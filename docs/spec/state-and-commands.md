# State, Commands, and Settings

> **Note on language:** the command titles below are documented in English. Whether v0.1 ships those titles in English, Japanese, or both in the actual `package.json` is a separate decision; see [`docs/packaging.md`](../packaging.md) for the concrete contribution.

## Session state

```ts
export type SessionStatus = 'stopped' | 'running' | 'paused' | 'meatArrived' | 'full';

export interface ChurrascoSessionState {
  status: SessionStatus;
  startedAt: string | null;
  lastTickAt: string | null;
  nextArrivalAt: string | null;
  currentMeatId: string | null;
  satiety: number;
  today: string;
  meatDeck: string[];
  lastServedMeatId: string | null;
}
```

## Meat log

```ts
export type MeatLogAction = 'eaten' | 'passed' | 'cooled';

export interface MeatLogEntry {
  id: string;
  meatId: string;
  action: MeatLogAction;
  createdAt: string;
  satietyDelta: number;
}
```

## Persistence

v0.1 uses `ExtensionContext.globalState` as the single backing store. Decision rationale and alternatives are recorded in [ADR-0007](../adr/0007-persistence-layer.md).

### Storage key

`churrasco.state.v1` — a single JSON-serialized `PersistedSnapshot`.

### `PersistedSnapshot`

```ts
export interface PersistedSnapshot {
  schemaVersion: 1;
  session: {
    today: string;            // YYYY-MM-DD
    satiety: number;
    meatDeck: string[];
    lastServedMeatId: string | null;
  };
  todayLog: MeatLogEntry[];
  lifetime: {
    perMeatEncounter: Record<string, number>;
    eaten: number;
  };
  lastLaunchDate: string;     // YYYY-MM-DD
}
```

`MeatLogEntry` is defined above (Meat log §). It is referenced here, not redefined.

### Volatile fields (NOT persisted)

`status`, `startedAt`, `lastTickAt`, `nextArrivalAt`, `currentMeatId`. The session always starts in `stopped` after activation; `nextArrivalAt` is therefore never restored, which avoids a stale-arrival firing immediately after PC sleep / restart (ADR-0007 §D8).

### Load on activate

```text
const snap = repository.load();              // initial snapshot on parse / shape error
if (snap.lastLaunchDate !== today()) {        // date rollover
  snap.todayLog = [];
  snap.session.satiety = 0;
  snap.session.today = today();
}
// snap.session is wired into the session service as initial state.
```

### Save timing

Every `onStateChange` and `onMeatLogged` event triggers `repository.save(...)` as fire-and-forget. The returned `Thenable<void>` from `globalState.update` is not awaited; write failures surface in the Output channel per VS Code conventions (ADR-0007 §D4).

### Date rollover

`todayLog`, `session.satiety`, and `session.today` reset **on the next activate** after the date changes between launches. The `lifetime` collection is preserved across rollovers. In-tick 24:00 detection is out of scope for v0.1 (ADR-0007 §D6).

### Fallback on corruption

- JSON parse error or shape violation → full reset to the initial snapshot, plus `console.warn`.
- Unknown `meatId` in `meatDeck` → drop the entry; an empty deck recovers via the next `drawNext` refill.
- Unknown `meatId` in `todayLog` → keep the entry (past-log meaning is preserved). Display fallback for unknown meats is the UI's concern.

## Today log and satiety

Behavior split between `SatietyService` (pure functions) and `TodayLogService` (stateful aggregator). Decision rationale and alternatives are recorded in [ADR-0008](../adr/0008-today-log-and-satiety.md).

### `SatietyService`

```ts
export function applyEat(
  currentSatiety: number,
  meat: Meat,
  maxSatiety: number,
): { nextSatiety: number; isFull: boolean };
```

- `nextSatiety = currentSatiety + meat.satiety`.
- `isFull = nextSatiety >= maxSatiety` ([ADR-0003 §3](../adr/0003-session-and-timer-design.md)).
- No internal state. Defensive guards for non-finite / negative inputs are not added; the boundary `sanitize*` helpers in `src/constants/configuration.ts` are the single sanitization point ([ADR-0003 §7](../adr/0003-session-and-timer-design.md)).
- The decision to act on `isFull === true` (transition to `'full'` vs auto-stop to `'stopped'`) is owned by the session layer per the `autoStopWhenFull` setting; specifics are recorded separately (see Settings § below).

### `TodayLogService`

State held by the service:

```ts
{
  todayLog: MeatLogEntry[];
  lifetime: {
    perMeatEncounter: Record<string, number>;
    eaten: number;
  };
}
```

API:

