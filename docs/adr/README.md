# Architecture Decision Records (ADR)

本ディレクトリはプロジェクトの重要なアーキテクチャ判断を**決定時の文脈ごと**記録する。形式は Michael Nygard 方式。

## 目的

- 「なぜこの技術/構成を選んだか」を未来の自分・開発者に残す
- 後日の見直し時に、**当時の前提条件**と**決定理由**を一緒に参照できる
- 判断を覆す場合は、元の ADR を変更せず **Supersedes** 関係で新 ADR を追加する

## ファイル命名規則

```
<4桁連番>-<短いケバブケース>.md
```

例: `0001-use-ecs-fargate-for-stg.md`

新規 ADR は `0000-record-architecture-decisions.md` をテンプレートとしてコピーし、連番をインクリメント。

## ステータス

| Status | 意味 |
|---|---|
| Proposed | 提案段階、未承認 |
| Accepted | 承認済み、実装反映対象 |
| Deprecated | 過去に採用していたが現在は使っていない |
| Superseded by NNNN | 別 ADR で置き換えられた |

## 一覧

| # | タイトル | Status |
|---|---|---|
| [0000](./0000-record-architecture-decisions.md) | ADR プロセスを採用する | Accepted |
| [0001](./0001-use-ecs-fargate-for-stg.md) | stg 環境に ECS Fargate を採用 | Accepted |
| [0002](./0002-fulltext-search-backend.md) | 全文検索バックエンドの選定 | Proposed |
| [0003](./0003-jwt-httponly-cookie-auth.md) | 認証トークン運搬に JWT + HttpOnly Cookie を採用 | Accepted |

## 今後作成予定の ADR

| # | 予定タイトル | 優先度 | 根拠 |
|---|---|---|---|
| 0004 | Celery タスク設計 (キュー分割 / acks_late / リトライ戦略) | High | ADR-0001 の Spot 運用と直結、Phase 7 Bot 着手前に必要 |
| 0005 | pg_bigm 正式採用 or Meilisearch 移行 (ADR-0002 の Supersedes) | High | Phase 2 PoC 後 |
| 0006 | KMS CMK 移行 (prod 向け) | Medium | Phase 9 本番昇格時 / Follow-up F-03 で追跡 |
