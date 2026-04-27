# ADR-0010: Sidebar Tree View design

> **Applies to ADR-0006 and later.** ADR-0001〜0005 はテンプレート制定以前の grandfather clause 対象。本テンプレートに従う必要はない（ADR-0006 §D6 / §D5 を参照）。
>
> **本 ADR は immutable**。受理後の本文書き換えは禁止。`Status` 行のみ可変（決定が逆転した場合は新 ADR を起こし、本 ADR の Status を `Superseded by ADR-NNNN` に更新）。詳細は ADR-0006 §D4。

- Status: Accepted
- Date: 2026-04-27
- Supersedes: なし

## Context

[ADR-0007](0007-persistence-layer.md) 〜 [ADR-0009](0009-today-summary-and-auto-stop.md) で M5 までのレイヤを確定し、`ChurrascoSessionService` / `TodayLogService` / `EndOfSessionSummaryController` が今日のログ・累計・満腹度を保持する状態に到達した。本 ADR-0010 は M6 (Simple sidebar) 範囲の決定を扱う。

[`docs/spec/ui.md` §Sidebar Tree View](../spec/ui.md) は表示レイアウトの SSOT を提供し、[`docs/spec/architecture.md` §ChurrascoTreeDataProvider](../spec/architecture.md) は `views/` ディレクトリと最小責務（service status / today's log / meat collection / refresh）を予告しているが、以下が未確定である:

- `ChurrascoTreeDataProvider` の API 表面（`getTreeItem` / `getChildren` のシグネチャ、コンストラクタ DI、`onDidChangeTreeData` の発火点）
- 表示構造（純関数 vs Provider 内ロジック）の責務配置
- refresh の駆動 Event 集合（`session.onStateChange` / `todayLog.onChange` / 1Hz countdown のいずれか / 全部）
- `ChurrascoTreeItem` の階層（root セクション → leaf の段数、`collapsibleState` 規約）
- 表示 locale（StatusBar / QuickPick の英語固定方針 [`docs/spec/ui.md` §Language note](../spec/ui.md) を継承するか）
- 不明 `meatId` 表示時の fallback 規約
- `viewsContainers.activitybar` 用アイコンを SVG ファイルにするか codicon 参照にするか

[`docs/packaging.md`](../packaging.md) L78-94 は `viewsContainers.activitybar.icon: "resources/churrasco.svg"` を予告しているが、当該 SVG は未配置である。VS Code API 仕様上、`viewsContainers.icon` は SVG / PNG パスのみ受け付け、codicon (`$(name)`) 参照は不可（`views.*.icon` は codicon 可だがコンテナ側は不可）。

実装は本 ADR スコープ外。`src/views/ChurrascoTreeDataProvider.ts` / `src/views/ChurrascoTreeItem.ts` / `src/views/buildSidebarSections.ts` の追加、`package.json` の `viewsContainers` / `views` 追加、`resources/churrasco.svg` 追加、`extension.ts` の配線、ドキュメント更新は後続実装フェーズで行う。本 ADR は契約のみを確定する。

## Decision

以下 7 点を Milestone 6 の Sidebar Tree View 設計として採用する。

### D1. 表示構造は純関数 `buildSidebarSections` に分離

`src/views/buildSidebarSections.ts` を `vscode` import 非依存の pure function として切り出す。Provider は `buildSidebarSections` の戻り値を `ChurrascoTreeItem` に変換する薄いラッパーに徹する。

```ts
type SidebarNode =
  | {
      kind: 'section';
      id: 'status' | 'today' | 'collection';
      label: string;
      children: SidebarNode[];
    }
  | {
      kind: 'leaf';
      label: string;
      description?: string;
      iconId?: string;
    };

export function buildSidebarSections(input: {
  state: ChurrascoSessionState;
  now: number;
  todayLog: readonly MeatLogEntry[];
  lifetime: { perMeatEncounter: Readonly<Record<string, number>>; eaten: number };
  maxSatiety: number;
  meats: readonly Meat[];
}): SidebarNode[];
```

`formatStatusBar.ts` / `formatTodayLog.ts` / `formatEndOfSessionSummary.ts` の前例（純関数 + Vitest）を踏襲。VS Code API mock を最小化してテスト容易性を最大化する。

### D2. `ChurrascoTreeDataProvider` は 2 入口の Event で refresh

`onDidChangeTreeData` の発火源は以下 2 つに限定する:

- `ChurrascoSessionService.onStateChange`
- `TodayLogService.onChange`