- `recordEntry(entry: MeatLogEntry): void` — appends to `todayLog`. If `entry.action === 'eaten'`, also increments `lifetime.eaten`. The two side effects are intentionally fused into one API to preserve atomicity ([ADR-0008 §D8](../adr/0008-today-log-and-satiety.md)).
- `recordEncounter(meatId: string): void` — increments `lifetime.perMeatEncounter[meatId]`. Called when a meat is served, regardless of `enableNotifications` ([ADR-0008 §D7](../adr/0008-today-log-and-satiety.md)).
- `resetToday(): void` — clears `todayLog` only; `lifetime` is preserved. Used both by the date rollover wiring and by the `churrasco.resetToday` command.
- `get todayLog(): readonly MeatLogEntry[]` and `get lifetime(): Readonly<...>` — read access.
- `onChange: Event<void>` — single notification point for persistence and UI subscribers.

The constructor takes `initialState: { todayLog, lifetime }` derived from `PersistedSnapshot` after the date-rollover transformation. The service itself does not detect date changes ([ADR-0008 §D10](../adr/0008-today-log-and-satiety.md)).

### Wiring

`extension.ts` is the only module that knows about both services. It bridges:

- `ChurrascoSessionService.onMeatLogged` → `TodayLogService.recordEntry`
- `ChurrascoSessionService.onMeatServed` → `TodayLogService.recordEncounter` (where `onMeatServed: Event<{ meatId: string; servedAt: string }>` is fired by `ChurrascoSessionService.tick()` at the `meatArrived` transition edge)
- `ChurrascoSessionService.onStateChange` ∪ `TodayLogService.onChange` → pull current state from both services, build a `PersistedSnapshot`, call `repository.save(snapshot)` fire-and-forget ([ADR-0008 §D9](../adr/0008-today-log-and-satiety.md)).

The reverse direction (`TodayLogService` → `ChurrascoSessionService`) is not wired. `ChurrascoSessionService` does not import `TodayLogService`.

## Commands

### Catalog

```json
{
  "commands": [
    { "command": "churrasco.startSession",   "title": "Churrasco: Start Service" },
    { "command": "churrasco.stopSession",    "title": "Churrasco: End Service" },
    { "command": "churrasco.pauseSession",   "title": "Churrasco: Pause" },
    { "command": "churrasco.eatCurrentMeat", "title": "Churrasco: Eat Current Meat" },
    { "command": "churrasco.passCurrentMeat","title": "Churrasco: Pass Current Meat" },
    { "command": "churrasco.showTodayLog",   "title": "Churrasco: Show Today's Log" },
    { "command": "churrasco.openMenu",       "title": "Churrasco: Open Menu" },
    { "command": "churrasco.resetToday",     "title": "Churrasco: Reset Today's Log" }
  ]
}
```

### Behavior

#### `churrasco.startSession`

- From `stopped`: set `status` to `running`, set `startedAt` to `now`, set `nextArrivalAt` to `now + intervalMinutes`, snapshot `today` to today's date, and refresh the status bar.
- From `paused`: resume by setting `status` to `running` while keeping `nextArrivalAt`. There is no separate resume command — `startSession` is the only entry back into `running` from `paused` ([ADR-0003 §4](../adr/0003-session-and-timer-design.md)).
- From `running`, `meatArrived`, or `full`: no-op.

#### `churrasco.stopSession`

- Set `status` to `stopped`.
- Set `currentMeatId` to `null`.
- Set `nextArrivalAt` to `null`.
- The end-of-session summary is shown by `EndOfSessionSummaryController` on the `(running | paused | meatArrived | full) → stopped` transition edge ([ADR-0009 §D2](../adr/0009-today-summary-and-auto-stop.md)). The service itself does not invoke `window.*`.
- A `stopped → stopped` invocation is suppressed by the shallow-equal guard so the summary edge does not fire ([ADR-0003 §5](../adr/0003-session-and-timer-design.md)).

#### `churrasco.pauseSession`

- From `running`: set `status` to `paused`, keep `nextArrivalAt`, show "paused" in the status bar. The internal tick keeps running but skips arrivals while paused.
- From any other state: no-op.

#### `churrasco.eatCurrentMeat`

- Run only if there is a `currentMeatId`.
- Append an `eaten` entry to the meat log.
- Add `meat.satiety` to `satiety` via [`SatietyService.applyEat`](../adr/0008-today-log-and-satiety.md).
- Set `currentMeatId` to `null`.
- If `isFull` (`satiety >= maxSatiety`):
  - When `autoStopWhenFull` is `true`: transition directly to `'stopped'` (skipping `'full'`), set `nextArrivalAt` to `null`, and stop the timer ([ADR-0009 §D6](../adr/0009-today-summary-and-auto-stop.md)). The summary fires via the same edge as a manual stop.
  - When `autoStopWhenFull` is `false`: set `status` to `'full'` and stop the timer; the user remains in `'full'` until they manually invoke `stopSession` ([ADR-0009 §D7](../adr/0009-today-summary-and-auto-stop.md)).
