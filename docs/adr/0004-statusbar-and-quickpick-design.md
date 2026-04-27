# ADR-0004: StatusBar and QuickPick Controller Design for Milestone 3

- **Status**: Accepted
- **Date**: 2026-04-26
- **Deciders**: Project owner

## Context

ADR-0003 で M2 の `ChurrascoSessionService` を確定し、`onStateChange: Event<ChurrascoSessionState>` ベースの状態通知と `setState` shallow-equal guard が動いている。M2 完了時点で 3/8 コマンド（`startSession` / `stopSession` / `pauseSession`）が registered だが、ユーザが「いま running なのか」「次の肉まで何秒か」「肉が到着しているか」を視認する手段が無い。

`docs/roadmap.md` の次フェーズは **Milestone 3 — Status bar and Quick Pick**。done-when は次の 2 条件:

1. running / meat-arrived / stopped 状態で正しい表示に切り替わる
2. Eat / Pass / End for the day が QuickPick から選択可能

設計仕様（`docs/spec/ui.md` / `docs/spec/state-and-commands.md` / `docs/spec/architecture.md`）は表示テキスト・コマンドカタログ・モジュール責務を規定するが、以下は未規定:

- countdown 秒更新を「session の tick に乗るか / Controller が独自タイマーを持つか」
- M4 でしか実装されない `eatCurrentMeat` / `passCurrentMeat` を M3 の QuickPick にどう含めるか
- ADR-0003 §6 で M3 に延期された設定 reactivity の正確なスコープ（`intervalMinutes` まで踏み込むか）
- M5 で実装される `showTodayLog` を M3 の QuickPick に出すか
- spec/ui.md に表示例が無い `paused` 状態の StatusBar 文言

これらを ADR で明文化しないと M4 以降で「あの時こう決めた」が口承になる。

## Decision

以下 8 点を M3 の `StatusBarController` / `QuickPickController` 設計として採用する。

### 1. StatusBar カウントダウンは Controller 所有の 1Hz タイマー

`StatusBarController` が独自に `setInterval(render, 1000)` を持ち、`status === 'running'` の間だけ稼働させる。

理由:

- `ChurrascoSessionService.tick()` は ADR-0003 §2 で「肉到着時のみ state 変更」が確定済み。`onStateChange` を毎秒発火させる案は shallow-equal guard と M2 の意味論を壊す
- M5 で `globalState` 永続化が乗ったとき、毎秒の状態書き戻しが副作用になる
- 「session 状態 + 現在時刻」の純関数として `formatStatusBarText(state, now, meats)` に切り出せ、Vitest で table-driven テストできる
- M4 の `NotificationController` は「肉到着 1 回限り」で発火する性質なので、毎秒 fire される onStateChange は逆に困る

`status` が `running` 以外（`paused` / `meatArrived` / `stopped` / `full`）への遷移で interval を停止し、その場で 1 回再描画する。`refreshIntervalMs` と `now: () => number` は DI で上書き可能（テスト用）。

### 2. QuickPick の Eat / Pass は表示するが M3 では handler stub

M3 done-when「Eat / Pass / End for the day can be chosen from the Quick Pick」を文言通り満たすため、QuickPick に Eat / Pass 項目を表示する。`churrasco.eatCurrentMeat` / `churrasco.passCurrentMeat` は **コマンドとして登録**するが、handler は M3 では `window.showInformationMessage('Eat will be implemented in Milestone 4')` 相当を出すだけ。

理由:

- QuickPick から `commands.executeCommand(picked.command)` で発火するため、command が未登録だと `command not found` エラーになる
- M4 では handler の中身を差し替えるだけで、コマンド ID 登録の差分が出ない（git diff が振る舞い変更に集中する）
- フィルタ条件「Eat / Pass は `currentMeatId !== null` のときだけ表示」は M3 で実装する（spec/ui.md §92）

代替案「M3 では QuickPick から Eat/Pass を外す」は done-when 文言を緩く解釈する必要があり、M4 で QuickPick 配線も含めて入れることになるため Tidy First の「小さな変更を積み重ねる」原則に反する。

### 3. 設定 reactivity は `showStatusBar` のみ、`intervalMinutes` は M4+ へ再延期

`workspace.onDidChangeConfiguration` を `StatusBarController` で持つが、監視対象は `churrasco.showStatusBar` のみ。`item.show()` / `item.hide()` を切り替える。

`churrasco.intervalMinutes` の即時 reactivity は M3 では入れない。理由:

- セッション中の interval 変更で `nextArrivalAt` をどう再計算するか（残り時間を比例縮小？単に `now + new interval` にリセット？）の意味論決定が必要で、これ自体が ADR レベルの議論
- spec/state-and-commands.md §137 は「M3 で実装」と書くが、acceptance.md §41 の `intervalMinutes can be changed` は「変更できる」とのみ記述で「即時反映」とは書いていない。次の `startSession` から効く既存仕様で acceptance を満たす
- M4 着手時に NotificationController と合わせて ADR-0005 で再決定する

ADR-0003 §6 / Future work で「M3 で StatusBar reactivity と一緒に実装」とした方針は本 ADR で **`showStatusBar` のみに縮小** して上書きする。

