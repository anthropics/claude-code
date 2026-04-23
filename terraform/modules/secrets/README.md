# `secrets` module

Secrets Manager にシークレットの枠を一括で作成する。

## 命名規約

```
sns/<env>/<category>/<key>
```

例:
- `sns/stg/django/secret-key`
- `sns/stg/django/db-password`
- `sns/stg/stripe/secret-key`
- `sns/stg/openai/api-key`

ECS task definition の `secrets` 属性で ARN 参照し、ランタイム環境変数にバインドする。

## 2 種類のシークレット

### 自動生成 (terraform が put)

| キー | 用途 | 方式 |
|---|---|---|
| `django/secret-key` | Django SECRET_KEY | `random_password` (length 64, special 可) |
| `django/db-password` | RDS master password | `random_password` (length 40, RDS 互換の記号のみ) |

`var.generate_random_values = true` (default) の時だけ put される。
`lifecycle.ignore_changes = [secret_string]` で、運用者が `aws secretsmanager
put-secret-value` で手動ローテートした後、次回 apply が戻さないようにしている。

### Placeholder (運用者が手動 put)

外部由来のシークレットは terraform では枠のみ作成:

| キー | 取得元 |
|---|---|
| `sentry/dsn` | Sentry プロジェクト設定 |
| `mailgun/api-key` | Mailgun コントロールパネル |
| `mailgun/signing-key` | Mailgun Webhook signing key |
| `stripe/secret-key` | Stripe ダッシュボード (test / live) |
| `stripe/webhook-secret` | Stripe Webhook endpoint の signing secret |
| `openai/api-key` | OpenAI platform |
| `anthropic/api-key` | Anthropic console |

初期状態では `{"note": "SET_VIA_AWS_CLI: ..."}` という placeholder が入る。
運用者が実値を書き込むコマンド例:

```bash
aws secretsmanager put-secret-value \
  --secret-id sns/stg/stripe/secret-key \
  --secret-string "sk_test_xxxxx"
```

## recovery_window_in_days

Secrets Manager は削除時に論理削除状態になり、指定日数内に `restore-secret` で復旧可能。
- stg: 7 日 (default)
- prod: 30 日を推奨

`0` を指定すると即時削除 (テスト環境で作り直したいとき用)。

## 使用例

```hcl
module "secrets" {
  source = "../../modules/secrets"

  environment              = "stg"
  project                  = "sns"
  generate_random_values   = true
  recovery_window_in_days  = 7
}

# 他モジュールに ARN を渡す
module "data" {
  source              = "../../modules/data"
  db_password_arn     = module.secrets.db_password_arn
  db_password_value   = module.secrets.db_password_value # RDS 作成時の MasterUserPassword
  # ...
}

module "compute" {
  source          = "../../modules/compute"
  secret_arns_map = module.secrets.secret_arns
  # ...
}
```

## IAM 連携

ECS task execution role が必要な `secretsmanager:GetSecretValue` permission:

```hcl
resource "aws_iam_role_policy" "task_execution_read_secrets" {
  role   = aws_iam_role.ecs_task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = module.secrets.all_secret_arns_list
    }]
  })
}
```

## シークレットの値のフォーマット (重要)

**すべてのシークレット値は JSON オブジェクト `{"value": "<実値>"}` 形式で保存する**
(security-reviewer PR #49 HIGH)。

理由: アプリ側が JSON parse で統一的に取り出せるようにし、Placeholder ↔ 実値の
フォーマット不一致による運用初期のバグを防ぐため。

### 手動 put の正しいコマンド

```bash
# 実際の Stripe secret key は Stripe ダッシュボードから取得して
# <STRIPE_SECRET_KEY> のところに貼り付ける
aws secretsmanager put-secret-value \
  --secret-id sns/stg/stripe/secret-key \
  --secret-string '{"value":"<STRIPE_SECRET_KEY>"}'
```

### アプリ側の取得パターン (Django)

```python
import json
import boto3

client = boto3.client("secretsmanager")
response = client.get_secret_value(SecretId="sns/stg/stripe/secret-key")
secret = json.loads(response["SecretString"])
api_key = secret["value"]
```

### 例外: 自動生成シークレット (django/secret-key, django/db-password)

自動生成グループは `random_password.result` が直接 string として入る
(JSON ラップなし、歴史的経緯 + RDS の master_user_password が JSON を受け付けない)。
アプリ・data モジュール側は string として扱うこと。

## IAM policy で必要な action

ECS task execution role には最低:

- `secretsmanager:GetSecretValue`

SDK によっては追加で必要になるケース (describe / list-versions 等) がある:

- `secretsmanager:DescribeSecret`
- `secretsmanager:ListSecretVersionIds`

`Resource` には `var.secret_arns` マップから**必要なシークレットのみ**を抜き出し、
`all_secret_arns_list` は便利だが過剰権限になりがちなので、サービスごとに絞ることを推奨:

```hcl
resource "aws_iam_role_policy" "django_read_secrets" {
  role   = aws_iam_role.ecs_task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      Resource = [
        module.secrets.secret_arns["django/secret-key"],
        module.secrets.secret_arns["django/db-password"],
        module.secrets.secret_arns["sentry/dsn"],
      ]
    }]
  })
}
```

## db_password_value の取扱い注意

output `db_password_value` は `sensitive = true` が付いており、CLI 表示や
ログへの平文漏洩は防がれる。ただし以下の制約を認識すること
(security-reviewer PR #49 HIGH):

1. **terraform state には平文で記録される**。state ファイルは S3 backend
   (SSE-S3) + DynamoDB lock で保護されるが、state 閲覧権限を持つ IAM principal
   は全シークレットを取得可能
2. **呼び出し元 (data モジュール) の state にも複製される**。RDS master_user_password
   引数に渡した瞬間、data モジュールの state にも平文値が入る
3. **代替案**: RDS で `manage_master_user_password = true` を使うと AWS が自動で
   Secrets Manager 管理し、値が terraform state に入らない。ただし secret 名を
   `sns/stg/django/db-password` にコントロールできなくなる (`rds!db-<random>` 形式)
4. **現方針**: secret 名のコントロール性を優先し、state 保護 (S3 暗号化 + IAM 最小化)
   で緩和する。prod で要件が厳しくなれば `manage_master_user_password` へ切替

## 今後の拡張

- **ローテーション自動化**: `aws_secretsmanager_secret_rotation` + Lambda (DB password を 30 日ごと)
- **KMS CMK**: `var.kms_key_id` は用意済み。prod では CMK で IAM / CloudTrail 可視化強化 (ADR 発行予定)
- **manage_master_user_password**: prod 移行時に state 漏洩リスク最小化で検討
- **External Secret Store**: 1Password / HashiCorp Vault との同期
