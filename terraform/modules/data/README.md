# `data` module

RDS PostgreSQL + ElastiCache Redis + 付随する subnet/parameter group。

## 前提依存

- network モジュール: `db_subnet_ids`, `rds_security_group_id`, `redis_security_group_id`
- secrets モジュール: `db_master_password` (`db_password_value` output を sensitive で渡す)

## リソース

### RDS PostgreSQL
- Engine: postgres 15.8 (stg)、`aws_db_instance.this`
- Instance class: `db.t4g.micro` (stg) — ARCHITECTURE.md §4.1 で t4g.small 昇格判断条件あり
- Storage: gp3 20GB → 最大 100GB 自動スケール、暗号化 (AWS managed KMS)
- Multi-AZ: stg=false / prod=true 推奨
- **Parameter group**: `shared_preload_libraries = pg_bigm` でローディング、
  `log_min_duration_statement = 1000ms` で slow query ログ有効化
- Backup: 7 日、JST 03:00-04:00
- Maintenance: JST 水曜 04:00-05:00
- Performance Insights: 有効、stg は 7 日保持 (無料枠)
- CloudWatch Logs: postgresql + upgrade

### ElastiCache Redis
- Engine: Redis 7.1、Single-node `cache.t4g.micro`
- Parameter group: `maxmemory-policy = allkeys-lru` (Channels + cache 兼用)
- stg は snapshot 無効、AUTH token なし (SG で十分守る)
- Maintenance: JST 木曜 04:00-05:00
- **prod 昇格時**: replication group + transit encryption + at-rest encryption +
  auth_token に切替 (別モジュール `data_replication` を新設予定)

## pg_bigm / pg_trgm の有効化

`shared_preload_libraries` で load は済むが、Django 初回 migrate 時に以下を実行する必要がある:

```python
# apps/common/migrations/0001_extensions.py (Phase 1 で作成予定)
from django.contrib.postgres.operations import BigmExtension, TrigramExtension

class Migration(migrations.Migration):
    operations = [
        BigmExtension(),
        TrigramExtension(),
    ]
```

## lifecycle.ignore_changes

- `password`: secrets モジュールの ignore_changes と対になる。手動 put で
  secret を更新しても RDS 側の master_user_password は自動同期しないため、
  RDS を更新したい場合は別途 `aws rds modify-db-instance` を実行する運用
- `final_snapshot_identifier`: `timestamp()` で差分が無限に出る問題を回避

## 使用例

```hcl
module "data" {
  source = "../../modules/data"

  environment = "stg"
  project     = "sns"

  # network モジュールから
  db_subnet_ids           = module.network.db_subnet_ids
  rds_security_group_id   = module.network.rds_security_group_id
  redis_security_group_id = module.network.redis_security_group_id

  # secrets モジュールから
  db_master_password = module.secrets.db_password_value

  # stg 向け設定 (デフォルト値でも OK)
  rds_instance_class  = "db.t4g.micro"
  rds_multi_az        = false
  redis_node_type     = "cache.t4g.micro"
}
```

## 運用上の注意

### destroy 時の final snapshot

`rds_skip_final_snapshot = false` (default) だと destroy で final snapshot が作られる。
stg teardown を頻繁に行う場合は環境変数で `true` にしつつ、`rds_deletion_protection = false`
にする。prod は `true` 固定。

### ストレージ自動スケール

`max_allocated_storage_gb = 100` で 20GB → 100GB まで自動拡張。その先は手動で
`allocated_storage` を変更する。CloudWatch アラームは observability モジュールで
20% 閾値を設定済み。

### 接続数

t4g.micro のデフォルト `max_connections` は約 81。Django (`CONN_MAX_AGE=60`) +
Celery worker + Daphne の合計が超えないよう監視する。超えたら PgBouncer を
compute モジュール側に導入する。

## 今後の拡張

- PgBouncer (Fargate サイドカー) 導入で接続プーリング
- prod の Multi-AZ + read replica
- RDS Proxy (Lambda / Fargate からの cold connection 吸収)
- KMS CMK 暗号化
- `data_replication` モジュールで ElastiCache replication group
