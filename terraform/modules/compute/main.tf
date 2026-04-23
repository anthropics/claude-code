# Compute module (P0.5-04)
#
# - ECS Cluster with FARGATE + FARGATE_SPOT capacity providers
# - ALB with sticky sessions (for Daphne WebSocket) and long idle_timeout
# - ALB target groups for app (Django nginx) / next (Next.js) / daphne (WS) /
#   webhook (Stripe + GitHub 直受け用)
# - ALB listener rules: host + path-based routing matching ARCHITECTURE.md §3.4
# - ECR repositories (one per service that publishes an image)
# - IAM roles: ecs_task_execution (shared) + placeholder for task roles
#
# Task definitions / services themselves are NOT created here. Each ECS
# service will land as part of the corresponding feature Phase (Phase 0.5-11
# for Hello-World, Phase 1+ for real apps).

locals {
  prefix = "${var.project}-${var.environment}"

  default_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "compute"
    },
    var.tags,
  )

  # ECR を作る対象 (celery-worker と celery-beat は django イメージを共有するため
  # ECR レポジトリは個別には作らない)
  ecr_services = ["backend", "frontend", "nginx"]

  # ALB target group 設定 (service -> port / health check path)
  target_groups = {
    app = {
      port     = 80
      protocol = "HTTP"
      health   = "/api/health/"
      sticky   = false
    }
    next = {
      port     = 3000
      protocol = "HTTP"
      # F-10: 軽量 /api/healthz route handler を叩く。SSR フルレンダを 30s ごとに
      # 起動しないため ALB 側のコストも Next.js 側の負荷も下がる。
      health   = "/api/healthz"
      sticky   = false
    }
    daphne = {
      port     = 8001
      protocol = "HTTP"
      health   = "/ws/health/"
      # WebSocket 再接続を同じタスクに張り付かせるため sticky (ARCHITECTURE §3.4)
      sticky   = true
    }
  }
}

# ---------------------------------------------------------------------------
# ECS Cluster
# ---------------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = "${local.prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.default_tags
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name = aws_ecs_cluster.this.name

  capacity_providers = var.enable_fargate_spot ? ["FARGATE", "FARGATE_SPOT"] : ["FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

# ---------------------------------------------------------------------------
# ECR Repositories
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "this" {
  for_each = toset(local.ecr_services)

  name                 = "${local.prefix}-${each.value}"
  image_tag_mutability = "MUTABLE" # stg は latest tag を許可。prod は IMMUTABLE 推奨
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "AES256"
  }
  tags = merge(local.default_tags, { Service = each.value })
}

# 古いイメージ削除ポリシー (architect PR #51 HIGH 指摘反映):
#   - release-* tag (手動タグ、本番ロールバック用): 30 個保持
#   - stg-* tag (CI 自動タグ、PR/merge ごとに生成): 100 個保持
#     毎 PR で stg-<sha> を push するため、30 個だとすぐ枯渇する
#   - latest tag: 最新のみ保持
#   - untagged: 7 日で削除
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each = aws_ecr_repository.this

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 release-* tagged images (prod rollback pool)"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["release-*"]
          countType      = "imageCountMoreThan"
          countNumber    = 30
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 100 stg-* tagged images (CI pool, high churn)"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = ["stg-*"]
          countType      = "imageCountMoreThan"
          countNumber    = 100
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 10
        description  = "Expire untagged images after 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
    ]
  })
}

# ---------------------------------------------------------------------------
# ALB
# ---------------------------------------------------------------------------

