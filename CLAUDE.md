# CLAUDE.md

## Project Overview

Churrasco Break は VS Code 拡張。10分ごとに異なる部位のシュラスコを届け、**Eat / Pass / End for the day** で応答する軽いリズムを提供する。TypeScript で実装し、VS Code Extension Host 上で動作する。

## Build & Development

パッケージマネージャは **pnpm**（`packageManager: pnpm@10.33.2`）。`npm` は使わない。

```bash
pnpm install                 # 依存インストール（frozen-lockfile は CI 側）
pnpm compile                 # 型チェック + esbuild バンドル
pnpm watch                   # ウォッチモード（tsc --noEmit と esbuild --watch を並行実行）
pnpm lint                    # Biome（lint + format + import 整理）チェック
pnpm lint:fix                # Biome 自動修正
pnpm format                  # Biome フォーマットのみ書き込み
pnpm knip                    # 未使用 export / dep 検出
pnpm test:unit               # Vitest ユニットテスト
pnpm test:vscode             # @vscode/test-cli による拡張統合テスト
pnpm test                    # test:unit + test:vscode
pnpm package                 # .vsix パッケージング（vsce）
pnpm ci                      # ローカル CI（下記 Completion Requirements を一括実行）
```

### Prerequisites

- Node.js **24** 以上（`.nvmrc`、`engines.node` で固定）
- pnpm 10 系（`packageManager` で固定。Corepack 推奨）
- VS Code **1.90** 以上（拡張テスト用）

### Completion Requirements

**各タスク完了時、コミット前に必ず `pnpm ci` を通すこと。**

```bash
pnpm ci
```

`pnpm ci` は以下を順に実行する（`.github/workflows/ci.yml` の `quality` job と同等）:

1. `biome ci .` — lint + format + import 整理
2. `pnpm check-types` — `tsc --noEmit`
3. `knip` — 未使用ファイル / export / dep 検出
4. `vitest run --coverage` — ユニットテスト + カバレッジ閾値（lines 80 / branches 75）
5. `pnpm audit --prod --audit-level=high` — 本番依存の脆弱性監査

**これらのステップは絶対にスキップしないこと。** タスク単位で `pnpm ci` を通すのは最低限の品質基準である。Stop hook で自動実行されるため、手動でも事前に走らせておくのが望ましい。

`pnpm test:vscode` と `pnpm package` は CI 側で実行される重い検証。ローカルでは必要時のみ走らせる。

### Supply Chain Guard

- `.npmrc` に `minimum-release-age=10080`（7 日）を設定。リリース直後の依存は解決対象から除外され、レジストリ侵害から 1 週間のバッファを確保する
- `.npmrc` の `engine-strict=true` / `package-manager-strict=true` で Node / pnpm のバージョン整合を強制
- `package.json` の `pnpm.onlyBuiltDependencies` で postinstall を許可するパッケージを限定

### Local Hooks (lefthook)

- `pre-commit`: ステージ済みファイルに対して `biome check --staged`
- `commit-msg`: `commitlint --edit` で Conventional Commits を強制
- 初回 `pnpm install` 時に `prepare` スクリプトが `lefthook install` を実行する

## Architecture

現状（M0〜M4 完了）の `src/` 構成:

```
src/
  extension.ts                       — activate / deactivate、DI ルート
  constants/
    meats.ts                         — DEFAULT_MEATS（12 種）
    commands.ts                      — COMMAND_IDS
    configuration.ts                 — CONFIGURATION_KEYS、sanitize* 関数
  domain/
    meat.ts                          — Meat / MeatCategory / MeatRarity 型
    session.ts                       — ChurrascoSessionState、SessionStatus 型
    log.ts                           — MeatLogEntry、MeatLogAction 型
  services/
    ChurrascoSessionService.ts       — セッション・タイマー・eat/pass/cooled
    MeatDeckService.ts               — drawNext 関数（シャッフル・ドロー・補充）
  ui/
    formatStatusBar.ts               — 純関数: state → 表示文字列
    StatusBarController.ts           — 1Hz countdown 描画
    NotificationController.ts        — 肉到着通知・edge 検出
    QuickPickController.ts           — 動的メニュー
  test/
    extension.test.ts                — @vscode/test-cli 統合テスト
```

M5〜M6 で追加予定の構成（`docs/roadmap.md` 参照）:

```
src/
  services/
    SatietyService.ts                — 満腹度計算（M5）
    TodayLogService.ts               — 今日のログ集計（M5）
  storage/
    ChurrascoStateRepository.ts      — ExtensionContext.globalState ラッパー（M5）
  views/
    ChurrascoTreeDataProvider.ts     — サイドバー Tree View（M6）
    ChurrascoTreeItem.ts             — Tree View アイテム（M6）
```

ユニットテストは各実装ファイルと同じ階層に `*.test.ts` で置き、Vitest が `src/**/*.test.ts`（ただし `src/test/**` を除く）を拾う。`src/test/**` 配下は VS Code 拡張ホスト上で動かす統合テスト専用。

## プロジェクト基本方針

### 目的

VS Code エディタに 10 分ごとにシュラスコの部位を届け、Eat / Pass / End で記録する軽量ゲーミフィケーション拡張。

### 技術方針

- **VS Code ネイティブ UI のみ（v0.1）**: Webview は v0.2+ に延期。StatusBar・Notification・Quick Pick・Tree View を活用
- **ゼロ外部依存（ランタイム）**: 拡張の起動・配布を軽量に保つ
- **型安全**: TypeScript の厳格モードを使用。`any` は原則禁止
- **globalState 永続化**: v0.1 の状態は ExtensionContext.globalState で管理。DB・ファイル不要
- **esbuild バンドル**: 起動を高速に保つ

## TDD サイクル

各機能は以下のサイクルで実装する:

1. **Red**: テストを書く（失敗する）
2. **Green**: 最小限の実装でテストを通す
3. **Refactor**: コードを改善する

## Tidy First? (Kent Beck)

機能変更の前に、まずコードを整理（tidy）するかを検討する:

**原則**:

- **構造的変更と機能的変更を分離する**: tidying は別コミットで行う
- **小さく整理してから変更する**: 大きなリファクタリングより、小さな整理を積み重ねる
- **読みやすさを優先**: 次の開発者（未来の自分を含む）のために整理する

**Tidying パターン**:

1. **Guard Clauses**: ネストを減らすために早期リターンを使う
2. **Dead Code**: 使われていないコードを削除
3. **Normalize Symmetries**: 似た処理は同じ形式で書く
4. **Extract Helper**: 再利用可能な部分を関数に抽出
5. **One Pile**: 散らばった関連コードを一箇所にまとめる
6. **Explaining Variables**: 複雑な式を説明的な変数に分解

**タイミング**:

- 変更対象のコードが読みにくい → Tidy First
- 変更が簡単にできる状態 → そのまま実装
- Tidying のコストが高すぎる → 機能変更後に検討

## イテレーション単位

機能を最小単位に分割し、各イテレーションで 1 つの機能を完成させる。各イテレーションでコミットを行う。
