# ADR-0009: Today summary and auto-stop UI flow

- Status: Accepted
- Date: 2026-04-27
- Supersedes: なし

## Context

[ADR-0007](0007-persistence-layer.md) と [ADR-0008](0008-today-log-and-satiety.md) で M5 永続化レイヤと today log + satiety サービスを確定した。本 ADR-0009 は ADR-0006 §D9 / Neutral 節に基づく M5 4 本分割の最終本として、サービス終了時の UX と `autoStopWhenFull` 設定の振る舞いを確定する。

現状未確定の論点:

- end-of-session summary の表示形式（modal / non-modal information message / Quick Pick / Output channel）
- summary 発火 edge の定義（どの状態遷移で出すか）
- `autoStopWhenFull=true` のとき `'full'` を経由するか直接 `'stopped'` に遷移するか
- `'full'` 状態の意味（`autoStopWhenFull` の有無で到達可能性が変わる）
- `churrasco.showTodayLog` / `churrasco.resetToday` の具体的 Behavior（command catalog にはあるが詳細未定義）
- summary / today log 表示の責務配置（Service / UI Controller / pure formatter）
- title 表示（[`docs/spec/ui.md`](../spec/ui.md) §End-of-session summary L164: "The Refactorer Who Waits for Meat"）の v0.1 採否

`docs/spec/state-and-commands.md` の `#### churrasco.eatCurrentMeat` Behavior は `isFull` 時に `'full'` への遷移しか書いておらず、`autoStopWhenFull` の自動停止フローが反映されていない。`docs/spec/state-and-commands.md` Settings § `churrasco.autoStopWhenFull` も「end the session automatically」の一文のみで、経由する状態や summary の発火タイミングが未定義である。

実装は本 ADR スコープ外。`src/ui/EndOfSessionSummaryController.ts` / `src/ui/formatEndOfSessionSummary.ts` / `src/ui/formatTodayLog.ts` の追加と `ChurrascoSessionService` への `getAutoStopWhenFull` DI 拡張は、後続の実装フェーズで本 ADR の決定に従って行う。

## Decision

以下 11 点を Milestone 5 の today summary + auto-stop UX 設計として採用する。

### D1. End-of-session summary は non-modal `window.showInformationMessage`

`window.showInformationMessage(text)` を modal オプションなしで呼ぶ。ユーザーは右上のトースト通知としてサマリーを受け取り、自動消滅または「✕」ボタンで閉じる。

modal は採用しない。バックグラウンド常駐拡張で modal を出すと、End for the day という明示的アクションの直後にもう一度確認 dialog を要求する形になり、操作意図に対して過剰な侵襲性を持つ（ADR-0007 §A11 と同じ判断軸）。

### D2. Summary 発火 edge: 任意の active 状態 → `'stopped'`

`ChurrascoSessionService.onStateChange` を購読し、`(running | paused | meatArrived | full) → stopped` の遷移エッジでのみ summary を表示する。`stopped → stopped` は ADR-0003 §5 の shallow-equal guard により `onStateChange` が fire しないため、自然に suppress される。

起動直後の `stopped` 開始では何も表示しない（前回値が存在しないため edge にならない）。autoStop 経由の停止（D6）も同じ edge を通るため統一される。

### D3. Summary フォーマットは pure function、内容は `ui.md` 既存例に準拠

`formatEndOfSessionSummary({ todayLog, satiety, maxSatiety }): string` を pure function として `src/ui/` 配下に切り出す。`formatStatusBar.ts` の前例を踏襲。

表示内容は [`docs/spec/ui.md` §End-of-session summary](../spec/ui.md) L161-165 の現行例を SSOT とする（eaten 件数 / passed 件数 / satiety 達成率）。本 ADR で再掲しない（ADR-0006 §D3）。

### D4. Title 行は v0.1 では非表示

