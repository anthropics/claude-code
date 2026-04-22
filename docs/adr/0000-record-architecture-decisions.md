# 0000. ADR プロセスを採用する

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: haruna

## Context

プロジェクトを進める中で、技術選定・インフラ設計・ライブラリ採用などの判断を幾度も下す。Slack や README の断片では文脈が失われ、半年後に「なぜこれを選んだのか？」が分からなくなる。

Michael Nygard 氏提唱の ADR 形式は、軽量なテキストファイルで**決定時の文脈**を残せるため、ソフトウェアエンジニアリング界で広く採用されている。

## Decision

`docs/adr/` に ADR を蓄積する。

- 形式: Markdown、Michael Nygard テンプレート
- ファイル名: `<4桁連番>-<短いケバブケース>.md`
- 必須項目: Status, Date, Deciders, Context, Decision, Consequences
- 推奨項目: Alternatives considered, References

判断を覆す場合は元 ADR を変更せず、新 ADR で Supersedes 関係を記録する。

## Consequences

### Positive
- 後から経緯を追える。新規メンバーが判断背景を理解できる
- サブエージェントレビュー時にも ADR を参照できる

### Negative
- 軽微な判断まで ADR を書くと形骸化するため、**1 ファイルあたり合計 10-20 行で書ける規模の判断**には使わない
- 会議時間短縮のため、決定までの議論内容は省略し結論中心に記述する

## Alternatives considered

1. **README.md の章として残す**: 判断が増えると README が肥大化し、見つけにくくなる。却下
2. **GitHub Wiki**: Discoverability は良いが、コードと ADR の相関（コミットに紐づけた参照）が取りにくい。却下
3. **Notion / Confluence**: 検索性は高いが、オフライン閲覧と Git 履歴統合ができない。却下

## References
- [Michael Nygard — Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [adr-tools](https://github.com/npryce/adr-tools)
