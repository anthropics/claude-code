# stg environment composition (P0.5-07).
#
# 7 モジュールを結合して stg 環境を立ち上げる。`terraform apply` 一回で
# 全リソースが起動する状態を目指す (ECS task definition / aws_ecs_service は
# Hello World 相当を P0.5-11 / P0.5-12 で追加する)。
#
# モジュール呼び出し順 (実質的な依存):
#   secrets (独立)
#   network (独立) ────┬──▶ data (network の subnet / sg を受ける)
#                      │
#                      └──▶ storage (ほぼ独立、edge の OAC を後で受ける)
#   edge (ALB DNS を受ける必要があるので compute の後)
#   compute (network / (後から) edge の ACM を受ける)
#   observability (compute / data / (後から) edge を識別子で参照)
#
# 循環を避けるため、edge の OAC を storage に渡すのは第二フェーズで行う
# (最初は OAC なしで storage を作り、edge 作成後に bucket policy を付ける)。
# stg はまだサービスを公開していないので、この二段階運用は Phase 0.5 では許容。

locals {
  project = var.project

  common_tags = {
    Project     = var.project
    Environment = "stg"
    ManagedBy   = "terraform"
  }
}

data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# 1. Secrets Manager
# ---------------------------------------------------------------------------

module "secrets" {
  source = "../../modules/secrets"

  environment             = "stg"
  project                 = var.project
  recovery_window_in_days = 7 # stg
  generate_random_values  = true
}

# ---------------------------------------------------------------------------
# 2. Network (VPC / subnets / SG / fck-nat / VPC endpoints)
# ---------------------------------------------------------------------------

module "network" {
  source = "../../modules/network"

  environment          = "stg"
  project              = var.project
  enable_vpc_endpoints = var.enable_vpc_endpoints
}

# ---------------------------------------------------------------------------
# 3. Data (RDS + ElastiCache)
# ---------------------------------------------------------------------------

module "data" {
  source = "../../modules/data"

  environment = "stg"
  project     = var.project

  db_subnet_ids           = module.network.db_subnet_ids
  rds_security_group_id   = module.network.rds_security_group_id
  redis_security_group_id = module.network.redis_security_group_id

  db_master_password = module.secrets.db_password_value

  rds_instance_class        = var.rds_instance_class
  rds_allocated_storage_gb  = var.rds_allocated_storage_gb
  rds_multi_az              = var.rds_multi_az
  rds_skip_final_snapshot   = var.rds_skip_final_snapshot

  redis_node_type = var.redis_node_type
}

# ---------------------------------------------------------------------------
# 4. Storage (S3 buckets)
# 最初は OAC なしで作成。edge 作成後に bucket policy を足すため、
# 本環境では `cloudfront_oac_arn` は 2 度目の apply で埋める想定
# (chicken-and-egg を許容)。
# ---------------------------------------------------------------------------

module "storage" {
  source = "../../modules/storage"

  environment = "stg"
  project     = var.project

  aws_account_id   = data.aws_caller_identity.current.account_id
  frontend_origins = ["https://${var.app_subdomain}.${var.domain_name}"]

  # 二段階 apply (architect PR #53 HIGH): 初回は空、edge 作成後に tfvars で
  # `cloudfront_distribution_arn_override` を埋めて再 apply。
  cloudfront_oac_arn = var.cloudfront_distribution_arn_override
}

# ---------------------------------------------------------------------------
# 5. Compute (ECS + ALB + ECR + IAM)
# HTTPS listener は edge 作成後 (ACM ARN 渡し) に enable されるため、
# 初回 apply は HTTP のみで ALB を起動する二段階運用。
# ---------------------------------------------------------------------------

module "compute" {
  source = "../../modules/compute"

  environment = "stg"
  project     = var.project

  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  alb_security_group_id = module.network.alb_security_group_id

  # edge 作成後に acm_alb_arn を渡す (二段階 apply、architect PR #53 HIGH)。
  # 最初の apply は空文字列 = HTTP only で ALB を起動。
  alb_certificate_arn = var.alb_certificate_arn_override

  alb_idle_timeout_seconds = 3600
  enable_fargate_spot      = true

  # F-02: ALB access logs を storage の専用バケットに書き出す。
  # prefix は compute モジュール側で "alb/<env>" 固定。
  alb_access_logs_bucket = module.storage.alb_logs_bucket_id
}

# ---------------------------------------------------------------------------
# 6. Edge (CloudFront + Route53 + ACM)
# ---------------------------------------------------------------------------

module "edge" {
  source = "../../modules/edge"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment = "stg"
  project     = var.project

  domain_name        = var.domain_name
  app_subdomain      = var.app_subdomain
  webhook_subdomain  = var.webhook_subdomain

  alb_dns_name = module.compute.alb_dns_name
  alb_zone_id  = module.compute.alb_zone_id

  media_bucket_regional_domain  = module.storage.bucket_regional_domains["media"]
  static_bucket_regional_domain = module.storage.bucket_regional_domains["static"]
}

# ---------------------------------------------------------------------------
# 7. Observability (Log Groups + Alarms + SNS Topic)
# ---------------------------------------------------------------------------

module "observability" {
  source = "../../modules/observability"

  environment        = "stg"
  project            = var.project
  log_retention_days = 30
  alert_email        = var.alert_email

  ecs_services = ["django", "next", "daphne", "celery-worker", "celery-beat"]

  # compute モジュールが `service_names` output で実サービス名を返す。
  ecs_service_name_map = module.compute.service_names
  ecs_cluster_name     = module.compute.ecs_cluster_name

  alb_arn_suffix = module.compute.alb_arn_suffix

  rds_instance_identifier    = module.data.rds_instance_id
  rds_allocated_storage_gb   = var.rds_allocated_storage_gb
}