`ui.md` L164 の `Title: The Refactorer Who Waits for Meat` 行は v0.1 では出力しない。titles system は `docs/roadmap.md` v0.2 候補（"Expanded titles system"）の領域で、v0.1 で title を 1 件だけ仮置きすると後の本実装と整合が取れない。

`ui.md` 側に v0.1 では title 行を省略する旨を追記し、ADR-0009 をリンクする。

### D5. Summary 発火責務は UI 層の `EndOfSessionSummaryController`

新規 `src/ui/EndOfSessionSummaryController.ts` を導入し、`ChurrascoSessionService.onStateChange` を購読、D2 の edge で `formatEndOfSessionSummary` を呼んで `window.showInformationMessage` に渡す。`TodayLogService` から `todayLog` / `lifetime` を、`ChurrascoSessionService.state` から `satiety` を pull する。

`ChurrascoSessionService.stop()` 内から `window.*` を呼ばない。Service 層 → UI 層への責務漏れは `docs/spec/architecture.md:160-165` の `extension.ts` "wiring only" / Service 層責務の境界を破る。

### D6. AutoStop 経路: `'full'` を経由しない直接 `'running' → 'stopped'`

`ChurrascoSessionService.eat()` 内で `isFull === true` のとき:

- `getAutoStopWhenFull() === true` → `setState({ status: 'stopped', currentMeatId: null, nextArrivalAt: null, satiety: nextSatiety })` で直接 `'stopped'` に遷移し、タイマーを停止
- `getAutoStopWhenFull() === false` → 既存通り `'full'` 状態に遷移し、タイマーを停止しない（ユーザーの明示 stop を待つ）

中間状態 `'full'` を経由しない理由は、status bar が一瞬 `full` を表示してから即 `stopped` に切り替わる UX のちらつきを避けるため。`'running' → 'stopped'` という単一遷移にすることで、D2 の summary edge も自然に通る。

### D7. `'full'` 状態の到達可能性を `autoStopWhenFull=false` に限定

D6 の結果として、`SessionStatus = 'full'` は `autoStopWhenFull=false` の設定下でのみ到達可能となる。型自体は変更しないが、本 ADR で意味を再定義する: 「`'full'` は autoStop=false 時に、ユーザーが明示的に `stop()` を呼ぶまでセッションを保留する待機状態」。

ADR-0003 / ADR-0005 で定義された `'full'` 遷移条件（`eat()` 内 `nextSatiety >= maxSatiety`）は autoStop=false 経路で継承される。

### D8. `churrasco.showTodayLog` は `window.showInformationMessage` + 専用 formatter

`formatTodayLog({ todayLog, satiety, maxSatiety }): string` を pure function として `src/ui/` 配下に切り出し、`window.showInformationMessage(text)` で表示する。Quick Pick は採用しない（ログ件数が増えるとアイテム選択 UX が破綻する。表示専用なら information message の方が単純）。

D3 の `formatEndOfSessionSummary` と関数を分けるのは、ui.md L137-155 の today log 形式（時刻 + meat name の縦並び）と L157-165 の summary 形式（集計のみ）が異なる主題のため。

### D9. `churrasco.resetToday` は warning modal で確認後に `TodayLogService.resetToday()` を呼ぶ

`window.showWarningMessage("Reset today's log?", { modal: true }, 'Reset')` の Reset 押下時のみ `TodayLogService.resetToday()` を呼ぶ。lifetime は保持される（ADR-0008 §D4 の `resetToday` 仕様を継承）。

modal を採用するのは、destructive action（todayLog 消去）であり、誤操作復旧がストレージから不可能なため。D1 の summary が non-modal なのは「情報通知」、本コマンドが modal なのは「破壊操作の確認」と性質が異なる。

### D10. テスト戦略

- `formatEndOfSessionSummary` / `formatTodayLog` は pure function として Vitest で境界（eaten=0、cooled=0、satiety=0、satiety=max）を網羅
- `EndOfSessionSummaryController` は Vitest で fake `EventEmitter` + `window.showInformationMessage` mock により D2 の edge 検出を検証（`stopped → stopped` で発火しないこと、`running → stopped` で発火すること）
- `ChurrascoSessionService.eat()` の autoStop 分岐は既存テストファイルに追加（`getAutoStopWhenFull` を返す値で挙動が分岐すること）
- 既存カバレッジ閾値（lines 80 / branches 75）を維持

