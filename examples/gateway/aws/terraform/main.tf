# Claude apps gateway on ECS Fargate — Terraform equivalent of setup.sh.
# Section markers (§N) map to setup.sh and the walkthrough:
# https://code.claude.com/docs/en/claude-apps-gateway-on-aws
#
# Unlike the GCP example this module does NOT create the network — the VPC and
# private subnets are walkthrough prerequisites, passed in as variables.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Read (not created) so a typo'd VPC or subnet ID fails the plan up front
# instead of half-applying.
data "aws_vpc" "this" {
  id = var.vpc_id
}

data "aws_subnet" "private" {
  for_each = toset(var.private_subnet_ids)
  id       = each.value
}

locals {
  config_path    = var.gateway_config_path != "" ? var.gateway_config_path : "${path.module}/../gateway.yaml"
  gateway_config = file(local.config_path)
  image          = "${aws_ecr_repository.repo.repository_url}:${var.image_tag}"
}

# ── 1 Security groups ───────────────────────────────────────────────────────
# Three groups chain the traffic path: corp network -> ALB :443, ALB ->
# gateway :8080, gateway -> Postgres :5432. Nothing else is reachable.
# Rules are separate resources (not inline) so they never fight other tooling.
resource "aws_security_group" "alb" {
  name        = "claude-gateway-alb"
  description = "Claude gateway ALB"
  vpc_id      = var.vpc_id
}

resource "aws_security_group" "gateway" {
  name        = "claude-gateway-svc"
  description = "Claude gateway service"
  vpc_id      = var.vpc_id
}

resource "aws_security_group" "db" {
  name        = "claude-gateway-db"
  description = "Claude gateway Postgres"
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from the corporate network"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = var.corporate_cidr
}

resource "aws_vpc_security_group_ingress_rule" "gateway_from_alb" {
  security_group_id            = aws_security_group.gateway.id
  description                  = "Gateway port from the ALB"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_gateway" {
  security_group_id            = aws_security_group.db.id
  description                  = "Postgres from the gateway"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.gateway.id
}

# Egress: the ALB only needs to reach its targets; the gateway needs the NAT
# path out (Bedrock, the IdP, Secrets Manager, ECR, CloudWatch Logs) plus
# Postgres. The DB group needs no egress (security groups are stateful).
resource "aws_vpc_security_group_egress_rule" "alb_to_gateway" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Health checks + forwarding to gateway tasks"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.gateway.id
}

resource "aws_vpc_security_group_egress_rule" "gateway_all" {
  security_group_id = aws_security_group.gateway.id
  description       = "Egress to Bedrock, the IdP, Secrets Manager, ECR, CloudWatch Logs, Postgres"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ── 2 IAM roles (least-privilege) ───────────────────────────────────────────
# Task role: the gateway's runtime identity. Its ONLY permission is invoking
# Claude models on Bedrock — the upstream's `auth: {}` resolves to this role
# via the AWS default credential chain. The policy must cover both the
# cross-region inference-profile ARNs and the underlying foundation-model ARNs.
data "aws_iam_policy_document" "ecs_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task" {
  name               = var.task_role_name
  assume_role_policy = data.aws_iam_policy_document.ecs_trust.json
}

resource "aws_iam_role_policy" "bedrock_invoke" {
  name = "bedrock-invoke"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"]
      Resource = [
        "arn:aws:bedrock:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:inference-profile/us.anthropic.*",
        "arn:aws:bedrock:*::foundation-model/anthropic.*",
      ]
    }]
  })

  # The walkthrough is scoped to commercial US regions: this policy and the
  # gateway's built-in model catalog both use the us.anthropic.* geo-prefixed
  # cross-region inference profiles, which only exist in the commercial US
  # regions — an explicit list, not a `us-` prefix match, because GovCloud
  # (us-gov-*) and ISO (us-iso-*) regions share the prefix but live in
  # different AWS partitions where those profiles and this module's arn:aws:
  # ARNs are wrong. Anywhere else the deploy provisions fine and then every
  # model call fails. Other-region deploys must pin region-appropriate
  # profiles via a models: block in gateway.yaml (see the config reference's
  # models: guidance: https://code.claude.com/docs/en/claude-apps-gateway-config),
  # widen the inference-profile ARN geo prefix above, and set
  # allow_non_us_region = true.
  lifecycle {
    precondition {
      condition     = var.allow_non_us_region || contains(["us-east-1", "us-east-2", "us-west-1", "us-west-2"], var.region)
      error_message = "region is not a commercial US region (GovCloud/ISO share the us- prefix but are different partitions), and this module's IAM policy and the built-in model catalog use the US-geo (us.anthropic.*) inference profiles. Pin your region's inference profiles in a models: block in gateway.yaml, adjust the bedrock-invoke ARN prefix, then set allow_non_us_region = true."
    }
  }
}

