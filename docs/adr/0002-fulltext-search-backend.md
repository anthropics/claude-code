# 0002. 全文検索バックエンドの選定

- **Status**: Proposed（Phase 2 冒頭で PoC し確定する）
- **Date**: 2026-04-21（提案日）
- **Deciders**: haruna（architect サブエージェントレビュー済み 2026-04-21）
- **Related**: [docs/ARCHITECTURE.md §4.3](../ARCHITECTURE.md), [docs/SPEC.md §10](../SPEC.md)

## Context

SPEC §10 でツイート本文と記事に対する全文検索を要件としている:

- 日本語検索（形態素解析）
- タグ / 投稿者 / 期間 / コンテンツ種別 / has:image / has:code などのフィルタ演算子
- コードスニペットを含むツイート本文の検索
- 初期ユーザー 2,000 名、1 年後のツイート数想定 20 万件

architect レビューで Meilisearch + EFS + Fargate 構成に疑問が提起された:

- EFS は IOPS 課金で検索ワークロードと相性が悪い
- Fargate 再起動時にインデックス再読込で数分のダウンタイム
- MVP 規模なら RDS の拡張機能で十分な可能性

## Decision（Proposed）

**MVP は PostgreSQL `pg_bigm` + Lindera を仮採用する。**

- RDS PostgreSQL の parameter group で `pg_bigm` 拡張を有効化（[P0.5-03](https://github.com/haruna0712/claude-code/issues/16) で実施）
- Django ORM + Raw SQL で N-gram 検索を実装
- Phase 2 冒頭（1〜2 日）で実データを用いた **精度検証スパイク**を実施し、以下のどちらかで本決定する:
  - 精度が要件を満たす → `pg_bigm` 正式採用、本 ADR を `Accepted` へ
  - 精度不足 → Meilisearch on EC2 (`t4g.small` + EBS) へ移行、本 ADR を `Superseded by 000X` で Meilisearch ADR を新規作成

## 評価軸

| 軸 | pg_bigm | Meilisearch on EC2 | OpenSearch Serverless |
|---|---|---|---|
| 月額コスト（stg） | $0 (RDS 内) | +$20/月 | **$700+/月**（2 OCU indexing + 2 OCU search × $0.24/h × 730h の最小構成、常時稼働時） |
| 運用対象数 | 1 (RDS) | 2 (RDS + EC2) | 2 |
| 日本語精度 | Lindera 併用で高 | Lindera プラグインで最高水準 | kuromoji で高 |
| フィルタ演算子 | SQL で柔軟 | 高速だが表現力はやや劣る | 両者の中間 |
| コードスニペット検索 | LIKE + N-gram で可 | 高性能 | 高性能 |
| 本番移行時のスケール | リードレプリカで伸ばす | クラスタ構築必要 | マネージドで自動 |

## Consequences

### Positive
- MVP コスト最小化
- 運用対象を RDS 1 つに集約
- 後から Meilisearch や OpenSearch へ移行する場合も `apps.search` 配下の Repository を差し替えるだけで済むよう設計する

### Negative
- `pg_bigm` は 2-gram ベースで、単一文字検索は不正確
- RDS の負荷が上がるため TL バッチとの競合に注意
- Lindera の辞書更新はメンテナンスコスト

## Alternatives considered

### Meilisearch + EFS + Fargate（元提案）
- 却下理由: EFS の IOPS 制約とタスク再起動時のインデックス再読込

### Meilisearch + EBS + EC2
- 保留: pg_bigm で不足した場合の次善策

### OpenSearch Serverless
- 却下理由: 最小 4 OCU 常時稼働で **月額 $700+** が現時点の実コスト
  （2 OCU indexing + 2 OCU search × $0.24/h × 730h）。stg 予算 ¥20-30k/月
  に対して 1 桁違うため却下

### PostgreSQL tsvector + GIN index
- 却下理由: 日本語対応が弱い（trigram との併用が必要だが pg_bigm の方が素直）

## Validation Criteria（Phase 2 PoC）

- ツイート 10,000 件・記事 200 件を投入
- 以下のクエリで検索結果が人間レビューで妥当と判定されること:
  - `python デコレータ`（複合キーワード）
  - `type:article tag:go`（フィルタ演算子）
  - `@username from:2026-01-01`（投稿者 + 期間）
  - `gRPC ストリーミング`（カタカナ＋英字混在）
- p95 検索レスポンス < 300ms

## References
- [docs/ARCHITECTURE.md §4.3](../ARCHITECTURE.md)
- [docs/SPEC.md §10](../SPEC.md)
- [pg_bigm 公式](https://pgbigm.osdn.jp/pg_bigm-1-2.html)
- [Lindera](https://github.com/lindera/lindera)
- architect レビュー: docs/REVIEW_CONSOLIDATED.md H-5
