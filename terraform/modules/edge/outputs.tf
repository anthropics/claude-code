output "route53_zone_id" {
  value = aws_route53_zone.this.zone_id
}

output "route53_name_servers" {
  description = "お名前.com で NS レコードに設定する 4 つの NS (docs/operations/dns-delegation.md)"
  value       = aws_route53_zone.this.name_servers
}

output "acm_cloudfront_arn" {
  # aws_acm_certificate_validation.certificate_arn を返すことで、validation
  # 完了までの暗黙依存を下流に伝播させる (`aws_acm_certificate.*.arn` を
  # 直接返すと依存が切れて validation 未完了の証明書を CloudFront に渡す可能性)。
  description = "CloudFront 用 ACM 証明書 ARN (us-east-1、validation 完了後)"
  value       = aws_acm_certificate_validation.cloudfront.certificate_arn
}

output "acm_alb_arn" {
  # 同上 (validation の完了を待つ意味で aws_acm_certificate_validation を参照)
  description = "ALB 用 ACM 証明書 ARN (ap-northeast-1)。compute モジュールに渡す。"
  value       = aws_acm_certificate_validation.alb.certificate_arn
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "cloudfront_distribution_arn" {
  description = <<-EOT
    CloudFront distribution ARN。storage モジュールの S3 bucket policy の
    `AWS:SourceArn` 条件に渡す (OAC 推奨パターン、architect PR #52 MEDIUM:
    旧 `cloudfront_oac_arn` はリネームした)。
  EOT
  value = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.this.id}"
}

# 旧 output 名との後方互換 (storage モジュールがまだ `cloudfront_oac_arn` 参照)
output "cloudfront_oac_arn" {
  description = "DEPRECATED: cloudfront_distribution_arn を使用してください。互換のため維持。"
  value       = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.this.id}"
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.this.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "Route53 alias の zone_id"
  value       = aws_cloudfront_distribution.this.hosted_zone_id
}

output "cloudfront_oac_id" {
  description = "Origin Access Control ID"
  value       = aws_cloudfront_origin_access_control.s3.id
}

output "app_fqdn" {
  value = local.app_fqdn
}

output "webhook_fqdn" {
  value = local.webhook_fqdn
}

data "aws_caller_identity" "current" {}
