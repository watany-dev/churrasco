# UI Specification

## Status bar

The status bar is the central piece of always-visible UI.

Normal state:

```text
🥩 Next meat in 03:42
```

Meat arrived:

```text
🍖 Picanha has arrived
```

After eating:

```text
😋 Satiety 40% | Next 09:58
```

Stopped:

```text
🥩 Churrasco: stopped
```

Paused:

```text
⏸ Churrasco: paused
```

Display rules:

- Show only one piece of information at a time.
- Keep the text short.
- In normal state, prioritize the countdown.
- During a meat arrival, prioritize the meat name.
- Push detail into the tooltip.

Tooltip example:

```text
Churrasco Break
Status: open
Next meat: in 03:42
Eaten today: 4
Passed today: 1
Satiety: 40%
Click to open the menu
```

## Notifications

Show a notification only at the moment a meat arrives.

Example:

```text
🍖 A Picanha has been served. The sweetness of the fat moves your refactor along.
```

Notification buttons:

```text
Eat
Pass
End for the day
```

Notification rules:

- At most one notification per timer cycle.
- If the user dismisses the notification, the meat stays "unhandled" for a short grace period.
- If the next meat is ready before the previous one is handled, the previous meat is recorded as `cooled` automatically.
- No follow-up nag notifications.

## Quick Pick menu

Clicking the status bar opens a Quick Pick.

```text
🍖 Eat the current meat
🙅 Pass the current meat
📋 Show today's meat log
🔥 Start service
⏸ Pause
🛑 End for the day
```

Display rules:

- Items are filtered by session state.
- If there is no current meat, **Eat** and **Pass** are hidden.
- Today's meat log is always available.

> Milestone note: M3 ships every item except `📋 Show today's meat log`,
> which lands together with the M5 `churrasco.showTodayLog` command and
> the `TodayLogService`. Eat / Pass are wired to stub commands in M3 and
> get their real handlers in M4 ([ADR-0004 §2](../adr/0004-statusbar-and-quickpick-design.md)).

## Sidebar Tree View

v0.1 ships a simple sidebar.

```text
CHURRASCO BREAK

Service status
  🟢 Open
  ⏱ Next meat in 03:42
  😋 Satiety 40%

Today's meats
  ✅ 10:00 Picanha
  ✅ 10:10 Alcatra
  ⏭ 10:20 Fraldinha
  ✅ 10:30 Linguica

Meat collection
  🥩 Picanha x3
  🍖 Costela x1
  🐔 Coracao not yet encountered
  🧀 Grilled Cheese not yet encountered
```

Sections shown:

- Service status.
- Time until the next meat.
- Satiety.
- Meats eaten today.
- Meats passed today.
- Per-meat lifetime encounter count.

## Today's meat log

The log can be opened from a command or from the Quick Pick.

```text
🍖 Today's churrasco log

Eaten: 5
Passed: 1
Cooled: 1
Satiety: 50%

10:00 ✅ Picanha
10:10 ✅ Alcatra
10:20 ⏭ Fraldinha
10:30 ✅ Linguica
10:40 🥶 Costela
10:50 ✅ Grilled Pineapple
```

## End-of-session summary

Shown when the user chooses **End for the day**.

```text
🏁 Today's churrasco has ended.
Eaten: 7 / Passed: 2 / Satiety: 80%
Title: The Refactorer Who Waits for Meat
```
