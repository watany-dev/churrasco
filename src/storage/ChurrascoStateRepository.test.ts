import { describe, expect, it, vi } from 'vitest';
import type { Memento } from 'vscode';
import { ChurrascoStateRepository } from './ChurrascoStateRepository';
import { STORAGE_KEY, createInitialSnapshot } from './PersistedSnapshot';

class FakeMemento implements Memento {
  private store = new Map<string, unknown>();

  keys(): readonly string[] {
    return [...this.store.keys()];
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.store.has(key) ? (this.store.get(key) as T) : defaultValue) as T | undefined;
  }

  update(key: string, value: unknown): Thenable<void> {
    if (value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
    return Promise.resolve();
  }
}

const TODAY = '2026-04-27';

describe('ChurrascoStateRepository', () => {
  describe('load', () => {
    it('returns the initial snapshot when storage is empty', () => {
      const memento = new FakeMemento();
      const repo = new ChurrascoStateRepository(memento, () => TODAY);
      const snap = repo.load();
      expect(snap).toEqual(createInitialSnapshot(TODAY));
    });

    it('round-trips a saved snapshot', () => {
      const memento = new FakeMemento();
      const repo = new ChurrascoStateRepository(memento, () => TODAY);
      const snap = createInitialSnapshot(TODAY);
      snap.session.satiety = 42;
      snap.todayLog.push({
        id: 'l1',
        meatId: 'picanha',
        action: 'eaten',
        createdAt: '2026-04-27T10:00:00.000Z',
        satietyDelta: 12,
      });
      snap.lifetime.eaten = 5;
      snap.lifetime.perMeatEncounter.picanha = 3;
      repo.save(snap);
      const reloaded = repo.load();
      expect(reloaded).toEqual(snap);
    });

    it('returns the initial snapshot and warns when the schema version mismatches', () => {
      const memento = new FakeMemento();
      void memento.update(STORAGE_KEY, { schemaVersion: 99, session: {} });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const repo = new ChurrascoStateRepository(memento, () => TODAY);
      const snap = repo.load();
      expect(snap).toEqual(createInitialSnapshot(TODAY));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('returns the initial snapshot when stored value is not an object', () => {
      const memento = new FakeMemento();
      void memento.update(STORAGE_KEY, 'not-an-object');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const repo = new ChurrascoStateRepository(memento, () => TODAY);
      expect(repo.load()).toEqual(createInitialSnapshot(TODAY));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('returns the initial snapshot when shape is invalid (missing fields)', () => {
      const memento = new FakeMemento();
      void memento.update(STORAGE_KEY, { schemaVersion: 1 });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const repo = new ChurrascoStateRepository(memento, () => TODAY);
      expect(repo.load()).toEqual(createInitialSnapshot(TODAY));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('drops unknown meatId from meatDeck and keeps known entries', () => {
      const memento = new FakeMemento();
      const snap = createInitialSnapshot(TODAY);
      snap.session.meatDeck = ['picanha', 'unknown-meat', 'alcatra'];
      void memento.update(STORAGE_KEY, snap);
      const repo = new ChurrascoStateRepository(memento, () => TODAY, ['picanha', 'alcatra']);
      const reloaded = repo.load();
      expect(reloaded.session.meatDeck).toEqual(['picanha', 'alcatra']);
    });

    it('keeps unknown meatId in todayLog (past-log meaning preserved)', () => {
      const memento = new FakeMemento();
      const snap = createInitialSnapshot(TODAY);
      snap.todayLog.push({
        id: 'l1',
        meatId: 'gone',
        action: 'eaten',
        createdAt: '2026-04-27T10:00:00.000Z',
        satietyDelta: 5,
      });
      void memento.update(STORAGE_KEY, snap);
      const repo = new ChurrascoStateRepository(memento, () => TODAY, ['picanha']);
      const reloaded = repo.load();
      expect(reloaded.todayLog).toHaveLength(1);
      expect(reloaded.todayLog[0]?.meatId).toBe('gone');
    });
  });

  describe('save', () => {
    it('persists the snapshot under the canonical storage key', () => {
      const memento = new FakeMemento();
      const repo = new ChurrascoStateRepository(memento, () => TODAY);
      const snap = createInitialSnapshot(TODAY);
      snap.session.satiety = 20;
      repo.save(snap);
      expect(memento.get(STORAGE_KEY)).toEqual(snap);
    });
  });

  describe('reset', () => {
    it('removes the persisted state entirely', () => {
      const memento = new FakeMemento();
      const repo = new ChurrascoStateRepository(memento, () => TODAY);
      repo.save(createInitialSnapshot(TODAY));
      repo.reset();
      expect(memento.get(STORAGE_KEY)).toBeUndefined();
    });
  });
});
