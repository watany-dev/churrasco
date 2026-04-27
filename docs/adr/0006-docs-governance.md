# ADR-0006: Docs governance — SSOT, three-layer structure, ADR immutability

- Status: Accepted
- Date: 2026-04-27
- Supersedes: なし

## Context

`docs/spec/*.md`（6 ファイル）と `docs/adr/0001〜0005.md`（5 ファイル）が M0〜M4 を経て蓄積された結果、以下の構造的問題が顕在化した。

1. **重複と不整合**: `MeatLogEntry` 型が `state-and-commands.md` と `architecture.md` の両方で言及される、`ChurrascoSessionService` の責務が複数 spec に分散する、など「同じ事実が複数箇所に書かれ、片方が更新されると齟齬が生じる」典型的な SSOT 違反が散在する。
2. **参照方向の曖昧さ**: spec から ADR を引く、ADR が roadmap を引く、spec がロードマップ的記述（"M5 で〜"、"将来〜"）を内包する、など階層の混在が発生していた。
3. **ADR の章構成のブレ**: ADR-0001〜0005 の節構成（番号付き節 vs 名前付き節、Alternatives の位置、Status 表記）が個別に異なり、新規 ADR を書く際にどの形式を踏襲すべきか判断が要る。
4. **継続検証の欠如**: docs 品質を継続的に保つ仕組み（PR テンプレート / CI チェック）が存在せず、M5 以降も同種の問題が再発する見込みが高い。

M5（永続化・ログ・満腹度・サマリー）着手にあたり、新たに 3 本以上の ADR と複数 spec の追記が発生する。governance を確立せず M5 に進むと、上記問題が指数的に膨らむ。本 ADR は M5 着手前に docs 運用ルールを確定させるための決定を記録する。

## Decision

`docs/` 配下のドキュメント運用について、以下を決定する。

### D1. SSOT（Single Source of Truth）+ 三層構造を採用する

ドキュメントは三層に分け、各概念には主管文書を一つ定める。

- **第 1 層 — `docs/spec/overview.md`**（なぜ）: ユーザー像・目的・価値・v0.1 スコープ
- **第 2 層 — `docs/spec/*.md`**（何を）: 主題別の仕様
- **第 3 層 — `docs/adr/*.md`**（どう決めたか・代替案）: 決定の記録

これとは独立した第 4 軸として **`docs/roadmap.md`**（時系列の計画、揮発性が高い）を置く。

### D2. 主管マトリクス

各概念の主管 spec を以下に固定する。重複時はここが正、他は参照のみ。

| 主管文書 | 担う領域 |
|---------|---------|
| `docs/spec/overview.md` | ユーザー像・目的・価値・v0.1 スコープ |
| `docs/spec/meats.md` | `Meat` 型・12 種データ・抽選ルール |
| `docs/spec/state-and-commands.md` | 状態型・コマンド・設定・**永続化スキーマ** |
| `docs/spec/ui.md` | StatusBar / Notification / QuickPick / TreeView / サマリー UI |
| `docs/spec/architecture.md` | 技術スタック・モジュール責務・ディレクトリ構成・**エラーハンドリング**|
| `docs/spec/acceptance.md` | 受け入れ基準 |

### D3. 参照方向ルール

- 上位 → 下位の単方向参照を原則とする（`overview` → `spec/*` → `adr/*`）。
- 下位文書が上位文書の用語を**引用**するのは可（リンク付き）。例: ADR が「`spec/state-and-commands.md` の `PersistedSnapshot` をこう実装する理由」を語る。
- **再掲は禁止**。同じ型定義・同じ振る舞い記述を複数箇所に書かない。
- `docs/roadmap.md` は第 4 独立軸として扱う。`spec/*` および `adr/*` から roadmap を参照することは禁止（時間軸の依存を作らない）。逆に roadmap から spec/adr を参照することは可。

### D4. ADR は厳格 immutable とする

- 受理された ADR の本文は書き換えない。
- 例外は `Status` 行のみ。決定が逆転した場合、新 ADR を起こし、旧 ADR の Status を `Superseded by ADR-NNNN` に更新する。
- これにより各 ADR は「ある時点での決定スナップショット」として機能する。

### D5. ADR テンプレートを `docs/adr/_template.md` に定める

新規 ADR は以下の固定章構成に従う。

1. **Status**: Accepted / Superseded by ADR-NNNN
2. **Context**: この決定に至った状況・問題
3. **Decision**: 採用した決定
4. **Consequences**: 決定の結果生じる影響、tradeoff
5. **Alternatives considered**: 検討した代替案と却下理由
6. **Related ADRs**: 関連 ADR への参照

`_template.md` はアンダースコア接頭辞で ADR 連番（0001〜）から除外する。

### D6. 既存 ADR-0001〜0005 は grandfather clause

ADR-0001〜0005 はテンプレート制定以前の文書であり、章構成を新テンプレートに合わせる修正は行わない。`_template.md` には「Applies to ADR-0006 and later」と明記する。これは D4（immutability）の貫徹でもある。

### D7. 継続検証は PR テンプレートで行う

`.github/pull_request_template.md` に以下のチェックリストを追加する。

- 関連 spec を更新したか（または更新不要であることを確認したか）
- SSOT 違反がないか（同じ事実を複数箇所に書いていないか）
- 三層違反がないか（spec が roadmap を参照していないか、ADR が roadmap を参照していないか、上位文書が下位を再掲していないか）
- 関連 ADR を起こしたか（必要な場合）

