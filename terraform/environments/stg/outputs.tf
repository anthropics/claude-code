# stg environment outputs — 運用で参照する値のみ露出する。

output "app_url" {
  description = "アプリの公開 URL (Route53 NS 伝播後にアクセス可能)"
  value       = "https://${var.app_subdomain}.${var.domain_name}"
}

output "webhook_url" {
  description = "Stripe / GitHub webhook エンドポイントのベース URL"
  value       = "https://webhook.${var.app_subdomain}.${var.domain_name}"
}

output "route53_name_servers" {
  description = "お名前.com の NS レコードに設定する 4 本 (docs/operations/dns-delegation.md)"
  value       = module.edge.route53_name_servers
}

output "cloudfront_domain_name" {
  description = "CloudFront ディストリビューション の *.cloudfront.net ドメイン (動作確認用)"
  value       = module.edge.cloudfront_domain_name
}

output "alb_dns_name" {
  description = "ALB DNS (Route53 経由でない直接アクセス用、動作確認のみ)"
  value       = module.compute.alb_dns_name
}

output "ecr_repository_urls" {
  description = "CI が docker push する先 (GitHub Actions から参照)"
  value       = module.compute.ecr_repository_urls
}

output "ecs_cluster_name" {
  value = module.compute.ecs_cluster_name
}

output "rds_endpoint" {
  description = "RDS エンドポイント (app の DATABASE_URL に使う)"
  value       = module.data.rds_endpoint
  sensitive   = true # architect PR #53 MEDIUM: hostname と port を terminal/CI ログに晒さない
}

output "redis_connection_url" {
  description = "Redis 接続 URL (app の REDIS_URL に使う)"
  value       = module.data.redis_connection_url
  sensitive   = true # 接続先 host 情報を含むため
}

output "alerts_topic_arn" {
  description = "追加のサブスクライバー (Slack 等) を足したいときの SNS Topic ARN"
  value       = module.observability.sns_topic_arn
}

output "secret_arns" {
  description = "ECS task definition の secrets 属性や IAM policy で参照"
  value       = module.secrets.secret_arns
  sensitive   = true # 個別の ARN 自体は公開情報だが、全 Secret の存在リストを平文で出さない
}

# 二段階 apply で使う ARN (terraform.tfvars に書き戻す)
output "cloudfront_distribution_arn" {
  description = "二段階 apply 時に terraform.tfvars の cloudfront_distribution_arn_override に設定"
  value       = module.edge.cloudfront_distribution_arn
}

output "acm_alb_arn" {
  description = "二段階 apply 時に terraform.tfvars の alb_certificate_arn_override に設定"
  value       = module.edge.acm_alb_arn
}
