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

v0.1 uses `ExtensionContext.globalState`.

What we persist:

- Session state.
- Today's meat log.
- Lifetime per-meat encounter count.
- Lifetime eaten count.
- Last launch date.

When the date changes:

- Today's log is reset.
- Lifetime collection is preserved.
- The session starts in `stopped`.

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
- Show the end-of-session summary (M5).
- A `stopped → stopped` invocation is suppressed by the shallow-equal guard so it does not re-emit the summary ([ADR-0003 §5](../adr/0003-session-and-timer-design.md)).

#### `churrasco.pauseSession`

- From `running`: set `status` to `paused`, keep `nextArrivalAt`, show "paused" in the status bar. The internal tick keeps running but skips arrivals while paused.
- From any other state: no-op.

#### `churrasco.eatCurrentMeat`

- Run only if there is a `currentMeatId`.
- Append an `eaten` entry to the meat log.
- Add `meat.satiety` to `satiety`.
- Set `currentMeatId` to `null`.
- If `satiety >= maxSatiety`, set `status` to `full`.
- Otherwise set `nextArrivalAt` to `now + intervalMinutes`.

#### `churrasco.passCurrentMeat`

- Run only if there is a `currentMeatId`.
- Append a `passed` entry to the meat log.
- `satiety` does not change.
- Set `currentMeatId` to `null`.
- Set `nextArrivalAt` to `now + intervalMinutes`.

#### `churrasco.showTodayLog`

- Show today's log via an information message or Quick Pick.
- v0.1 does not use a Webview.

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

The setting is read as a snapshot on each `startSession`. Reactivity to `workspace.onDidChangeConfiguration` is deferred to M3 when the status-bar countdown lands.

### `churrasco.enableNotifications`

When `true`, show a notification on meat arrival. When `false`, only the status bar and sidebar update.

### `churrasco.showStatusBar`

When `true`, show the status bar item. When `false`, drive the extension via commands and the sidebar only.

### `churrasco.pauseWhenInactive`

In v0.1 the setting is registered but the implementation is optional. Properly auto-pausing during VS Code idle (to avoid a backlog of arrivals) is targeted for v0.2+.

### `churrasco.maxSatiety`

Maximum value of satiety. Default `100`.

### `churrasco.autoStopWhenFull`

When `true`, end the session automatically once `satiety >= maxSatiety`.

### `churrasco.locale`

Display language. v0.1 officially supports `ja` only.
