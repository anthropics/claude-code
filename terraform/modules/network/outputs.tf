output "vpc_id" {
  value = aws_vpc.this.id
}

output "vpc_cidr" {
  value = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "db_subnet_ids" {
  value = aws_subnet.db[*].id
}

output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}

output "redis_security_group_id" {
  value = aws_security_group.redis.id
}

output "fcknat_security_group_id" {
  value = aws_security_group.fcknat.id
}

output "fcknat_network_interface_id" {
  description = "fck-nat ENI。prod で Route53 health check 等に参照する際に利用。"
  value       = aws_network_interface.fcknat[0].id
}

output "fcknat_asg_name" {
  value = aws_autoscaling_group.fcknat.name
}
