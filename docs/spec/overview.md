# Overview

## 1. Summary

**Churrasco Break** is a VS Code extension that adds a "different cut of churrasco arrives every 10 minutes" experience as a small mid-work distraction.

The goal is not a strict Pomodoro timer but a light rhythm and a bit of play that does not seriously interrupt your flow. When a meat arrives, the user can choose **Eat**, **Pass**, or **End for the day**. Eaten meats are recorded in that day's log.

In v0.1 the implementation centers on the status bar, notifications, Quick Pick, and a simple sidebar. A more elaborate Webview-based churrasco board is out of scope for v0.1.

## 2. Concept

### 2.1 Experience concept

While you work, a churrasco quietly runs in the corner of VS Code.

Normally the status bar shows "time until the next meat." After 10 minutes the meat arrives, and a notification offers **Eat / Pass / End for the day**. Eaten meats, passed meats, and satiety accumulate in that day's session log.

### 2.2 Experience principles

- Do not break the user's work.
- Keep always-visible UI minimal.
- Make the moment a meat arrives a little fun.
- One or two clicks to act.
- Leave behind silly-but-charming logs and titles users want to revisit daily.

## 3. Target users

- Developers who spend long hours in VS Code.
- People who don't want strict time management like Pomodoro but do want light pacing.
- People who want a touch of play and color in their editor.
- People who want to avoid noisy, notification-heavy extensions.

## 4. v0.1 Scope

### 4.1 In scope for v0.1

- Starting and stopping a session.
- A timer that delivers a meat every 10 minutes.
- A draw that does not repeat any meat until the deck cycles.
- Status-bar countdown.
- Arrival notification.
- **Eat / Pass / End for the day** from the notification.
- Quick Pick menu when the status bar is clicked.
- Today's meat log.
- Simple sidebar Tree View.
- Satiety updates.
- Basic settings.
- State persistence.
- Minimal unit tests and an extension integration test.
- A locally installable VSIX.

### 4.2 Out of scope for v0.1

- A rich Webview-based grill view.
- Audio playback.
- Animation.
- Marketplace-ready release pipeline.
- Multi-user sharing.
- Per-workspace detailed statistics.
- AI-generated meat commentary.
- External API integrations.
