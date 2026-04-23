output "rds_instance_id" {
  description = "RDS インスタンス識別子 (observability モジュールの alarm dimension に渡す)"
  value       = aws_db_instance.this.id
}

output "rds_endpoint" {
  description = "RDS endpoint (host:port 形式)"
  value       = aws_db_instance.this.endpoint
}

output "rds_address" {
  description = "RDS hostname (port なし)"
  value       = aws_db_instance.this.address
}

output "rds_port" {
  value = aws_db_instance.this.port
}

output "rds_database_name" {
  value = aws_db_instance.this.db_name
}

output "rds_master_username" {
  value = aws_db_instance.this.username
}

output "rds_parameter_group_name" {
  value = aws_db_parameter_group.postgres15.name
}

output "rds_arn" {
  value = aws_db_instance.this.arn
}

output "redis_id" {
  value = aws_elasticache_cluster.this.id
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint (Single-node なので cluster_address とほぼ同じ)"
  value       = aws_elasticache_cluster.this.cache_nodes[0].address
}

output "redis_port" {
  value = aws_elasticache_cluster.this.port
}

output "redis_connection_url" {
  description = "Django settings / Celery に渡す REDIS_URL"
  value       = "redis://${aws_elasticache_cluster.this.cache_nodes[0].address}:${aws_elasticache_cluster.this.port}/0"
}
