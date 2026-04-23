# Terraform

本プロジェクトの Infrastructure-as-Code。

## ディレクトリ構成

```
terraform/
├── backend.tf              # S3 backend 設定 (全環境共通)
├── versions.tf             # Terraform / provider バージョン制約
├── modules/                # 再利用可能モジュール (Phase 0.5 で順次追加)
│   ├── network/            # VPC, subnets, SG, fck-nat, VPC Endpoints
│   ├── data/               # RDS + ElastiCache
│   ├── compute/            # ECS Cluster, ALB, ECR
│   ├── edge/               # CloudFront, Route53, ACM
│   └── observability/      # CloudWatch Log Groups, Alarms, SNS Topic
└── environments/
    └── stg/                # stg 環境 (Phase 0.5 で立ち上げ)
        ├── main.tf         # モジュール呼び出し
        ├── variables.tf
        └── terraform.tfvars
```

## Bootstrap (初回のみ)

Terraform state を保存する S3 バケットと DynamoDB lock テーブルは
Terraform 自身では管理しない (chicken-and-egg)。 以下のスクリプトで作成する:

```bash
./scripts/bootstrap-tf-state.sh
```

詳細は [docs/operations/tf-state-bootstrap.md](../docs/operations/tf-state-bootstrap.md) を参照。

## 通常の運用

```bash
cd terraform/environments/stg
terraform init
terraform plan
terraform apply   # ← 手動承認 (CD でも手動ステップを通す)
```

## ADR

Terraform / AWS 設計に関する決定は [docs/adr/](../docs/adr/) に記録:
- [ADR-0001](../docs/adr/0001-use-ecs-fargate-for-stg.md) — stg に ECS Fargate を採用
