# Churrasco Break

Churrasco Break is a VS Code extension that delivers a different cut of churrasco to your editor every 10 minutes. It is not a strict Pomodoro timer — it is a light rhythm and a bit of play that does not break your flow.

When a meat arrives you can **Eat**, **Pass**, or **End for the day**. Every meat you eat is recorded in today's log, and your satiety, meat collection, and titles grow over time.

## Features

- A new meat arrives every 10 minutes.
- Non-repeating draw until the deck cycles.
- Status bar countdown to the next meat.
- Meat-arrival notification with **Eat / Pass / End for the day**.
- Today's meat log.
- Satiety tracker.
- Meat collection (lifetime totals).

## Commands

- `Churrasco: Start Service`
- `Churrasco: End Service`
- `Churrasco: Pause`
- `Churrasco: Eat Current Meat`
- `Churrasco: Pass Current Meat`
- `Churrasco: Show Today's Log`
- `Churrasco: Open Menu`
- `Churrasco: Reset Today's Log`

## Settings

- `churrasco.intervalMinutes`
- `churrasco.enableNotifications`
- `churrasco.showStatusBar`
- `churrasco.pauseWhenInactive`
- `churrasco.maxSatiety`
- `churrasco.autoStopWhenFull`
- `churrasco.locale`

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
