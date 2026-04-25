# Roadmap

## v0.1 milestones

### Milestone 0 — Project bootstrap

Goal:

- A minimal VS Code extension that activates.

Tasks:

- Create a TypeScript-based VS Code extension project on top of the existing toolchain skeleton (`package.json`, `pnpm-lock.yaml`, `biome.json`, `tsconfig.json`, `vitest.config.ts`, `.vscode-test.mjs`, `knip.config.ts`, `esbuild.js`).
- Fill in `package.json` `contributes` (commands, views, configuration) per [packaging.md](../packaging.md).
- Create `extension.ts`.
- Register a "hello world"-equivalent command.

Deliverables:

- F5 launches an Extension Development Host.
- A Churrasco command can be run from the command palette.

Done when:

- `pnpm compile` passes.
- A dummy command runs in VS Code.
- The CI workflow stays green on the resulting branch.

### Milestone 1 — Meat data and draw

Goal:

- Implement the core "a different meat is served" mechanic.

Tasks:

- Define the `Meat` type.
- Define `DEFAULT_MEATS`.
- Implement `MeatDeckService`.
- Implement shuffling.
- Implement the no-repeat-until-cycle draw.
- Implement the back-to-back avoidance on refill.
- Write unit tests for `MeatDeckService`.

Deliverables:

- A service that returns the next meat.
- Tests for non-repetition.

Done when:

- All 12 meats are served before any repeats.
- After a refill, the just-served meat is not served again immediately.

### Milestone 2 — Session and timer

Goal:

- After starting service, meats arrive at the configured interval.

Tasks:

- Define `SessionStatus`.
- Define `ChurrascoSessionState`.
- Implement `ChurrascoSessionService`.
- Implement start / stop / pause.
- Implement the tick (`setInterval`).
- Compute time-remaining from `nextArrivalAt`.
- Read the `intervalMinutes` setting.

Deliverables:

- Starting service starts the timer.
- After the configured interval, `currentMeatId` is set.

Done when:

- A short `intervalMinutes` makes meat arrival observable.
- After stop, the timer no longer fires.
- On `deactivate` the timer is disposed.

### Milestone 3 — Status bar and Quick Pick

Goal:

- Finalize the always-visible UI without disrupting work.

Tasks:

- Implement `StatusBarController`.
- Implement state-specific text.
- Implement the tooltip.
- Make a status-bar click invoke `churrasco.openMenu`.
- Implement `QuickPickController`.
- Filter Quick Pick items by session state.

Deliverables:

- The status bar shows the countdown.
- Clicking the status bar opens an actionable Quick Pick.

Done when:

- Display changes correctly across running, meat-arrived, and stopped states.
- Eat / Pass / End for the day can be chosen from the Quick Pick.

### Milestone 4 — Notifications and meat actions

Goal:

- Complete the "a meat just arrived" experience.

Tasks:

- Implement `NotificationController`.
- Call `showInformationMessage` on arrival.
- Implement Eat / Pass / End for the day buttons.
- Implement `eatCurrentMeat`.
- Implement `passCurrentMeat`.
- Implement the `cooled` flow.

Deliverables:

- Arrival notifications.
- Notification-driven meat actions.

Done when:

- A notification appears on meat arrival.
- Eat updates satiety and the log.
- Pass updates only the log.
- End for the day stops the session.

### Milestone 5 — Log, satiety, persistence

Goal:

- Preserve the day's experience and reward the user at end-of-session.

Tasks:

- Define `MeatLogEntry`.
- Implement `TodayLogService`.
- Implement `SatietyService`.
- Implement `ChurrascoStateRepository`.
- Save and load via `globalState`.
- Reset today's log on day change.
- Implement the end-of-session summary.

Deliverables:

- Today's meat log.
- Satiety.
- Lifetime meat collection.
- End-of-session summary.

Done when:

- Restarting VS Code preserves the lifetime collection.
- Only today's log resets when the date changes.
- Satiety reaching `maxSatiety` flips the session to `full`.

### Milestone 6 — Simple sidebar

Goal:

- Provide a single place to view logs and the collection.

Tasks:

- Implement `ChurrascoTreeDataProvider`.
- Add `views` to `package.json`.
- Render the service-status section.
- Render today's meats.
- Render the meat collection.
- Refresh the Tree View on state change.

Deliverables:

- Churrasco Break sidebar.

Done when:

- Service status is shown.
- Today's log is shown.
- Meat collection is shown.
- Sidebar updates after Eat / Pass.

### Milestone 7 — Tests and packaging

Goal:

- Reach a quality bar that supports local distribution as v0.1.

Tasks:

- Round out `MeatDeckService` tests.
- Round out `ChurrascoSessionService` tests.
- Add an integration test for command registration.
- Tidy up `contributes` in `package.json`.
- Author `README.md`.
- Author `CHANGELOG.md`.
- Build the VSIX with `@vscode/vsce`.

Deliverables:

- v0.1.0 VSIX.
- README.
- CHANGELOG.

Done when:

- `pnpm compile` passes.
- `pnpm lint` passes.
- `pnpm knip` passes.
- `pnpm test:unit` and `pnpm test:vscode` both pass.
- `pnpm package` produces a VSIX.
- The CI `ci` workflow is green on `main`.
- The VSIX installs and runs in another VS Code environment.

## v0.2 and beyond candidates

- Webview-based Churrasco Board.
- Grill animations.
- Meat-card visuals.
- Audio.
- Expanded titles system.
- Weekly and monthly meat statistics.
- Per-workspace meat logs.
- Customizable meat data.
- English UI.
- Marketplace publication.
