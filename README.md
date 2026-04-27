# Churrasco Break

Churrasco Break is a VS Code extension that delivers a different cut of churrasco to your editor every 10 minutes. It is not a strict Pomodoro timer — it is a light rhythm and a bit of play that does not break your flow.

When a meat arrives you can **Eat**, **Pass**, or **End for the day**. Every meat you eat is recorded in today's log, and your satiety, meat collection, and titles grow over time.

## Status

Active v0.1 development. The full v0.1 scope is tracked across [Roadmap](docs/roadmap.md) milestones M0–M7. Currently shipped: session service with a non-repeating meat draw, status bar countdown, Quick Pick menu, arrival notifications wired to Eat / Pass / End-for-the-day handlers, and the `cooled` flow that auto-records meats that go untouched before the next arrival (M0–M4). M5 adds today's log, satiety, the lifetime meat collection, persistence via `ExtensionContext.globalState`, an end-of-session summary, and `autoStopWhenFull` behavior. M6 ships the simple sidebar Tree View (service status / today's meats / meat collection) on a dedicated activity bar container. M7 (tests and packaging) is the remaining milestone.

## Features (v0.1 target)

- A new meat arrives every 10 minutes.
- Non-repeating draw until the deck cycles.
- Status bar countdown to the next meat.
- Meat-arrival notification with **Eat / Pass / End for the day**.
- Today's meat log.
- Satiety tracker.
- Meat collection (lifetime totals).

## Commands

Implemented (M0–M6):

- `Churrasco: Start Service` — `churrasco.startSession`
- `Churrasco: End Service` — `churrasco.stopSession`
- `Churrasco: Pause` — `churrasco.pauseSession`
- `Churrasco: Open Menu` — `churrasco.openMenu`
- `Churrasco: Eat Current Meat` — `churrasco.eatCurrentMeat`
- `Churrasco: Pass Current Meat` — `churrasco.passCurrentMeat`
- `Churrasco: Show Today's Log` — `churrasco.showTodayLog`
- `Churrasco: Reset Today's Log` — `churrasco.resetToday`

## Settings

- `churrasco.intervalMinutes`
- `churrasco.enableNotifications`
- `churrasco.showStatusBar`
- `churrasco.pauseWhenInactive`
- `churrasco.maxSatiety`
- `churrasco.autoStopWhenFull`
- `churrasco.locale`

## Development

Prerequisites:

- Node.js 24 or newer (pinned via `.nvmrc` and `engines.node`)
- pnpm 10.x (pinned via `packageManager`, activate with Corepack)
- VS Code 1.90 or newer (for the integration tests)

Common scripts:

```bash
pnpm install            # install dependencies (CI uses --frozen-lockfile)
pnpm compile            # type-check, emit @vscode/test-cli artifacts, esbuild bundle
pnpm watch              # tsc --noEmit and esbuild --watch in parallel
pnpm lint               # Biome check (lint + format + import sort)
pnpm lint:fix           # Biome auto-fix
pnpm format             # Biome format --write
pnpm knip               # detect unused files / exports / dependencies
pnpm test:unit          # Vitest unit tests with coverage
pnpm test:vscode        # @vscode/test-cli integration tests in an Extension Host
pnpm test               # test:unit + test:vscode
pnpm package            # build a .vsix with @vscode/vsce
pnpm ci                 # local CI: biome ci, check-types, knip, vitest --coverage, audit
```

Each task must finish with `pnpm ci` green before committing. The CI workflow (`.github/workflows/ci.yml`) runs the same checks plus `pnpm test:vscode` and `pnpm package`.

Press F5 in VS Code to launch an Extension Development Host with the bundled extension loaded.

## Documentation

The full specification, architecture, and roadmap live in [`docs/`](docs/README.md):

- [Overview](docs/spec/overview.md) — concept, target users, v0.1 scope
- [UI](docs/spec/ui.md) — status bar, notifications, Quick Pick, sidebar
- [Meats](docs/spec/meats.md) — meat data model and draw rules
- [State & Commands](docs/spec/state-and-commands.md) — session state, commands, settings
- [Architecture](docs/spec/architecture.md) — tech stack and module layout
- [Acceptance Criteria](docs/spec/acceptance.md) — definition of done for v0.1
- [Roadmap](docs/roadmap.md) — v0.1 milestones and v0.2+ candidates
- [Packaging](docs/packaging.md) — `package.json` blueprint
- [ADRs](docs/adr/) — architecture decision records