### D11. コミット分割: 単一 commit

ADR-0009 と `docs/spec/state-and-commands.md` の Behavior / Settings 更新、`docs/spec/ui.md` の End-of-session summary 補足、`docs/spec/architecture.md` の Module 責務追記、`docs/README.md` の ADR リスト追記は 1 commit に集約する。実装コミットは別フェーズ。

ADR-0007 / ADR-0008 と同じ単一 commit 方針を踏襲し、ADR と spec の相互引用が commit 単位で完結する状態を維持する。

## Consequences

### Positive

- D1 の non-modal 採用により、End for the day 直後の操作フローが modal で中断されず、軽量拡張のトーンと整合する
- D6 の直接遷移により、autoStop 時の status bar ちらつきが構造的に消える
- D2 / D5 で summary 発火を `EndOfSessionSummaryController` に集約することで、Service 層が UI を知らない状態を維持できる（`docs/spec/architecture.md` 責務分離と整合）
- D7 で `'full'` の意味が明確化され、「autoStop=true なのに `'full'` 状態が観測される」という設定齟齬が起きない
- D9 の modal 確認により destructive な resetToday の誤操作リスクが下がる
- D11 の単一 commit により ADR-0009 と spec が同じレビュー単位で読まれ、参照関係が完結する

### Negative

- D1 の non-modal は通知 OS 設定によっては自動消滅し、ユーザーが summary を読み逃す可能性がある（v0.1 の意図的トレードオフ）
- D6 で `'full'` を経由しないため、autoStop=true ユーザーは「目標達成」感を視覚的に味わう瞬間（`full` 表示）を失う。summary 通知の文面でカバーする必要がある
- D8 の `showTodayLog` を information message にすると、長いログでテキスト幅が広がりすぎる懸念がある。Quick Pick / Tree View（M6）への乗り換え判断は v0.2 で再評価
- D5 で UI Controller が `TodayLogService` と `ChurrascoSessionService` の両方に依存するため、subscriber 配線箇所が `extension.ts` で増える
- D9 の modal 確認は、resetToday を頻繁に使うユーザーにとっては摩擦になる。v0.1 のターゲット用途（休憩リマインダーのリセット）では頻度が低い前提

### Neutral

- 本 ADR は契約のみを確定し、実装コードを伴わない。後続実装ステップが ADR-0007 / 0008 / 0009 を参照して具体化する
- D11 の単一 commit 方針は ADR-0007 / 0008 と同じ前例。grandfather clause 対象の ADR-0001〜0005 とは方針が異なる
- D7 は型 `SessionStatus` を変更せず意味の再定義のみで対応する。型レベルの変更は将来の互換性配慮として温存

## Alternatives considered

### A1. Summary を modal information message で表示

却下理由: バックグラウンド常駐拡張で End for the day 直後に modal を出すと、ユーザーの明示意図（停止）の直後に再度操作（OK 押下）を要求し、軽量 UX のトーンを破る。ADR-0007 §A11 の判断と同じ。

### A2. Summary を Output channel に出力

却下理由: Output channel はユーザーが明示的に開かないと見えない。「セッション終了の達成感」を伝える UX としては discoverability が低すぎる。

### A3. Summary を Quick Pick で表示

却下理由: Quick Pick は選択 UI で、表示専用には責務が合わない。閉じる UX も「エスケープキー」と「項目選択でコミット」が混在し、ユーザー意図と乖離する。

### A4. AutoStop で `'full'` を経由してから `'stopped'`

却下理由: status bar が一瞬 `'full'` を表示してから即 `'stopped'` に切り替わるちらつきが発生する。setState を 2 回連続で fire することで onStateChange リスナーも 2 回呼ばれ、summary edge 検出が複雑になる。

