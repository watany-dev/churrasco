# ADR-0007: Persistence Layer for Milestone 5

- Status: Accepted
- Date: 2026-04-27
- Supersedes: なし

## Context

ADR-0006 で `docs/` 配下の SSOT・三層構造・ADR テンプレートを確立し、M5 の前段としての governance 整備が完了した。M5 は ADR-0006 §D9 / Neutral 節により 4 本の ADR に分割される計画で、本 ADR-0007 はその第 1 本として永続化レイヤを主題とする。後続の ADR（today log / satiety、today summary / auto-stop）が依存する基礎を確定させるのが本 ADR の役割。

現状 `docs/spec/state-and-commands.md` の Persistence セクションは「保存対象」を箇条書きするのみで、以下が未確定である:

- storage キー設計（単一キー集約か、複数キー分割か）
- スキーマバージョニングの有無、不一致時の挙動
- `ChurrascoSessionState` の永続化対象と揮発フィールドの境界
- 書き込みタイミング（即時か debounce か `deactivate` flush か）
- `activate` 時の読み込み配線とサービスへの注入経路
- 日付変更検出のロジック
- JSON parse / shape 違反 / 未知 `meatId` への破損時挙動
- `ChurrascoStateRepository` の API 表面とテスト戦略

これらは先行 ADR で部分的に前提化されている。ADR-0002 §1 は `meatDeck` / `lastServedMeatId` が `globalState` で永続化される前提に立って back-to-back 重複回避を設計しており、ADR-0003 §10 Future work は「日付変更検知」と「sleep 復帰時の `nextArrivalAt` 扱い」の決定を M5 永続化と一緒に行うと宣言している。`docs/spec/architecture.md:122-126` は `storage/ChurrascoStateRepository.ts` を責務マトリクスに既に予告している。本 ADR はこれらの前提を統合し、未決定論点を一括で固定する。

実装は本 ADR スコープ外。`src/storage/ChurrascoStateRepository.ts` の追加と `src/services/ChurrascoSessionService.ts` への DI 拡張は別 ADR の決定事項に委ね、本 ADR は契約（型・タイミング・破損時挙動）のみを確定する。

## Decision

以下 11 点を Milestone 5 の永続化レイヤ設計として採用する。

### D1. 単一 storage キー集約（`churrasco.state.v1`）

`globalState` のキーは 1 本に集約し、`PersistedSnapshot` 全体を JSON シリアライズして保存する。キー名にはスキーマメジャー番号（`v1`）を含める。

### D2. `schemaVersion: 1` を埋め込み、不一致時は reset + warn

`PersistedSnapshot.schemaVersion` を必須フィールドとし、読み込み時に既知バージョンと一致しなければ全体を破棄して初期 snapshot で起動する。`console.warn` で記録する（VS Code Extension Host では Developer Tools / Output channel に流れる）。

### D3. 永続化対象と揮発フィールドの境界

`ChurrascoSessionState` のうち以下を永続化する:

- `today`、`satiety`、`meatDeck`、`lastServedMeatId`

以下は揮発（永続化しない）とし、起動時は常に `stopped` 開始の前提を維持する（ADR-0003 §10 を継承）:

- `status`、`startedAt`、`lastTickAt`、`nextArrivalAt`、`currentMeatId`

加えて以下を新規に永続化する:

- `todayLog: MeatLogEntry[]`
- `lifetime: { perMeatEncounter: Record<string, number>; eaten: number }`
- `lastLaunchDate: string`

具体的な型は `docs/spec/state-and-commands.md` の `PersistedSnapshot` を SSOT とし、本 ADR では再掲しない（ADR-0006 §D3）。

### D4. 書き込みタイミング: 即時 fire-and-forget

`ChurrascoSessionService` の `onStateChange` と `onMeatLogged` を購読し、変更ごとに `globalState.update(...)` を呼ぶ。返却される `Thenable<void>` を await せず fire-and-forget とする（VS Code 規約上、書き込み失敗は Output channel に通知される）。

### D5. 読み込み配線: `activate` で `load()` → サービスへの DI 注入を入口とする

`ChurrascoStateRepository.load()` の戻り値が `ChurrascoSessionService` 構築時の入口となる設計上の方向を確定する。`activate` は `load()` 結果を取得し、日付ロールオーバー処理（D6）を経て初期状態としてサービスに注入する。`extension.ts` は wiring に専念し、`globalState` を直接読まない（`docs/spec/architecture.md:143-156` の "wiring only" を遵守）。

具体実装（コンストラクタへの `initialState` 引数追加、既存テストへの影響範囲）は別 ADR の決定事項とし、本 ADR では DI ポイントの存在のみを確定する。

### D6. 日付変更検出: 起動時のみ判定

`load()` 直後に `lastLaunchDate !== todayDate(now)` を判定し、不一致なら `todayLog`、`session.satiety`、`session.today` をリセットして lifetime データは保持する。`tick` 内での 24:00 跨ぎ検出と wall-clock タイマーは本マイルストーンの範囲外とする。