### 4. `📋 Show today's meat log` は M5 まで QuickPick から外す

spec/ui.md §83 では QuickPick 常時表示項目だが、対応コマンド `churrasco.showTodayLog` は M5 の `TodayLogService` に依存。M3 で stub 登録する案も検討したが、Eat / Pass と異なり M3 done-when の文言に含まれないため不要な前倒しと判断。

M5 で `TodayLogService` 実装と同時に QuickPickController の `buildItems` に追加する。M3 のコードでは TODO コメントを残さない（実装時に spec/ui.md を再参照すれば自明）。

### 5. `paused` 状態の StatusBar 表示は `⏸ Churrasco: paused`

spec/ui.md §7-49 に表示例が `stopped` / `running` / `meatArrived` / 「After eating」しか無く、`paused` 表示が未規定。state-and-commands.md §92 は「show 'paused' in the status bar」とのみ記述。

本 ADR で次を採用:

- text: `⏸ Churrasco: paused`
- tooltip: `Churrasco Break\nStatus: paused\nNext meat: in MM:SS (paused)\nClick to open the menu`

`MM:SS` は `nextArrivalAt - now` を凍結表示（`paused` 中は session の tick が空振りするため、Controller の 1Hz タイマーは停止し、再 render されないので値が固定される）。

`⏸` (U+23F8) は OS によりフォントが当たらない可能性があり、F5 実機確認を必須とする（M3 完了の手動検証手順 8 に組み込み）。

本決定は `docs/spec/ui.md` への反映を M3 内のコミット 9 で行う。

### 6. `formatStatusBarText` を純関数として切り出す

`src/ui/formatStatusBar.ts` に `formatStatusBarText(state, now, meats): { text, tooltip, command }` を置き、StatusBarController からはこの関数を呼ぶだけにする。

理由:

- Vitest で `vscode` モックを最小化（`createStatusBarItem` をモックする必要がない）して状態 × currentMeatId × 残り秒の網羅テストが書ける
- StatusBarController のテストはライフサイクル（interval start/stop、show/hide、dispose）に集中できる
- `Math.max(0, Math.ceil((Date.parse(nextArrivalAt) - now) / 1000))` の `MM:SS` 整形ロジックがコントローラから漏れず単体テスト可能

`buildItems` は QuickPickController のクラスメソッドに留める（external export すると knip で `unused export` を踏むため）。

### 7. ファイル配置: `src/ui/`

architecture.md §126-129 の推奨に従い `src/ui/` ディレクトリを新規作成し、`StatusBarController.ts` / `QuickPickController.ts` / `formatStatusBar.ts`（と各 `.test.ts`）を配置する。M4 で `NotificationController.ts` も同階層に追加される。

`src/test/` 配下（`@vscode/test-cli` 専用）には触らず、`vscode.commands.getCommands(true)` で新コマンド ID 3 件の登録確認のみ追加する。

### 8. extension.ts ワイヤリング

`extension.ts` で `service` の隣に `statusBar` / `quickPick` を構築し、`subscriptions` に push する。コマンド登録は次の通り:

| Command | M3 での handler |
|---------|-----------------|
| `churrasco.openMenu` | `() => quickPick.open()` |
| `churrasco.eatCurrentMeat` | `() => window.showInformationMessage('Eat will be implemented in Milestone 4')` |
| `churrasco.passCurrentMeat` | 同上（Pass 用文言） |

stub handler は extension.ts 内のインライン関数として書く（M4 で差し替えるとき探しやすい）。M4 で `MeatActionService` のような新サービスに移譲する設計判断はここでは行わない。

### コミット分割（Tidy First / 9 commit）

ADR-0001 / 0002 / 0003 のパターンを踏襲し、構造変更と振る舞い変更を分離する。

| # | Type | Subject | 性質 |
|---|------|---------|------|
| 1 | docs | `docs(adr): add ADR-0004 for StatusBar and QuickPick controller design` | docs |
| 2 | feat | `feat(commands): add openMenu, eatCurrentMeat, passCurrentMeat command IDs` | structural |
| 3 | feat | `feat(config): add showStatusBar to CONFIGURATION_KEYS` | structural |
| 4 | feat | `feat(ui): add formatStatusBarText pure function with tests` | behavioral |
| 5 | feat | `feat(ui): implement StatusBarController with countdown and visibility reactivity` | behavioral |
| 6 | feat | `feat(ui): implement QuickPickController with state-filtered items` | behavioral |
| 7 | feat | `feat(extension): wire StatusBar/QuickPick controllers and stub eat/pass commands` | behavioral |
| 8 | chore | `chore(package): contribute openMenu, eatCurrentMeat, passCurrentMeat commands` | structural |
| 9 | docs | `docs: mark M3 done and reflect intervalMinutes reactivity deferral` | docs |

各コミット時点で `pnpm ci` を満たす。コミット 5 と 6 はテスト先行で複数 Red → Green → Refactor サイクルになる想定。

## Consequences

### Positive

