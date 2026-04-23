variable "environment" {
  description = "環境名 (stg / prod)。ログ・アラーム名の prefix に使う。"
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

variable "log_retention_days" {
  description = "CloudWatch Log Groups のログ保持日数"
  type        = number
  default     = 30
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "CloudWatch が受け入れる retention 値のみ指定可能。"
  }
}

variable "alert_email" {
  description = "アラート通知先メールアドレス (SNS Topic にサブスクライブ)"
  type        = string
  validation {
    condition     = can(regex("^[^@]+@[^@]+\\.[^@]+$", var.alert_email))
    error_message = "有効なメールアドレス形式で指定してください。"
  }
}

variable "ecs_services" {
  description = "CloudWatch Log Group を作る ECS サービス論理名リスト"
  type        = list(string)
  default = [
    "django",
    "next",
    "daphne",
    "celery-worker",
    "celery-beat",
  ]
}

variable "ecs_service_name_map" {
  description = <<-EOT
    ECS サービス論理名 -> 実 ServiceName (ECS 上の識別子) のマップ。
    compute モジュールが命名する実サービス名を明示的に注入するための escape
    hatch (architect PR #46 HIGH 指摘)。未指定の場合は `<project>-<env>-<logical>`
    のデフォルト命名規約に従う。compute モジュール実装時に実在する名前と一致
    することを確認すること。
  EOT
  type        = map(string)
  default     = {}
}

variable "alb_arn_suffix" {
  description = "ALB の `arn_suffix` (5xx エラー率アラーム用)。未指定なら ALB アラームをスキップ。"
  type        = string
  default     = ""
}

variable "rds_instance_identifier" {
  description = "RDS インスタンス識別子 (CPU / 容量アラーム用)。未指定なら RDS アラームをスキップ。"
  type        = string
  default     = ""
}

variable "rds_allocated_storage_gb" {
  description = "RDS の allocated storage (GB)。FreeStorageSpace アラーム閾値の算出に使う。"
  type        = number
  default     = 20
}

variable "rds_free_storage_threshold_ratio" {
  description = "FreeStorageSpace アラーム発火の閾値比率 (0.0-1.0)。default 0.2 で残り 20% を切ったら通知。"
  type        = number
  default     = 0.2
  validation {
    condition     = var.rds_free_storage_threshold_ratio > 0 && var.rds_free_storage_threshold_ratio < 1
    error_message = "0 < ratio < 1 の範囲で指定してください。"
  }
}

variable "ecs_cluster_name" {
  description = "ECS Cluster 名 (サービス CPU アラーム用)。未指定ならスキップ。"
  type        = string
  default     = ""
}

variable "tags" {
  description = "全リソース共通タグ"
  type        = map(string)
  default     = {}
}