- Otherwise set `nextArrivalAt` to `now + intervalMinutes`.

#### `churrasco.passCurrentMeat`

- Run only if there is a `currentMeatId`.
- Append a `passed` entry to the meat log.
- `satiety` does not change.
- Set `currentMeatId` to `null`.
- Set `nextArrivalAt` to `now + intervalMinutes`.

#### `churrasco.showTodayLog`

- Render today's log via the pure `formatTodayLog` formatter and display it through `window.showInformationMessage` ([ADR-0009 §D8](../adr/0009-today-summary-and-auto-stop.md)).
- The displayed content follows the example in [`docs/spec/ui.md` §Today's meat log](ui.md). v0.1 does not use a Webview or Quick Pick for this command.

#### `churrasco.resetToday`

- Show a confirmation modal (`window.showWarningMessage(..., { modal: true }, 'Reset')`) before any state mutation ([ADR-0009 §D9](../adr/0009-today-summary-and-auto-stop.md)).
- On `Reset`: invoke `TodayLogService.resetToday()`, which clears `todayLog` only. `lifetime` is preserved ([ADR-0008 §D4](../adr/0008-today-log-and-satiety.md)).
- On `Cancel` or modal dismissal: no-op.

## Settings

```json
{
  "churrasco.intervalMinutes": 10,
  "churrasco.enableNotifications": true,
  "churrasco.showStatusBar": true,
  "churrasco.pauseWhenInactive": false,
  "churrasco.maxSatiety": 100,
  "churrasco.autoStopWhenFull": true,
  "churrasco.locale": "ja"
}
```

### `churrasco.intervalMinutes`

Interval between meat arrivals, in minutes. Default `10`. During development and testing this can be set to `1` or `0.1`.

The value is sanitized at the extension boundary by `sanitizeInterval` in `src/constants/configuration.ts`: any non-finite, zero, negative, or non-numeric value (e.g. user edits in `settings.json` that bypass the JSON schema) falls back to `DEFAULT_INTERVAL_MINUTES` (`10`). The session service itself assumes a positive finite number and carries no defensive guard ([ADR-0003 §7](../adr/0003-session-and-timer-design.md)).

The setting is read as a snapshot on each `startSession`. Reactivity to `workspace.onDidChangeConfiguration` for `intervalMinutes` is not wired ([ADR-0005 §8](../adr/0005-notifications-and-meat-actions-design.md), reaffirming [ADR-0004 §3](../adr/0004-statusbar-and-quickpick-design.md)) because mid-session interval changes require deciding how to recompute `nextArrivalAt`, and ADR-0005 §1 expanded the meaning of `nextArrivalAt` to also drive the cooled tick. `churrasco.showStatusBar` is wired reactively; ADR-0005 §5 keeps `enableNotifications` snapshotted at the meat-arrival edge instead of reactive.

### `churrasco.enableNotifications`

When `true`, show a notification on meat arrival. When `false`, only the status bar and sidebar update. Sanitized via `sanitizeBoolean` in `src/constants/configuration.ts`. Read as a snapshot at the `running → meatArrived` edge by `NotificationController` ([ADR-0005 §5](../adr/0005-notifications-and-meat-actions-design.md)); not wired to `onDidChangeConfiguration`.

### `churrasco.showStatusBar`

When `true`, show the status bar item. When `false`, drive the extension via commands and the sidebar only.

### `churrasco.pauseWhenInactive`

In v0.1 the setting is registered but the implementation is optional. Properly auto-pausing during VS Code idle (to avoid a backlog of arrivals) is not implemented.

### `churrasco.maxSatiety`

Maximum value of satiety. Default `100`.

### `churrasco.autoStopWhenFull`

When `true`, the session transitions directly from `'running'` to `'stopped'` (skipping `'full'`) the moment `satiety >= maxSatiety` is reached during an `eat()` call. The end-of-session summary fires through the standard `(running | paused | meatArrived | full) → stopped` edge ([ADR-0009 §D2 / §D6](../adr/0009-today-summary-and-auto-stop.md)).

When `false`, the session enters `'full'` and waits for the user to invoke `stopSession` manually ([ADR-0009 §D7](../adr/0009-today-summary-and-auto-stop.md)). The `'full'` state is therefore reachable only under `autoStopWhenFull=false`.

Sanitized via `sanitizeBoolean` in `src/constants/configuration.ts`. Read as a snapshot inside `ChurrascoSessionService.eat()`; not wired to `onDidChangeConfiguration`.

### `churrasco.locale`

Display language. v0.1 officially supports `ja` only.