`docs/spec/acceptance.md:32` の「Today's log resets when the date changes」は「次回 `activate` 時にリセットされる」と読むこととし、誤読を避けるため `docs/spec/state-and-commands.md` の Persistence セクションでも明示する。

### D7. 破損・不整合時のフォールバック

- JSON parse エラー → 全体 reset + `console.warn`
- 必須フィールド欠落（shape 違反） → 同上
- `meatDeck` 内の未知 `meatId`（ユーザー設定変更で消えた等）→ 該当 ID を drop。空になれば次回 `drawNext` の refill で自動回復
- `todayLog` 内の未知 `meatId` → エントリは保持（過去ログとしての意味を尊重）。表示時のフォールバックは UI の責務（`docs/spec/ui.md` 主管）

ユーザーへの modal 通知は採用しない（バックグラウンド常駐拡張として侵襲的）。

### D8. Sleep 復帰時の `nextArrivalAt`

ADR-0003 §10 Future work（PC sleep 復帰時の古い `nextArrivalAt` 扱い）への明示的 answer として、本 ADR は「`nextArrivalAt` を D3 により永続化しない」ことで構造的に解消する立場を採る。起動時 `stopped` 開始のため `nextArrivalAt` は復元時に存在せず、復帰直後の意図せぬ通知発火が発生しない。

### D9. `ChurrascoStateRepository` の API 表面

`docs/spec/architecture.md:122-126` で予告された Repository は以下 3 メソッドの最小 API を持つ:

- `load(): PersistedSnapshot`（破損時は初期 snapshot を返す）
- `save(snapshot: PersistedSnapshot): void`
- `reset(): void`

`vscode.Memento` 抽象（`globalState` の型）に依存し、コンストラクタで Memento を受け取る DI 形式とする。テスト時は fake Memento を注入する。フィールド単位 API（`getTodayLog`、`setSatiety` 等）は採用しない（原子的書き込み単位を壊し、Repository が肥大化する）。

### D10. テスト戦略

- ユニット（Vitest）: `vi.mock('vscode')` で fake `Memento` を提供。round-trip / 破損 fallback / `schemaVersion` 不一致 / 日付ロールオーバーを網羅
- 統合（`@vscode/test-cli`）: 実 `globalState` の round-trip を 1 シナリオのみカバー
- 既存カバレッジ閾値（lines 80 / branches 75）を維持。Repository は分岐多めのため branches に注意し、未到達分岐を残さない

### D11. コミット分割: 単一 commit

本 ADR と `docs/spec/state-and-commands.md` の Persistence セクション置換、`docs/README.md` の ADR リスト追記は 1 commit に集約する。ADR と spec は `PersistedSnapshot` を相互引用するため不可分で、別 commit に分けるとレビュー時に片方ずつ読んだ際に参照先が宙に浮く。

実装コミット（Repository 実装、サービス DI 拡張、テスト追加）は別 ADR の決定事項とし、本 ADR の範囲外。

## Consequences

### Positive

- 永続化スキーマが単一の `PersistedSnapshot` 型として SSOT 化され、後続 ADR・実装での「どこに何を保存するか」の判断コストが消える
- 揮発フィールドの境界（D3）が明示されることで、サービス層は永続化を意識せずに揮発状態を扱える
- Sleep 復帰時の挙動が D8 により構造的に解消され、ADR-0003 Future work が 1 つ closed される
- D2 / D7 のフォールバック方針が一貫しており、破損データに対する extension の挙動が予測可能
- D11 の単一 commit 分割により ADR と spec の参照関係がレビュー時に完結する
- D9 の最小 API（load / save / reset）は `vscode.Memento` 抽象に依存するため、Vitest での DI テストが容易

### Negative

- `nextArrivalAt` を永続化しない結果、起動時は必ず `stopped` 開始となり「再起動前のセッションを継続したい」UX 期待には応えられない（v0.1 の意図的な制約）
- 同日内に extension を起動しっぱなしで日付を跨ぐと、D6 により `todayLog` が即時リセットされず翌起動までずれる。長時間稼働ユーザーには違和感が生じうる
- `globalState.update` を fire-and-forget するため、ディスク書き込み失敗が発生した場合 in-memory 状態と永続状態が乖離する。検出は Output channel 経由の手動確認に依存
- D5 で「DI 注入が入口」と方向だけを確定し具体実装を別 ADR に委ねるため、実装着手時に既存 `ChurrascoSessionService` テストへの影響範囲を別途設計する必要が残る

### Neutral

- 本 ADR は契約（型・タイミング・破損時挙動）に集中し、実装コードを伴わない。後続マイルストーンの実装 ADR が本 ADR を参照して具体化する
- D11 の単一 commit 方針は、ADR-0001 / 0002 / 0003 の「複数 commit による Tidy First 分割」とは異なるが、本 ADR が docs only スコープであり構造変更と振る舞い変更の混在が起きないため許容される

## Alternatives considered

### A1. 複数 storage キー分割（`churrasco.session` / `churrasco.todayLog` / `churrasco.lifetime`）

