# Churrasco Break — Documentation

Design, behavior, and roadmap for the Churrasco Break VS Code extension.

If you are new here, start with the [Overview](spec/overview.md) and skim the [UI](spec/ui.md) mockups to get a feel for the experience. Implementers should follow the [Roadmap](roadmap.md) milestones in order.

## Specification

- [Overview](spec/overview.md) — concept, target users, v0.1 scope
- [UI](spec/ui.md) — status bar, notifications, Quick Pick, sidebar, today's log, end-of-session summary
- [Meats](spec/meats.md) — meat entity, default meat list, draw rules
- [State & Commands](spec/state-and-commands.md) — session state, persistence, command catalog, settings
- [Architecture](spec/architecture.md) — tech stack, directory layout, module responsibilities
- [Acceptance Criteria](spec/acceptance.md) — definition of done for v0.1, implementation priority

## Project

- [Roadmap](roadmap.md) — v0.1 milestones (M0–M7) and v0.2+ candidates
- [Packaging](packaging.md) — `package.json` blueprint

## Architecture Decision Records

- [ADR-0001](adr/0001-development-startup-strategy.md) — development startup strategy for v0.1
- [ADR-0002](adr/0002-meat-deck-service-design.md) — `MeatDeckService` design (M1)
- [ADR-0003](adr/0003-session-and-timer-design.md) — `ChurrascoSessionService` and timer design (M2)
- [ADR-0004](adr/0004-statusbar-and-quickpick-design.md) — status bar and Quick Pick design (M3)
- [ADR-0005](adr/0005-notifications-and-meat-actions-design.md) — notifications and meat actions (M4)
- [ADR-0006](adr/0006-docs-governance.md) — docs governance: SSOT, three-layer structure, ADR immutability
- [ADR-0007](adr/0007-persistence-layer.md) — persistence layer (M5)
- [ADR-0008](adr/0008-today-log-and-satiety.md) — today log and satiety services (M5)
- [ADR-0009](adr/0009-today-summary-and-auto-stop.md) — today summary and auto-stop UI flow (M5)
- [ADR-0010](adr/0010-sidebar-tree-view-design.md) — sidebar Tree View design (M6)

ADR テンプレート: [`adr/_template.md`](adr/_template.md)（ADR-0006 以降に適用）

---

# Documentation Conventions

`docs/` 配下のドキュメント運用ルール。決定経緯と代替案の検討は [ADR-0006](adr/0006-docs-governance.md) を参照。**本セクションは現行ルールのスナップショット**で、ルール自体が変わる場合は新 ADR を起こし、本ファイルを更新する。

## ディレクトリ構造と三層 + 1 軸

```
docs/
├── README.md            ← 本ファイル（ナビゲーション + 運用ルールの現行版）
├── spec/                ← 第 1〜2 層
│   ├── overview.md      ← 第 1 層: なぜ作るか（ユーザー像・目的・価値・スコープ）
│   ├── meats.md         ← 第 2 層: 何を作るか（主題別仕様）
│   ├── state-and-commands.md
│   ├── ui.md
│   ├── architecture.md
│   └── acceptance.md
├── adr/                 ← 第 3 層: どう決めたか
│   ├── _template.md     ← ADR-0006 以降に適用される固定章構成
│   ├── 0001-...md       ← grandfather clause（テンプレ非準拠）
│   └── ...
└── roadmap.md           ← 第 4 軸: 時系列の計画（揮発性高）
```

- **第 1 層 `overview.md`**: 不変の目的を語る。ユーザーが何者で、なぜこの拡張が要るか。
- **第 2 層 `spec/*.md`**: 現状の事実としての仕様。「何が、どう振る舞うか」を主題別に書く。
- **第 3 層 `adr/*.md`**: 過去のある時点での決定スナップショット。**immutable**。
- **第 4 軸 `roadmap.md`**: 時系列の計画。揮発性が高いため、他層から独立した軸として扱う。

## 主管マトリクス（SSOT）

各概念には主管文書を一つ定める。重複時はここが正、他は参照リンクのみ。