加えて `session.state.status === 'running'` の間だけ `refreshIntervalMs`（既定 1000ms）の `setInterval` を ensure し、Service status セクションの countdown を再描画する。`StatusBarController` の `syncRefresh` パターンを踏襲。`running` 以外では interval を clear する。

[`docs/spec/architecture.md`](../spec/architecture.md) で永続化が同じ 2 入口 Event を購読するため、refresh 駆動と永続化駆動が同じ Event ソースに揃う。

### D3. 階層は 2 段（section root → leaf）

`getChildren(undefined)` は 3 つの section root（`status` / `today` / `collection`）を返す。`getChildren(section)` は当該 section の leaf 群を返す。それ以上の入れ子は v0.1 では持たない。

`collapsibleState` は section が `Expanded`、leaf が `None`。ユーザーが手動で collapse した状態は VS Code 側が保持し、本 Provider では復元しない。

### D4. 表示 locale は英語固定

[`docs/spec/ui.md` §Language note](../spec/ui.md) で StatusBar / QuickPick が英語固定とされている方針を Tree View にも継承する。meat 名は `Meat.nameEn` を使用し、unknown meat は D6 のフォールバックに従う。

Notification は `nameJa` 混在のままで、本 ADR の対象外（[ADR-0005 §10](0005-notifications-and-meat-actions-design.md) 参照）。

### D5. Activity Bar アイコンは `resources/churrasco.svg` を SVG ファイルとして追加

`package.json` `contributes.viewsContainers.activitybar[0].icon` は SVG / PNG パスのみ受け付けるため（codicon 不可）、`resources/churrasco.svg` に最小 monochrome SVG を 1 ファイル追加し、ここから参照する。

SVG の制約は VS Code 標準ガイドラインに従う:

- viewBox 24x24
- 単色（`fill="currentColor"` または `stroke="currentColor"`）
- 装飾なし、シンボル 1 つのみ

[`docs/packaging.md`](../packaging.md) L84 の予告と整合する。codicon (`$(flame)` 等) は `views.*.icon` でのみ使用可能であり、本 ADR では `viewsContainers` 側のみが対象のため SVG 必須。

### D6. 不明 `meatId` のフォールバック表示

`buildSidebarSections` 内で `meats.find(m => m.id === entry.meatId)` が `undefined` を返した場合、表示文字列は `Unknown meat (${entry.meatId})` とする。`formatTodayLog` の既存規約（`'Unknown meat'`）から `meatId` を併記する形に拡張する。

[ADR-0007](0007-persistence-layer.md) §Fallback の「Unknown `meatId` in `todayLog` → keep the entry」と整合し、データを失わずに UI 側で識別可能な形で残す。

### D7. テスト戦略

- `buildSidebarSections` は pure function として Vitest で境界（stopped / running / meatArrived / paused / full、todayLog 空 / 多件、未知 meatId、collection 未到達）を網羅
- `ChurrascoTreeDataProvider` は Vitest で fake `EventEmitter` + `vscode` mock（`TreeItem` / `TreeItemCollapsibleState` / `ThemeIcon`）により D2 の 2 入口 refresh と 1Hz countdown ensure / clear を検証
- `ChurrascoTreeItem` は `SidebarNode` → `TreeItem` 変換の最小ケース（section / leaf）を Vitest でカバー
- 既存カバレッジ閾値（lines 80 / functions 80 / branches 75 / statements 80）を維持
- `src/test/extension.test.ts` に `churrasco.statusView` 登録の統合テストを追加

## Consequences

### Positive

- D1 の純関数化により、表示ロジックが `vscode` API 非依存となり Vitest カバレッジを稼ぎやすい（既存 formatter 群と統一）
- D2 の 2 入口 Event は永続化と同じソースを使うため、表示と保存のタイミングずれが構造的に発生しない
- D3 の 2 段階層により `getChildren` ロジックが分岐 2 件で済み、テストが単純になる
- D4 の英語固定により StatusBar / QuickPick との UI 一貫性が保たれる
- D5 の SVG ファイル化により Activity Bar への登録が VS Code API 仕様どおり動作する
- D6 の `meatId` 併記フォールバックは、将来 meat データが追加された後の旧ログ表示でも識別性が残る

### Negative

- D1 の純関数化と Provider 分離は import 経路が 1 階層増える。`buildSidebarSections` → `ChurrascoTreeDataProvider` → `extension.ts` の流れを把握する負荷
- D2 で countdown を 1Hz refresh するため、CPU 負荷は StatusBar と同じレベルで二重に発生する（v0.1 では許容範囲）
- D5 で SVG ファイル管理が増える。アイコン差し替え時にバイナリ的レビューが必要になる
- D6 のフォールバック文字列は ID を露出するため、ユーザーから見ると技術的な見た目になる（v0.1 ではログ保全を優先）

