# ADR-0002: MeatDeckService Design for Milestone 1

- **Status**: Accepted
- **Date**: 2026-04-25
- **Deciders**: Project owner（grill-me セッション 2026-04-25 を経て決定）

## Context

ADR-0001 で v0.1 の出発点を固定し、M0 (Project bootstrap) は PR #16 のマージで完了した。`churrasco.startSession` の stub と Vitest / `@vscode/test-cli` の smoke が green になり、Stop hook で `pnpm ci` が各ターン後に強制される運用に乗っている。

`docs/roadmap.md` の次フェーズは **Milestone 1 — Meat data and draw**: `docs/spec/meats.md:25-146` に記された 12 件の `DEFAULT_MEATS` と、`docs/spec/meats.md:151-159` の draw rules（in-cycle no-repeat、empty 時 refill、refill 直後の先頭が `lastServedMeatId` と一致しない）を実装する。`docs/spec/acceptance.md:13-15` の [Meat draw] 3 条件がこれに対応する。

`docs/spec/state-and-commands.md:18-19` で `ChurrascoSessionState` にすでに `meatDeck: string[]` と `lastServedMeatId: string | null` が定義され（永続化対象）、M2 以降で導入される `SessionState` がデッキ状態の真の所有者になる。M1 の `MeatDeckService` をどう設計するかには、`SessionState` への接続コスト・テスト容易性・`pnpm ci`（biome / tsc / knip / vitest --coverage / audit）通過を同時に満たすために複数の分岐がある:

1. **状態管理の所在**: クラス内部に持つか、呼び出し側 (`SessionState`) が保持して関数に渡すか
2. **型/データ配置**: `domain/meat.ts` と `constants/meats.ts` の 2 ファイルに分けるか、コロケートして 1 ファイルにするか
3. **乱数源**: `Math.random` 直接か、`rng?: () => number` 注入か、`vi.spyOn` グローバルモックか
4. **Refill 衝突回避アルゴリズム**: swap-with-deck[1] / reshuffle-until-different / move-last + tail-shuffle
5. **Public API の表面積**: `drawNext` 1 つか、`createInitialDeck` / `shuffle` も export するか
6. **コミット粒度**: Tidy First の構造/振る舞い分離をどこまで徹底するか

これらを ADR で固定し、M1 着手後の実装判断を最小化する。

## Decision

以下 8 点を Milestone 1 の `MeatDeckService` 設計として採用する。

### 1. Stateless functions（モジュール関数の集合）

`MeatDeckService` はクラスではなく、純粋関数を export するモジュール。デッキ（残り札 ID 配列）と `lastServedMeatId` は呼び出し側が保持し、M1 の関数は受け取った state の純粋変換を返す。

理由:

- `SessionState.meatDeck` / `SessionState.lastServedMeatId` は `globalState` で永続化されるため、`SessionState` がデッキ状態の真の所有者となる。クラス内部に同等の state を持つと「クラスインスタンスの状態」と「永続状態」の二重化が発生し、snapshot/restore のラウンドトリップが必要になる
- 純関数は setup/teardown 不要でテストが単純
- `services/MeatDeckService.ts` というファイル名は維持する（`services/` は責務カテゴリの命名であり、必ずしもクラスを含意しない）

### 2. 型/データの分離（spec-literal layout）

- `src/domain/meat.ts` — `interface Meat` を export
- `src/constants/meats.ts` — `DEFAULT_MEATS: Meat[]` を export

`MeatCategory` / `MeatRarity` は `domain/meat.ts` 内部の **非 export** 型エイリアスに留める。これらは `Meat` 内部でしか使われないため、export すると knip が unused export として落とす。M6 で TreeView がカテゴリ別表示する際に export 化する。

`DEFAULT_MEATS` は `as const` を付けず素直に `Meat[]` で export する。`COMMAND_IDS` (keys が API) と異なり、`DEFAULT_MEATS` は values が API であり、v0.2+ の "Customizable meat data" で動的に拡張する余地を残すため。

### 3. Injectable RNG（mulberry32 ヘルパ）

`drawNext(state, allMeats, rng?: () => number)` が `rng` を任意引数で受け、未指定時に `Math.random` フォールバック。

