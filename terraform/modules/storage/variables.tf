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

variable "backup_transition_to_glacier_days" {
  description = "バックアップバケットで IA -> Glacier へ移行する日数"
  type        = number
  default     = 90
}

variable "backup_expiration_days" {
  description = "バックアップの完全削除までの日数。0 で削除しない。"
  type        = number
  default     = 730 # 2 年
  validation {
    condition     = var.backup_expiration_days == 0 || var.backup_expiration_days >= 7
    error_message = "0 (無期限) か 7 日以上を指定。"
  }
}

variable "cloudfront_oac_arn" {
  description = <<-EOT
    CloudFront Origin Access Control の ARN。
    media / static バケットは CloudFront 経由でのみ配信するため、bucket policy
    で sourceArn をこの OAC に限定する。空なら bucket policy をスキップ
    (edge モジュール実装前のフェーズで使用)。
  EOT
  type        = string
  default     = ""
}

variable "aws_account_id" {
  description = <<-EOT
    自 AWS アカウント ID。OAC bucket policy の AWS:SourceAccount 条件に使う
    (security-reviewer PR #48 MEDIUM)。未指定なら SourceAccount 条件をスキップ
    (SourceArn のみで絞る)。
  EOT
  type        = string
  default     = ""
}

variable "frontend_origins" {
  description = <<-EOT
    media bucket の PUT/POST CORS で許可する frontend origin のリスト。
    例: ["https://stg.example.com"]。S3 CORS は正規表現ではなく完全一致 + 末尾
    ワイルドカードしか効かないため、必ず具体的な値を指定する
    (security-reviewer PR #48 HIGH)。
    空リストの場合は PUT/POST ルールを作成しない (presigned URL 直アップロード不可)。
  EOT
  type        = list(string)
  default     = []
  validation {
    condition = alltrue([
      for o in var.frontend_origins : can(regex("^https://[^*]+$", o))
    ])
    error_message = "frontend_origins は https:// で始まる完全な origin (ワイルドカード不可) のリスト。"
  }
}

variable "tags" {
  description = "全リソース共通タグ"
  type        = map(string)
  default     = {}
}
