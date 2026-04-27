import type { MeatLogAction, MeatLogEntry } from '../domain/log';
import type { Meat } from '../domain/meat';
import type { ChurrascoSessionState } from '../domain/session';

export type SidebarSectionId = 'status' | 'today' | 'collection';

export interface SidebarLeafNode {
  kind: 'leaf';
  label: string;
  description?: string;
  iconId?: string;
}

export interface SidebarSectionNode {
  kind: 'section';
  id: SidebarSectionId;
  label: string;
  children: SidebarNode[];
}

export type SidebarNode = SidebarSectionNode | SidebarLeafNode;

interface BuildSidebarInput {
  state: ChurrascoSessionState;
  now: number;
  todayLog: readonly MeatLogEntry[];
  lifetime: { perMeatEncounter: Readonly<Record<string, number>>; eaten: number };
  maxSatiety: number;
  meats: readonly Meat[];
}

const ACTION_EMOJI: Record<MeatLogAction, string> = {
  eaten: '✅',
  passed: '⏭',
  cooled: '🥶',
};

export function buildSidebarSections(input: BuildSidebarInput): SidebarNode[] {
  return [
    {
      kind: 'section',
      id: 'status',
      label: 'Service status',
      children: buildStatusLeaves(input),
    },
    {
      kind: 'section',
      id: 'today',
      label: "Today's meats",
      children: buildTodayLeaves(input),
    },
    {
      kind: 'section',
      id: 'collection',
      label: 'Meat collection',
      children: buildCollectionLeaves(input),
    },
  ];
}

function buildStatusLeaves(input: BuildSidebarInput): SidebarLeafNode[] {
  const { state, now, maxSatiety, meats } = input;
  const leaves: SidebarLeafNode[] = [];
  leaves.push({ kind: 'leaf', label: formatStatusHeadline(state, meats) });
  if (state.status === 'running' || state.status === 'paused' || state.status === 'meatArrived') {
    leaves.push({
      kind: 'leaf',
      label: `⏱ Next meat in ${formatRemaining(state.nextArrivalAt, now)}`,
    });
  }
  leaves.push({
    kind: 'leaf',
    label: `😋 Satiety ${formatSatietyPercent(state.satiety, maxSatiety)}`,
  });
  return leaves;
}

function buildTodayLeaves(input: BuildSidebarInput): SidebarLeafNode[] {
  if (input.todayLog.length === 0) {
    return [{ kind: 'leaf', label: 'No meats logged yet.' }];
  }
  return input.todayLog.map((entry) => ({
    kind: 'leaf',
    label: `${formatTime(entry.createdAt)} ${ACTION_EMOJI[entry.action]} ${lookupMeatName(entry.meatId, input.meats)}`,
  }));
}

function buildCollectionLeaves(input: BuildSidebarInput): SidebarLeafNode[] {
  return input.meats.map((meat) => {
    const count = input.lifetime.perMeatEncounter[meat.id] ?? 0;
    return {
      kind: 'leaf',
      label: meat.nameEn,
      description: count > 0 ? `x${count}` : 'not yet encountered',
    };
  });
}

function formatStatusHeadline(state: ChurrascoSessionState, meats: readonly Meat[]): string {
  switch (state.status) {
    case 'stopped':
      return '🛑 Stopped';
    case 'running':
      return '🟢 Open';
    case 'paused':
      return '⏸ Paused';
    case 'meatArrived':
      return `🍖 ${lookupMeatName(state.currentMeatId, meats)} has arrived`;
    case 'full':
      return '🍖 Full';
  }
}

function formatRemaining(nextArrivalAt: string | null, now: number): string {
  if (nextArrivalAt === null) {
    return '00:00';
  }
  const remainingSec = Math.max(0, Math.ceil((Date.parse(nextArrivalAt) - now) / 1000));
  const mm = Math.floor(remainingSec / 60)
    .toString()
    .padStart(2, '0');
  const ss = (remainingSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatSatietyPercent(satiety: number, maxSatiety: number): string {
  const percent = Math.min(100, Math.round((satiety / maxSatiety) * 100));
  return `${percent}%`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function lookupMeatName(meatId: string | null, meats: readonly Meat[]): string {
  if (meatId === null) {
    return 'Unknown meat';
  }
  return meats.find((m) => m.id === meatId)?.nameEn ?? `Unknown meat (${meatId})`;
}
