# Edge module (P0.5-05)
#
# CloudFront 単一ディストリビューション + Route53 Hosted Zone +
# ACM 証明書 (us-east-1 / ap-northeast-1) を束ねる。
#
# 設計方針:
# - CloudFront は単一ディスト、Behavior で /api/*  /ws/*  /media/* を振り分け
# - webhook.<domain> は CloudFront を経由せず ALB 直 (Stripe 署名検証を壊さない、
#   ARCHITECTURE §1 / SPEC §17.3)
# - ACM は CloudFront 用に us-east-1 (provider alias)、ALB 用に ap-northeast-1 の 2 本

locals {
  prefix = "${var.project}-${var.environment}"

  app_fqdn     = "${var.app_subdomain}.${var.domain_name}"
  webhook_fqdn = "${var.webhook_subdomain}.${var.app_subdomain}.${var.domain_name}"

  default_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "edge"
    },
    var.tags,
  )
}

# ---------------------------------------------------------------------------
# Route53 Hosted Zone
# ---------------------------------------------------------------------------

# お名前.com からの委任先。NS レコードを手動で更新する必要あり
# (docs/operations/dns-delegation.md、P0.5-10 で手順書)。
resource "aws_route53_zone" "this" {
  name = var.domain_name

  tags = merge(local.default_tags, { Name = var.domain_name })
}

# ---------------------------------------------------------------------------
# ACM Certificates
#   - CloudFront 用: us-east-1 (provider alias "us_east_1" を環境側で宣言)
#   - ALB 用: ap-northeast-1 (default provider)
#
#   両方とも DNS 検証で Route53 にレコード追加。
# ---------------------------------------------------------------------------

resource "aws_acm_certificate" "cloudfront" {
  provider = aws.us_east_1

  domain_name               = local.app_fqdn
  subject_alternative_names = [local.webhook_fqdn]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.default_tags, { Name = "${local.prefix}-cloudfront-cert" })
}

resource "aws_acm_certificate" "alb" {
  domain_name               = local.app_fqdn
  subject_alternative_names = [local.webhook_fqdn]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.default_tags, { Name = "${local.prefix}-alb-cert" })
}

# DNS 検証レコード (両証明書で同じ検証レコードが出てくるため、for_each で重複排除)
locals {
  _cf_validation_options  = aws_acm_certificate.cloudfront.domain_validation_options
  _alb_validation_options = aws_acm_certificate.alb.domain_validation_options

  # map: record_name -> { name, type, record }
  cf_validation_records = {
    for dvo in local._cf_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }
  alb_validation_records = {
    for dvo in local._alb_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }
}

resource "aws_route53_record" "cert_validation_cf" {
  for_each = local.cf_validation_records

  zone_id = aws_route53_zone.this.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true # ap-northeast-1 側と同じ record が出ることがある
}

resource "aws_route53_record" "cert_validation_alb" {
  for_each = local.alb_validation_records

  zone_id = aws_route53_zone.this.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "cloudfront" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.cloudfront.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation_cf : r.fqdn]
}

resource "aws_acm_certificate_validation" "alb" {
  certificate_arn         = aws_acm_certificate.alb.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation_alb : r.fqdn]
}

# ---------------------------------------------------------------------------
# CloudFront Origin Access Control (S3 bucket policy で使用)
# ---------------------------------------------------------------------------

resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${local.prefix}-s3-oac"
  description                       = "OAC for media / static S3 buckets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ---------------------------------------------------------------------------
# CloudFront distribution (単一)
# Behaviors:
#   /_next/static/*  -> S3 static (long TTL)
#   /media/*         -> S3 media (long TTL、GET のみ)
#   /api/*           -> ALB  (no cache)
#   /ws/*            -> ALB  (no cache、WebSocket 透過)
#   / (default)      -> ALB  (Next.js SSR、short TTL)
# ---------------------------------------------------------------------------

# AWS Managed Cache policies
data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

data "aws_cloudfront_origin_request_policy" "cors_s3" {
  name = "Managed-CORS-S3Origin"
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.prefix} CloudFront"
  default_root_object = "" # Next.js SSR が index を返す
  price_class         = var.price_class
  aliases             = [local.app_fqdn]
  http_version        = "http2and3"

  # -------- Origins --------
  origin {
    origin_id   = "alb"
    domain_name = var.alb_dns_name

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_keepalive_timeout = 60
      origin_read_timeout      = 60
    }
  }

  origin {
    origin_id                = "media"
    domain_name              = var.media_bucket_regional_domain
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
    s3_origin_config {
      # OAC 使用時も s3_origin_config.origin_access_identity は空文字列を指定する必要あり
      origin_access_identity = ""
    }
  }

  origin {
    origin_id                = "static"
    domain_name              = var.static_bucket_regional_domain
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
    s3_origin_config {
      origin_access_identity = ""
    }
  }

  # -------- Ordered cache behaviors --------
  # ⚠️ NOTE (architect PR #52 MEDIUM): AWS CloudFront は
  # `ordered_cache_behavior` を **Terraform 定義順 = API 送信順** で評価する。
  # 具体度ではなく先勝ち。新しい behavior を追加する際は既存 pattern と
  # 衝突しないよう順序を確認すること (例: /api/ws/* を入れる場合、/ws/* より
  # 先に定義しないと /api/ws/abc が /ws/* でマッチしてしまう)。

  # -------- Default behavior (Next.js SSR via ALB) --------
  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # -------- /_next/static/* → S3 static (long cache) --------
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3.id
  }

  # -------- /media/* → S3 media --------
  ordered_cache_behavior {
    path_pattern           = "/media/*"
    target_origin_id       = "media"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3.id
  }

  # -------- /api/* → ALB (no cache) --------
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # -------- /ws/* → ALB (WebSocket 透過) --------
  # ⚠️ WebSocket keepalive 要件 (architect PR #52 HIGH):
  #   - CloudFront viewer idle timeout = 10 分 (固定)
  #   - CloudFront origin_read_timeout = 60s (custom_origin_config で明示)
  #   - ALB idle_timeout = 3600s (compute モジュール側)
  #   この連携だと idle な接続は origin_read_timeout (60s) で切断される。
  #   クライアント (reconnecting-websocket) は自動再接続するが、Phase 3 DM で
  #   長時間セッションが続く場合は 30s 間隔で ping frame を送る運用が前提。
  #   将来 ws.<domain> を別途立てて CloudFront を bypass する選択肢あり (docs/adr)。
  ordered_cache_behavior {
    path_pattern           = "/ws/*"
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = false

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cloudfront.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = merge(local.default_tags, { Name = "${local.prefix}-cloudfront" })
}

# ---------------------------------------------------------------------------
# Route53 A records
# ---------------------------------------------------------------------------

# app: stg.<domain> → CloudFront (alias)
# (additional_alb_record = true の場合は ALB 直にフォールバック、検証用)
resource "aws_route53_record" "app" {
  zone_id = aws_route53_zone.this.zone_id
  name    = local.app_fqdn
  type    = "A"

  alias {
    name                   = var.additional_alb_record ? var.alb_dns_name : aws_cloudfront_distribution.this.domain_name
    zone_id                = var.additional_alb_record ? var.alb_zone_id : aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

# webhook: webhook.stg.<domain> → ALB 直 (CloudFront 非経由)
# Stripe / GitHub webhook の HMAC 署名検証が body 変換で壊れないようにする
# (SPEC §17.3、security-reviewer PR #36 feedback)
resource "aws_route53_record" "webhook" {
  zone_id = aws_route53_zone.this.zone_id
  name    = local.webhook_fqdn
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
