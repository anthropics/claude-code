# `network` module

VPC / サブネット / Security Group / fck-nat ASG / VPC Endpoints をまとめて作る。

## 構成図

```
VPC 10.0.0.0/16
├── public  10.0.1.0/24  (AZ-a)  ← ALB, fck-nat ENI
├── public  10.0.2.0/24  (AZ-c)
├── private 10.0.11.0/24 (AZ-a)  ← ECS Fargate
├── private 10.0.12.0/24 (AZ-c)
├── db      10.0.21.0/24 (AZ-a)  ← RDS, ElastiCache
└── db      10.0.22.0/24 (AZ-c)

IGW ─ public RT ─ public subnets
      private RT (× AZ) ─ fck-nat ENI (AZ-a) ─ IGW → 外部 API
      db RT (no egress) ─ db subnets
      S3 Gateway Endpoint → private RT + db RT (S3 は NAT 不要)
      Interface Endpoints (ECR/Secrets/Logs/STS) → private subnets
```

## fck-nat 採用理由

AWS NAT Gateway は stg 常時稼働で $32/月 + データ転送料。fck-nat は `t4g.nano`
($3.6/月) で同等機能を提供。AutoScaling Group (Min=1/Max=1) で障害時の自己復旧。
Multi-AZ は Phase 9 prod 昇格時に AZ ごとの fck-nat に拡張する。

詳細は [ADR-0001](../../../docs/adr/0001-use-ecs-fargate-for-stg.md) の
「NAT 冗長化」節を参照。

## VPC Endpoints

AWS サービス向けトラフィックを NAT 経由にせず内部通信へ。
- Gateway (S3): 無料
- Interface (ECR API / ECR DKR / Secrets Manager / CloudWatch Logs / STS):
  各 $7/月 × 5 = $35/月

NAT Instance 単一障害時の**AWS サービス利用は Endpoint 経由で継続**される設計。
`var.enable_vpc_endpoints = false` でスキップも可能 (最初期だけコスト最小化する場合)。

## Security Group マトリクス

| ソース | → | 宛先 | Port |
|---|---|---|---|
| Internet | → | alb-sg | 80, 443 |
| alb-sg | → | ecs-sg | 0-65535 |
| ecs-sg | → | rds-sg | 5432 |
| ecs-sg | → | redis-sg | 6379 |
| ecs-sg | → | vpce-sg | 443 |
| private/db CIDR | → | fcknat-sg | all |

## Outputs

他モジュールが参照するもの:
- `vpc_id`, `private_subnet_ids`, `db_subnet_ids` → data / compute モジュール
- `ecs_security_group_id`, `alb_security_group_id` → compute モジュール
- `rds_security_group_id`, `redis_security_group_id` → data モジュール

## 使用例 (環境ディレクトリ)

```hcl
module "network" {
  source = "../../modules/network"

  environment          = "stg"
  project              = "sns"
  vpc_cidr             = "10.0.0.0/16"
  availability_zones   = ["ap-northeast-1a", "ap-northeast-1c"]
  enable_vpc_endpoints = true
}
```

## 今後の拡張

- prod 昇格時に Multi-AZ の fck-nat (AZ ごとに 1 台、private RT も AZ 別に振り分け)
- VPC Flow Logs の有効化
- Transit Gateway による複数 VPC 接続 (将来別サービス追加時)
