output "bucket_ids" {
  description = "論理名 -> bucket ID のマップ (= bucket 名)。Django storages や Next.js の BUCKET 環境変数に渡す。"
  value       = { for k, b in aws_s3_bucket.this : k => b.id }
}

output "bucket_arns" {
  description = "論理名 -> bucket ARN のマップ。IAM policy の resources に入れる。"
  value       = { for k, b in aws_s3_bucket.this : k => b.arn }
}

output "bucket_regional_domains" {
  description = "論理名 -> regional_domain_name (CloudFront オリジンに指定)"
  value       = { for k, b in aws_s3_bucket.this : k => b.bucket_regional_domain_name }
}

output "media_bucket_id" {
  value = aws_s3_bucket.this["media"].id
}

output "media_bucket_arn" {
  value = aws_s3_bucket.this["media"].arn
}

output "static_bucket_id" {
  value = aws_s3_bucket.this["static"].id
}

output "static_bucket_arn" {
  value = aws_s3_bucket.this["static"].arn
}

output "backup_bucket_id" {
  value = aws_s3_bucket.this["backup"].id
}

output "backup_bucket_arn" {
  value = aws_s3_bucket.this["backup"].arn
}

# ALB access logs (F-02): compute モジュールの var.alb_access_logs_bucket に渡す
output "alb_logs_bucket_id" {
  description = "ALB access logs を保存する S3 bucket 名 (compute モジュール alb_access_logs_bucket に渡す)"
  value       = aws_s3_bucket.this["alb_logs"].id
}

output "alb_logs_bucket_arn" {
  value = aws_s3_bucket.this["alb_logs"].arn
}
