# Inputs — mirror the env-overridable knobs in setup.sh (same defaults).

variable "region" {
  description = "AWS region for everything this module creates. Pick one where Bedrock serves the Claude models you need. (The Bedrock region the gateway calls is set separately inside gateway.yaml — keep the two equal.) The walkthrough is scoped to the commercial US regions (us-east-1/us-east-2/us-west-1/us-west-2 — GovCloud and ISO regions are different partitions); see allow_non_us_region."
  type        = string
  default     = "us-east-1"
}

variable "allow_non_us_region" {
  description = "The bedrock-invoke IAM policy and the gateway's built-in model catalog use the US-geo (us.anthropic.*) cross-region inference profiles, so any region outside the commercial US four (including GovCloud/ISO, which are different partitions) fails a plan-time precondition. Set true ONLY after pinning region-appropriate inference profiles via a models: block in gateway.yaml (see the config reference) and widening the ARN geo prefix in main.tf's bedrock-invoke policy."
  type        = bool
  default     = false
}

# ── Networking inputs (prerequisites — NOT created here) ────────────────────
variable "vpc_id" {
  description = "Existing VPC ID (the walkthrough's prerequisite VPC). Unlike the GCP example, this module does not create the network."
  type        = string
}

variable "private_subnet_ids" {
  description = "Two+ private subnet IDs in different AZs, with outbound internet via a NAT gateway. The internal ALB, the ECS tasks, and the RDS subnet group all attach here."
  type        = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "private_subnet_ids needs at least two subnets in different AZs (the internal ALB requires two)."
  }
}

variable "corporate_cidr" {
  description = "Your corporate network CIDR — the only source the ALB security group admits on 443. Must not overlap private_subnet_ids: hosts there are trusted_proxies (gateway.yaml) and could spoof client IPs via X-Forwarded-For."
  type        = string
}

# ── IAM (§2) ────────────────────────────────────────────────────────────────
variable "task_role_name" {
  description = "ECS task role name (the gateway's runtime identity; its only permission is Bedrock invoke)."
  type        = string
  default     = "claude-gateway-task"
}

variable "execution_role_name" {
  description = "ECS execution role name (the ECS agent's identity: pulls the image, injects the secrets)."
  type        = string
  default     = "claude-gateway-execution"
}

# ── Image (§6) ──────────────────────────────────────────────────────────────
# Terraform creates the ECR repository but does NOT build/push the image (that's
# a docker build step — see README). It references the image by tag.
variable "ecr_repo" {
  description = "ECR repository name."
  type        = string
  default     = "claude-gateway"
}

variable "image_tag" {
  description = "Image tag — the tag you built and pushed (must already exist in the repo as linux/amd64, with gateway.yaml baked in). setup.sh tags as <version>-cfg<sha8 of gateway.yaml>; see the README Deploy section for the build command."
  type        = string
  validation {
    condition     = can(regex("^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$", var.image_tag))
    error_message = "image_tag must be a valid OCI tag — set it to the tag you pushed (the '<version>' in terraform.tfvars.example is a placeholder)."
  }
}

variable "gateway_config_path" {
  description = "Path to gateway.yaml. Empty = ../gateway.yaml relative to this module. Read for the REPLACE_ME guard and the config-sha that rolls the service; the file itself ships inside the image."
  type        = string
  default     = ""
}

# ── RDS (§3) ────────────────────────────────────────────────────────────────
variable "db_instance" {
  description = "RDS instance identifier."
  type        = string
  default     = "claude-gateway-db"
}

variable "db_engine_version" {
  description = "Postgres major version. The gateway supports PostgreSQL 14 or newer; 16 is the recommended default."
  type        = string
  default     = "16"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GiB."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Database name."
  type        = string
  default     = "claude_gateway"
}

variable "db_user" {
  description = "Database master user (the gateway connects as this role)."
  type        = string
  default     = "gateway"
}

# ── Secrets (§5) ────────────────────────────────────────────────────────────
# The execution role's secrets-read policy grants read on exactly these three
# secrets' ARNs, so renames are picked up automatically on the next apply.
variable "secret_name" {
  description = "Secrets Manager secret holding the Postgres connection string."
  type        = string
  default     = "gateway-postgres-url"
}

variable "jwt_secret_name" {
  description = "Secrets Manager secret holding the session JWT signing key."
  type        = string
  default     = "gateway-jwt-secret"
}

variable "oidc_secret_name" {
  description = "Secrets Manager secret holding the Okta OIDC client secret."
  type        = string
  default     = "gateway-oidc-client-secret"
}

variable "oidc_client_secret" {
  description = "Okta OIDC client secret value. Leave empty to NOT manage the version via Terraform (only if you add the secret version out-of-band — without one the tasks fail to start)."
  type        = string
  default     = ""
  sensitive   = true
}

# ── ECS + ALB (§7) ──────────────────────────────────────────────────────────
variable "cluster_name" {
  description = "ECS cluster name."
  type        = string
  default     = "claude-gateway"
}

variable "service_name" {
  description = "ECS service name (also used for the ALB and target group)."
  type        = string
  default     = "claude-gateway"
}

variable "log_group_name" {
  description = "CloudWatch Logs group for the gateway's stderr (audit events + operational logs)."
  type        = string
  default     = "/ecs/claude-gateway"
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention in days. The group carries the gateway's audit events, so align with your audit retention policy."
  type        = number
  default     = 90
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the internal gateway hostname (the host in gateway.yaml's public_url), served by the ALB's HTTPS listener."
  type        = string
}

variable "task_cpu" {
  description = "Fargate task CPU units."
  type        = number
  default     = 1024
}

variable "task_memory" {
  description = "Fargate task memory (MiB)."
  type        = number
  default     = 2048
}

variable "desired_count" {
  description = "ECS service desired task count. Each task opens a Postgres pool of up to 5 connections (the gateway's store.max_connections default) and db.t4g.micro caps at ~80 max_connections — keep desired_count × 5 below the DB class's limit, or raise the class before raising this."
  type        = number
  default     = 1
}

variable "deletion_protection" {
  description = "Deletion protection on RDS and the ALB (and whether RDS skips the final snapshot on destroy). Keep true to avoid accidental deletion of the running deployment."
  type        = bool
  default     = true
}
