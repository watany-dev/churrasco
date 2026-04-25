# ADR-0001: Development Startup Strategy for v0.1

- **Status**: Accepted
- **Date**: 2026-04-25
- **Deciders**: Project owner（grill-me セッション 2026-04-25 を経て決定）

## Context

`churrasco` リポジトリの v0.1 開発を始めるにあたり、以下の状況にある:

- ツールチェイン（pnpm, biome, tsc, knip, vitest, @vscode/test-cli, esbuild, lefthook）と CI（`ci.yml` の `quality` / `vscode-test` / `package` ジョブ）は構築済み
- `.claude/settings.json` の Stop hook で `pnpm ci` が自動実行され、品質ゲートが各ターン後に強制される
- `src/extension.ts` は `activate` / `deactivate` の空スタブのみ
- `package.json` に `contributes` も `activationEvents` も無く、`main` フィールドすら設定されていない
- 設計上の意思決定は `docs/spec/*.md` と `docs/packaging.md` に記録されているが、ADR は本ドキュメントが初

この状態から「最初の一手」をどう打つかには複数の分岐がある:

1. **開発順序**: `docs/roadmap.md` の Milestone 順（service-first）か、垂直スライス（walking skeleton）優先か
2. **M0 のスコープ**: roadmap の M0 記載は最小（hello-world command + activate）。設定や定数の宣言まで踏み込むか
3. **テストの境界**: M0 で vitest と `@vscode/test-cli` のどちらを green にするか
4. **M0 で登録するコマンド**: `churrasco.helloWorld` のような throwaway か、最終形（`docs/spec/state-and-commands.md` の正規 ID）か
5. **コミットの粒度**: Tidy First（Kent Beck）と Conventional Commits の両立をどう図るか

ADR がないままこれらを決め進めると、後続マイルストーンで「あの時こう決めた」が口承になる。最初の判断こそ ADR で固定する価値が高い。

## Decision

以下 5 点を v0.1 開発の出発点として採用する:

### 1. 開発順序: Service-first（roadmap 通り）

M0 → M1 (`MeatDeckService`) → M2 (`ChurrascoSessionService`) → M3 (StatusBar / QuickPick) → M4 (Notification) → M5 (Persistence) → M6 (TreeView) → M7 (品質ゲート)。

各 service を TDD（Red → Green → Refactor）で完成させてから UI に繋ぐ。Walking skeleton 案（UI まで最速で繋ぐ）は早期フィードバックが得られる利点があるが、テストが後追いになり `pnpm ci` のカバレッジ閾値（lines 80 / branches 75 / functions 80 / statements 80）を維持する負担が大きいため不採用。

### 2. M0 のスコープ: 設定 7 項目を含む厚めのブートストラップ

M0 で以下を済ませる:

- `package.json` に `main: "./dist/extension.js"` を追加
- `package.json` の `compile` script に `tsc -p tsconfig.test.json` を追加し、`out/test/*.js` を出力させる（後述）
- `tsconfig.test.json` を新設（vscode-test ランタイム向けに `noEmit: false`、`module: CommonJS`）
- `package.json` の `contributes.commands` に `churrasco.startSession` を 1 件、`contributes.configuration` に 7 項目（`docs/packaging.md` 準拠）を宣言
- `src/constants/commands.ts` を新設し `COMMAND_IDS.startSession` を export
- `src/extension.ts` の `activate` で `churrasco.startSession` を stub として登録
- vitest（`src/extension.test.ts`）と vscode-test（`src/test/extension.test.ts`）の双方で smoke test を 1 本ずつ green にする

ただし以下の型・定数は **M0 では作らない**:

- `src/constants/meats.ts` および `Meat` / `MeatCategory` / `MeatRarity` 型 → 消費する M1 で導入
- `src/constants/configuration.ts`（設定キー定数） → 消費する M2 で導入
- `src/domain/session.ts`（`SessionStatus` / `ChurrascoSessionState`） → 消費する M2 で導入
- `src/domain/log.ts`（`MeatLogEntry` / `MeatLogAction`） → 消費する M5 で導入

理由: `knip.config.ts` の `entry: ['src/extension.ts', 'src/test/**/*.test.ts', 'src/**/*.test.ts']` および `project: ['src/**/*.ts']` 設定下で、消費先のない export は `pnpm ci` を落とす。Stop hook が各ターン後に自動で `pnpm ci` を回すため、knip green を保つことは絶対要件。

### 3. テストの境界: M0 で vitest と vscode-test の双方を green にする

`docs/spec/architecture.md` の方針通り、純粋ロジックは Vitest、Extension Host が必要なものは `@vscode/test-cli`。Glob は CLAUDE.md の通り `src/**/*.test.ts`（vitest、`src/test/**` 除外）と `src/test/**/*.test.ts`（vscode-test）。

