# Observability module (P0.5-06)
#
# CloudWatch Log Groups + CloudWatch Alarms + SNS Topic for alerts.
# 他モジュール (compute/data/edge) はこのモジュールの出力を参照せず、
# このモジュールが他モジュールのリソース名を var で受け取る片方向依存にする
# (architect 推奨: モジュール間の output 引き回しコスト削減)。

locals {
  prefix = "${var.project}-${var.environment}"

  default_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "observability"
    },
    var.tags,
  )

  # ECS サービス論理名 -> 実 ServiceName を解決する。
  # caller が map で明示した場合はそちらを優先し、それ以外は prefix+論理名で推定。
  resolved_ecs_service_names = {
    for logical in var.ecs_services :
    logical => lookup(var.ecs_service_name_map, logical, "${local.prefix}-${logical}")
  }

  # RDS FreeStorageSpace 閾値 (bytes) = allocated_storage * (1 - ratio)
  # 例: 20GB × 0.2 = 4GB、100GB × 0.2 = 20GB
  rds_free_storage_threshold_bytes = floor(
    var.rds_allocated_storage_gb * var.rds_free_storage_threshold_ratio * 1024 * 1024 * 1024
  )
}

# ---------------------------------------------------------------------------
# CloudWatch Log Groups — 1 ECS サービスにつき 1 group
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "ecs" {
  for_each = toset(var.ecs_services)

  name              = "/ecs/${local.prefix}/${each.value}"
  retention_in_days = var.log_retention_days

  tags = merge(local.default_tags, { Service = each.value })
}

# ---------------------------------------------------------------------------
# SNS Topic — アラート配信先
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "alerts" {
  name = "${local.prefix}-alerts"
  tags = local.default_tags
}

resource "aws_sns_topic_subscription" "alert_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ---------------------------------------------------------------------------
# ECS Service CPU Alarm (1 サービスにつき 1 アラーム)
# ecs_cluster_name が未指定のうちは作らない。
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "ecs_service_cpu" {
  for_each = var.ecs_cluster_name == "" ? toset([]) : toset(var.ecs_services)

  alarm_name          = "${local.prefix}-ecs-${each.value}-cpu-high"
  alarm_description   = "ECS service ${each.value} CPU > 80% for 15 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300 # 5min
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    # 実 ServiceName は var.ecs_service_name_map で明示注入可能 (architect PR #46 HIGH)。
    # 未指定時は "<prefix>-<logical>" にフォールバックする。
    ServiceName = local.resolved_ecs_service_names[each.value]
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = merge(local.default_tags, { Service = each.value })
}

# ---------------------------------------------------------------------------
# RDS CPU / FreeStorageSpace Alarms
# rds_instance_identifier が未指定なら作らない。
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count = var.rds_instance_identifier == "" ? 0 : 1

  alarm_name          = "${local.prefix}-rds-cpu-high"
  alarm_description   = "RDS CPU > 80% for 15 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.default_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  count = var.rds_instance_identifier == "" ? 0 : 1

  alarm_name          = "${local.prefix}-rds-storage-low"
  alarm_description   = "RDS FreeStorageSpace < ${floor(var.rds_free_storage_threshold_ratio * 100)}% of ${var.rds_allocated_storage_gb}GB"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = local.rds_free_storage_threshold_bytes
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_identifier
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.default_tags
}

# ---------------------------------------------------------------------------
# ALB 5xx Error Rate Alarm
# alb_arn_suffix が未指定なら作らない。
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "alb_5xx_rate" {
  count = var.alb_arn_suffix == "" ? 0 : 1

  alarm_name          = "${local.prefix}-alb-5xx-rate-high"
  alarm_description   = "ALB HTTPCode_Target_5XX_Count > 1% of total requests"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 0.01
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "IF(total_requests > 0, errors_5xx / total_requests, 0)"
    label       = "5xx error rate"
    return_data = true
  }

  metric_query {
    id = "errors_5xx"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions = {
        LoadBalancer = var.alb_arn_suffix
      }
    }
  }

  metric_query {
    id = "total_requests"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions = {
        LoadBalancer = var.alb_arn_suffix
      }
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = local.default_tags
}