テストは `src/services/MeatDeckService.test.ts` 内に `createSeededRng(seed: number)` (mulberry32 ベース) ヘルパをコロケートし、shuffle 結果を決定論的に制御する。`vi.spyOn(Math, 'random')` のグローバルモック方式は採用しない（setup/teardown 漏れによるテスト間汚染リスクを避ける）。

`createSeededRng` はテストファイル内のローカル関数として留め、export しない（knip 影響なし）。

### 4. Refill 衝突回避: swap deck[0] ↔ deck[1]

Fisher-Yates で 1 回シャッフル後、`deck[0] === lastServedMeatId && deck.length >= 2` なら `deck[0]` と `deck[1]` を swap する。

理由:

- O(1) 追加コスト、決定論的
- reshuffle ループは N=12 のシードによってループ回数がぶれ、テスト/カバレッジ計測が読みにくい
- "move-last + tail-shuffle" は仕様 (`docs/spec/meats.md:156`) に記述のない偶然性バイアスを混入させる

### 5. Minimal public API

`src/services/MeatDeckService.ts` の export は以下 2 つのみ:

- `drawNext(state: MeatDeckState, allMeats: Meat[], rng?: () => number): { meat: Meat; state: MeatDeckState }`
- `interface MeatDeckState { deck: string[]; lastServedMeatId: string | null }`

初期状態は `{ deck: [], lastServedMeatId: null }`。`drawNext` が空デッキを検知して仕様 4-5 を含むリフィルを内包する。`createInitialDeck` や `shuffle` を別途 export しない（消費先がなく knip が落ちる）。

### 6. `extension.ts` には触れない

M0 stub をそのまま維持する。`MeatDeckService` の export はテストファイル（knip entry）が consumer になるため knip green を保てる。UI/コマンド配線は M3 以降。

### 7. 防御的契約（事前条件）

`drawNext` の事前条件として **`allMeats.length > 0` を要求**する。`DEFAULT_MEATS` は固定 12 件のため v0.1 では空配列が渡されることはないが、`Meat[]` 型は空配列を許容する。判断:

- defensive な `throw new Error(...)` は **入れない**。テストで実行されない防御コードはカバレッジ閾値（lines 80 / branches 75）を脅かし、knip の unused branch 検出にも触れる可能性がある。ADR-0001 の「消費先のないコードを延期する」方針と整合
- 代わりに `MeatDeckService.ts` の関数 JSDoc に `@param allMeats - Must be non-empty.` を 1 行で記し、契約として文書化する
- v0.2+ でユーザー設定による肉リストカスタマイズが入る際に、その時点で消費される `validateMeats` 関数を追加する

### 8. 4-commit Tidy First split

ADR-0001 の 4-commit パターンを踏襲し、Kent Beck "Tidy First" の構造変更/振る舞い変更分離を徹底する。各コミット時点で `pnpm ci` を満たす。

| # | Type | Subject | 性質 |
|---|------|---------|------|
| 0 | docs | `docs(adr): add ADR-0002 for MeatDeckService design` | docs |
| 1 | feat | `feat(meat): add Meat domain type` | structural |
| 2 | feat | `feat(meat): add DEFAULT_MEATS with uniqueness test` | behavioral |
| 3 | feat | `feat(deck): implement MeatDeckService.drawNext for in-cycle draw` | behavioral |
| 4 | feat | `feat(deck): avoid lastServed at refilled deck head` | behavioral |

commit ① は型のみのファイルを単独で導入する純構造変更。runtime に到達せずカバレッジ instrument 対象外だが、`Meat` 型に消費先がないため `knip.config.ts` の `ignore` 配列に `'src/domain/meat.ts'` を一時追加して `pnpm ci` を通す。commit ② で `DEFAULT_MEATS` とそのテストが consumer になり次第、`ignore` から除去する（commit ① の構造変更を巻き戻す逆 tidy）。

### 9. M2 への統合パス

M1 では `MeatDeckState.deck` という field 名で実装する（`docs/spec/state-and-commands.md` の `ChurrascoSessionState.meatDeck` とは別名）。M2 で `src/domain/session.ts` に `ChurrascoSessionState` を導入する際、命名差は次のいずれかで吸収する:

