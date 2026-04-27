import { describe, expect, it } from 'vitest';
import { DEFAULT_MEATS } from '../constants/meats';
import type { MeatLogEntry } from '../domain/log';
import type { ChurrascoSessionState } from '../domain/session';
import {
  type SidebarLeafNode,
  type SidebarNode,
  buildSidebarSections,
} from './buildSidebarSections';

const FROZEN_NOW = Date.parse('2026-04-27T01:00:00.000Z');

function makeState(overrides: Partial<ChurrascoSessionState> = {}): ChurrascoSessionState {
  return {
    status: 'stopped',
    startedAt: null,
    lastTickAt: null,
    nextArrivalAt: null,
    currentMeatId: null,
    satiety: 0,
    today: '2026-04-27',
    meatDeck: [],
    lastServedMeatId: null,
    ...overrides,
  };
}

function entry(
  action: MeatLogEntry['action'],
  meatId: string,
  createdAt: string,
  id: string,
): MeatLogEntry {
  return {
    id,
    meatId,
    action,
    createdAt,
    satietyDelta: action === 'eaten' ? 10 : 0,
  };
}

function findSection(nodes: SidebarNode[], id: 'status' | 'today' | 'collection'): SidebarNode {
  const section = nodes.find((n) => n.kind === 'section' && n.id === id);
  if (!section || section.kind !== 'section') {
    throw new Error(`section ${id} not found`);
  }
  return section;
}

function leafLabels(node: SidebarNode): string[] {
  if (node.kind !== 'section') {
    throw new Error('expected section');
  }
  return node.children.map((child) => {
    if (child.kind !== 'leaf') {
      throw new Error('nested sections are not allowed in v0.1');
    }
    return child.label;
  });
}

function leaves(node: SidebarNode): SidebarLeafNode[] {
  if (node.kind !== 'section') {
    throw new Error('expected section');
  }
  return node.children.map((child) => {
    if (child.kind !== 'leaf') {
      throw new Error('nested sections are not allowed in v0.1');
    }
    return child;
  });
}

describe('buildSidebarSections', () => {
  it('returns three top-level sections in fixed order', () => {
    const nodes = buildSidebarSections({
      state: makeState(),
      now: FROZEN_NOW,
      todayLog: [],
      lifetime: { perMeatEncounter: {}, eaten: 0 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    expect(nodes.map((n) => (n.kind === 'section' ? n.id : null))).toEqual([
      'status',
      'today',
      'collection',
    ]);
  });

  it('renders the stopped status with no countdown', () => {
    const nodes = buildSidebarSections({
      state: makeState({ status: 'stopped', satiety: 0 }),
      now: FROZEN_NOW,
      todayLog: [],
      lifetime: { perMeatEncounter: {}, eaten: 0 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    const labels = leafLabels(findSection(nodes, 'status'));
    expect(labels).toContain('🛑 Stopped');
    expect(labels.some((l) => l.startsWith('⏱'))).toBe(false);
    expect(labels).toContain('😋 Satiety 0%');
  });

  it('renders the running status with a countdown to the next meat', () => {
    const nextArrivalAt = new Date(FROZEN_NOW + 3 * 60_000 + 42_000).toISOString();
    const nodes = buildSidebarSections({
      state: makeState({ status: 'running', satiety: 40, nextArrivalAt }),
      now: FROZEN_NOW,
      todayLog: [],
      lifetime: { perMeatEncounter: {}, eaten: 0 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    const labels = leafLabels(findSection(nodes, 'status'));
    expect(labels).toContain('🟢 Open');
    expect(labels).toContain('⏱ Next meat in 03:42');
    expect(labels).toContain('😋 Satiety 40%');
  });

  it('renders the meatArrived status with the meat name', () => {
    const nodes = buildSidebarSections({
      state: makeState({
        status: 'meatArrived',
        currentMeatId: 'picanha',
        satiety: 0,
      }),
      now: FROZEN_NOW,
      todayLog: [],
      lifetime: { perMeatEncounter: {}, eaten: 0 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    const labels = leafLabels(findSection(nodes, 'status'));
    expect(labels).toContain('🍖 Picanha has arrived');
  });

  it('renders the paused status', () => {
    const nodes = buildSidebarSections({
      state: makeState({
        status: 'paused',
        nextArrivalAt: new Date(FROZEN_NOW + 60_000).toISOString(),
      }),
      now: FROZEN_NOW,
      todayLog: [],
      lifetime: { perMeatEncounter: {}, eaten: 0 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    const labels = leafLabels(findSection(nodes, 'status'));
    expect(labels).toContain('⏸ Paused');
  });

  it('renders the full status without a countdown', () => {
    const nodes = buildSidebarSections({
      state: makeState({ status: 'full', satiety: 100 }),
      now: FROZEN_NOW,
      todayLog: [],
      lifetime: { perMeatEncounter: {}, eaten: 0 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    const labels = leafLabels(findSection(nodes, 'status'));
    expect(labels).toContain('🍖 Full');
    expect(labels.some((l) => l.startsWith('⏱'))).toBe(false);
    expect(labels).toContain('😋 Satiety 100%');
  });

  it('shows a placeholder leaf when today log is empty', () => {
    const nodes = buildSidebarSections({
      state: makeState(),
      now: FROZEN_NOW,
      todayLog: [],
      lifetime: { perMeatEncounter: {}, eaten: 0 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    const labels = leafLabels(findSection(nodes, 'today'));
    expect(labels).toEqual(['No meats logged yet.']);
  });

  it('renders today log entries chronologically with HH:mm and action emoji', () => {
    const nodes = buildSidebarSections({
      state: makeState(),
      now: FROZEN_NOW,
      todayLog: [
        entry('eaten', 'picanha', '2026-04-27T01:00:00.000Z', 'l1'),
        entry('passed', 'alcatra', '2026-04-27T01:10:00.000Z', 'l2'),
        entry('cooled', 'fraldinha', '2026-04-27T01:20:00.000Z', 'l3'),
      ],
      lifetime: { perMeatEncounter: {}, eaten: 1 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    const labels = leafLabels(findSection(nodes, 'today'));
    expect(labels).toEqual(['01:00 ✅ Picanha', '01:10 ⏭ Alcatra', '01:20 🥶 Fraldinha']);
  });

  it('falls back to "Unknown meat (id)" for an unknown meatId in today log', () => {
    const nodes = buildSidebarSections({
      state: makeState(),
      now: FROZEN_NOW,
      todayLog: [entry('eaten', 'gone', '2026-04-27T05:00:00.000Z', 'l1')],
      lifetime: { perMeatEncounter: {}, eaten: 1 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    const labels = leafLabels(findSection(nodes, 'today'));
    expect(labels).toEqual(['05:00 ✅ Unknown meat (gone)']);
  });

  it('renders meat collection with encounter counts and a not-yet placeholder', () => {
    const nodes = buildSidebarSections({
      state: makeState(),
      now: FROZEN_NOW,
      todayLog: [],
      lifetime: { perMeatEncounter: { picanha: 3, costela: 1 }, eaten: 4 },
      maxSatiety: 100,
      meats: DEFAULT_MEATS,
    });
    const collection = leaves(findSection(nodes, 'collection'));
    expect(collection).toHaveLength(DEFAULT_MEATS.length);
    const picanha = collection.find((n) => n.label === 'Picanha');
    expect(picanha?.description).toBe('x3');
    const coracao = collection.find((n) => n.label === 'Coracao');
    expect(coracao?.description).toBe('not yet encountered');
  });
});
