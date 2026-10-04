output "alb_dns_name" {
  description = "Internal ALB DNS name. Alias your gateway hostname (the host in gateway.yaml's public_url) to this in a Route 53 private hosted zone — the *.elb.amazonaws.com name itself can't carry your ACM certificate."
  value       = aws_lb.gateway.dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID, for the Route 53 alias record."
  value       = aws_lb.gateway.zone_id
}

output "image" {
  description = "Image the service runs (build/push this separately — see README)."
  value       = local.image
}

output "ecr_repository_url" {
  description = "ECR repository URL to push the gateway image to."
  value       = aws_ecr_repository.repo.repository_url
}

output "task_role_arn" {
  description = "Gateway runtime task role (Bedrock invoke)."
  value       = aws_iam_role.task.arn
}

output "execution_role_arn" {
  description = "ECS execution role (image pull + secret injection)."
  value       = aws_iam_role.execution.arn
}

output "db_endpoint" {
  description = "RDS private endpoint (host only; the connection string lives in the gateway-postgres-url secret)."
  value       = aws_db_instance.db.address
}
