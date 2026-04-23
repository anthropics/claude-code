variable "aws_region" {
  description = "stg の AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project" {
  description = "プロジェクト名 (全リソース prefix に使う)"
  type        = string
  default     = "sns"
}

# ---------- DNS ----------

variable "domain_name" {
  description = "apex ドメイン (お名前.com で取得してある。例: example.com)"
  type        = string
}

variable "app_subdomain" {
  description = "アプリ用サブドメイン (結果: <app_subdomain>.<domain_name>)"
  type        = string
  default     = "stg"
}

# ---------- 通知 ----------

variable "alert_email" {
  description = "observability モジュールからのアラート送信先メール"
  type        = string
}

# ---------- RDS オーバーライド (環境別に調整しやすく) ----------

variable "rds_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "rds_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "rds_multi_az" {
  type    = bool
  default = false # stg は Single-AZ
}

variable "rds_skip_final_snapshot" {
  type    = bool
  default = false
}

# ---------- ElastiCache オーバーライド ----------

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

# ---------- サブドメイン ----------

variable "webhook_subdomain" {
  description = "Stripe/GitHub webhook 用サブドメイン (architect PR #53 MEDIUM: ハードコード廃止)。結果: <webhook_subdomain>.<app_subdomain>.<domain_name>"
  type        = string
  default     = "webhook"
}

# ---------- 二段階 apply の override ----------
#
# edge モジュール作成前は、storage bucket policy / compute HTTPS listener に
# 渡す ARN が存在しないため空文字列で bootstrap する。edge 作成後は以下の値を
# tfvars に書き込んで再 apply すれば main.tf を編集せずに二段階目に進める
# (architect PR #53 HIGH)。
#
# 初回:
#   terraform apply         # bootstrap、空のまま
# 二段階目:
#   terraform output cloudfront_distribution_arn > /tmp/cf.arn
#   terraform output acm_alb_arn > /tmp/acm.arn
#   # terraform.tfvars に以下を追記:
#   cloudfront_distribution_arn_override = "<cf.arn>"
#   alb_certificate_arn_override         = "<acm.arn>"
#   terraform apply

variable "cloudfront_distribution_arn_override" {
  description = "storage の bucket policy に渡す CloudFront distribution ARN。二段階目 apply 時に埋める。"
  type        = string
  default     = ""
}

variable "alb_certificate_arn_override" {
  description = "compute の ALB HTTPS listener に渡す ACM 証明書 ARN (ap-northeast-1)。二段階目 apply 時に埋める。"
  type        = string
  default     = ""
}

# ---------- 便利オプション ----------

variable "enable_vpc_endpoints" {
  description = "VPC Interface Endpoints (ECR/Secrets/Logs/STS) を作るか。月 $35 前後かかるのでオフにもできる。"
  type        = bool
  default     = true
}
