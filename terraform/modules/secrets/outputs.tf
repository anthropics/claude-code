output "secret_arns" {
  description = "シークレット論理名 (例: django/secret-key) -> ARN のマップ。ECS task execution role / task role の IAM policy で resources に指定する。"
  value = merge(
    { for k, s in aws_secretsmanager_secret.generated : k => s.arn },
    { for k, s in aws_secretsmanager_secret.placeholder : k => s.arn },
  )
}

output "all_secret_arns_list" {
  description = "全シークレット ARN のリスト形式 (IAM policy の resources にそのまま渡せる)"
  value = concat(
    [for s in aws_secretsmanager_secret.generated : s.arn],
    [for s in aws_secretsmanager_secret.placeholder : s.arn],
  )
}

output "django_secret_key_arn" {
  description = "Django SECRET_KEY の ARN (convenience accessor)"
  value       = aws_secretsmanager_secret.generated["django/secret-key"].arn
}

output "db_password_arn" {
  description = "RDS master password の ARN (data モジュールが参照)"
  value       = aws_secretsmanager_secret.generated["django/db-password"].arn
}

output "db_password_value" {
  description = "RDS master password の現在値。terraform apply 直後に data モジュールへ値を渡す用途で sensitive = true。"
  value       = var.generate_random_values ? random_password.generated["django/db-password"].result : null
  sensitive   = true
}
