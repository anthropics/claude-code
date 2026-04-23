variable "environment" {
  description = "環境名 (stg / prod)"
  type        = string
  validation {
    condition     = contains(["stg", "prod"], var.environment)
    error_message = "environment は stg / prod のいずれか。"
  }
}

variable "project" {
  description = "プロジェクト名 (シークレット名 prefix)"
  type        = string
  default     = "sns"
}

variable "recovery_window_in_days" {
  description = <<-EOT
    Secrets Manager の論理削除猶予期間。0 にすると即時削除。
    stg は 7 日で運用、prod は 30 日を推奨 (誤 destroy からの復旧余地)。
  EOT
  type        = number
  default     = 7
  validation {
    condition     = var.recovery_window_in_days == 0 || (var.recovery_window_in_days >= 7 && var.recovery_window_in_days <= 30)
    error_message = "0 (即時削除) または 7-30 日を指定。"
  }
}

variable "generate_random_values" {
  description = <<-EOT
    true にすると Django SECRET_KEY / DB パスワードなどをランダム値で生成する。
    false にすると placeholder (AWSCURRENT: "CHANGEME") で作成し、運用者が
    別途 `aws secretsmanager put-secret-value` で書き換える運用。
  EOT
  type        = bool
  default     = true
}

variable "kms_key_id" {
  description = <<-EOT
    シークレット暗号化用の KMS CMK ID または ARN。null (default) の場合は
    AWS managed key (alias/aws/secretsmanager) を使う。
    security-reviewer PR #49 LOW: 先に変数化しておくことで prod CMK 移行時に
    ForceNew を避ける。CMK 採用時の ADR は別途発行予定。
  EOT
  type        = string
  default     = null
}

variable "tags" {
  description = "全リソース共通タグ"
  type        = map(string)
  default     = {}
}
