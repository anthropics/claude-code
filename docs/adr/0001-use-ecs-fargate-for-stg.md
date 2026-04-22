# 0001. stg 環境に ECS Fargate を採用

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: haruna（architect サブエージェントレビュー済み 2026-04-21）
- **Related**: [docs/ARCHITECTURE.md](../ARCHITECTURE.md), [docs/ROADMAP.md](../ROADMAP.md)

## Context

エンジニア特化型 SNS の stg 環境（将来的に prod も）を AWS にデプロイする必要がある。以下の制約を考慮してコンピュート基盤を選定:

- **予算**: 月 ¥20,000〜30,000（stg のみ）
- **初期ユーザー数**: 2,000 名想定
- **機能要件**: Django + Next.js + Nginx + Celery + Django Channels (WebSocket)
- **既存資産**: Docker Compose 構成（`local.yml`）で既に稼働中
- **運用負荷**: フルタイム 1 人開発、専任インフラ担当なし
- **冗長化**: Single-AZ で可（将来 prod は Multi-AZ 化）
- **IaC**: Terraform で管理

## Decision

**ECS Fargate** を採用する。

- Cluster: FARGATE + FARGATE_SPOT 混在（stg では Celery worker のみ Spot）
- タスク粒度:
  - Django + nginx サイドカー（1 タスク）
  - Next.js SSR（1 タスク）
  - Daphne (Channels WebSocket)（1 タスク）
  - Celery worker + Beat（2 タスク、Beat は非 Spot）
- ALB 前段、CloudFront は単一ディストリビューション
- RDS PostgreSQL + ElastiCache Redis は Fargate とは別に管理

## Consequences

### Positive
- マネージドで EC2 の OS パッチ管理不要
- Docker イメージ資産を活かせる
- ECR + ECS UpdateService による Rolling Update が簡素
- タスク定義をそのまま prod に持ち込める
- **月額想定 ≒ ¥23k で予算内**（[ARCHITECTURE.md §11](../ARCHITECTURE.md#11-予算見積もりstg-のみ) 参照）

### Negative
- EC2 比で単位時間あたりのコストが高い（+20〜30%）
- cold start は EC2 より遅い（Channels / Celery は常駐前提なので影響少）
- vCPU / Memory 刻みが固定（0.25, 0.5, 1.0...）で細かい調整不可
- **Celery worker を FARGATE_SPOT で動かす場合**: Spot 中断（2 分通知）時の
  in-flight タスク取扱いに注意。対策として `acks_late=True`,
  `task_reject_on_worker_lost=True`, 適切な `visibility_timeout`, DLQ を設計すること
  （ADR-0004 Celery 設計で詳述予定）。Beat は**絶対に Spot 不可**（二重発火防止）

### コスト概算（参考）
vCPU × タスク数 × 時間 × 単価 の積算:

```
Fargate (ap-northeast-1): $0.04048/vCPU-hour + $0.004445/GB-hour
常時稼働 5 タスク (nginx+django, next, daphne, celery worker+beat)
合計 1.5 vCPU / 3 GB ≒ $44/月

ALB: $17/月
RDS db.t4g.micro Single-AZ: $15/月
ElastiCache cache.t4g.micro: $12/月
その他 (S3/CloudFront/VPC Endpoints/fck-nat/Logs/転送): $60/月
```

**合計 ≒ $150/月 (≒¥23k)** — 詳細は [ARCHITECTURE.md §11](../ARCHITECTURE.md#11-予算見積もりstg-のみ) 参照。

## Alternatives considered

### (a) EKS（Kubernetes）
- **Pros**: デファクトでエコシステム豊富、Canary / Blue-Green が柔軟
- **Cons**: コントロールプレーン $73/月固定、運用負荷が非常に高い
- **判定**: 1 人運用では over-engineering、却下

### (b) EC2 + Docker Compose
- **Pros**: 最安（$20-30/月で動く）、ローカルとほぼ同じ構成
- **Cons**: ALB 連携・冗長化・OS パッチ・SSH 鍵管理が自前、Auto Scaling の手間大
- **判定**: 冗長化できず単一障害点になるため却下

### (c) AWS App Runner
- **Pros**: 設定最小、サービスごとの URL 自動発行、シンプルな料金体系
- **Cons**:
  - **Celery のような常駐ワーカーに不向き**: リクエスト駆動の課金モデルで、
    長時間 idle なバックグラウンドタスク（Celery worker / Beat）との相性が悪く、
    予測コストが立てづらい
  - カスタムドメイン運用時の VPC 統合 / Secrets Manager アクセスが Fargate 比で制限的
  - 複数サービス（Django / Next / Daphne / Celery）を 1 プロダクトにまとめる際の
    サービス境界管理が煩雑化
- **判定**: 常駐ワーカー中心の設計に合わないため却下

### (d) Lightsail Container
- **Pros**: 固定料金でわかりやすい（$10/月〜）
- **Cons**: VPC 統合が弱い、Secrets Manager 連携が面倒、スケール上限が低い
- **判定**: MVP 後半で 2,000+ ユーザーに耐える保証がないため却下

## References
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md) 全体構成
- architect サブエージェントレビュー (docs/REVIEW_CONSOLIDATED.md §2)
