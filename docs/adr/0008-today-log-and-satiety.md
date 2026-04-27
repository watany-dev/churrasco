# ADR-0008: Today log and satiety services

- Status: Accepted
- Date: 2026-04-27
- Supersedes: なし

## Context

[ADR-0007](0007-persistence-layer.md) で M5 永続化レイヤの「入れ物」（`PersistedSnapshot` の型・保存タイミング・破損時挙動・Repository API）を確定した。本 ADR-0008 は ADR-0006 §D9 の M5 4 本分割計画における第 2 本として、その入れ物の中身を扱う 2 つのサービス — `TodayLogService` と `SatietyService` — の責務と境界を確定する。

現状、satiety 加算と log 追記は [`src/services/ChurrascoSessionService.ts`](../../src/services/ChurrascoSessionService.ts) の `eat()` / `pass()` / `tick()` に直接埋まっており、以下が未確定である:

- `SatietyService` / `TodayLogService` をどう責務分割するか（一体 / 分離 / 既存サービス内に残す）
- `lifetime` 集計（`perMeatEncounter` / `eaten`）の更新タイミング
- `meat` がサーブされた事実をどのコンポーネントが知るべきか（tick 内直接呼び出し vs 新 Event）
- 各サービスの状態保持（stateful / 純粋関数）と DI 形式
- 日付ロールオーバー後の各サービス内部状態の初期化責務
- `autoStopWhenFull` 設定の所属（本 ADR か ADR-0009 か）
- 永続化との接続点（誰が `repository.save` を呼ぶか）

ADR-0007 は「`PersistedSnapshot.lifetime.perMeatEncounter` をサマリーが読む」と関連先（ADR-0009）を予告しているのみで、書き込み側の責務までは確定していない。本 ADR は読み書き両側の責務を集計サービスに集約する。

実装は本 ADR スコープ外。`src/services/SatietyService.ts` と `src/services/TodayLogService.ts` の追加、`ChurrascoSessionService` の DI 改修と既存テスト影響の精査は別 ADR / 別コミットの実装フェーズで行う。本 ADR は契約（責務分割・API 表面・配線方向）のみを確定する。

## Decision

以下 11 点を Milestone 5 の today log + satiety レイヤ設計として採用する。

### D1. 責務分割: `SatietyService` と `TodayLogService` の 2 サービス分離

satiety 計算と today log / lifetime 集計を別サービスに分離する。`ChurrascoSessionService` は両サービスを直接保持せず、Event を介して疎結合に通知する側に徹する。`spec/architecture.md` のディレクトリ予告（`SatietyService.ts` / `TodayLogService.ts`）と整合。

### D2. `SatietyService` は純粋関数モジュール

`SatietyService` は内部状態を持たず、関数 `applyEat(currentSatiety, meat, maxSatiety): { nextSatiety: number; isFull: boolean }` を export する `MeatDeckService.drawNext` 形式の純粋関数モジュールとする。「現在の satiety」は `ChurrascoSessionState` が引き続き保持し、`SatietyService` は次の値と `isFull` 判定だけを返す。

`isFull` の判定式は ADR-0003 §3 で確定済みの `nextSatiety >= maxSatiety` を継承する。負の `currentSatiety` / 負の `meat.satiety` / 非有限値などの異常入力は呼び出し側の責任とし、防御的分岐は持たない（ADR-0003 §7 の sanitize 境界規約と整合）。

### D3. `TodayLogService` は stateful クラス

`TodayLogService` は内部状態として `todayLog: MeatLogEntry[]` と `lifetime: { perMeatEncounter: Record<string, number>; eaten: number }` を保持する。コンストラクタで `initialState: { todayLog, lifetime }` を受け取り、起動時の永続スナップショットから初期化される。

純粋関数化は不採用。`MeatLogEntry[]` の append と `perMeatEncounter` の累積は本質的に副作用を伴い、純粋関数化すると呼び出し側で都度 spread / merge を強いられる。

### D4. `TodayLogService` の公開 API

最小 API:

- `recordEntry(entry: MeatLogEntry): void` — `todayLog` に append。`action === 'eaten'` のとき `lifetime.eaten += 1`
- `recordEncounter(meatId: string): void` — `lifetime.perMeatEncounter[meatId]` を `+= 1`
- `resetToday(): void` — `todayLog = []` のみ。`lifetime` は保持
- `get todayLog(): readonly MeatLogEntry[]`
- `get lifetime(): Readonly<{ perMeatEncounter: Readonly<Record<string, number>>; eaten: number }>`
- `onChange: Event<void>` — 永続化と UI が購読する単一通知点

