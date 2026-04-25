---
description: churrasco のドキュメント（docs/spec/*.md、README.md、docs/roadmap.md）をソースコードの現状に合わせて最新化するスキル。トリガー例 - 「ドキュメントを最新化して」「設計書を更新」「update docs」「README を直して」「docs と src の乖離を確認」「sync documentation」。
---

# update-docs

ソースコードの現状に基づき、すべてのドキュメントを一括で最新化するスキル。

## Phase 1: ソースコードの現状把握

1. `src/` 配下の TypeScript ソースコードを読み込む
   - `src/extension.ts` — ワイヤリング・DI ルート
   - `src/constants/` — 肉リスト・コマンド ID・設定キー定数
   - `src/domain/` — Meat・SessionState・Log エンティティ型
   - `src/services/` — ビジネスロジック
     - `ChurrascoSessionService.ts` — セッション管理・タイマー
     - `MeatDeckService.ts` — シャッフル・ドロー
     - `SatietyService.ts` — 満腹度計算
     - `TodayLogService.ts` — ログ集計
   - `src/storage/` — `ChurrascoStateRepository.ts`（globalState ラッパー）
   - `src/ui/` — StatusBar・Notification・Quick Pick コントローラ
   - `src/views/` — Tree View プロバイダ・アイテム
2. `package.json` のコマンド・依存関係・VS Code エンジンバージョンを確認する
3. `tsconfig.json` のコンパイル設定を確認する
4. 公開 API・型・コマンド一覧を把握する

## Phase 2: 各ドキュメントの更新

### 2-1. 設計書 (`docs/spec/*.md`)

1. 各設計書の内容をソースコードと照合する
2. 以下を更新する:
   - モジュール構成の変更
   - 型・インターフェースの追加・変更・削除
   - 関数シグネチャの変更
   - VS Code API の利用方法の変更
3. 設計書が存在しない新機能がある場合、設計書の新規作成を提案する

### 2-2. README.md

1. プロジェクト概要が最新か確認する
2. インストール・ビルド手順を確認する
   - `npm install`・`npm run compile`・`npm run test` が正しいか
   - `package.json` のバージョン・エンジン要件と整合しているか
3. コマンド一覧（`Churrasco: Start Service` 等）が `package.json` の contributes.commands と一致しているか
4. 設定項目（`churrasco.intervalMinutes` 等）が `package.json` の contributes.configuration と一致しているか

## Phase 3: 一貫性チェック

すべてのドキュメント間で以下の一貫性を確認する:

1. **クラス名・型名の統一**
   - すべてのドキュメントで同じ名前を使用しているか
2. **コマンド参照の統一**
   - `npm run compile` / `npm run test` / `npm run lint` が正しく参照されているか
   - `zig` / `cargo` / `make` 等の他言語コマンドが残っていないか
3. **ファイルパス参照の統一**
   - `src/extension.ts`、`src/services/` 等のパスが正しいか
   - 存在しないファイルへの参照がないか
4. **依存情報の統一**
   - `package.json` に記載されたパッケージとドキュメントの記載が一致しているか
   - ランタイム依存ゼロの方針が維持されているか

## Phase 4: 更新レポートの出力

以下の形式で更新内容をレポートする:

```markdown
## ドキュメント更新レポート

### 更新したドキュメント
| ファイル | 更新内容 |
|---------|---------|
| docs/spec/xxx.md | [変更概要] |
| README.md | [変更概要] |
| ... | ... |

### 新規作成を提案するドキュメント
- [ファイル名]: [理由]

### 検出した不整合
- [不整合の詳細]
```

## 記述ルール

- コード例は TypeScript で記述すること
- README.md は英語で記述すること
- 設計書（docs/spec/）は日本語で記述すること
- クラス名・インターフェース名は PascalCase に従うこと
- 関数名・変数名は camelCase に従うこと