CI による機械チェック（リンク切れ・ADR 連番ギャップ・テンプレ必須セクション欠落）は別マイルストーンに切り出す。

### D8. 運用ルールの現行版は `docs/README.md` に置く

D1〜D7 の運用ルールは `docs/README.md` に明文化し、`docs/` 配下の入口とする。本 ADR は決定経緯（なぜこのルールにしたか）を記録するスナップショットであり、現行ルールの参照先は `docs/README.md` とする。ルール自体が将来更新される場合は新 ADR で superseding する。

### D9. M5 着手前の後ろ向き整備の判定基準

M0〜M4 の既存 spec で既存問題を是正する際は、以下の機械的 3 判定のみを修正対象とする。

1. **ロードマップ的記述の混入**: spec 中の "M5 で〜"、"v0.2 で〜"、"将来〜" を削除（roadmap は `docs/roadmap.md`）
2. **同概念の二重記述**: 主管マトリクス（D2）に従い片方を削除し参照に置換
3. **既存 ADR は触らない**（D4 / D6）

グレーゾーン（粒度・表現のブレ）は M6 着手前の点検フェーズに持ち越す。

## Consequences

### Positive

- 新規参加者は `docs/README.md` → `docs/spec/overview.md` → 主題別 spec → 関連 ADR の単方向で読み進められる。
- M5 以降の新規 ADR は `_template.md` の固定構造に従うため、レビューが「Status を確認 → Context を読む → Decision と Alternatives で判断する」という定型読解になる。
- ADR が immutable であることで、git history を追わずに ADR ファイル単体で「その時点の決定」が読める。
- 主管マトリクス（D2）により「永続化スキーマはどこに書くべきか」のような曖昧判断がレビュー時に発生しない。

### Negative

- M5 着手前に 2 PR（governance 確立 + M5 設計）の前段が増え、実装着手が遅延する。
- 既存 ADR-0001〜0005 が新テンプレートと章構成上整合しない状態が永続化する（grandfather clause）。これは ADR コミュニティの慣習に沿うが、初見では違和感を生む可能性がある。
- 継続検証を PR テンプレート（人間判断）に依存するため、レビュアーが見落とせば違反が混入する。CI 機械チェックの導入までこのリスクは残る。

### Neutral

- M5 ADR は 4 本（ADR-0006 governance / 0007 persistence / 0008 today log + satiety / 0009 today summary + auto-stop）に分割される。既存 ADR-0001〜0005 の「マイルストーン単位 = ADR 単位」の慣例から「テーマ単位 = ADR 単位」へ移行する。

## Alternatives considered

### A1. ガバナンスを ADR-0006 に書くだけで spec/README には書かない

却下理由: ADR は immutable な決定スナップショットであり、現行ルールの参照先としては機能しづらい。5 年後に「現行ルールはどこ？」と探した時、複数 ADR を時系列で追って最新版を組み立てる必要が生じる。`docs/README.md` という単一の現行ルール文書を別に置く方が運用が軽い（D8）。

### A2. 既存 ADR-0001〜0005 をテンプレートに合わせて整形（一回限りの例外）

却下理由: ADR の immutability（D4）を一回でも例外的に破ると、原則の信頼性が下がる。既存 ADR の章構成は「その時点でのチームの書き方」を記録しており、それ自体が歴史的事実。テンプレート整形は表面上の見栄えだけ整えるが、節の再構成は微妙な意味のシフトを伴うリスクがある。

### A3. SSOT のみ採用（三層構造は明文化しない）

却下理由: SSOT だけでは「同じ階層の spec 同士で重複したらどちらが主管か」は決まるが、「ADR が overview を再掲してよいか」のような階層方向の判断が定まらない。現状の ADR-0003〜0005 は spec を引用する運用が既に確立しており、これを明文化する三層構造とセットで採用する方が自然。

### A4. CI で機械チェックを入れる（M5 と同時実施）

却下理由: M5 はすでに ADR 4 本 + spec 改修 + 実装で重い。docs tooling を混ぜるとレビュー対象が増えすぎ、本来の M5 設計判断が埋もれる。機械チェックは別マイルストーン（例: 0.1.1 docs tooling）に切り出す。本 ADR は人間判断（PR テンプレ）に絞る（D7）。

### A5. M5 着手と並行して spec 整備を進める

却下理由: M5 実装中に「この記述は spec に書いてあるが ADR にもある、どちらが正？」の判断が頻発する想定。先に SSOT で「主管はこっち」を確定させておけば、M5 実装中の判断コストが下がる。並行進行は「ついで修正」が分散して全体像が見えず、トータル工数が増える。

### A6. ADR-0006 を 1 本に集約せず、SSOT 用と immutability 用と参照方向用に分割

却下理由: D1〜D9 は相互依存しており（例: D4 immutability と D5 テンプレートと D6 grandfather clause は一体の決定）、別 ADR に分けると相互参照が必要になる。一つの governance 決定として 1 ADR にまとめる方が後年の参照性が高い。

## Related ADRs

- ADR-0001: Development startup strategy（grandfather clause 対象、テンプレート非準拠）
- ADR-0002: Meat deck service design（同上）
- ADR-0003: Session and timer design（同上）
- ADR-0004: Status bar and quick pick design（同上）
- ADR-0005: Notifications and meat actions design（同上）
- ADR-0007 (planned): Persistence layer（本 ADR の D5 テンプレートに準拠する初の ADR）
- ADR-0008 (planned): Today log and satiety services
- ADR-0009 (planned): Today summary and auto-stop UI flow
