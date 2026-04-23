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

# ---------- network 依存 (片方向: identifier を受け取る) ----------

variable "db_subnet_ids" {
  description = "RDS / ElastiCache の subnet group に使う DB subnet ID リスト"
  type        = list(string)
  validation {
    condition     = length(var.db_subnet_ids) >= 2
    error_message = "DB subnet は 2 AZ 以上必要 (RDS subnet group の要件)。"
  }
}

variable "rds_security_group_id" {
  description = "RDS インスタンスに付与する SG ID (network モジュールの rds-sg)"
  type        = string
}

variable "redis_security_group_id" {
  description = "ElastiCache に付与する SG ID (network モジュールの redis-sg)"
  type        = string
}

# ---------- secrets 依存 ----------

variable "db_master_username" {
  description = "RDS master ユーザー名"
  type        = string
  default     = "postgres"
}

variable "db_master_password" {
  description = <<-EOT
    RDS master password (sensitive)。secrets モジュールの db_password_value を渡す。
    secrets モジュール側で lifecycle.ignore_changes しているので、RDS 作成後に
    手動ローテートしても RDS 側の master_password は同期されない点に注意
    (必要なら `aws rds modify-db-instance --master-user-password` で別途更新)。
  EOT
  type        = string
  sensitive   = true
}

# ---------- RDS ----------

variable "rds_engine_version" {
  description = <<-EOT
    PostgreSQL バージョン。
    `auto_minor_version_upgrade = true` のためマイナーはメンテナンスウィンドウで
    自動更新される。メジャーアップグレード (15→16) は ADR 化して明示的に実施する。
  EOT
  type        = string
  default     = "15.12"
}

variable "rds_storage_iops" {
  description = "gp3 IOPS。null で AWS デフォルト (3000 IOPS)。allocated_storage が 400GB を超える場合は指定推奨。"
  type        = number
  default     = null
}

variable "rds_storage_throughput_mbs" {
  description = "gp3 スループット (MB/s)。null で AWS デフォルト (125 MB/s)。"
  type        = number
  default     = null
}

variable "rds_instance_class" {
  description = "RDS インスタンスクラス"
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage_gb" {
  description = "RDS ストレージ (GB)"
  type        = number
  default     = 20
  validation {
    condition     = var.rds_allocated_storage_gb >= 20
    error_message = "RDS gp3 の最小は 20GB。"
  }
}

variable "rds_max_allocated_storage_gb" {
  description = "ストレージ自動スケール上限 (GB)。0 で自動スケール無効。"
  type        = number
  default     = 100
}

variable "rds_multi_az" {
  description = "Multi-AZ にするか (stg は false、prod は true 推奨)"
  type        = bool
  default     = false
}

variable "rds_backup_retention_days" {
  description = "自動バックアップ保持日数 (0 で無効)"
  type        = number
  default     = 7
}

variable "rds_deletion_protection" {
  description = "誤 destroy 防止"
  type        = bool
  default     = true
}

variable "rds_skip_final_snapshot" {
  description = "destroy 時の final snapshot をスキップ (stg の teardown 効率化)"
  type        = bool
  default     = false
}

# ---------- ElastiCache ----------

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.1"
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_num_cache_nodes" {
  description = "stg は Single-node の 1。prod は replication group で 2+ (別モジュールで拡張)"
  type        = number
  default     = 1
}

variable "tags" {
  description = "全リソース共通タグ"
  type        = map(string)
  default     = {}
}