### Neutral

- D3 の 2 段階層は v0.2+ で「meat collection をカテゴリでグルーピング」する場合に再設計が必要になる（rarity / category 別表示）。本 ADR では single-pass で全 12 件を flat に並べる
- D4 の英語固定は `churrasco.locale` 設定の `ja` 値とは独立。ja=日本語化は v0.2+ の課題
- D5 の SVG はあくまでプレースホルダ品質で良い。マーケットプレース公開時にデザイン強化する前提（roadmap v0.2+ 候補）

## Alternatives considered

### A1. 表示ロジックを `ChurrascoTreeDataProvider` 内に統合（純関数化しない）

却下理由: Provider が `vscode.TreeItem` 構築と表示テキスト生成の両責務を負うことになり、Vitest 側で `vscode` mock の表面積が拡大する。`formatStatusBar` / `formatTodayLog` の前例と非対称になる。

### A2. refresh 駆動を `session.onStateChange` のみに限定

却下理由: `TodayLogService.onChange` 単独で発火するケース（`recordEncounter` / `resetToday`）でサイドバーが更新されなくなる。具体的には `resetToday` コマンドで todayLog をクリアしても画面に反映されない。

### A3. countdown refresh を行わず、状態遷移のみで再描画

却下理由: `running` 中は `nextArrivalAt` が動的に減算される値であり、`onStateChange` は arrival edge / start / pause でしか fire しない。countdown 表示が止まって見える UX 退行。

### A4. 階層を 3 段以上にする（meat を category 別にグルーピング）

却下理由: v0.1 では 12 種しかなく、flat 表示で視認性が十分。`MeatCategory` を ADR-0002 §A で `domain/meat.ts` 内部の非 export 型に留める方針があり、export 化はカテゴリ表示が必要になった時点（v0.2+）で行うのが整合的。

### A5. Activity Bar アイコンを codicon (`$(flame)`) で指定

却下理由: VS Code API 仕様により `contributes.viewsContainers.*.icon` は codicon 参照を受け付けない（SVG / PNG パスのみ）。`views.*.icon` とは異なる仕様であり、ここで誤った指定をすると登録時にエラーログが出る。

### A6. Activity Bar に独立コンテナを置かず、Explorer view container にネスト

却下理由: [`docs/packaging.md`](../packaging.md) L78-94 で独立 `viewsContainers.activitybar.churrasco-break` の予告があり、[`docs/spec/ui.md` §Sidebar Tree View](../spec/ui.md) の例レイアウトもサイドバー直下を想定している。Explorer ネストにすると、コードを書いていない時間帯（拡張機能のメインユース）でアクセスできない。

### A7. 不明 `meatId` を `'Unknown meat'` 固定（ID 非露出）

却下理由: `formatTodayLog.ts` の現行表示と揃うが、複数の不明 meat が混在した場合に区別がつかない。ID 併記により旧データのデバッグや手動修正の手がかりが残る。v0.1 のターゲットユーザー（開発者）は ID 露出を許容できる前提。

### A8. Tree View の locale を `churrasco.locale` 設定で切り替え可能にする

却下理由: 設定駆動の locale 切り替えは v0.2+ の "English UI" 候補（[`docs/roadmap.md`](../roadmap.md)）であり、StatusBar / QuickPick とまとめて将来実装するのが整合的。M6 単独で部分実装すると UI 全体が混在状態になる。

### A9. `ChurrascoTreeDataProvider` を `Disposable` にしない

却下理由: 1Hz refresh の `setInterval` と onStateChange / onChange の購読を保持するため、`extension.ts` の `subscriptions` 経由で teardown する必要がある。`StatusBarController` / `EndOfSessionSummaryController` と同じパターン。

## Related ADRs

- [ADR-0004](0004-statusbar-and-quickpick-design.md): StatusBar / QuickPick 設計。本 ADR §D2 / §D4 が refresh パターンと locale を継承
- [ADR-0006](0006-docs-governance.md): docs governance。本 ADR §D1 / §D5 が SSOT 引用と spec/packaging との整合を維持
- [ADR-0007](0007-persistence-layer.md): 永続化レイヤ。本 ADR §D6 の fallback が `keep the entry` ポリシーを継承
- [ADR-0008](0008-today-log-and-satiety.md) §D6: `extension.ts` "wiring only" 原則。本 ADR §D2 が refresh 配線にこの原則を適用
- [ADR-0009](0009-today-summary-and-auto-stop.md) §D5: UI Controller が両サービスを購読するパターン。本 ADR §D2 がこれを Provider に拡張
