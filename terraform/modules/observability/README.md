# `observability` module

CloudWatch Log Groups + CloudWatch Alarms + SNS Topic の IaC 定義。

## 責務

- ECS サービスごとに `/ecs/<project>-<env>/<service>` の Log Group を作成
- Alerts 配信用 SNS Topic と Email サブスクリプションを作成
- ECS CPU / RDS CPU / RDS 空き容量 / ALB 5xx エラー率 の基本アラームを設置
- 他モジュールの出力 (cluster 名 / ALB arn_suffix / RDS identifier) を variable で受け、
  未指定のアラームは作らない (optional 依存)

## 片方向依存

他モジュール (network / data / compute / edge) の output は参照**しない**。
このモジュールが var で必要な識別子を受け取る片方向構造にすることで、
モジュール間の output 引き回しコストを下げる (architect レビュー M-3 方針)。

## 使用例 (環境ディレクトリ `environments/stg/main.tf` から)

```hcl
module "observability" {
  source = "../../modules/observability"

  environment        = "stg"
  project            = "sns"
  log_retention_days = 30
  alert_email        = var.alert_email

  ecs_services = ["django", "next", "daphne", "celery-worker", "celery-beat"]

  # これらは他モジュール立ち上げ後に値を埋める (optional)
  alb_arn_suffix          = module.compute.alb_arn_suffix
  rds_instance_identifier = module.data.rds_instance_id
  ecs_cluster_name        = module.compute.ecs_cluster_name
}
```

## Outputs

| 名前 | 用途 |
|---|---|
| `sns_topic_arn` | 追加サブスクライバー (Lambda / Slack webhook 等) から参照 |
| `log_group_names` | ECS task definition の `logConfiguration.options.awslogs-group` に渡す |
| `log_group_arns` | ECS task execution role の IAM policy で `resources` に指定 |

## 運用上の注意

### SNS Email サブスクリプションは二段階

`aws_sns_topic_subscription` を `email` プロトコルで作成すると、AWS から確認メールが
送信され、**ユーザーが承認リンクをクリックするまで `PendingConfirmation` 状態でアラートは届かない**。

`terraform apply` が成功 = アラート経路が有効、ではない。以下の手順で確認:

1. `terraform apply` 後、`var.alert_email` 宛に "AWS Notification - Subscription Confirmation" が届く
2. メール内の `Confirm subscription` リンクをクリック
3. `aws sns get-topic-attributes --topic-arn <...>` で `SubscriptionsConfirmed >= 1` を確認
4. 疎通試験: AWS Console から該当 SNS Topic に "Publish message" で手動送信し、メール到達を確認

将来的に Slack/Chatbot 経由へ切替える場合は `https` プロトコルの SNS subscription を追加し、
email は fallback として併存させる運用を推奨。

### ECS サービス名の対応表

compute モジュール未実装時点では、このモジュールは ECS ServiceName を
`<project>-<env>-<logical>` のデフォルト命名規約で解決する。compute 側の実名が
異なる場合は **`var.ecs_service_name_map` で明示注入**すること。

```hcl
module "observability" {
  # ...
  ecs_service_name_map = {
    django        = module.compute.service_names["django"]
    next          = module.compute.service_names["next"]
    daphne        = module.compute.service_names["daphne"]
    celery-worker = module.compute.service_names["celery-worker"]
    celery-beat   = module.compute.service_names["celery-beat"]
  }
}
```

未注入かつ compute の命名規約と食い違うと、アラームは作成されるが CloudWatch メトリクス
が合致せず「永遠に INSUFFICIENT_DATA」になる。compute モジュール PR の受け入れ基準に
「observability の `resolved_ecs_service_names` と ECS 実体名が一致すること」を含める。

## 今後の拡張

- Slack Webhook / Chatbot 統合 (現状は email のみ)
- CloudWatch Dashboards (`aws_cloudwatch_dashboard`)
- カスタムメトリクス (active users, tweets per minute) — アプリ側で Sentry metrics か直接 PutMetricData
- ログ保持の環境別デフォルト (stg=30 日 / prod=365 日)
- CostCenter / Owner / Service タグ (Cost Explorer 配分強化)
- Dashboard で参照する `alarm_arns` output の追加