M0 から両方を green にしておくことで、M1 以降は「どちらに書くべきか」の判断のみで済み、テストハーネスの初期化コストを後ろ倒ししない。

### 4. M0 で登録するコマンド: `churrasco.startSession` を直接登録

`docs/spec/state-and-commands.md` および `docs/packaging.md` で正規化されているコマンド ID は `churrasco.startSession`（タイトル `"Churrasco: Start Service"`）。roadmap M0 の "hello-world command" は plain な慣用表現であり、実体としては最終形の ID を最初から使う。

`churrasco.helloWorld` などの throwaway を経由する案は `contributes.commands` の入替コストが純粋に無駄であるため不採用。M0 stub の中身は `window.showInformationMessage('Churrasco started (stub)')` 一行。M2 で `ChurrascoSessionService` ができ次第、ハンドラだけ差し替える。

### 5. コミットの粒度: M0 を 4 コミットに分割

Kent Beck "Tidy First" の「構造変更と機能変更を分ける」原則と、commitlint で強制される Conventional Commits を両立させるため、M0 を以下の 4 コミットに分ける:

1. `chore: prepare extension entrypoint and test compile pipeline` — `main` フィールド追加、`tsconfig.test.json` 新設、`compile` script 改修、`COMMAND_IDS` 定数定義（純構造変更、振る舞い変化なし）
2. `feat: declare configuration schema and command contribution` — `package.json` の `contributes.commands` と `contributes.configuration` を新設
3. `feat: register churrasco.startSession command as stub` — `src/extension.ts` の `activate` 実装と vitest unit test
4. `test: add vscode-test integration smoke test` — `src/test/extension.test.ts` 追加

本 ADR 自体は別途 `docs:` コミットとして先行させる（コミット 0）。

## Consequences

### Positive

- M3 で `contributes.commands` を入れ替えずに済む（最初から正規 ID）
- 早期から両テストハーネスが green になり、M1 以降は Red を書くだけで TDD サイクルに入れる
- Tidy First の原則に従った 4 コミット分割で、各コミットの diff が小さく、レビュー・二分探索（`git bisect`）が容易
- 型・定数の延期方針により Stop hook の `pnpm ci`（とりわけ knip）が初日から green を維持
- ADR-0001 が以後の決定の参照点となり、`docs/spec/*.md` と `docs/roadmap.md` の橋渡し（roadmap M0 の "hello-world" と spec の `churrasco.startSession` の対応）が文書化される

### Negative

- M0 のスコープが roadmap 記述より広いため、roadmap の見積（1〜2 日）を超える可能性がある
- 「型・定数を先に作って後続を楽にする」案を一部見送ったため、M1 以降の各サービス着手時に型を都度足す手間が分散する
- `tsconfig.test.json` という別設定を導入したことで、ビルド構成のレイヤーが 1 つ増える（メリットは vscode-test の Mocha + CJS ランタイムへの対応）

### Neutral

- 本 ADR は v0.1 開発の起点を固定するもので、v0.2 以降（Webview など）の方針には影響しない

## Alternatives Considered

### Walking skeleton 優先

M0 + 各 service の最小 stub を経由して、M3（StatusBar）と M4（Notification）まで早期に貫通させ、肉が出る・選択できる体感を最速で得てから内部を厚くする案。早期フィードバックは魅力的だが、TDD が後追いになり `pnpm ci` のカバレッジ閾値維持コストが高くなるため不採用。

### `churrasco.helloWorld` を throwaway として登録

roadmap M0 の文言に忠実にする案。後で `churrasco.startSession` に差し替える際、`contributes.commands` の入替・テストの書換えが純粋に無駄なため不採用。

### M0 を 1 コミットで完了

「小さい milestone なら 1 コミットでも許容」とする案。Tidy First の構造変更分離原則に反する上、コミット粒度が大きいと `pnpm ci` 失敗時の二分探索コストが高くなる。Conventional Commits の意図とも合わないため不採用。

### 全定数・型を M0 で作る

`docs/spec/architecture.md` のディレクトリ構成に沿って `meats.ts` / `configuration.ts` / `domain/*.ts` をすべて M0 で作る案。消費先がないため knip が落ち、Stop hook が連続失敗する。M0 の `pnpm ci` を維持できないため不採用。採用案では消費マイルストーンごとに導入する。

## References

- `docs/roadmap.md` Milestone 0
- `docs/spec/architecture.md`（モジュール責務、テスト分割）
- `docs/spec/state-and-commands.md`（正規コマンド ID と設定値）
- `docs/spec/meats.md`（M1 で消費される `Meat` 型と `DEFAULT_MEATS`）
- `docs/packaging.md`（`contributes` の正準スキーマ）
- `CLAUDE.md`（TDD・Tidy First・`pnpm ci` 必須要件）
- grill-me セッション記録: `/root/.claude/plans/reactive-crafting-leaf.md`
