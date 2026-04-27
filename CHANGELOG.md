# Changelog

All notable changes to the Churrasco Break extension are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-27

Initial v0.1 release covering milestones M0–M7. Distributed as a local VSIX; not yet
published to the VS Code Marketplace.

### Added

- **Session and timer (M2)** — `Churrasco: Start Service` / `End Service` / `Pause`
  manage the lifecycle. Meats arrive at the configured `churrasco.intervalMinutes`
  cadence and stop when the session stops.
- **Meat draw (M1)** — 12 default cuts of churrasco served with a non-repeating
  draw until the deck cycles, plus a back-to-back avoidance swap on refill.
- **Status bar countdown (M3)** — Always-visible countdown to the next meat,
  state-aware text and tooltip, click opens the Quick Pick.
- **Quick Pick menu (M3)** — Dynamic menu filtered by session state
  (`stopped` / `running` / `meatArrived` / `paused` / `full`).
- **Arrival notification + actions (M4)** — Notification on meat arrival with
  **Eat** / **Pass** / **End for the day** buttons, plus the `cooled` flow that
  records untouched meats automatically before the next arrival.
- **Today's log, satiety, lifetime collection (M5)** — `MeatLogEntry` records
  for `eaten` / `passed` / `cooled`, satiety accumulation up to
  `churrasco.maxSatiety`, and a lifetime meat collection with totals.
- **Persistence (M5)** — `ExtensionContext.globalState` round-trip with date
  rollover that resets today's log while preserving the lifetime collection.
- **End-of-session summary (M5)** — Information notification on the
  `(running | paused | meatArrived | full) → stopped` transition edge.
- **`autoStopWhenFull` behavior (M5)** — Reaching `maxSatiety` ends the session
  directly when `true`; otherwise enters `full` and waits for a manual stop.
- **Sidebar Tree View (M6)** — Dedicated activity bar container with three
  sections: service status / today's meats / meat collection. Refreshes on state
  change with a 1 Hz countdown re-render.
- **Commands (8)** — `startSession`, `stopSession`, `pauseSession`, `openMenu`,
  `eatCurrentMeat`, `passCurrentMeat`, `showTodayLog`, `resetToday`.
- **Configuration (7)** — `intervalMinutes`, `enableNotifications`,
  `showStatusBar`, `pauseWhenInactive`, `maxSatiety`, `autoStopWhenFull`,
  `locale` (`ja` only in v0.1).
- **Tests and packaging (M7)** — Vitest unit suites across services / UI / views
  / storage with coverage thresholds (`lines 80 / branches 75`),
  `@vscode/test-cli` integration tests for command and view registration, and
  a `pnpm package` pipeline producing `churrasco-break-0.1.0.vsix`.

### Notes

- Locale is fixed to Japanese (`ja`); English UI is tracked for v0.2+.
- `pauseWhenInactive` is contributed but not implemented in v0.1.

[Unreleased]: https://github.com/watany-dev/churrasco/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/watany-dev/churrasco/releases/tag/v0.1.0
