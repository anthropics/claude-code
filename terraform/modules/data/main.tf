# Data module (P0.5-03)
#
# - RDS PostgreSQL (Single-AZ for stg, Multi-AZ opt for prod)
# - ElastiCache Redis (Single-node for stg)
# - Subnet groups + parameter groups for pg_bigm / pg_trgm
# - db_password は secrets モジュールから var 経由で渡す (state 漏洩の緩和は
#   docs/adr/ + secrets/README.md に記載)

locals {
  prefix = "${var.project}-${var.environment}"

  default_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Module      = "data"
    },
    var.tags,
  )
}

# ---------------------------------------------------------------------------
# RDS PostgreSQL
# ---------------------------------------------------------------------------

resource "aws_db_subnet_group" "this" {
  name       = "${local.prefix}-rds-subnet-group"
  subnet_ids = var.db_subnet_ids

  tags = merge(local.default_tags, { Name = "${local.prefix}-rds-subnet-group" })
}

# pg_bigm (日本語全文検索) + pg_trgm (タグ編集距離) を有効化。
# shared_preload_libraries は静的パラメータなので適用には RDS 再起動が必要
# (terraform apply 時に自動で再起動される)。
resource "aws_db_parameter_group" "postgres15" {
  name_prefix = "${local.prefix}-pg15-"
  family      = "postgres15"
  description = "Postgres 15 parameters with pg_bigm + pg_trgm preloaded"

  parameter {
    # pg_bigm: 日本語全文検索 (Phase 1/2 で CREATE EXTENSION)
    # pg_stat_statements: Performance Insights が参照するクエリ統計 (DB reviewer PR #50 HIGH)
    name         = "shared_preload_libraries"
    value        = "pg_bigm,pg_stat_statements"
    apply_method = "pending-reboot"
  }

  parameter {
    # pg_stat_statements の追跡対象: IN 句などの正規化した文
    name         = "pg_stat_statements.track"
    value        = "all"
    apply_method = "pending-reboot"
  }

  # Bot 投稿や TL キャッシュ更新で slow query を把握できるようにログ化
  parameter {
    name         = "log_min_duration_statement"
    value        = "1000" # 1 秒超えるクエリをログ
    apply_method = "immediate"
  }

  parameter {
    name         = "log_statement"
    value        = "ddl" # DDL のみログ
    apply_method = "immediate"
  }

  # 接続数管理: Daphne + Gunicorn + Celery の合計に合わせて
  # t4g.micro default は 81 前後だが、CONN_MAX_AGE を効かせる前提で据え置き。
  # PgBouncer 導入時はここを絞って過剰接続を拒否する。

  tags = local.default_tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "this" {
  identifier = "${local.prefix}-postgres"

  engine                 = "postgres"
  engine_version         = var.rds_engine_version
  instance_class         = var.rds_instance_class
  allocated_storage      = var.rds_allocated_storage_gb
  max_allocated_storage  = var.rds_max_allocated_storage_gb > 0 ? var.rds_max_allocated_storage_gb : null
  storage_type           = "gp3"
  iops                   = var.rds_storage_iops
  storage_throughput     = var.rds_storage_throughput_mbs
  storage_encrypted      = true
  # KMS は AWS managed key (aws/rds)。prod で CMK 移行時は kms_key_id を variable 化する。

  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.postgres15.name
  vpc_security_group_ids = [var.rds_security_group_id]

  username = var.db_master_username
  password = var.db_master_password
  # password 変更は手動運用 (secrets 側の ignore_changes と整合)。
  # AWS RDS 側で手動 password 変更した場合、次回 terraform apply で
  # "in-place update" が走るため、lifecycle.ignore_changes でガードする。

  port     = 5432
  db_name  = "sns"

  multi_az                = var.rds_multi_az
  publicly_accessible     = false
  auto_minor_version_upgrade = true

  backup_retention_period = var.rds_backup_retention_days
  backup_window           = "18:00-19:00" # JST 03:00-04:00
  maintenance_window      = "Wed:19:00-Wed:20:00" # JST 水曜 04:00-05:00

  deletion_protection = var.rds_deletion_protection
  skip_final_snapshot = var.rds_skip_final_snapshot
  # final_snapshot_identifier は timestamp() を使わず固定名にする
  # (database-reviewer PR #50 MEDIUM: timestamp() は毎 plan で差分を生む)。
  # 実行時刻は copy_tags_to_snapshot で引き継いだ tags + AWS 側の作成時刻から追える。
  # teardown を複数回行う場合は手動で snapshot 名を別にする (e.g. `final_snapshot_identifier`
  # 変数化は本モジュールでは未対応、必要になれば追加)。
  final_snapshot_identifier = var.rds_skip_final_snapshot ? null : "${local.prefix}-postgres-final"
  copy_tags_to_snapshot     = true

  performance_insights_enabled          = true
  performance_insights_retention_period = 7 # stg は 7 日、prod は 731 (2 年) を別途指定

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(local.default_tags, {
    Name = "${local.prefix}-postgres"
  })

  lifecycle {
    # password は手動運用に委ねる (secrets モジュール側の ignore_changes と対)
    ignore_changes = [
      password,
    ]
  }
}

# pg_bigm / pg_trgm は shared_preload_libraries で有効化済みだが、
# CREATE EXTENSION はスキーマレベルで別途実行が必要。
# 初回 migrate 時に apps.common のマイグレーションで CREATE EXTENSION IF NOT EXISTS を
# 実行する Django データマイグレーションを追加する (Phase 1 作業、別 Issue)。

# ---------------------------------------------------------------------------
# ElastiCache Redis
# ---------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "this" {
  name       = "${local.prefix}-redis-subnet-group"
  subnet_ids = var.db_subnet_ids

  tags = merge(local.default_tags, { Name = "${local.prefix}-redis-subnet-group" })
}

