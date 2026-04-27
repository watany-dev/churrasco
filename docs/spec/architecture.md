# Architecture

## Tech stack

```text
Language:
  TypeScript

Runtime:
  Node.js 24 LTS (engines.node >=24)
  VS Code Extension Host

Package manager:
  pnpm (pinned via Corepack and the packageManager field)

VS Code APIs:
  StatusBarItem
  window.showInformationMessage
  window.showQuickPick
  TreeView / TreeDataProvider
  commands.registerCommand
  ExtensionContext.globalState
  workspace.getConfiguration

Build:
  TypeScript Compiler (type-check only)
  esbuild (bundling)

Test:
  Vitest (pure logic / unit)
  @vscode/test-cli + @vscode/test-electron (Extension Host integration)

Quality:
  Biome (lint + format + import sort)
  knip (unused files / exports / dependencies)

Commits:
  Conventional Commits, enforced via commitlint in CI

Packaging:
  @vscode/vsce

CI / Automation:
  GitHub Actions (ci.yml, commitlint.yml, security-scan.yml, codeql.yml)
  actionlint + zizmor (workflow static analysis, security-scan.yml)
  CodeQL (JavaScript/TypeScript SAST, codeql.yml)
  Dependabot (npm, github-actions)

State storage:
  ExtensionContext.globalState

UI:
  Native VS Code UI only in v0.1
  Webview is out of scope for v0.1
```

### Why these choices

#### TypeScript

VS Code extensions target a JavaScript API; we want type safety on `extension.ts`, the state shape, the meat data, and `TreeDataProvider`.

#### VS Code Extension API

Status bar, notifications, Quick Pick, commands, Tree View, and `globalState` are all available directly — no external UI library is needed for the v0.1 experience.

#### esbuild

We bundle to keep activation and distribution lightweight. esbuild is small to configure and fits a v0.1-sized extension. The TypeScript compiler is used only for type-checking (`tsc --noEmit`); esbuild owns code generation.

#### Vitest + `@vscode/test-cli`

Pure logic — the meat draw, satiety calculation, log aggregation — is covered by **Vitest**. It is TS/ESM-native, ships with mocking and coverage out of the box, and makes the iteration cycle (`vitest`) fast enough to run while editing. Anything that needs a live Extension Host (command registration, `globalState` round-trips) is covered by `@vscode/test-cli` + `@vscode/test-electron` only. Vitest tests live colocated with the implementation as `src/**/*.test.ts` (excluding `src/test/**`), and `@vscode/test-cli` tests live under `src/test/**/*.test.ts`.

#### Biome

Biome handles linting, formatting, and import sorting in a single Rust binary. It replaces an ESLint + Prettier + `eslint-plugin-import` setup with one config file and a single CI check (`biome ci .`). The rule set in `biome.json` is recommended + a strict overlay (no unused imports, no `any`, prefer `const`, `useImportType`).

#### knip

Detects unused files, exports, and dependencies across the project. It complements Biome's per-file rules with whole-graph analysis and runs as part of the `quality` job in CI.

#### pnpm + Corepack

`pnpm` is pinned through the `packageManager` field and activated via Corepack so every contributor and CI runner uses the same version. Lockfile is `pnpm-lock.yaml` and `--frozen-lockfile` is enforced in CI.

#### `globalState`

The data we save in v0.1 is a small JSON-shaped state. We do not need a database or file-based store.

#### Why no Webview in v0.1

A Webview is expressive but adds HTML/CSS/JS, message passing, security configuration, and state synchronization. v0.1 prioritizes the core loop — "a different meat every 10 minutes; eat or pass."

## Recommended directory layout

```text
churrasco-break/
  .vscode/
    launch.json
    tasks.json
  src/
    extension.ts
    extension.test.ts                — Vitest, mocks `vscode`
    constants/
      meats.ts
      meats.test.ts
      commands.ts
      configuration.ts
      configuration.test.ts
    domain/
      meat.ts
      session.ts
      log.ts
    services/
      ChurrascoSessionService.ts
      ChurrascoSessionService.test.ts
      MeatDeckService.ts
      MeatDeckService.test.ts
      SatietyService.ts
      SatietyService.test.ts
      TodayLogService.ts
      TodayLogService.test.ts
    storage/
      ChurrascoStateRepository.ts
      PersistedSnapshot.ts
      dateRollover.ts
    ui/
      StatusBarController.ts
      NotificationController.ts
      QuickPickController.ts
      EndOfSessionSummaryController.ts
      formatStatusBar.ts
      formatTodayLog.ts
      formatEndOfSessionSummary.ts
    views/
      ChurrascoTreeDataProvider.ts
      ChurrascoTreeItem.ts
    test/
      extension.test.ts              — @vscode/test-cli, runs in an Extension Host
  package.json
  tsconfig.json
  esbuild.js
  README.md
```

Vitest tests are colocated with their implementation file using the `*.test.ts` suffix (`vitest.config.ts` picks up `src/**/*.test.ts` while excluding `src/test/**`). `@vscode/test-cli` tests live exclusively under `src/test/**/*.test.ts` and are compiled separately via `tsconfig.test.json` to `out/test/**/*.js` for the Extension Host.

## Module responsibilities

### `extension.ts`

Wiring only.

Does:

- Read configuration.
- Construct the repository.
- Construct services.
- Construct UI controllers.
- Register commands.
- Register the `TreeDataProvider`.
- Dispose the timer on `deactivate`.

Does **not**:

- Run the meat draw.
- Compute satiety.
- Generate notification text.
- Aggregate today's log.