`recordEntry` から `lifetime.eaten` を分離した独立 API（`incrementEaten`）は持たない。「eaten ログを 1 件追記する」と「累計 eaten を 1 増やす」は同一イベントの 2 つの側面で、API を分割すると呼び出し側で順序保証と原子性を再実装することになる。

### D5. ChurrascoSessionService に新 Event `onMeatServed` を追加

`ChurrascoSessionService.tick()` 内で `meatArrived` 遷移が確定した直後に新 Event `onMeatServed: Event<{ meatId: string; servedAt: string }>` を fire する。`TodayLogService` がこれを購読して `recordEncounter(meatId)` を呼ぶ。

`tick()` から `TodayLogService` のメソッドを直接呼ばないことで、`ChurrascoSessionService` は `TodayLogService` の存在を知らずに済む（DI 順序の循環回避、テストでの mock 簡素化）。

### D6. 配線方向: `extension.ts` が両サービスを購読してブリッジ

`extension.ts` は `ChurrascoSessionService.onMeatLogged` を `TodayLogService.recordEntry` に、`ChurrascoSessionService.onMeatServed` を `TodayLogService.recordEncounter` に転送する。逆向きの配線（`TodayLogService` → `ChurrascoSessionService`）は持たない。

`docs/spec/architecture.md:143-156` の "wiring only" を遵守し、`extension.ts` の責務はあくまで Event の配線のみ。集計ロジックは `TodayLogService` 側に閉じる。

### D7. perMeatEncounter のカウントタイミング: tick の `meatArrived` edge

「meat がユーザーに到達した回数」の定義として、tick の `meatArrived` 遷移エッジ（D5 の `onMeatServed` 発火点）で `perMeatEncounter[meatId] += 1` する。notification 表示時点ではない。

理由: `enableNotifications=false`（`docs/spec/state-and-commands.md` Settings §）のユーザーでも meat はサーブされるため、collection 集計が notification 設定に左右されるべきではない。

### D8. lifetime.eaten の更新タイミング: `recordEntry` 内で同期

`TodayLogService.recordEntry(entry)` 内で `entry.action === 'eaten'` を検査し、その場で `lifetime.eaten += 1` する。`onMeatLogged` は `eaten` / `passed` / `cooled` の 3 種を流すため、`passed` と `cooled` ではカウントしない。

`cooled` を eaten カウントに含めない設計判断を明示しておく（meat が冷めたのは「食べていない」結果であり、collection の「経験」は D7 の `perMeatEncounter` 側で既に記録済みのため二重計上にならない）。

### D9. 永続化との接続: extension.ts wiring が snapshot を組み立てて save

永続化 ADR-0007 §D4 の「変更ごとに `globalState.update`」を本 ADR では以下のように具体化する: `extension.ts` が `ChurrascoSessionService.onStateChange` と `TodayLogService.onChange` を購読し、いずれの発火時も両サービスから現在状態を pull して `PersistedSnapshot` を組み立て、`repository.save(snapshot)` を fire-and-forget で呼ぶ。

`StateSaver` のような専用集約クラスは導入しない（M5 段階では wiring 1 箇所で十分。サービス数が増えた段階で再評価）。

### D10. 日付ロールオーバー後の TodayLogService 初期化責務

ADR-0007 §D6 で確定した「`activate` 時に `lastLaunchDate !== today()` ならリセット」は、`extension.ts` wiring が `repository.load()` 直後に `PersistedSnapshot` を加工して行う。`TodayLogService` のコンストラクタには加工後の snapshot から `{ todayLog, lifetime }` が渡されるため、サービス内部に日付検出ロジックを持たない。

`resetToday()` API（D4）は date rollover 専用ではなく、明示的な `churrasco.resetToday` コマンド（spec Commands § にカタログ済み）の実装ハンドルとして提供する。

### D11. autoStopWhenFull は本 ADR スコープ外

`churrasco.autoStopWhenFull` 設定の振る舞い実装と end-of-session summary は ADR-0009 の責務範囲とする。本 ADR では `SatietyService.applyEat` が `isFull` を返すところまでを定義し、`isFull === true` を受けて session を `'full'` に遷移させるか `'stopped'` まで遷移させるかは ADR-0009 で決定する。

