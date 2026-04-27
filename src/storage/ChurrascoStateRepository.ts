import type { Memento } from 'vscode';
import type { MeatLogAction, MeatLogEntry } from '../domain/log';
import {
  type PersistedSnapshot,
  SCHEMA_VERSION,
  STORAGE_KEY,
  createInitialSnapshot,
} from './PersistedSnapshot';

export class ChurrascoStateRepository {
  constructor(
    private readonly memento: Memento,
    private readonly today: () => string,
    private readonly knownMeatIds?: readonly string[],
  ) {}

  load(): PersistedSnapshot {
    const raw = this.memento.get<unknown>(STORAGE_KEY);
    if (raw === undefined) {
      return createInitialSnapshot(this.today());
    }
    const parsed = this.tryParse(raw);
    if (parsed === null) {
      return createInitialSnapshot(this.today());
    }
    return this.sanitize(parsed);
  }

  save(snapshot: PersistedSnapshot): void {
    void this.memento.update(STORAGE_KEY, snapshot);
  }

  reset(): void {
    void this.memento.update(STORAGE_KEY, undefined);
  }

  private tryParse(raw: unknown): PersistedSnapshot | null {
    if (!isPlainObject(raw)) {
      console.warn('[churrasco] Persisted state is not an object; resetting.');
      return null;
    }
    if (raw.schemaVersion !== SCHEMA_VERSION) {
      console.warn(
        `[churrasco] Persisted schemaVersion ${String(raw.schemaVersion)} does not match ${SCHEMA_VERSION}; resetting.`,
      );
      return null;
    }
    if (!isValidShape(raw)) {
      console.warn('[churrasco] Persisted state has invalid shape; resetting.');
      return null;
    }
    return raw as unknown as PersistedSnapshot;
  }

  private sanitize(snapshot: PersistedSnapshot): PersistedSnapshot {
    if (this.knownMeatIds === undefined) {
      return snapshot;
    }
    const known = new Set(this.knownMeatIds);
    return {
      ...snapshot,
      session: {
        ...snapshot.session,
        meatDeck: snapshot.session.meatDeck.filter((id) => known.has(id)),
        lastServedMeatId:
          snapshot.session.lastServedMeatId !== null && known.has(snapshot.session.lastServedMeatId)
            ? snapshot.session.lastServedMeatId
            : null,
      },
    };
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidShape(value: Record<string, unknown>): boolean {
  const session = value.session;
  if (!isPlainObject(session)) return false;
  if (typeof session.today !== 'string') return false;
  if (typeof session.satiety !== 'number') return false;
  if (!Array.isArray(session.meatDeck)) return false;
  if (session.lastServedMeatId !== null && typeof session.lastServedMeatId !== 'string') {
    return false;
  }
  if (!Array.isArray(value.todayLog)) return false;
  for (const entry of value.todayLog as unknown[]) {
    if (!isMeatLogEntry(entry)) return false;
  }
  const lifetime = value.lifetime;
  if (!isPlainObject(lifetime)) return false;
  if (!isPlainObject(lifetime.perMeatEncounter)) return false;
  if (typeof lifetime.eaten !== 'number') return false;
  if (typeof value.lastLaunchDate !== 'string') return false;
  return true;
}

function isMeatLogEntry(value: unknown): value is MeatLogEntry {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (typeof value.meatId !== 'string') return false;
  if (!isMeatLogAction(value.action)) return false;
  if (typeof value.createdAt !== 'string') return false;
  if (typeof value.satietyDelta !== 'number') return false;
  return true;
}

function isMeatLogAction(value: unknown): value is MeatLogAction {
  return value === 'eaten' || value === 'passed' || value === 'cooled';
}