### `ChurrascoSessionService`

- Start a session (from `stopped` or as a resume from `paused`).
- Stop a session.
- Pause.
- Handle the timer tick.
- Handle a meat arrival.
- Handle eat.
- Handle pass.

Implements `vscode.Disposable` so it can be pushed into `ExtensionContext.subscriptions` to ensure the timer and `EventEmitter` are torn down on `deactivate`. Exposes three events for subscribers: `onStateChange: Event<ChurrascoSessionState>` (consumed by `StatusBarController`, `NotificationController`, `EndOfSessionSummaryController`, and the persistence wiring in `extension.ts`), `onMeatLogged: Event<MeatLogEntry>` (forwarded to `TodayLogService.recordEntry`), and `onMeatServed: Event<{ meatId; servedAt }>` (forwarded to `TodayLogService.recordEncounter` at the `meatArrived` transition edge). Accepts an optional constructor `initialState` so the persisted snapshot's `satiety` / `today` / `meatDeck` / `lastServedMeatId` can be seeded at activation. See [ADR-0003](../adr/0003-session-and-timer-design.md) for the command boundary semantics, idempotency guard, and configuration handling, and [ADR-0008](../adr/0008-today-log-and-satiety.md) / [ADR-0009](../adr/0009-today-summary-and-auto-stop.md) for the M5 events and `autoStopWhenFull` branch.

### `MeatDeckService`

- Shuffle the meat list.
- Draw the next meat.
- Refill the deck.
- Avoid back-to-back duplicates across refills.

### `SatietyService`

- Compute the next satiety value after eating a meat.
- Return whether the new value reaches `maxSatiety`.

Pure-function module (no internal state). The session layer owns the current satiety value and consumes only the computed result. Boundary `sanitize*` helpers in `src/constants/configuration.ts` are the single sanitization point; `applyEat` carries no defensive guards. See [ADR-0008](../adr/0008-today-log-and-satiety.md).

### `TodayLogService`

- Hold today's `MeatLogEntry[]`.
- Hold lifetime aggregates: `perMeatEncounter` and `eaten` counters.
- Append entries (`recordEntry`) and increment encounters (`recordEncounter`).
- Reset today's log on date rollover or via the `churrasco.resetToday` command.
- Expose `onChange: Event<void>` for persistence and UI subscribers.

Stateful service constructed with `initialState` from `PersistedSnapshot`. Subscribes (via `extension.ts` wiring) to `ChurrascoSessionService.onMeatLogged` and `ChurrascoSessionService.onMeatServed`. Does not import `ChurrascoSessionService` directly. See [ADR-0008](../adr/0008-today-log-and-satiety.md).

### `ChurrascoStateRepository`

- Wrap `ExtensionContext.globalState` behind a `load` / `save` / `reset` API.
- Read and write a single `PersistedSnapshot` under the canonical storage key.
- Reject mismatched `schemaVersion`, malformed shapes, and non-object payloads, falling back to the initial snapshot with a `console.warn` (no modal).
- Sanitize unknown `meatId` values out of `meatDeck` / `lastServedMeatId` while preserving past entries in `todayLog`.
- The `applyDateRollover` pure helper, applied by `extension.ts` immediately after `load()`, resets `todayLog` / `session.satiety` / `session.today` while preserving `lifetime` and the meat deck across launches.

See [ADR-0007](../adr/0007-persistence-layer.md).

### `StatusBarController`

- Create the status bar item.
- Update `text` / `tooltip` / `command` based on session state.
- Dispose.

### `NotificationController`

- Show the meat-arrival notification.
- Forward the user's choice to the appropriate command or service.
- No-op when notifications are disabled.

### `EndOfSessionSummaryController`

- Subscribe to `ChurrascoSessionService.onStateChange`.
- On the `(running | paused | meatArrived | full) → stopped` transition edge, pull `todayLog` / `lifetime` from `TodayLogService` and `satiety` from the session, format via the pure `formatEndOfSessionSummary`, and display through a non-modal `window.showInformationMessage`.

Independent from `NotificationController` (different edge, different responsibility). See [ADR-0009](../adr/0009-today-summary-and-auto-stop.md).

### `ChurrascoTreeDataProvider`

- Implements `TreeDataProvider<ChurrascoTreeItem>` and `Disposable`.
- Renders three top-level sections — service status, today's meats, meat collection — by delegating layout to the pure `buildSidebarSections` function.
- Subscribes to `ChurrascoSessionService.onStateChange` and `TodayLogService.onChange`; either event re-fires `onDidChangeTreeData(undefined)` to refresh the whole tree.
- While the session status is `running`, ensures a 1Hz refresh interval to keep the countdown leaf in sync; clears the interval when the status leaves `running`.
- Disposes the interval, subscriptions, and emitter on `dispose()`.

See [ADR-0010](../adr/0010-sidebar-tree-view-design.md).

### `buildSidebarSections`

Pure function (`vscode`-independent) that converts the session state, today log, lifetime aggregates, satiety, and meat catalog into a `SidebarNode[]` tree. The provider maps each node to a `ChurrascoTreeItem`. Vitest covers status / today / collection rendering, including unknown-`meatId` fallback.

### `ChurrascoTreeItem`

`vscode.TreeItem` subclass that wraps a `SidebarNode`. Sections are constructed with `Expanded` collapsible state; leaves with `None`. Section nodes carry their `children: SidebarNode[]` so the provider can resolve `getChildren(parent)` without re-running `buildSidebarSections`.