## Consequences

### Positive

- `ChurrascoSessionService` の責務がセッション制御とタイマーに集中し、satiety 計算と log 集計が分離される（ADR-0006 §D9 の M5 分割意図と整合）
- `SatietyService` を純粋関数化したことで Vitest テストが入力 → 出力の表で書け、`vi.mock('vscode')` も不要
- D5 の `onMeatServed` Event 化により、`ChurrascoSessionService` が `TodayLogService` を import せずに済み、両サービス間の循環依存リスクが構造的に消える
- D7 が collection カウントを notification 設定から独立させるため、`enableNotifications=false` のヘビーユーザーでも lifetime collection が正しく育つ
- D9 の単一 wiring 集約点により、save 呼び出し箇所が `extension.ts` 1 箇所に集約され、永続化のデバッグが容易
- D10 で日付検出責務を wiring に集約することで、`TodayLogService` がテスト時に「今日の日付」モックを持たずに済み、テスト境界が清潔に保てる

### Negative

- 新 Event `onMeatServed` を追加することで `ChurrascoSessionService` の Event 数が `onStateChange` / `onMeatLogged` / `onMeatServed` の 3 本に増え、subscriber 配線の見落としリスクが上がる
- D9 の「両 Event 発火時に snapshot を pull して save」は、短時間に両 Event が連続発火した場合に save 呼び出しが 2 連続になりうる（fire-and-forget なので実害は小さいが、`globalState.update` の I/O が無駄に発生する）
- D8 で `recordEntry` が 2 つの責務（log append + lifetime カウント）を持つことになり、SRP 観点では「単一 API で 2 副作用」の構造になる。原子性確保を優先した結果である
- D2 の `applyEat` を純粋関数化したことで、`ChurrascoSessionService.eat()` の中で「関数呼び出し → 戻り値の構造分解 → setState 引数組み立て」の 3 ステップに分解されるため、行数自体は微増する
- D11 で autoStopWhenFull を ADR-0009 に委ねたため、本 ADR 完了時点では `'full'` 遷移後の振る舞いが宙に浮く。実装フェーズで ADR-0009 と同期して進める前提

### Neutral

- `SatietyService` を純粋関数モジュールにした点は `MeatDeckService.drawNext` の前例を踏襲しており、コードベースの一貫性が保たれる
- `TodayLogService` を stateful クラスにした点は `ChurrascoSessionService` の前例を踏襲しており、Event 駆動の DI スタイルが揃う
- 本 ADR は契約のみを確定し、実装コードを含まない。後続実装 ADR（または直接の実装コミット）が本 ADR を参照して具体化する想定

## Alternatives considered

### A1. `LogAndSatietyService` として 1 サービスに統合

却下理由: satiety 計算（純粋・状態なし）と log 集計（副作用あり・状態あり）は性質が異なり、統合すると一方の純粋性が失われる。テストも入力出力表 vs Event 駆動で書き方が異なるため、ファイル分割した方が読みやすい。

### A2. 既存 `ChurrascoSessionService` に satiety / todayLog / lifetime を全て残す

却下理由: M5 で 4 ADR 分割した動機（ADR-0006 §D9）が、まさに `ChurrascoSessionService` 肥大化の予防だった。既存路線の継続は分割の意味を失わせる。`ChurrascoSessionService` は v0.1 完了時点で 200 行を超えており、今後の collection 表示・summary 計算まで載せると保守困難になる。

### A3. `SatietyService` を stateful 化（current satiety を内部に保持）

却下理由: 現在の satiety を 2 箇所（`ChurrascoSessionState.satiety` と `SatietyService` 内部）で持つと、片方の更新漏れが発生した瞬間に sync エラーになる。SSOT は `ChurrascoSessionState` 側に置き、`SatietyService` は計算関数に徹する。

### A4. perMeatEncounter のカウントを notification 表示時に行う

却下理由: D7 で記載の通り `enableNotifications=false` のユーザーで永久にカウントされず、collection が育たない。サーブされた事実そのものを基準にする方が堅牢。

### A5. tick から `TodayLogService` メソッドを直接呼び、`onMeatServed` Event を作らない

