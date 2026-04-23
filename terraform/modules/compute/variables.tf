variable "environment" {
  description = "環境名 (stg / prod)"
  type        = string
  validation {
    condition     = contains(["stg", "prod"], var.environment)
    error_message = "environment は stg / prod のいずれか。"
  }
}

variable "project" {
  description = "プロジェクト名 (リソース prefix)"
  type        = string
  default     = "sns"
}

# ---------- network 依存 ----------

variable "vpc_id" {
  description = "VPC ID (target group の vpc_id に使う)"
  type        = string
}

variable "public_subnet_ids" {
  description = "ALB を配置する public subnet ID リスト (2 AZ)"
  type        = list(string)
  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "ALB は 2 AZ 以上のサブネットを要求する。"
  }
}

variable "alb_security_group_id" {
  description = "ALB に付与する SG (network モジュールの alb-sg)"
  type        = string
}

# ---------- ALB ----------

variable "alb_certificate_arn" {
  description = <<-EOT
    ALB HTTPS listener で使う ACM 証明書 ARN (ap-northeast-1 リージョン)。
    edge モジュールが発行する *.stg.example.com 証明書の ARN を渡す。
    未指定 (空) の場合は HTTPS listener をスキップし HTTP のみで起動する
    (edge モジュール未実装時のブートストラップ用)。
  EOT
  type        = string
  default     = ""
}

variable "alb_idle_timeout_seconds" {
  description = "ALB idle timeout (WebSocket 維持のため長め)"
  type        = number
  default     = 3600 # 1 時間
}

variable "alb_access_logs_bucket" {
  description = "ALB access logs を保存する S3 bucket 名 (storage モジュールの backup か専用バケット)。空ならログ無効化。"
  type        = string
  default     = ""
}

# ---------- ECS ----------

variable "ecs_services" {
  description = <<-EOT
    ECS サービス論理名リスト。observability モジュールと揃える。
    実際の task definition は各 Phase で段階的に追加するので、この module は
    ECR + ALB 側の受け皿だけ用意する。
  EOT
  type        = list(string)
  default = [
    "django",
    "next",
    "daphne",
    "celery-worker",
    "celery-beat",
  ]
}

variable "enable_fargate_spot" {
  description = <<-EOT
    Cluster の capacity providers に FARGATE_SPOT を含めるか。
    **本 module は cluster 定義までしか行わない**ため、実際に Spot で動かすには
    環境ディレクトリの aws_ecs_service 側で以下のように明示的に上書きする必要がある
    (architect PR #51 HIGH):

    capacity_provider_strategy {
      capacity_provider = "FARGATE_SPOT"
      weight            = 1
    }

    celery-beat は Spot 絶対不可 (二重発火防止)、celery-worker と cold 系 batch は
    Spot 推奨、django/next/daphne は FARGATE (on-demand) 推奨。
  EOT
  type        = bool
  default     = true
}

# ---------- タグ ----------

variable "tags" {
  description = "全リソース共通タグ"
  type        = map(string)
  default     = {}
}