却下理由: 関心ごとの分離は読みやすいが、原子的書き込み単位がズレ、片方だけが破損して片方は健全という中途半端な状態を許容することになる。複数キーを横断したロールバック・スキーマ移行のコストが単一キー集約より高い。D1 で単一キーに集約する。

### A2. スキーマバージョニングなし

却下理由: v0.2 以降で非互換変更が発生した時点で、過去データの形が判別できず安全な migration が書けない。`schemaVersion: 1` の埋め込みは 4 バイト程度のオーバーヘッドで将来の選択肢を確保する。D2 で採用する。

### A3. `status` まで永続化して `running` を復元

却下理由: VS Code 再起動直後にユーザー操作を伴わず通知が発火する経路を作ると、明示的なユーザーアクションなしに UI を介入させる「侵襲的」な挙動になる。ADR-0003 §10 が起動時 `stopped` を前提化している設計と整合させる。

### A4. `meatDeck` / `lastServedMeatId` を永続化しない

却下理由: ADR-0002 §1 が globalState 永続化を前提に back-to-back 重複回避を設計している。揮発化すると同日内の再起動でデッキ周期が壊れ、ADR-0002 §4 の「refill 直後の先頭が `lastServedMeatId` と一致しない」保証が再起動跨ぎで成立しない。

### A5. 書き込み 500ms debounce

却下理由: eat / pass のような単発操作は 1 イベントで意味のある状態変化を発生させる。debounce 窓中の crash は「ユーザーが Eat したのに保存されていない」というデータロスを生む。tick (1s 間隔) と比較して書き込み頻度は十分低く、debounce の必要がない。D4 で即時 fire-and-forget を採用する。

### A6. `deactivate` flush のみ

却下理由: VS Code は extension host のクラッシュや強制終了時に `deactivate` をスキップする経路を持つ。`deactivate` flush のみだとセッション中のすべての記録が失われうるため、データ保全観点で許容できない。

### A7. post-construction の `restore()` メソッド

却下理由: `ChurrascoSessionService` の構築と状態復元を二段階に分けると、「`restore()` 前に `start()` が呼ばれたらどうするか」「複数回 `restore()` を呼んだら？」の境界条件がテストパスを増やす。D5 で「コンストラクタ DI で `initialState` を渡す」一段階構築を採用する（具体実装は別 ADR）。

### A8. `activate` で直接 `globalState.get` を呼ぶ

却下理由: `extension.ts` は `docs/spec/architecture.md:143-156` で "wiring only" と責務制約されており、Repository を経由せずに永続化 API を直接叩くと責務の漏れが生じる。Repository をラッパーとして導入する D9 と整合させる。

### A9. tick 内で日付変更を検出

却下理由: tick は本来「`nextArrivalAt` 到達判定」のみを責務とする（ADR-0003 §2）。日付検出を兼ねると tick の責務が肥大化し、起動時判定（D6）との二重化でテストパスが倍化する。長時間起動しっぱなしユーザーは v0.1 ターゲット（開発時間中のみ起動）から外れるため、起動時判定で十分とする。

### A10. wall-clock タイマー（0:00 発火）

却下理由: タイマー 1 本を増やすコストが、解決する UX 問題（同日内日付跨ぎ）の規模に見合わない。VS Code 拡張は基本的に「開発作業時間に開いて閉じる」前提で、24h 起動しっぱなしのユースケースは v0.1 では扱わない。

### A11. 破損時に modal で通知

却下理由: バックグラウンド常駐拡張で modal を出すと、ユーザーが意図しないタイミング（VS Code 起動直後）で操作を要求することになり侵襲的。`console.warn` + Output channel 経由のサイレント通知に留める。

### A12. フィールド単位 API（`getTodayLog` / `setSatiety` 等）

却下理由: Repository が肥大化し、原子的書き込み単位が崩れる（一部だけ更新中の中途半端な永続状態を許す）。`load` / `save` / `reset` の最小 API（D9）に絞ることで、スナップショット全体の整合性を Repository が保証できる。

### A13. ADR と spec を別 commit に分離

却下理由: spec の `PersistedSnapshot` を ADR が引用し、ADR の決定根拠を spec が逆参照するため、片方の commit を単独で読むと参照先が前 commit にしかない状態になる。レビュー単位として不可分。

## Related ADRs

- [ADR-0002](0002-meat-deck-service-design.md) §1: `meatDeck` / `lastServedMeatId` が globalState で永続化される前提を確立。本 ADR の D3 がこれを継承
- [ADR-0003](0003-session-and-timer-design.md) §10 Future work: 日付変更検知と sleep 復帰時の `nextArrivalAt` 扱いを M5 永続化に委譲。本 ADR の D6 / D8 が answer として記録
- [ADR-0006](0006-docs-governance.md) §D9: M5 ADR が 4 本に分割される計画。本 ADR-0007 はその第 1 本
- ADR-0008（planned）: today log サービス + satiety サービス。本 ADR の `PersistedSnapshot.todayLog` / `lifetime.eaten` を消費
- ADR-0009（planned）: today summary + auto-stop。本 ADR の `PersistedSnapshot.lifetime.perMeatEncounter` をサマリーが読む