# Execution role: the ECS agent's identity — pulls the image from ECR and
# injects the Secrets Manager values into the container; the gateway never
# uses it. AmazonECSTaskExecutionRolePolicy covers the ECR pull + awslogs;
# the inline policy adds read on exactly the three secrets this module
# creates — their full ARNs, not a name-prefix wildcard, so nothing else
# in a shared account (present or future) is readable through this role.
resource "aws_iam_role" "execution" {
  name               = var.execution_role_name
  assume_role_policy = data.aws_iam_policy_document.ecs_trust.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "secrets_read" {
  name = "read-gateway-secrets"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "secretsmanager:GetSecretValue"
      Resource = [
        aws_secretsmanager_secret.jwt.arn,
        aws_secretsmanager_secret.oidc.arn,
        aws_secretsmanager_secret.postgres_url.arn,
      ]
    }]
  })
}

# ── 6 ECR repository ────────────────────────────────────────────────────────
# NOTE: image build/push is a separate step (see README) — Terraform only makes
# the repo. IMMUTABLE tags + scan-on-push: the ECS service pulls whatever this
# repo serves under the deployed tag, so a pushed tag must never be silently
# re-pointed. For production, also restrict push rights on this repo to your
# CI / image-promotion pipeline rather than operator credentials.
resource "aws_ecr_repository" "repo" {
  name                 = var.ecr_repo
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

# ── 3 RDS for PostgreSQL (private subnets, no public address) ───────────────
resource "aws_db_subnet_group" "db" {
  name        = var.db_instance
  description = "Claude gateway"
  subnet_ids  = var.private_subnet_ids
}

# rds.force_ssl: reject plaintext connections server-side — the client-side
# counterpart is sslmode=verify-full in the connection string (§5). The family
# tracks the major version in var.db_engine_version.
#
# name_prefix + create_before_destroy: a major engine bump changes `family`,
# which forces replacement — with a static name that deadlocks (the new group
# can't be created under the taken name; the old can't be destroyed while the
# live instance uses it: "parameter group is currently in use"). With this
# shape the replacement group gets a fresh unique name, the instance is
# repointed, then the old group is destroyed. (The subnet group above needs
# neither: subnet_ids update in place and an engine bump never touches it.)
resource "aws_db_parameter_group" "db" {
  name_prefix = "${var.db_instance}-"
  family      = "postgres${split(".", var.db_engine_version)[0]}"
  description = "Claude gateway - require TLS on every connection"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# URL-safe (alphanumeric) so it drops cleanly into the connection string.
# nosemgrep: terraform-generic-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote S3 backend (see README "Remote state")
resource "random_password" "db" {
  length  = 32
  special = false
}

# nosemgrep: terraform-aws-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote S3 backend (see README "Remote state")
resource "aws_db_instance" "db" {
  identifier            = var.db_instance
  engine                = "postgres"
  engine_version        = var.db_engine_version
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  db_name               = var.db_name
  username              = var.db_user
  password              = random_password.db.result
  db_subnet_group_name  = aws_db_subnet_group.db.name
  parameter_group_name  = aws_db_parameter_group.db.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible   = false
  storage_encrypted     = true
  deletion_protection   = var.deletion_protection
  # Greenfield teardown: skip the final snapshot only once deletion protection
  # is deliberately turned off (the same switch — see README "Tear down").
  skip_final_snapshot       = !var.deletion_protection
  final_snapshot_identifier = "${var.db_instance}-final"
}

# ── 5 Secrets Manager ───────────────────────────────────────────────────────
# postgres-url: connection string built from the instance's private endpoint.
# The execution role's policy (§2) grants read on these three secrets' ARNs
# and nothing else.
#
# recovery_window_in_days rides the same switch as skip_final_snapshot: the
# secrets have fixed names, so a destroy that leaves them in the default
# 30-day scheduled-deletion state makes the next apply fail with a name
# conflict. Greenfield teardown (deletion_protection = false) deletes them
# immediately; a protected deployment keeps the 30-day recovery window.
resource "aws_secretsmanager_secret" "postgres_url" {
  name                    = var.secret_name
  recovery_window_in_days = var.deletion_protection ? 30 : 0
}

# sslmode=verify-full: the gateway's driver (Bun.SQL) honors sslmode from the
# URL and verifies the server certificate chain AND hostname. The trust anchor
# is the AWS RDS CA bundle baked into the image at /etc/claude/rds-global-bundle.pem
# and loaded via NODE_EXTRA_CA_CERTS (see ../Dockerfile) — do NOT add a
# libpq-style `sslrootcert=` query param: the driver doesn't read it and
# forwards it to Postgres as a startup parameter, which the server rejects.
# nosemgrep: terraform-aws-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote S3 backend (see README "Remote state")
resource "aws_secretsmanager_secret_version" "postgres_url" {
  secret_id     = aws_secretsmanager_secret.postgres_url.id
  secret_string = "postgres://${var.db_user}:${random_password.db.result}@${aws_db_instance.db.address}:5432/${var.db_name}?sslmode=verify-full"
}

# jwt: session signing key.
# nosemgrep: terraform-generic-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote S3 backend (see README "Remote state")
resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = var.jwt_secret_name
  recovery_window_in_days = var.deletion_protection ? 30 : 0 # see postgres_url
}

# nosemgrep: terraform-aws-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote S3 backend (see README "Remote state")
resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

# oidc client secret: operator-provided (from the Okta OIDC web app).
resource "aws_secretsmanager_secret" "oidc" {
  name                    = var.oidc_secret_name
  recovery_window_in_days = var.deletion_protection ? 30 : 0 # see postgres_url
}

# nosemgrep: terraform-aws-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote S3 backend (see README "Remote state")
resource "aws_secretsmanager_secret_version" "oidc" {
  count         = var.oidc_client_secret != "" ? 1 : 0
  secret_id     = aws_secretsmanager_secret.oidc.id
  secret_string = var.oidc_client_secret
}

# Warn (not block) at plan time when the OIDC secret value isn't set: the task
# definition references the secret unconditionally, so an empty value with no
# out-of-band version means the tasks fail to start late, at container init
# (ResourceInitializationError). A warning (not a precondition) keeps the
# documented out-of-band-version mode usable.
check "oidc_client_secret_set" {
  assert {
    condition     = var.oidc_client_secret != ""
    error_message = "oidc_client_secret is empty — set it in terraform.tfvars, or add a version to the gateway-oidc-client-secret secret out-of-band before applying (the ECS tasks inject it at start and will fail without one)."
  }
}

# ── 7 ECS Fargate service + internal ALB ────────────────────────────────────
resource "aws_ecs_cluster" "cluster" {
  name = var.cluster_name
}

# The gateway's stderr carries both its audit events and operational logs.
# Bounded retention — without it the group keeps logs forever and cost grows
# unbounded; the default (90 days) is sized for audit-trail review windows.
resource "aws_cloudwatch_log_group" "gateway" {
  name              = var.log_group_name
  retention_in_days = var.log_retention_days
}

# Task definition. gateway.yaml ships INSIDE the image (unlike the GCP example,
# which mounts it from Secret Manager), so Terraform reads ../gateway.yaml only
# to (a) enforce the no-REPLACE_ME guard before a deploy and (b) stamp a hash
# of the config + every managed secret value into the container environment —
# secrets are injected at task start, so rotating one (tainting
# random_password.db ALTERs the DB password; a new oidc_client_secret) would
# otherwise leave running tasks on stale values with nothing forcing a roll.
# NOTE the hash only forces a roll; a config EDIT still reaches the container
# only via a rebuilt image — push under a new tag (the repo enforces
# immutability) and bump image_tag, or the roll redeploys the old config.
resource "aws_ecs_task_definition" "gateway" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    cpu_architecture        = "X86_64" # build the image linux/amd64; ARM64 for Graviton (see ../Dockerfile)
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([
    {
      name  = "gateway"
      image = local.image
      portMappings = [{ containerPort = 8080 }]
      environment = [
        {
          name = "GATEWAY_CONFIG_SHA"
          value = substr(sha256(join("", [
            local.gateway_config,
            random_password.db.result,
            random_password.jwt.result,
            var.oidc_client_secret,
          ])), 0, 16)
        },
      ]
      secrets = [
        { name = "GATEWAY_JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn },
        { name = "OIDC_CLIENT_SECRET", valueFrom = aws_secretsmanager_secret.oidc.arn },
        { name = "GATEWAY_POSTGRES_URL", valueFrom = aws_secretsmanager_secret.postgres_url.arn },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.gateway.name
          awslogs-region        = data.aws_region.current.region
          awslogs-stream-prefix = "gateway"
        }
      }
    }
  ])

  # Guard mirrors setup.sh's REPLACE_ME check (non-comment lines): the config
  # is baked into the image this task definition deploys, so a half-filled
  # gateway.yaml at apply time means the pushed image is half-filled too.
  lifecycle {
    precondition {
      condition = length([
        for line in split("\n", local.gateway_config) :
        line
        if !startswith(trimspace(line), "#") && strcontains(line, "REPLACE_ME")
      ]) == 0
      error_message = "gateway.yaml still has REPLACE_ME on a non-comment line — fill it in (and rebuild/push the image) before applying."
    }
  }

  depends_on = [
    aws_secretsmanager_secret_version.postgres_url,
    aws_secretsmanager_secret_version.jwt,
  ]
}

