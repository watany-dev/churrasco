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
  GitHub Actions (ci.yml, commitlint.yml)
  Dependabot (npm, github-actions)

State storage:
  ExtensionContext.globalState

UI:
  Native VS Code UI only in v0.1
  Webview is deferred to v0.2+
```

### Why these choices

#### TypeScript

VS Code extensions target a JavaScript API; we want type safety on `extension.ts`, the state shape, the meat data, and `TreeDataProvider`.

#### VS Code Extension API

Status bar, notifications, Quick Pick, commands, Tree View, and `globalState` are all available directly — no external UI library is needed for the v0.1 experience.

#### esbuild

We bundle to keep activation and distribution lightweight. esbuild is small to configure and fits a v0.1-sized extension. The TypeScript compiler is used only for type-checking (`tsc --noEmit`); esbuild owns code generation.

#### Vitest + `@vscode/test-cli`

Pure logic — the meat draw, satiety calculation, log aggregation — is covered by **Vitest**. It is TS/ESM-native, ships with mocking and coverage out of the box, and makes the iteration cycle (`vitest`) fast enough to run while editing. Anything that needs a live Extension Host (command registration, `globalState` round-trips) is covered by `@vscode/test-cli` + `@vscode/test-electron` only. The two suites live side-by-side: `src/**/*.test.ts` for Vitest, `src/test/**/*.test.ts` for `@vscode/test-cli`.

#### Biome

Biome handles linting, formatting, and import sorting in a single Rust binary. It replaces an ESLint + Prettier + `eslint-plugin-import` setup with one config file and a single CI check (`biome ci .`). The rule set in `biome.json` is recommended + a strict overlay (no unused imports, no `any`, prefer `const`, `useImportType`).

#### knip

Detects unused files, exports, and dependencies across the project. It complements Biome's per-file rules with whole-graph analysis and runs as part of the `quality` job in CI.

#### pnpm + Corepack

`pnpm` is pinned through the `packageManager` field and activated via Corepack so every contributor and CI runner uses the same version. Lockfile is `pnpm-lock.yaml` and `--frozen-lockfile` is enforced in CI.

#### `globalState`

The data we save in v0.1 is a small JSON-shaped state. We do not need a database or file-based store.

#### Why no Webview in v0.1

A Webview is expressive but adds HTML/CSS/JS, message passing, security configuration, and state synchronization. v0.1 prioritizes the core loop — "a different meat every 10 minutes; eat or pass." Webview is on the [Roadmap](../roadmap.md) for v0.2+.

## Recommended directory layout

```text
churrasco-break/
  .vscode/
    launch.json
    tasks.json
  src/
    extension.ts
    constants/
      meats.ts
      commands.ts
      configuration.ts
    domain/
      meat.ts
      session.ts
      log.ts
    services/
      ChurrascoSessionService.ts
      MeatDeckService.ts
      SatietyService.ts
      TodayLogService.ts
    storage/
      ChurrascoStateRepository.ts
    ui/
      StatusBarController.ts
      NotificationController.ts
      QuickPickController.ts
    views/
      ChurrascoTreeDataProvider.ts
      ChurrascoTreeItem.ts
    test/
      MeatDeckService.test.ts
      ChurrascoSessionService.test.ts
      extension.test.ts
  package.json
  tsconfig.json
  esbuild.js
  README.md
```

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

- Start a session.
- Stop a session.
- Pause.
- Handle the timer tick.
- Handle a meat arrival.
- Handle eat.
- Handle pass.
- Decide when the user is full.

### `MeatDeckService`

- Shuffle the meat list.
- Draw the next meat.
- Refill the deck.
- Avoid back-to-back duplicates across refills.

### `StatusBarController`

- Create the status bar item.
- Update `text` / `tooltip` / `command` based on session state.
- Dispose.

### `NotificationController`

- Show the meat-arrival notification.
- Forward the user's choice to the appropriate command or service.
- No-op when notifications are disabled.

### `ChurrascoTreeDataProvider`

- Render the service-status section.
- Render today's meat log.
- Render the meat collection.
- Refresh on state changes.
