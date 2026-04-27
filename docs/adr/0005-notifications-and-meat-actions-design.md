# ADR-0005: Notifications and Meat-Action Design for Milestone 4

- **Status**: Accepted
- **Date**: 2026-04-27
- **Deciders**: Project owner（grill-me セッション 2026-04-27 を経て決定）

## Context

ADR-0001〜0004 で v0.1 の出発点と M1〜M3 の設計を順次固定してきた。M3 完了時点で `ChurrascoSessionService` の start/stop/pause/tick・`StatusBarController`・`QuickPickController` が動作し、M3 done-when を満たしている。`eatCurrentMeat` / `passCurrentMeat` コマンドは ADR-0004 §2 で「M3 ではコマンド ID 登録のみ、handler は M4 で差し替える」と方針決定済みで、現状 `extension.ts:35-40` で `window.showInformationMessage('... will be implemented in Milestone 4')` のスタブが入っている。肉到着通知（`NotificationController`）は未配線。

`docs/roadmap.md` の次フェーズは **Milestone 4 — Notifications and meat actions**。done-when は次の 4 条件:

1. 肉到着時に通知が表示される
2. Eat で satiety とログが更新される
3. Pass でログのみ更新される
4. End for the day でセッションが停止する

しかし spec は以下の境界を未規定で残している:

- `cooled` 状態の技術的実装手段（`docs/spec/ui.md:78-79` は「次の肉が前を上書きする前に前を `cooled` として記録」とだけ書き、どう実装するかは不明。ADR-0003 §3 で meatArrived 状態は `nextArrivalAt: null` と決まっており、自動 cooled の発火タイミングをどうするかが設計判断）
- `onMeatLogged` のような log 通知 API の責務分担（M5 の `TodayLogService` が log を保管する予定。M4 でセッションサービスが log 配列を内部に持つか、emitter のみで M5 に橋渡しするか）
- `eat` / `pass` 内での `onStateChange` と `onMeatLogged` の発火順序契約
- `enableNotifications` / `maxSatiety` 設定の reactivity スコープ（ADR-0004 §3 で `intervalMinutes` reactivity が M4+ に再延期されたが、本 M4 で他の設定にどこまで踏み込むか）
- `autoStopWhenFull` の自動停止と end-of-session summary の実装タイミング（spec/state-and-commands.md §157 / §82-88、後者は「M5」と明記）
- 通知の表示言語（`docs/spec/state-and-commands.md:159` で `locale: 'ja'` と書かれているが、spec/ui.md §63-73 の例文は英語。M3 の `formatStatusBar` は英語固定で実装済み）
- 通知のボタン Promise が遅延 resolve した際に、cooled で差し替わった新しい `currentMeatId` に作用する競合の扱い

これらを ADR で明文化しないと M5 以降で「あの時こう決めた」が口承になる。

## Decision

以下 11 点を M4 の M4 範囲設計として採用する。

### 1. cooled = tick 改修パス（meatArrived でも `nextArrivalAt` を持つ）

`tick()` の早期 return 条件を `status !== 'running' && status !== 'meatArrived'` に変更する。`running → meatArrived` 遷移時も `nextArrivalAt = now + intervalMs` を設定し、cooled タイマーをそこから動かす。

ADR-0003 §2 の「単一 setInterval / 1 秒ジッター容認」を維持しつつ、別タイマーを増やさずに cooled を実現する。

### 2. `meatArrived → meatArrived` 遷移を新たに許容

cooled tick で「旧 `currentMeatId` を log に流し、`drawNext` で新しい肉を取り、`status: 'meatArrived'` のまま `currentMeatId` 更新、`nextArrivalAt = now + intervalMs` 再設定」を `setState` する。`currentMeatId` 変化により ADR-0003 §5 の shallow-equal guard を突破し、`onStateChange` が発火する。これは ADR-0003 §3 の状態境界表に新たに追加される遷移である。

### 3. log = `onMeatLogged: Event<MeatLogEntry>` のみ

`ChurrascoSessionService` は `onMeatLogged: Event<MeatLogEntry>` を公開し、`eat()` / `pass()` / cooled tick の各動作で log entry を fire する。in-memory 配列は持たない。M5 で `TodayLogService` がこの emitter を subscribe し、`globalState` に保管する。

これにより SessionService の責務が「セッション状態管理」から逸脱せず、M5 移行時に log 配列の所有権移動コストが発生しない。

### 4. emit 順序契約: `setState`（→ `onStateChange` fire）→ `onMeatLogged.fire(entry)`

