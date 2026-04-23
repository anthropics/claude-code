# Storage module (P0.5-08)
#
# S3 buckets: media (ユーザー画像) / static (Next.js 静的アセット) / backup
# (RDS スナップショット・Meilisearch ダンプ等)。
#
# 共通ポリシー:
# - Versioning: 有効 (誤削除復旧 + 監査)
# - Encryption: SSE-S3 (AES256)
# - Public Access: 完全遮断
# - Object Ownership: BucketOwnerEnforced (ACL 無効化)
# - Lifecycle: bucket ごとに個別定義

locals {
  prefix = "${var.project}-${var.environment}"

  default_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "storage"
    },
    var.tags,
  )

  buckets = {
    media    = { name = "${local.prefix}-media", purpose = "user-uploaded content (avatars, tweet images, DM attachments)" }
    static   = { name = "${local.prefix}-static", purpose = "Next.js static assets via CloudFront" }
    backup   = { name = "${local.prefix}-backup", purpose = "RDS / Meilisearch / app-level backups" }
    alb_logs = { name = "${local.prefix}-alb-logs", purpose = "ALB access logs (F-02)" }
  }

  # ap-northeast-1 Elastic Load Balancing service account (AWS 公式 account ID)。
  # https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html
  elb_service_account_ap_northeast_1 = "582318560864"
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets

  bucket        = each.value.name
  force_destroy = false # 誤削除防止。prod teardown 時のみ override。

  tags = merge(local.default_tags, {
    Name    = each.value.name
    Purpose = each.value.purpose
    Bucket  = each.key
  })
}

resource "aws_s3_bucket_ownership_controls" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = aws_s3_bucket.this

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# ---------------------------------------------------------------------------
# Lifecycle rules — bucket ごとに個別の方針
# ---------------------------------------------------------------------------

# backup: IA -> Glacier -> 期限削除
# NOTE: Glacier (90 日最小) を採用し Deep Archive (180 日最小) を選ばないのは、
# stg の監査要件が 730 日で、Deep Archive の 180 日最小 + 取出し遅延 (最大 48 時間)
# を避けるため (security-reviewer PR #48 LOW 指摘)。prod で保持期間を 5 年以上に
# 延ばす場合は Deep Archive 併用を再検討する。
resource "aws_s3_bucket_lifecycle_configuration" "backup" {
  bucket = aws_s3_bucket.this["backup"].id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    filter {} # 全オブジェクト対象

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = var.backup_transition_to_glacier_days
      storage_class = "GLACIER"
    }

    dynamic "expiration" {
      for_each = var.backup_expiration_days > 0 ? [1] : []
      content {
        days = var.backup_expiration_days
      }
    }

    # 旧バージョンは 30 日後に削除 (バージョニングで無限に膨らむのを防ぐ)
    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# media: 旧バージョンのみ削除、本体は永続
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.this["media"].id

  rule {
    id     = "cleanup-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# static: CloudFront 配信なのでキャッシュが効く。古いデプロイの静的ファイルは
# CloudFront invalidation 後に IA へ移して節約。
resource "aws_s3_bucket_lifecycle_configuration" "static" {
  bucket = aws_s3_bucket.this["static"].id

  rule {
    id     = "static-transition-to-ia"
    status = "Enabled"

    filter {}

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# alb_logs: 最長 90 日で削除。ALB の access logs は stg では検証用途で、
# 長期保持は prod で検討する (F-02)。
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.this["alb_logs"].id

  rule {
    id     = "expire-alb-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}

# ALB の access logs 書き込みを許可する bucket policy (F-02):
# ELB サービスアカウント (ap-northeast-1 = 582318560864) に s3:PutObject のみ許可。
# 参考: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html
data "aws_iam_policy_document" "alb_logs_write" {
  statement {
    sid     = "AllowELBServiceAccountPutObject"
    effect  = "Allow"
    actions = ["s3:PutObject"]
    # prefix は compute モジュールで alb/<env>/... と指定されるのでワイルドカード
    resources = ["${aws_s3_bucket.this["alb_logs"].arn}/alb/*"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.elb_service_account_ap_northeast_1}:root"]
    }
  }

  # ELB が ACL "bucket-owner-full-control" を付けて PutObject するケースの許可
  statement {
    sid     = "AllowELBLoggingDeliveryAcl"
    effect  = "Allow"
    actions = ["s3:GetBucketAcl"]

    resources = [aws_s3_bucket.this["alb_logs"].arn]

    principals {
      type        = "Service"
      identifiers = ["logdelivery.elasticloadbalancing.amazonaws.com"]
    }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.this["alb_logs"].id
  policy = data.aws_iam_policy_document.alb_logs_write.json
}

# ---------------------------------------------------------------------------
# CORS — media バケットは直接 PUT (S3 presigned URL) の対象
# ---------------------------------------------------------------------------

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.this["media"].id

  cors_rule {
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"] # CloudFront 経由配信なので GET は広めで許容
    allowed_headers = []
    max_age_seconds = 3600
  }

  # PUT/POST は var.frontend_origins に明示列挙された origin 限定
  # (security-reviewer PR #48 HIGH)。S3 CORS の allowed_origins は末尾
  # 1 箇所の `*` しか効かず、`https://stg.*` のような書き方は
  # `https://stg.evil.com` 等の攻撃者 origin を通してしまう。
  dynamic "cors_rule" {
    for_each = length(var.frontend_origins) > 0 ? [1] : []
    content {
      id              = "presigned-upload"
      allowed_methods = ["PUT", "POST"]
      allowed_origins = var.frontend_origins
      allowed_headers = ["Content-Type", "Content-MD5", "x-amz-*"]
      expose_headers  = ["ETag"]
      max_age_seconds = 3600
    }
  }
}

# ---------------------------------------------------------------------------
# Bucket policy for CloudFront OAC (media / static)
# - cloudfront_oac_arn が空なら policy を作らない (edge モジュール未導入時)
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "cloudfront_read" {
  for_each = var.cloudfront_oac_arn == "" ? {} : { media = true, static = true }

  statement {
    sid     = "AllowCloudFrontServicePrincipalRead"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    resources = ["${aws_s3_bucket.this[each.key].arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [var.cloudfront_oac_arn]
    }

    # AWS 公式推奨の追加ガード (security-reviewer PR #48 MEDIUM)。
    # SourceArn だけでなく SourceAccount でも絞ると、将来 CloudFront
    # ディストリを別アカウントに移す可能性への保険になる。
    dynamic "condition" {
      for_each = var.aws_account_id == "" ? [] : [1]
      content {
        test     = "StringEquals"
        variable = "AWS:SourceAccount"
        values   = [var.aws_account_id]
      }
    }
  }
}

resource "aws_s3_bucket_policy" "cloudfront_read" {
  for_each = data.aws_iam_policy_document.cloudfront_read

  bucket = aws_s3_bucket.this[each.key].id
  policy = each.value.json
}