### A5. AutoStop=true でも `'full'` 状態で停止し、ユーザー手動で End for the day

却下理由: `autoStopWhenFull` 設定の名前と挙動が一致しない。「自動停止」を期待したユーザーが手動停止を要求されることになる。設定の意味と実装が乖離する。

### A6. v0.1 で title 行を仮置き表示（"Refactorer Who Waits for Meat" 1 件固定）

却下理由: titles system は roadmap v0.2 候補。1 件固定だと「なぜいつも同じ称号？」という UX 違和感を生み、本実装移行時に「以前と違う」というユーザー期待のミスマッチが起きる。v0.1 では非表示が清潔。

### A7. Summary を `ChurrascoSessionService.stop()` 内から直接表示

却下理由: Service 層から `window.*` を呼ぶと UI 層との責務分離（`docs/spec/architecture.md`）が崩れる。テストでも Service 単体テストに `vscode` モックが侵食する。Controller 経由で疎結合に保つ。

### A8. `showTodayLog` を Tree View（M6）でのみ実装し、command 経由はスタブ

却下理由: command catalog に既登録され Acceptance Criteria でも「Today's eaten meats can be reviewed」が含まれる。M6 Sidebar に依存させると M5 完了時に AC を満たせなくなる。command 経由の表示は M5 で完結させる。

### A9. `resetToday` に確認 dialog なし（即時実行）

却下理由: `todayLog` 消去は元に戻せない destructive action。誤操作で当日のログが失われると、ストレージは単一 snapshot 上書き（ADR-0007 §D1）のため復旧不可能。確認 modal は最小限のセーフティネット。

### A10. Summary に cooled 件数を含めない

却下理由: `docs/spec/ui.md` L146 の Today's meat log 例で "Cooled: 1" が示されており、End-of-session summary でも cooled の文脈は維持されるべき。spec との整合のため含める前提を D3 で SSOT 経由で継承する。

### A11. `autoStopWhenFull` を `pass()` / tick からも判定

却下理由: `pass()` で satiety は変化しない（ADR-0008 D2 / spec)。tick は meat 到着のトリガーで satiety 変化なし。`isFull` 判定は `eat()` 完了直後のみで網羅可能。多箇所判定は不要分岐を生む。

### A12. `EndOfSessionSummaryController` を `NotificationController` に統合

却下理由: `NotificationController` は meat-arrival edge を担当（ADR-0005 §1）。summary は session-end edge で対象が異なる。統合すると「2 種の edge を 1 Controller で扱う」状態になり、テストで edge 種別の場合分けが増える。SRP 違反。

### A13. `formatTodayLog` を `formatStatusBar.ts` に統合

却下理由: status bar formatter は短い 1 行表示が責務。multi-line のログ表示と性質が異なり、責務粒度がずれる。formatter 単位で分割するほうが Vitest でも境界条件を独立にカバーしやすい。

## Related ADRs

- [ADR-0003](0003-session-and-timer-design.md) §3 / §5: `'full'` 遷移条件と shallow-equal guard を確立。本 ADR §D6 / §D7 / §D2 がこれを継承
- [ADR-0005](0005-notifications-and-meat-actions-design.md) §7 / §10: `autoStopWhenFull` と end-of-session summary の M5 延期を宣言。本 ADR がその answer として該当範囲を確定
- [ADR-0006](0006-docs-governance.md) §D9 / Neutral: M5 ADR を 4 本に分割する計画。本 ADR-0009 はその第 4 本（最終本）
- [ADR-0007](0007-persistence-layer.md): `PersistedSnapshot.lifetime.perMeatEncounter` を summary が読む。本 ADR §D5 がそれを Controller の DI 経路として具体化
- [ADR-0008](0008-today-log-and-satiety.md) §D11: `'full'` 遷移後の振る舞いと `autoStopWhenFull` 設定を本 ADR に委譲。本 ADR §D6 / §D7 が answer として記録