resource "aws_lb" "this" {
  name               = "${local.prefix}-alb"
  load_balancer_type = "application"
  internal           = false

  subnets         = var.public_subnet_ids
  security_groups = [var.alb_security_group_id]

  # idle_timeout=3600s は Daphne WebSocket が再接続なしで最大 1h 生きるため。
  # architect PR #51 HIGH: CloudFront origin_read_timeout (default 60s / edge
  # モジュールで 60s 明示) とミスマッチするので、/ws/* は **edge モジュールの
  # CloudFront behavior で origin read timeout を長めに設定する** か、または
  # WebSocket は CloudFront を迂回する経路 (将来の別サブドメイン ws.<domain>)
  # を検討。現状は CloudFront 経由で 60s ごとに keepalive ping を打つ前提で運用。
  idle_timeout               = var.alb_idle_timeout_seconds
  enable_deletion_protection = var.environment == "prod"
  enable_http2               = true

  dynamic "access_logs" {
    for_each = var.alb_access_logs_bucket == "" ? [] : [1]
    content {
      bucket  = var.alb_access_logs_bucket
      prefix  = "alb/${var.environment}"
      enabled = true
    }
  }

  tags = merge(local.default_tags, { Name = "${local.prefix}-alb" })
}

resource "aws_lb_target_group" "this" {
  for_each = local.target_groups

  name        = "${local.prefix}-${each.key}-tg"
  port        = each.value.port
  protocol    = each.value.protocol
  vpc_id      = var.vpc_id
  target_type = "ip" # Fargate awsvpc mode

  deregistration_delay = 30

  # architect PR #51 MEDIUM: matcher を "200" に絞り、リダイレクトを
  # 健全状態と誤認しないようにする。
  # F-10 で next tg の health path を "/" -> "/api/healthz" に差し替え済み。
  health_check {
    path                = each.value.health
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  dynamic "stickiness" {
    for_each = each.value.sticky ? [1] : []
    content {
      type            = "lb_cookie"
      cookie_duration = 86400 # 24 時間 (ARCHITECTURE §3.4)
      enabled         = true
    }
  }

  tags = merge(local.default_tags, { Service = each.key })
}

# ---------------------------------------------------------------------------
# ALB Listeners
# ---------------------------------------------------------------------------

# HTTP: HTTPS にリダイレクトするだけ
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS: edge モジュールから ACM 証明書を受け取ってから作成
# (alb_certificate_arn が空なら未作成 = ブートストラップ用)
resource "aws_lb_listener" "https" {
  count = var.alb_certificate_arn == "" ? 0 : 1

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.alb_certificate_arn

  # default は Next.js SSR へ。paths で api / ws / webhook へ振り分け。
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["next"].arn
  }
}

# /api/* → app tg (Django)
resource "aws_lb_listener_rule" "api" {
  count = var.alb_certificate_arn == "" ? 0 : 1

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 10

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["app"].arn
  }
}

# /ws/* → daphne tg (sticky session 有効)
resource "aws_lb_listener_rule" "ws" {
  count = var.alb_certificate_arn == "" ? 0 : 1

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 20

  condition {
    path_pattern {
      values = ["/ws/*"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["daphne"].arn
  }
}

# webhook.* host header → app tg (Stripe/GitHub webhook、CloudFront 非経由)
resource "aws_lb_listener_rule" "webhook" {
  count = var.alb_certificate_arn == "" ? 0 : 1

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 5 # host header マッチを path より先に

  condition {
    host_header {
      values = ["webhook.*"]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this["app"].arn
  }
}

# ---------------------------------------------------------------------------
# IAM Roles
# ---------------------------------------------------------------------------

# Task execution role: ECR pull / CloudWatch Logs / Secrets Manager read
data "aws_iam_policy_document" "ecs_task_execution_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.prefix}-ecs-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_execution_assume.json

  tags = local.default_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Secrets Manager / CloudWatch Logs の細かい権限は利用側 (環境ディレクトリ)
# で必要なシークレット ARN に絞った policy を別途アタッチする想定。
# この module はロールだけ用意して、policy は min-privilege 優先で外で書く。

# Task role (アプリケーション権限): S3 / SES / SSM 等。
# Phase が進むにつれて必要な権限が増えるため、ここではスケルトンのみ。
resource "aws_iam_role" "ecs_task" {
  name               = "${local.prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_execution_assume.json # 同じ trust

  tags = local.default_tags
}
