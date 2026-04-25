# CLAUDE.md

## Project Overview

Churrasco Break は VS Code 拡張。10分ごとに異なる部位のシュラスコを届け、**Eat / Pass / End for the day** で応答する軽いリズムを提供する。TypeScript で実装し、VS Code Extension Host 上で動作する。

## Build & Development

```bash
npm install                  # 依存インストール
npm run compile              # TypeScript コンパイル（tsc + esbuild）
npm run watch                # ウォッチモード
npm run lint                 # ESLint チェック
npm run lint --fix           # ESLint 自動修正
npm run test                 # 全ユニットテスト（Mocha）
npm run package              # .vsix パッケージング（vsce）
```

### Prerequisites

- Node.js 20 以上
- VS Code 1.85 以上（拡張テスト用）

### Completion Requirements

**各タスク完了時**、コミット前に以下の全 CI チェックを必ず通すこと:

```bash
npm run compile && npm run lint && npm run test
```

1. `compile` — TypeScript コンパイル成功
2. `lint` — ESLint エラーなし
3. `test` — 全ユニットテスト成功

**これらのステップは絶対にスキップしないこと。** タスク単位で CI を通すのは最低限の品質基準である。

## Architecture

```
src/
  extension.ts               — ワイヤリングのみ（DI ルート）
  constants/
    meats.ts                 — 肉リスト定数
    commands.ts              — コマンド ID 定数
    configuration.ts         — 設定キー定数
  domain/
    meat.ts                  — Meat エンティティ型
    session.ts               — セッション状態型
    log.ts                   — 今日のログ型
  services/
    ChurrascoSessionService.ts  — セッション開始・停止・タイマー・肉到着
    MeatDeckService.ts          — シャッフル・ドロー・デッキ補充
    SatietyService.ts           — 満腹度計算
    TodayLogService.ts          — 今日のログ集計
  storage/
    ChurrascoStateRepository.ts — ExtensionContext.globalState ラッパー
  ui/
    StatusBarController.ts   — ステータスバー表示・更新
    NotificationController.ts — 肉到着通知・ユーザー選択転送
    QuickPickController.ts   — Quick Pick メニュー
  views/
    ChurrascoTreeDataProvider.ts — サイドバー Tree View
    ChurrascoTreeItem.ts         — Tree View アイテム
  test/
    MeatDeckService.test.ts
    ChurrascoSessionService.test.ts
    extension.test.ts
```

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
