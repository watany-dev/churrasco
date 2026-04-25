# Architecture

## Tech stack

```text
Language:
  TypeScript

Runtime:
  Node.js
  VS Code Extension Host

VS Code APIs:
  StatusBarItem
  window.showInformationMessage
  window.showQuickPick
  TreeView / TreeDataProvider
  commands.registerCommand
  ExtensionContext.globalState
  workspace.getConfiguration

Build:
  TypeScript Compiler
  esbuild

Test:
  Mocha
  @vscode/test-cli
  @vscode/test-electron

Quality:
  ESLint
  Prettier

Packaging:
  @vscode/vsce

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

We bundle to keep activation and distribution lightweight. esbuild is small to configure and fits a v0.1-sized extension.

#### Mocha + `@vscode/test-electron`

Used for integration tests that need the VS Code API. Pure logic such as the meat draw is covered by ordinary unit tests; command registration and state mutation are covered by extension tests.

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
