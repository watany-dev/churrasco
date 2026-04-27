## Summary

<!-- 1〜3 行で「何を変えたか / なぜ」を書く。"why" を優先する。 -->

## Test plan

<!-- レビュアーが手動検証する手順、または "Unit tests cover X / no manual verification needed" を書く。 -->

- [ ] `pnpm ci` がローカルで通る
- [ ] (UI 変更の場合) F5 Extension Development Host で動作確認

## Docs governance checklist

`docs/README.md` の運用ルール（ADR-0006）に従っているかを確認する。該当しない項目は `n/a` を記入。

- [ ] **関連 spec を更新した**（`docs/spec/*.md` の主管マトリクスに従い、影響範囲の spec を最新化したか / または更新不要であることを確認したか）
- [ ] **SSOT 違反がない**（同じ事実を複数ファイルに書いていないか。重複時は主管文書のみに記述し、他は参照リンクに置換したか）
- [ ] **三層違反がない**（spec が `docs/roadmap.md` を参照していないか / ADR が roadmap を参照していないか / 上位文書が下位を再掲していないか）
- [ ] **関連 ADR を起こした**（アーキテクチャ的な決定・後年の参照価値がある選択を含む変更の場合は ADR を新規作成したか / 該当しない場合は n/a）

## Related

<!-- 関連 issue / ADR / PR を列挙 -->

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