resource "aws_elasticache_parameter_group" "redis7" {
  name_prefix = "${local.prefix}-redis7-"
  family      = "redis7"
  description = "Redis 7 parameters for stg (Channels layer + Celery broker + cache)"

  # maxmemory-policy の選択 (database-reviewer PR #50 HIGH):
  #
  # この Redis は 3 種類のワークロードを相乗りしている:
  #   1. Celery broker (キューの key は TTL なし、evict されるとジョブ消失)
  #   2. Django Channels layer (WebSocket state、key に TTL あり)
  #   3. 汎用キャッシュ (ツイート TL / OGP / トレンドタグ等、key に TTL あり)
  #
  # allkeys-lru は 1 も evict するため stg でもジョブ消失のリスクがある。
  # volatile-lru は「TTL を明示的に設定した key のみを LRU で evict」するため、
  # Channels と cache (両方 TTL 付き) は evict されつつ、Celery の broker キュー
  # は保持される。Phase 3+ で job 量が増えたら Celery 用を別 Redis に分離する。
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = local.default_tags
}

resource "aws_elasticache_cluster" "this" {
  cluster_id           = "${local.prefix}-redis"
  engine               = "redis"
  engine_version       = var.redis_engine_version
  node_type            = var.redis_node_type
  num_cache_nodes      = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.redis7.name
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [var.redis_security_group_id]

  # stg は AUTH token 無効 (SG で十分守る)。prod では
  # replication group + transit encryption + at-rest encryption + auth_token が推奨で、
  # 別モジュール (data_replication) で提供する前提。
  snapshot_retention_limit = 0 # stg は snapshot なし (Redis は壊れても再作成で OK)
  apply_immediately        = false
  auto_minor_version_upgrade = true

  maintenance_window = "thu:19:00-thu:20:00" # JST 木曜 04:00-05:00

  tags = merge(local.default_tags, {
    Name = "${local.prefix}-redis"
  })
}
