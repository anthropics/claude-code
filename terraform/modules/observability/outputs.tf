output "sns_topic_arn" {
  description = "Alerts 配信用 SNS Topic の ARN。他モジュール (Lambda・外部サービス) からサブスクライブする用途。"
  value       = aws_sns_topic.alerts.arn
}

output "log_group_names" {
  description = "ECS サービス名 -> CloudWatch Log Group 名のマップ。compute モジュールの task definition でこの値を参照する。"
  value       = { for svc, lg in aws_cloudwatch_log_group.ecs : svc => lg.name }
}

output "log_group_arns" {
  description = "ECS サービス名 -> Log Group ARN のマップ。IAM policy で `resources` に渡す用途。"
  value       = { for svc, lg in aws_cloudwatch_log_group.ecs : svc => lg.arn }
}