# Internal ALB. ip_address_type ipv4: an internal dual-stack ALB publishes
# public-range AAAA records, which the CLI's /login private-network check
# rejects. idle_timeout 3600: the 60-second default closes a streaming
# response at the first quiet period (long prompt processing before the first
# token, extended thinking with no streamed output).
resource "aws_lb" "gateway" {
  name                       = var.service_name
  internal                   = true
  load_balancer_type         = "application"
  ip_address_type            = "ipv4"
  subnets                    = var.private_subnet_ids
  security_groups            = [aws_security_group.alb.id]
  idle_timeout               = 3600
  enable_deletion_protection = var.deletion_protection
}

# /readyz verifies the store is reachable, so a task that can't reach Postgres
# never enters rotation (the gateway also serves liveness-only /healthz — see
# the deploy guide's outage-behavior tradeoff).
resource "aws_lb_target_group" "gateway" {
  name        = var.service_name
  protocol    = "HTTP"
  port        = 8080
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path = "/readyz"
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.gateway.arn
  protocol          = "HTTPS"
  port              = 443
  # Explicit modern policy — omitting ssl_policy falls back to the legacy
  # ELBSecurityPolicy-2016-08 default, which still accepts TLS 1.0/1.1.
  ssl_policy      = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.gateway.arn
  }
}

resource "aws_ecs_service" "gateway" {
  name            = var.service_name
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.gateway.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Stop a rollout whose tasks keep failing (bad image, unbootable config) and
  # roll back to the last steady state instead of relaunching failing tasks
  # forever.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [aws_security_group.gateway.id]
    # All egress (Bedrock, the IdP, Secrets Manager, ECR, CloudWatch Logs)
    # goes through the NAT gateway — tasks get no public IP.
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.gateway.arn
    container_name   = "gateway"
    container_port   = 8080
  }

  # Tasks register with the ALB at start — give a cold task (image pull +
  # store connect + first /readyz) time before ECS replaces it as unhealthy.
  health_check_grace_period_seconds = 60

  # The listener must exist before targets register; the secrets must be
  # readable before the first task starts.
  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy.secrets_read,
    aws_iam_role_policy_attachment.execution_managed,
    aws_secretsmanager_secret_version.postgres_url,
    aws_secretsmanager_secret_version.jwt,
    aws_secretsmanager_secret_version.oidc,
    aws_db_instance.db,
  ]
}
