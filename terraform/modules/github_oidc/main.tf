# GitHub Actions OIDC provider + IAM Role (P0.5-13)
#
# GitHub Actions から AWS へ short-lived credential で認証するための IAM Role。
# アクセスキーをリポジトリ secrets に置かないことで、キー流出・ローテ漏れを根本解決する。
#
# 参考: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

locals {
  prefix = "${var.project}-${var.environment}"

  default_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "github_oidc"
    },
    var.tags,
  )

  # `sub` claim のデフォルトパターン。
  # `refs/heads/main` への push のみ許可する最小構成。CI でテストだけ走らせたい
  # PR は「environment: pr」ではなく `contents:read` のみの token で別経路推奨。
  default_allowed_refs = [
    "repo:${var.github_owner}/${var.github_repo}:ref:refs/heads/main",
  ]

  allowed_refs = length(var.allowed_refs) > 0 ? var.allowed_refs : local.default_allowed_refs
}

# ---------------------------------------------------------------------------
# OIDC Identity Provider
# すでに同アカウントで GitHub Actions OIDC provider が作られている場合はこの
# リソースを削除して data source で参照する運用に切り替えるか、module を
# skip する変数を足す。Phase 0.5 では新規アカウント前提で常に作成する。
# ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # thumbprint_list (security-reviewer PR #57 MEDIUM):
  #   AWS は 2023 年以降、OIDC トークンの署名検証を thumbprint ベースから
  #   ルート CA ベースに移行しているため、ここで列挙する値の実質的な効力は
  #   限定的。ただし aws_iam_openid_connect_provider リソースは値を要求する
  #   ため、GitHub 公式の DigiCert 系ルート thumbprint を記録。将来 AWS が
  #   再度 thumbprint 検証に戻した場合の後退防止として維持する。
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]

  tags = local.default_tags
}

# ---------------------------------------------------------------------------
# Trust policy: GitHub Actions workflow からの AssumeRoleWithWebIdentity を許可
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    effect  = "Allow"

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    # audience を sts.amazonaws.com に固定
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # sub claim が allowed_refs のいずれかに一致する workflow のみ許可
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.allowed_refs
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${local.prefix}-github-actions"
  description        = "Assumed by GitHub Actions via OIDC for stg deploy"
  assume_role_policy = data.aws_iam_policy_document.trust.json
  max_session_duration = 3600

  tags = local.default_tags
}

# ---------------------------------------------------------------------------
# Permissions: ECR push + ECS update-service + Secrets read + CloudWatch Logs
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "ecr_push" {
  count = length(var.ecr_repository_arns) > 0 ? 1 : 0

  # ECR repo に push するのに必要な最小 set。
  statement {
    sid    = "EcrAuthToken"
    effect = "Allow"
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    # GetAuthorizationToken は resource level で絞れない
    resources = ["*"]
  }

  statement {
    sid    = "EcrPushPull"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = var.ecr_repository_arns
  }
}

resource "aws_iam_role_policy" "ecr_push" {
  count = length(var.ecr_repository_arns) > 0 ? 1 : 0

  name   = "ecr-push"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.ecr_push[0].json
}

data "aws_iam_policy_document" "ecs_deploy" {
  count = var.ecs_cluster_arn == "" ? 0 : 1

  statement {
    sid    = "EcsListServices"
    effect = "Allow"
    actions = [
      "ecs:DescribeServices",
      "ecs:DescribeTasks",
      "ecs:DescribeTaskDefinition",
      "ecs:ListTasks",
    ]
    resources = ["*"] # 上記 Describe 系は resource level 絞りにくい
  }

  # UpdateService / RunTask / StopTask は ecs:cluster condition で
  # クラスター外への拡張を拒否できる。
  statement {
    sid    = "EcsClusterScopedActions"
    effect = "Allow"
    actions = [
      "ecs:UpdateService",
      "ecs:RunTask", # マイグレーション run-task 用
      "ecs:StopTask",
    ]
    resources = ["*"] # UpdateService 等は resource を cluster ARN で指定できるが、Service ARN 個別列挙が煩雑
    condition {
      test     = "StringEquals"
      variable = "ecs:cluster"
      values   = [var.ecs_cluster_arn]
    }
  }

  # RegisterTaskDefinition / DeregisterTaskDefinition は ecs:cluster condition が
  # 効かない (security-reviewer PR #57 HIGH)。condition なしで別 statement に
  # 分離し、最小 action のみ許可する。実体の保護はタグや命名規約と、ecs:family
  # を conditions で絞る将来運用に委ねる。
  statement {
    sid    = "EcsTaskDefinitionManagement"
    effect = "Allow"
    actions = [
      "ecs:RegisterTaskDefinition",
      "ecs:DeregisterTaskDefinition",
    ]
    resources = ["*"]
  }

  # ECS タスク実行ロール/タスクロールを PassRole する必要あり。
  # ecs_task_role_arns が指定されていればそれに絞り、空なら全 role ("*") に
  # 対して PassedToService=ecs-tasks.amazonaws.com で絞る暫定運用
  # (security-reviewer PR #57 HIGH)。
  statement {
    sid     = "EcsPassRole"
    effect  = "Allow"
    actions = ["iam:PassRole"]
    resources = length(var.ecs_task_role_arns) > 0 ? var.ecs_task_role_arns : ["*"]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "ecs_deploy" {
  count = var.ecs_cluster_arn == "" ? 0 : 1

  name   = "ecs-deploy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.ecs_deploy[0].json
}

data "aws_iam_policy_document" "secrets_read" {
  count = var.secrets_arn_prefix == "" ? 0 : 1

  statement {
    sid       = "ReadScopedSecrets"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [var.secrets_arn_prefix]
  }
}

resource "aws_iam_role_policy" "secrets_read" {
  count = var.secrets_arn_prefix == "" ? 0 : 1

  name   = "secrets-read"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.secrets_read[0].json
}

# CloudWatch Logs (ECS run-task のログ tail 用)
data "aws_iam_policy_document" "logs_read" {
  statement {
    sid    = "CloudWatchLogsRead"
    effect = "Allow"
    actions = [
      "logs:DescribeLogStreams",
      "logs:GetLogEvents",
      "logs:FilterLogEvents",
    ]
    resources = ["arn:aws:logs:*:*:log-group:/ecs/${local.prefix}/*"]
  }
}

resource "aws_iam_role_policy" "logs_read" {
  name   = "logs-read"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.logs_read.json
}