- (a) `MeatDeckState` の field 名を `meatDeck` に rename して `ChurrascoSessionState` のサブセットにする
- (b) `drawNext` のシグネチャを `drawNext({ meatDeck, lastServedMeatId }, ...)` に書き換え、内部でも `meatDeck` を使う

M2 着手時に判断する。M1 では `MeatDeckState` を `SessionState` のサブセットの暫定形として扱う。

## Consequences

### Positive

- stateless 設計により `SessionState` への接続でコピーが二重化しない
- minimal API (`drawNext` + `MeatDeckState`) で M2 の `SessionService` は 1 行から呼び出せる
- 4-commit 分割で `git bisect` と `git revert` の精度が高い
- mulberry32 + シード固定でテストが完全に決定論的、カバレッジ閾値を安定して超える
- 型/データ分離 (`domain/meat.ts` + `constants/meats.ts`) と非 export な `MeatCategory` / `MeatRarity` で、M6 まで knip green を維持できる

### Negative

- M2 で `MeatDeckState` ↔ `SessionState` の rename 1 コミットが必要になる
- commit ① ↔ ② で `knip.config.ts` の `ignore` を一時的に出し入れする（yo-yo パターン）。Tidy First との両立コスト
- `DEFAULT_MEATS` が空のときの振る舞いを未定義のまま残す（v0.1 では発生しない、v0.2 でカスタマイズ機能を入れる際に再検討）

### Neutral

- 本 ADR は M1 範囲の決定であり、M2 以降のサービス設計（タイマー、永続化、UI 配線）には直接影響しない

## Alternatives Considered

### Class with snapshot/restore

`MeatDeckService` クラスがインスタンス内部にデッキと `lastServedMeatId` を持ち、M2 で `SessionService` が `snapshot()` / `restore(snapshot)` 経由で `globalState` と同期する案。クラスインスタンスの state と永続 state の二重化が発生し、snapshot/restore のテストパスが余分に必要になるため不採用。

### Class with mutable state ref

コンストラクタで `{ deck, lastServedMeatId }` オブジェクトを参照渡しし、メソッドが in-place で書き換える案。snapshot/restore は不要だが、テストで参照同一性に依存するため可読性が落ちる。Stateless functions の方が assertion が明示的で勝るため不採用。

### Reshuffle until different

リフィル後に先頭が `lastServedMeatId` と一致したら deck 全体を再シャッフルする案。while ループの面倒さと、シードによってループ回数がぶれてカバレッジ計測が読みにくくなるため不採用。

### Move-last + tail-shuffle

`DEFAULT_MEATS` から `lastServedMeatId` を取り除いてシャッフル、末尾に元本を戻す案。仕様 (`docs/spec/meats.md:156`) には「先頭でない」しか書かれていないのに「末尾に押し込む」セマンティクスを追加するため、必要以上の偶然性バイアスを入れる。不採用。

### `createInitialDeck` / `shuffle` の追加 export

`drawNext` に加えて `createInitialDeck(allMeats, rng?)` や `shuffle<T>(items, rng?)` を export する案。`drawNext` が空デッキを内部リフィルするため `createInitialDeck` の独立ステップは不要、`shuffle` の他コンシューマも v0.1 にはない。knip が unused export として落とすため不採用。

### 2-commit / 3-commit 分割

「型・データ・サービス・refill ロジック」を 2-3 コミットに圧縮する案。コミット数は減るが、refill ロジックのバグを `git bisect` で隔離しづらい。Tidy First の「構造変更と振る舞い変更を分ける」原則からも 4-commit を採用。

## References

- `docs/roadmap.md` Milestone 1
- `docs/spec/meats.md`（`Meat` / `DEFAULT_MEATS` / draw rules の正規ソース）
- `docs/spec/state-and-commands.md:18-19`（`ChurrascoSessionState.meatDeck` / `lastServedMeatId` の永続フィールド）
- `docs/spec/acceptance.md:13-15`（[Meat draw] 受け入れ条件）
- `docs/spec/architecture.md`（`MeatDeckService` の責務記述）
- `docs/adr/0001-development-startup-strategy.md`（`pnpm ci` 必須要件と Tidy First 4-commit パターン）
- grill-me セッション記録: `/root/.claude/plans/zesty-hugging-cat.md`
