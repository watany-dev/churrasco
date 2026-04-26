# Acceptance Criteria

v0.1 is considered done when all of the following hold.

```text
[Session]
- The session can be started from the command palette.
- The session can be stopped from the command palette.
- While running, meats arrive at the configured interval.
- After the session is stopped, no more meats arrive.

[Meat draw]
- No meat repeats until the deck cycles through all meats.
- The deck is refilled when empty.
- The just-served meat does not appear at the head of a refilled deck.

[Status bar]
- While the session is running, the time until the next meat is displayed.
- When a meat has arrived, the meat name is displayed.
- Clicking opens the Quick Pick.

[Notifications]
- A notification is shown on meat arrival.
- The notification offers Eat / Pass / End for the day.
- Pressing Eat appends an `eaten` log entry.
- Pressing Pass appends a `passed` log entry.
- Pressing End for the day stops the session.

[Logs]
- Today's eaten meats can be reviewed.
- Today's passed meats can be reviewed.
- Today's log resets when the date changes.
- The lifetime collection persists across day changes.

[Satiety]
- Eating increases satiety.
- Passing does not increase satiety.
- Reaching `maxSatiety` puts the session in the `full` state.

[Settings]
- `intervalMinutes` can be changed.
- Setting `enableNotifications` to `false` suppresses notifications.
- Setting `showStatusBar` to `false` hides the status bar item.

[Quality]
- `pnpm compile` succeeds.
- `pnpm lint` succeeds.
- `pnpm test` succeeds.
- `pnpm ci` succeeds (biome ci, type-check, knip, vitest --coverage above thresholds, audit).
- A VSIX can be produced via `pnpm package`.
```

## Implementation priority

The five highest priorities, in order:

```text
1. The timer delivers meats.
2. No meat repeats until the deck cycles.
3. The status bar shows the time until the next meat.
4. Eat / Pass works from the notification.
5. Today's meat log persists.
```

Once these five are in place, the core experience of Churrasco Break works.