`eat()` / `pass()` / cooled tick は **state 先 → log 後** の順で発火する。subscriber が `MeatLogEntry` を受け取った時点で `service.state` は新 state を返す。M5 で `TodayLogService` が「今の state を見ながら log を記録」する設計に整合する。

### 5. `enableNotifications` は notification 発火時の snapshot

`NotificationController` は `getEnableNotifications: () => boolean` を DI で受け、肉到着エッジ検出の瞬間に呼んで判断する。`workspace.onDidChangeConfiguration` の監視は入れない。通知は「肉到着の瞬間」に 1 回出るだけなので、snapshot で実用上問題ない。

### 6. `maxSatiety` は `eat()` 呼び出し時の snapshot

`ChurrascoSessionService` は `getMaxSatiety: () => number` を DI で受け、`eat()` 内で 1 回だけ呼んで `satiety + delta >= max` を判定する。snapshot 方針は ADR-0003 §6 の `getIntervalMinutes` と整合する。

### 7. `status: 'full'` 遷移は実装、`autoStopWhenFull` は M5 に延期

`eat()` 後に `satiety + delta >= getMaxSatiety()` なら `status: 'full', currentMeatId: null, nextArrivalAt: null, satiety: satiety + delta` を `setState` する。tick は `full` で early return するため、新しい肉は来ない。

`autoStopWhenFull` 設定（package.json で既登録）に基づく `stop()` 自動発火は M4 では実装しない。end-of-session summary（spec/state-and-commands.md §82-88）が M5 と紐付くため、両者を一緒に M5 で実装するほうが自然。M4 では full 状態のユーザ動線は QuickPick の「End for the day」を介した明示的 `stop()` のみとなる。

### 8. `intervalMinutes` reactivity は引き続き延期

ADR-0004 §3 / Future work で「M4 着手時に ADR-0005 で決定」とされた `intervalMinutes` reactivity は、M4 でも実装しない。M4 done-when に含まれず、cooled / eat / pass の実装で M4 のスコープは十分に大きい。本 ADR §1 の `meatArrived` での `nextArrivalAt` 保持と組み合わせて、`onDidChangeConfiguration` で interval を変更すると「現在の `nextArrivalAt` をどう再計算するか」の意味論決定が新たに必要になり、M4 のスコープ外。M5 の `TodayLogService` 着手時か、それ以降に再検討する。

### 9. NotificationController が `previousStatus` でエッジ検出

`NotificationController` は内部に `previousStatus: SessionStatus` を持ち、`service.onStateChange` を subscribe する。「`previousStatus !== 'meatArrived' && next.status === 'meatArrived'`」のエッジでのみ通知を発火する。

これにより:
- 通常の `running → meatArrived` 遷移: 1 回だけ通知 → ui.md §77 の「at most one notification per timer cycle」と整合
- cooled での `meatArrived → meatArrived` 遷移: エッジ条件を満たさず追加通知なし → ui.md §80 の「No follow-up nag notifications」と整合

### 10. UI 言語ポリシー（M4 では通知のみ日本語化）

通知タイトルは `🍖 ${meat.nameJa} が焼き上がりました`、ボタンラベルは `'食べる'` / `'パス'` / `'今日は終了'` とする。`meat.flavorText` / `meat.effectLabel` は英語固定なので含めない。

`StatusBarController` / `QuickPickController` の英語固定文言は M3 のまま据え置き。spec/ui.md §63-73 の英語例文は doc 例として扱う。UI 言語の全面統一（StatusBar / QuickPick の日本語化）は M5+ の別 ADR で議論する。本 ADR では `docs/spec/ui.md` に「v0.1 では通知のみ日本語、StatusBar / QuickPick は英語固定（暫定）」の注記を加える。

### 11. extension.ts はスタブ差し替えのみ、コマンド ID / package.json の差分なし

ADR-0004 §2 の宣言通り、M4 では `eatCurrentMeat` / `passCurrentMeat` の handler 内容を `() => service.eat()` / `() => service.pass()` に差し替えるだけ。新コマンド ID は導入せず、`package.json` の `contributes` には触れない。`NotificationController` を構築して `context.subscriptions` に追加することで `subscriptions.length` は 9 → 10 になる。

### コミット分割（Tidy First / 9 commit）

ADR-0001 / 0002 / 0003 / 0004 のパターンを踏襲し、構造変更と振る舞い変更を分離する。