| 主管文書 | 担う領域 |
|---------|---------|
| `spec/overview.md` | ユーザー像・目的・価値・v0.1 スコープ |
| `spec/meats.md` | `Meat` 型・12 種データ・抽選ルール |
| `spec/state-and-commands.md` | 状態型・コマンド・設定・**永続化スキーマ** |
| `spec/ui.md` | StatusBar / Notification / QuickPick / TreeView / サマリー UI |
| `spec/architecture.md` | 技術スタック・モジュール責務・ディレクトリ構成・**エラーハンドリング** |
| `spec/acceptance.md` | 受け入れ基準 |

新概念を追加する際は、まずこの表のどの主管に属するかを決め、そこに書く。複数主管にまたがる場合は分割を検討する。

## 参照方向ルール

- **原則は単方向**: 上位 → 下位（`overview` → `spec/*` → `adr/*`）の方向で参照する。
- **下位が上位の用語を引用するのは可**: ADR が `state-and-commands.md` の型名を引用する等。リンク必須。
- **再掲は禁止**: 同じ型定義・同じ振る舞い記述を複数箇所に書かない。
- **`roadmap.md` は分離軸**: `spec/*` および `adr/*` から `roadmap.md` を参照することは**禁止**（時間軸の依存を作らない）。逆に `roadmap.md` から `spec/adr/` を参照することは可。
- **spec にロードマップ的記述を書かない**: "M5 で〜"・"将来〜"・"v0.2 で〜" は `roadmap.md` に集約。

## ADR ルール

### 新規作成

新規 ADR は [`adr/_template.md`](adr/_template.md) に従う。

1. **Status**: Proposed → Accepted、必要なら後日 `Superseded by ADR-NNNN`
2. **Context**: 状況・問題
3. **Decision**: 採用した決定（複数なら D1, D2, ... と番号化）
4. **Consequences**: Positive / Negative / Neutral の影響
5. **Alternatives considered**: 検討した代替案と却下理由（**省略不可**）
6. **Related ADRs**: 関連 ADR

ファイル名は `NNNN-<slug>.md`（4 桁ゼロパディングの連番）。`_template.md` のようにアンダースコア接頭辞のファイルは連番から除外。

### 更新

- ADR は **immutable**。受理後の本文書き換えは禁止。
- 例外は `Status` 行のみ。決定が逆転した場合、新 ADR を起こし、旧 ADR の Status を `Superseded by ADR-NNNN` に更新する。
- 既存 ADR-0001〜0005 は本テンプレート制定以前の grandfather clause 対象。章構成を新テンプレートに合わせる修正は行わない。

### 廃止

ADR を「廃止」するには新 ADR で superseding する。ADR ファイル自体の削除は行わない。

## 既存 spec の整合化

既存 spec で governance 違反が見つかった場合、以下の機械的 3 判定のみを修正対象とする（グレーゾーンは次回点検フェーズに持ち越す）。

1. **ロードマップ的記述の混入**: spec 中の "M5 で〜"・"v0.2 で〜"・"将来〜" を削除し、必要なら `roadmap.md` に移す。
2. **同概念の二重記述**: 主管マトリクスに従い片方を削除し、他は参照リンクに置換。
3. **既存 ADR は触らない**: ADR immutable / grandfather clause により対象外。

## 継続検証

PR テンプレート [`../.github/pull_request_template.md`](../.github/pull_request_template.md) に docs governance チェックリストを埋め込み、レビュー時に違反を検出する。

- 関連 spec の更新有無
- SSOT 違反（重複記述）の有無
- 三層違反（参照方向）の有無
- 関連 ADR の必要性

機械チェック（リンク切れ・ADR 連番ギャップ・テンプレ必須セクション欠落）の CI 化は別マイルストーンに切り出している。

## ルールの変更

本ファイルのルール自体を変更する場合は、新 ADR を起こして決定経緯を記録した上で本ファイルを更新する（ADR-0006 §D8）。「現行ルール = `docs/README.md`、決定理由 = ADR」の役割分担を維持する。