- spec 未規定の境界（countdown タイマー所有・QuickPick Eat/Pass 戦略・reactivity スコープ・`paused` 表示）が一箇所に文書化される
- `formatStatusBarText` 純関数の切り出しで状態 × 表示の網羅テストが軽量に書ける
- M4 では handler 中身の差し替えだけで Eat / Pass が動き、コマンド登録 / QuickPick / package.json 差分が再発しない
- `setState` shallow-equal guard と Controller 独自タイマーの組み合わせで、毎秒の UI 更新が globalState write を誘発しない（M5 永続化への前提が整う）
- 9-commit 分割で `git bisect` / `git revert` の精度が高い

### Negative

- `vscode` モックを `createStatusBarItem` / `showQuickPick` / `onDidChangeConfiguration` 対応に拡張する必要があり、`src/ui/*.test.ts` ごとに重複しがち（共通モックヘルパへの抽出は M3 後の Tidy として残す）
- M4 で Eat / Pass handler を差し替える際、既存 stub テストの assertion を更新する必要がある
- `paused` の `MM:SS` 凍結表示は「凍結された残り時間」と「resume 後の残り時間」が等しくない（resume では新しい interval を取らず `nextArrivalAt` 維持なので一致するが、ユーザ視点で混乱しないか M3 完了後にレビューが必要）

### Neutral

- 本 ADR は M3 範囲の決定であり、M4（Notification）以降の Controller 設計は ADR-0005 で別途決定する
- `intervalMinutes` reactivity は M4+ に再延期。ADR-0003 §6 の「M3 で実装」記述を本 ADR §3 で上書き

## Future work

- **`intervalMinutes` reactivity**: セッション中の interval 変更で `nextArrivalAt` をどう再計算するか → M4 着手時に ADR-0005 で決定
- **`📋 Show today's meat log` 項目追加**: M5 の `TodayLogService` 実装と同時に QuickPickController に追加
- **共通 `vscode` モックヘルパ**: `src/ui/*.test.ts` の重複を抽出 → M3 完了後の Tidy として独立コミット
- **`paused` UX レビュー**: `MM:SS` 凍結表示が混乱を招かないか M3 F5 検証で確認、必要なら M4 で調整

## Alternatives Considered

### Session の tick で毎秒 `lastTickAt` を更新し UI を駆動

`ChurrascoSessionService.tick()` で毎回 `lastTickAt = now` を setState し、`onStateChange` を毎秒発火させる案。StatusBarController は subscribe するだけで済む。不採用理由:

- ADR-0003 §5 の shallow-equal guard と M2 完了済みテストを破壊する
- M5 で globalState write が毎秒走る副作用が出る
- M4 の NotificationController が毎秒 fire される event を握りつぶす実装になり責務が滲む

### Eat / Pass を M3 の QuickPick から外す

`buildItems` で M3 では Eat / Pass を返さず、M4 で項目とコマンド登録を同時に入れる案。done-when 文言を緩く解釈する必要があり、M4 のコミット粒度が「QuickPick 項目追加 + コマンド登録 + handler 実装」と肥大化する。Tidy First の「小さな変更を積み重ねる」原則に反するため不採用。

### Eat / Pass の本実装を M3 に前倒し

M3 で `currentMeatId` のクリアと `nextArrivalAt` 再計算まで実装する案。satiety / log は M5 のため部分実装になり、M4 のスコープを侵食して「何が M3 で何が M4 か」が不明瞭になる。不採用。

### `intervalMinutes` reactivity を M3 で実装

ADR-0003 §6 / Future work の事前コミットメント通り M3 で入れる案。セッション中の挙動意味論決定が必要で M3 のスコープを超え、done-when にも含まれない。本 ADR §3 で M4+ に再延期する。

### `📋 Show today's meat log` を M3 で stub 登録

Eat / Pass と同じ stub パターンで M3 から QuickPick に出す案。done-when 文言に含まれず、M5 で `TodayLogService` と同時に入れる方が「stub の中身を書き換える」という Eat / Pass パターンよりも `TodayLogService` 設計と一体で議論できる。M3 では出さない。

### StatusBar の countdown を `setInterval` ではなく `setTimeout` の連鎖で実装

「次の秒境界まで」を `setTimeout` で待ち、再帰的に schedule する案。秒変わりの瞬間に正確に再描画できるが、dispose 経路で複数の handle を tracking する必要があり、ADR-0003 §2 の「単一 setInterval で 1 秒ジッター容認」と整合しない。不採用。

## References

- `docs/roadmap.md` Milestone 3
- `docs/spec/ui.md`（StatusBar / QuickPick の表示仕様）
- `docs/spec/state-and-commands.md:55-115`（コマンドカタログ・状態遷移）
- `docs/spec/architecture.md:126-204`（`src/ui/` 配置と Controller 責務）
- `docs/spec/acceptance.md:17-20, 41-43`（M3 受け入れ・設定挙動）
- `docs/adr/0003-session-and-timer-design.md` §5, §6（shallow-equal guard / 設定 snapshot）
- `src/services/ChurrascoSessionService.ts:31-37`（`onStateChange` API）
- `src/services/ChurrascoSessionService.ts:97-123`（tick が肉到着時のみ state 更新する事実）
