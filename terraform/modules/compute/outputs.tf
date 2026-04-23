output "ecs_cluster_id" {
  value = aws_ecs_cluster.this.id
}

output "ecs_cluster_name" {
  description = "observability モジュールの ECS CPU alarm ClusterName dimension に渡す"
  value       = aws_ecs_cluster.this.name
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "alb_arn" {
  value = aws_lb.this.arn
}

output "alb_arn_suffix" {
  description = "observability モジュールの ALB 5xx alarm LoadBalancer dimension に渡す"
  value       = aws_lb.this.arn_suffix
}

output "alb_dns_name" {
  description = "ALB の DNS 名。edge モジュールが Route53 A record の alias target に指定する"
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Route53 alias target に必要な canonical hosted zone ID"
  value       = aws_lb.this.zone_id
}

output "target_group_arns" {
  description = "target group 論理名 -> ARN のマップ。ECS service の load_balancer ブロックに渡す。"
  value       = { for k, tg in aws_lb_target_group.this : k => tg.arn }
}

output "ecr_repository_urls" {
  description = "service 名 -> ECR repository URL のマップ"
  value       = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "ecr_repository_arns" {
  description = "service 名 -> ECR repository ARN のマップ (IAM policy 用)"
  value       = { for k, r in aws_ecr_repository.this : k => r.arn }
}

output "ecs_task_execution_role_arn" {
  description = "ECS task definition の executionRoleArn に渡す"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_execution_role_name" {
  description = "Secrets Manager 読み取り policy を追加でアタッチする際に使う"
  value       = aws_iam_role.ecs_task_execution.name
}

output "ecs_task_role_arn" {
  description = "ECS task definition の taskRoleArn に渡す (アプリの AWS SDK 用)"
  value       = aws_iam_role.ecs_task.arn
}

output "ecs_task_role_name" {
  value = aws_iam_role.ecs_task.name
}

output "service_names" {
  description = <<-EOT
    observability モジュールの ecs_service_name_map に渡す用の予定サービス名。
    将来 aws_ecs_service を本 module で管理するようになったら、そちらから
    直接参照する。現状は命名規約を先に固定するためマップを出している。
  EOT
  value = { for svc in var.ecs_services : svc => "${local.prefix}-${svc}" }
}
