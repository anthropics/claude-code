variable "environment" {
  description = "環境名 (stg / prod)"
  type        = string
  validation {
    condition     = contains(["stg", "prod"], var.environment)
    error_message = "environment は stg / prod のいずれか。"
  }
}

variable "project" {
  description = "プロジェクト名"
  type        = string
  default     = "sns"
}

variable "domain_name" {
  description = "apex ドメイン (例: example.com)。Route53 Hosted Zone はこの名前で作成される。"
  type        = string
}

variable "app_subdomain" {
  description = "アプリのサブドメイン (例: stg)。最終的なホスト名は <app_subdomain>.<domain_name>"
  type        = string
}

variable "webhook_subdomain" {
  description = "Stripe/GitHub webhook 用サブドメイン。CloudFront 非経由 (ALB 直)。"
  type        = string
  default     = "webhook"
}

# ---------- ALB / S3 origin (compute / storage モジュール output を受ける) ----------

variable "alb_dns_name" {
  description = "CloudFront オリジンにする ALB の DNS 名"
  type        = string
}

variable "alb_zone_id" {
  description = "Route53 A alias の zone_id。webhook サブドメインの ALB alias に使う。"
  type        = string
}

variable "media_bucket_regional_domain" {
  description = "storage モジュールの media bucket regional_domain_name"
  type        = string
}

variable "static_bucket_regional_domain" {
  description = "storage モジュールの static bucket regional_domain_name"
  type        = string
}

# ---------- その他 ----------

variable "price_class" {
  description = "CloudFront price class。stg は US/EU/Asia まで、prod は All。"
  type        = string
  default     = "PriceClass_200"
  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "PriceClass_100 / 200 / All のみ。"
  }
}

variable "additional_alb_record" {
  description = <<-EOT
    `stg.<domain>` の Route53 A record を、CloudFront ではなく ALB に直接
    向けたい場合に使う一時オプション (edge モジュール立ち上げの動作確認用)。
    通常運用では false のまま。
  EOT
  type        = bool
  default     = false
}

variable "tags" {
  description = "全リソース共通タグ"
  type        = map(string)
  default     = {}
}