却下理由: `ChurrascoSessionService` が `TodayLogService` を直接 import すると、サービス間に方向性のある依存が生まれる。Event 駆動なら他のリスナー（将来の analytics / 通知のミラーリング等）も同じ Event を購読でき、拡張性が高い。テストでも `ChurrascoSessionService` を `TodayLogService` から独立して mock できる。

### A6. `ChurrascoSessionState` に `todayLog` と `lifetime` を含める

却下理由: `ChurrascoSessionState` の `setState` は shallow equality でガード（`ChurrascoSessionService.ts:217-227`）しており、参照比較でスキップを判定する。`MeatLogEntry[]` を含めると append 毎に新配列となり、shallow equality は機能するが、配列のサイズが時間とともに増えるため state Event payload も肥大化する。Event は「変更があった」通知に留め、内容は各サービスから pull する方が効率的。

### A7. lifetime カウントを Repository（永続化レイヤ）で行う

却下理由: ADR-0007 §D9 で Repository は `load` / `save` / `reset` の最小 API と決定済み。集計ロジックを Repository に持たせるとデータ層が振る舞いを持つことになり、責務分離が崩れる。

### A8. autoStopWhenFull 振る舞いを本 ADR に含める

却下理由: ADR-0007 §Related ADRs で「ADR-0009: today summary + auto-stop」と明示的に分離宣言済み。本 ADR が autoStop まで決めると ADR-0009 のスコープが空になる。マイルストーン分割の意図を尊重する。

### A9. 永続化を `StateSaver` 専用クラスに集約

却下理由: M5 段階ではサービス数が `ChurrascoSessionService` + `TodayLogService` の 2 つで、wiring 1 箇所で十分管理可能。専用クラスを増やすと配線箇所が増えるだけで凝集度は上がらない。サービス数が 4 を超えたら再評価する。

### A10. `cooled` を `lifetime` カウンタとして追加（`lifetime.cooled`）

却下理由: ADR-0007 §D3 で `lifetime` のフィールドは `perMeatEncounter` と `eaten` の 2 つに固定済み。新フィールド追加は `PersistedSnapshot` の schema 変更となり、別 ADR + `schemaVersion` バンプの判断が必要。本 ADR スコープ外。

### A11. `recordEntry` と `incrementEaten` を別 API に分離

却下理由: 「eaten log を 1 件追記」と「累計 eaten を +1」は同一の意味的イベントを 2 側面から記述したもの。API を分けると呼び出し側で順序保証（先に append、後で increment）と原子性（片方失敗時のロールバック）を再実装することになる。同一トランザクションは同一 API に閉じる。

### A12. `TodayLogService` を Vitest ではなく `@vscode/test-cli` でテスト

却下理由: `TodayLogService` は `vscode` API（`Memento` / `commands`）に直接依存しないため、Vitest で fake `EventEmitter` を注入するだけで完結する。Extension Host を立ち上げる `@vscode/test-cli` は遅く、純 logic テストに使うとフィードバックループが悪化する。`@vscode/test-cli` は ADR-0007 §D10 の Repository 統合シナリオに留める。

### A13. spec 更新を Persistence セクションへの追記で済ませる

却下理由: 主管マトリクス上、Persistence セクションは「保存形式」に責務がある。satiety 計算ルールと log 集計の振る舞いは Behavior に近く、新セクション "Today log and satiety" として独立させた方が SSOT 整理が清潔。

## Related ADRs

- [ADR-0003](0003-session-and-timer-design.md) §3: `isFull` 判定式 `satiety >= maxSatiety` を確立。本 ADR §D2 がこれを `SatietyService.applyEat` に継承
- [ADR-0005](0005-notifications-and-meat-actions-design.md): `onMeatLogged` Event を確立。本 ADR §D6 / §D8 がこれを `TodayLogService.recordEntry` の入力源として継承
- [ADR-0006](0006-docs-governance.md) §D9: M5 ADR を 4 本に分割する計画。本 ADR-0008 はその第 2 本
- [ADR-0007](0007-persistence-layer.md): `PersistedSnapshot` の型と保存タイミングを確定。本 ADR §D9 / §D10 がそれを書き込み・読み込みの責務配置として具体化
- ADR-0009（planned）: today summary + auto-stop。本 ADR §D11 で委譲した `'full'` 遷移後の振る舞いと `autoStopWhenFull` 設定を担う