| # | Type | Subject | 性質 |
|---|------|---------|------|
| 1 | docs | `docs(adr): add ADR-0005 for notifications and meat-action design` | docs |
| 2 | feat | `feat(config): add enableNotifications/maxSatiety/autoStopWhenFull keys with sanitizers` | structural |
| 3 | feat | `feat(domain): add MeatLogAction and MeatLogEntry types` | structural |
| 4 | feat | `feat(session): add eat/pass methods, onMeatLogged emitter, and full transition` | behavioral |
| 5 | feat | `feat(session): auto-cool the previous meat when the next arrives` | behavioral |
| 6 | feat | `feat(ui): implement NotificationController with single-shot meatArrived dispatch` | behavioral |
| 7 | feat | `feat(extension): wire NotificationController and replace eat/pass stubs with service calls` | behavioral |
| 8 | test | `test(extension): assert M4 command handlers and notification wiring` | behavioral |
| 9 | docs | `docs: mark M4 done; correct intervalMinutes reactivity scope and add UI language note` | docs |

commit 4 は `eat()` / `pass()` / `onMeatLogged` emitter / `status: 'full'` 遷移のみ。`tick()` 改修と既存テスト「does not re-arrive once already in meatArrived」（`ChurrascoSessionService.test.ts:205-213`）の置換は commit 5 に集約する。これにより commit 4 時点で既存テストが緑のまま、振る舞い差分が新規 `eat()` / `pass()` テストのみで完結する。

各コミット時点で `pnpm ci` を満たす。

## Consequences

### Positive

- spec 未規定の境界（cooled の実装手段・log 責務・emit 順序・reactivity スコープ・UI 言語ポリシー・通知ボタン競合の扱い）が一箇所に文書化される
- emit 順序契約（state 先 → log 後）で M5 の `TodayLogService` が新 state を見ながら log を記録する素直な実装が可能
- UI 言語ポリシーの段階的導入（M4 通知のみ → M5+ で全面統一を ADR で議論）により、M3 で確定した StatusBar / QuickPick の差し戻しが発生しない
- ADR-0003 §2 の「単一 setInterval」が cooled 実装でも維持される
- 9-commit 分割で `git bisect` / `git revert` の精度が高い

### Negative

- cooled で肉が差し替わった後、ユーザが古い通知のボタンを押すと **新しい** `currentMeatId` に作用する。VS Code の `showInformationMessage` に dismiss API がないため許容。stale ガードでボタンを無効化する案は実装複雑（NotificationController が出力時の `meatId` を保存して executeCommand 直前に state と照合する）でメリットが少ない
- `ChurrascoSessionService.test.ts:205-213` の既存テスト「does not re-arrive once already in meatArrived」は本 ADR §2 の方針変更により破壊される。commit 5 で cooled テストに置換する
- `subscriptions.length` が 9 → 10 になり、`extension.test.ts:127` を更新する
- M2 仕様（meatArrived 状態で `nextArrivalAt: null`）を本 ADR §1 で上書きするため、ADR-0003 §3 の境界表との整合は本 ADR と合わせて読む必要がある

### Neutral

- 本 ADR は M4 範囲の決定であり、M5（TodayLogService / globalState 永続化 / autoStopWhenFull / end-of-session summary / `intervalMinutes` reactivity / UI 言語統一）には別 ADR で対応する
- `EventEmitter<MeatLogEntry>` の選択は M5 の `TodayLogService` が subscribe する想定に整合するが、TodayLogService の設計自体は M5 の ADR で別途決定する

## Future work

以下は本 ADR のスコープ外、後続マイルストーンで再検討:

- **`autoStopWhenFull` 自動停止と end-of-session summary** → M5 で `TodayLogService` と一緒に実装
- **`intervalMinutes` reactivity** → M5+、`onDidChangeConfiguration` 監視と `nextArrivalAt` 再計算の意味論を別 ADR で決定
- **TodayLogService 永続化** → M5、`onMeatLogged` を subscribe して `globalState` に保管
- **UI 言語統一（StatusBar / QuickPick の日本語化）** → M5+ の別 ADR
- **cooled の sleep catch-up** → ADR-0003 §9 で deferred、M5 永続化と再検討
- **通知ボタンの stale ガード** → 必要が生じれば後続 ADR で検討（dismiss API 追加 or NotificationController 内の `meatId` 追跡）

## Alternatives Considered

### 別タイマーで cooled を実装

`NotificationController` または `ChurrascoSessionService` 内で `setTimeout(cooledHandler, intervalMs)` を起動し、cooled 専用タイマーを持つ案。pause / stop / dispose で 2 つのハンドルを teardown する必要があり、ADR-0003 §2 の「単一 setInterval」と矛盾する。不採用。

