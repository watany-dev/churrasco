# ADR-NNNN: <title>

> **Applies to ADR-0006 and later.** ADR-0001〜0005 はテンプレート制定以前の grandfather clause 対象。本テンプレートに従う必要はない（ADR-0006 §D6 / §D5 を参照）。
>
> **本 ADR は immutable**。受理後の本文書き換えは禁止。`Status` 行のみ可変（決定が逆転した場合は新 ADR を起こし、本 ADR の Status を `Superseded by ADR-NNNN` に更新）。詳細は ADR-0006 §D4。

- Status: Proposed | Accepted | Superseded by ADR-NNNN
- Date: YYYY-MM-DD
- Supersedes: なし | ADR-NNNN

## Context

この決定に至った状況・問題を記す。読者が「なぜ判断が必要だったのか」を ADR 単体で理解できるよう、前提となる事実・制約・既存の設計を簡潔に提示する。リンクで `docs/spec/*.md` の用語を引用するのは可（ADR-0006 §D3）。再掲は避ける。

## Decision

採用した決定を記す。複数の決定がある場合は D1, D2, ... と番号を振り、それぞれを独立して参照可能にする。実装詳細は spec に委ね、ここでは「何を選んだか」を明確に書く。

## Consequences

決定の結果生じる影響を記す。Positive / Negative / Neutral の小見出しを使い、tradeoff を正直に書く。後年「この決定で何が起きたか」を検証できるよう、観測可能な影響を優先する。

### Positive

- ...

### Negative

- ...

### Neutral

- ...

## Alternatives considered

検討した代替案と却下理由を記す。**この節を省略してはならない**（ADR-0006 §D5）。「思いつきで決めた」ADR の混入を防ぐため、最低 1 つの代替案を列挙し、なぜ却下したかを書く。

### A1. <案の名前>

却下理由: ...

### A2. <案の名前>

却下理由: ...

## Related ADRs

- ADR-NNNN: <タイトル>（関係性を一行で）
