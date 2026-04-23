# stg environment

Phase 0.5 で立ち上げる staging 環境。全 7 モジュールを結合する。

## 前提

1. `scripts/bootstrap-tf-state.sh` を実行済み
   (S3 bucket `sns-stg-tf-state` + DynamoDB `sns-stg-tf-lock` 作成済)
2. apex ドメインを取得済み (お名前.com 等)
3. AWS CLI / Terraform 1.9+ / 適切な IAM 権限

## 初期化 & Apply

```bash
cd terraform/environments/stg
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars を編集して domain_name / alert_email を設定

terraform init
terraform plan
terraform apply
```

## 二段階 apply (chicken-and-egg 回避)

このディレクトリは以下の循環依存を抱えている:

- `storage` bucket policy には `edge` の OAC ARN (実体は CloudFront distribution ARN) が必要
- `compute` HTTPS listener には `edge` の ACM ARN が必要

main.tf の編集を避けるため、**変数経由**で値を受け渡す運用にしている
(architect PR #53 HIGH 指摘対応):

```hcl
# variables.tf
variable "cloudfront_distribution_arn_override" { default = "" }
variable "alb_certificate_arn_override"         { default = "" }

# main.tf
module "storage" {
  cloudfront_oac_arn = var.cloudfront_distribution_arn_override
}
module "compute" {
  alb_certificate_arn = var.alb_certificate_arn_override
}
```

### 運用手順

1. **初回 apply** (両 override 空のまま):
   ```bash
   terraform apply
   ```
2. Route 53 NS を出力から取得し、お名前.com で設定
   ([docs/operations/dns-delegation.md](../../../docs/operations/dns-delegation.md))
3. NS 伝播を待ち (15 分〜数時間)、ACM 証明書が `ISSUED` になることを確認:
   ```bash
   aws acm describe-certificate --region us-east-1 --certificate-arn $(terraform output -raw acm_cloudfront_arn)
   ```
4. **二段階目**: override 値を取得して tfvars に追記:
   ```bash
   terraform output -raw cloudfront_distribution_arn
   terraform output -raw acm_alb_arn
   # terraform.tfvars に以下を追記
   cloudfront_distribution_arn_override = "<cf.arn>"
   alb_certificate_arn_override         = "<acm.arn>"

   terraform apply
   ```

**main.tf を編集する必要はない**。tfvars 変更のみで二段階目に進めるので
CI/CD 自動化も可能 (Phase 0.5-14 の cd-stg.yml で 2 回 apply する pipeline)。

## リソース一覧 (概算)

| モジュール | 主要リソース |
|---|---|
| network | VPC, 6 subnets, 6 SGs, fck-nat ASG, 6 VPC Endpoints |
| data | RDS Postgres 15.12 (db.t4g.micro), ElastiCache Redis 7.1 (cache.t4g.micro) |
| storage | 3 S3 buckets (media / static / backup) |
| secrets | 9 Secrets Manager entries (2 自動生成 + 7 placeholder) |
| compute | ECS cluster, ALB, 3 ECR repos, 2 IAM roles |
| edge | CloudFront, Route53 zone + 2 A records, 2 ACM certs |
| observability | 5 Log Groups, SNS topic, 最大 8 alarms |

## 削除

```bash
# 二段階削除 (chicken-and-egg の逆)
# まず edge の OAC 参照を外す (storage / compute の変数を "" に戻す)
terraform apply

# 次に全 destroy
terraform destroy

# state bucket / lock table を削除する場合は
# docs/operations/tf-state-bootstrap.md の削除手順を参照
```

## コスト目安

ARCHITECTURE.md §11 参照: **~$153/月** (¥22-25k)

- VPC Interface Endpoints をオフにすれば $35 削減
- fck-nat と Interface Endpoint 両方オフなら外部 API 通信が失敗するので注意