### cooled を実装しない

`docs/spec/ui.md:78-79` の cooled 仕様を M4 では実装せず M5+ に延期する案。M4 done-when に明示されていないため形式上は通せるが、spec を満たさず、M5 の log 永続化と一緒に再設計する負担が生じる。仕様を尊重して M4 で実装する。

### `ChurrascoSessionService` に `log: MeatLogEntry[]` 配列を持たせる

M4 で `getLog()` を公開し、M5 で `TodayLogService` に移譲する案。M4 でも視覚 UI が無い状態で配列を持つのは責務漏れ（spec の `ChurrascoSessionState` 型に log は含まれない）。emitter のみに留めて M5 で `TodayLogService` がリスナーになる方が綺麗。

### M4 で `MeatLogService` を新設

M4 で in-memory 版の `MeatLogService` を作り、M5 で `ChurrascoStateRepository` 連携を追加する案。M4 で永続化なしの中途半端な状態で 1 サービスを作るより、M5 で永続化と同時に作るほうが設計が一体化する。emitter 経由で M5 に橋渡しする方が段階的に綺麗。

### `NotificationController` に `showInformationMessage` / `executeCommand` の DI オプション

`NotificationControllerOptions` に test 用のモック差し込み口を設ける案。`vscode` 自体は EventEmitter のために `vi.mock` がいずれにせよ必要で、M3 の `QuickPickController` は直接 import + hoisted mock パターンで動いているため、UI コントローラ間で DI スタイルが不一致になる。既存パターンに統一して直接 import 採用。

### 通知ボタンの stale ガード

`NotificationController` が「通知出力時の `meatId`」を保存しておき、ボタン Promise が resolve した時点で `service.state.currentMeatId` と一致しなければ `executeCommand` をスキップする案。実装は可能だが、cooled 中の古い通知が無効化されるだけで、ユーザは「ボタンを押したのに何も起きない」体験になる。仕様 §80 の「nag しない」と相まって UX の改善になりにくく、本 ADR では「古い通知が新しい肉に作用する」を明示的に許容する。

### `autoStopWhenFull` を M4 で実装

`status: 'full'` 遷移と同時に `service.stop()` を発火し、自動でセッション終了する案。`stop()` は ADR-0003 §3 で「end-of-session summary 表示」を含むセマンティクスとされ（M5 で実装予定）、M4 で auto-stop だけ入れると summary 不在の不完全な end-of-session が起きる。両者を M5 で一緒に実装するほうが自然。

### M4 でも StatusBar / QuickPick を日本語化

通知の日本語化に合わせて StatusBar / QuickPick も統一する案。formatStatusBar.ts / QuickPickController.ts と各テストを変更する必要があり M4 のスコープが拡大する。M3 で英語固定として確定済みの差し戻しになるため、UI 言語統一は別 ADR で議論。M4 では暫定的な混在を許容する（本 ADR §10）。

### 完全 reactive な `enableNotifications`

`workspace.onDidChangeConfiguration` で `enableNotifications` 変更を即時反映する案。通知は「肉到着の瞬間」に 1 回だけ判定すれば実用上十分で、`Disposable` を 1 つ増やしテストモックも追加するコストに見合わない。snapshot で十分。

## References

- `docs/roadmap.md` Milestone 4
- `docs/spec/acceptance.md:22-27`（M4 done-when）
- `docs/spec/ui.md:57-81`（Notifications 仕様）
- `docs/spec/state-and-commands.md:25-34`（`MeatLogAction` / `MeatLogEntry` 正規定義）
- `docs/spec/state-and-commands.md:95-110`（eat / pass の状態遷移）
- `docs/spec/state-and-commands.md:139-141`（`enableNotifications` 設定）
- `docs/spec/architecture.md:174`（`ChurrascoSessionService` 「Handle eat (M4)」「Handle pass (M4)」責務）
- `docs/spec/architecture.md:192-196`（`NotificationController` 責務）
- `docs/adr/0003-session-and-timer-design.md` §2 / §3 / §5 / §9（単一 setInterval / 状態境界 / shallow-equal guard / sleep 復帰）
- `docs/adr/0004-statusbar-and-quickpick-design.md` §2 / §3 / §6 / Future work（M3 でのスタブ宣言 / `intervalMinutes` reactivity 再延期）
- `src/services/ChurrascoSessionService.ts:97-123`（M2 で実装された tick の現状）
- `src/extension.ts:35-40`（M3 の eat/pass スタブ）
- grill-me セッション記録: `/root/.claude/plans/m4-synchronous-bubble.md`
