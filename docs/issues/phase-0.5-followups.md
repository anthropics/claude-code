# Phase 0.5 フォローアップ Issues

Phase 0.5 実装中にサブエージェントレビューで指摘されたが、スコープ外として
フォローアップ扱いにした項目を追跡する。Phase 別に着手順で並べる。

発行: `./scripts/create-issues.sh phase-0.5-followups`

## 着手 Phase 分布 (doc-updater PR #60 の指摘を反映)

| Phase                                | Items                                          |
| ------------------------------------ | ---------------------------------------------- |
| Phase 1 (冒頭 Week 0 の準備タスク群) | F-10, F-11, F-14                               |
| Phase 1 (stg 運用開始時点から必要)   | F-02                                           |
| Phase 2 (検索実装と同時)             | F-15                                           |
| Phase 7 (Bot 実装の直前)             | F-04                                           |
| Phase 8 (プレミアム前に必須)         | F-01                                           |
| Phase 9 (本番昇格時のまとめ)         | F-03, F-05, F-06, F-07, F-08, F-09, F-12, F-13 |

Phase 9 にまとめて積んでいる項目 (F-06/F-07/F-08 等) は、stg 規模の拡大や予算
超過の兆候が出た場合には Phase 2-5 のタイミングで前倒し可。判断は毎 Phase 末の
コストレビューで行う。

---

## F-01. [infra][security] webhook.<domain> に WAF Regional を適用

- **Labels**: `type:infra`, `layer:infra`, `area:billing`, `area:moderation`, `priority:high`
- **Milestone**: `Phase 8: プレミアム`
- **Source**: architect PR #52 HIGH (edge モジュール) / security-reviewer PR #46

### 目的

Stripe / GitHub webhook を CloudFront 非経由で ALB 直接受けしているため、WAF Global が適用されない。AWS WAF Regional を ALB に Attach し、Stripe / GitHub 公式 IP レンジ以外からのアクセスを 403 にする。

### 作業内容

- [ ] `terraform/modules/compute` または新モジュール `terraform/modules/waf` に `aws_wafv2_web_acl` + `aws_wafv2_web_acl_association`
- [ ] AWS Managed Rule Set: `AWSManagedRulesCommonRuleSet`, `AWSManagedRulesKnownBadInputsRuleSet`
- [ ] Stripe 公式 IP レンジ: https://stripe.com/docs/ips (定期更新スクリプトを Lambda で)
- [ ] GitHub Meta API (`GET /meta`) から hooks IP を取得して IPSet に反映
- [ ] webhook.<domain> のみに適用、他トラフィックには影響させない

### 受け入れ基準

- [ ] Stripe / GitHub 以外の IP から webhook endpoint を叩いても 403
- [ ] Stripe Webhook のテスト送信が通る

---

## F-02. [infra][security] ALB access logs 専用 S3 バケットを用意

- **Labels**: `type:infra`, `layer:infra`, `priority:medium`
- **Milestone**: **`Phase 1: 認証・プロフィール・基本ツイート`** (doc-updater 指摘: stg 運用開始時点から必要なため前倒し)
- **Source**: architect PR #51 MEDIUM

### 目的

現状 ALB access logs が未設定。将来 compute モジュールの `alb_access_logs_bucket` 変数に渡すバケットを、storage の backup バケットに相乗りせず専用で用意する。ELB サービスアカウントへの PutObject 許可は専用バケットで完結させたい。

### 作業内容

- [ ] `terraform/modules/storage` に `alb_logs` バケットを追加 (他の 3 本と同じ共通ポリシー)
- [ ] バケットポリシーで ap-northeast-1 の ELB サービスアカウント `arn:aws:iam::582318560864:root` に PutObject を許可
- [ ] `compute` モジュールの `alb_access_logs_bucket` 変数に渡す
- [ ] 30 日後に Glacier → 365 日で削除の lifecycle

### 受け入れ基準

- [ ] ALB のアクセスログが S3 に 5 分おきに書き込まれる
- [ ] security-reviewer 承認

---

## F-03. [infra][security] KMS CMK への移行 (prod 向け)

- **Labels**: `type:infra`, `layer:infra`, `priority:medium`
- **Milestone**: `Phase 9: 本番昇格`
- **Source**: architect PR #45 MEDIUM / security-reviewer PR #49 LOW

### 目的

現状 stg は AWS managed key (SSE-S3 / aws/secretsmanager / aws/rds)。prod では
customer-managed KMS key に移行して IAM / CloudTrail 可視化を強化。

### 作業内容

- [ ] `terraform/modules/kms` モジュール新設
- [ ] tf-state bucket / backup bucket / Secrets Manager / RDS で CMK に切替
- [ ] rotation schedule: 365 日
- [ ] ADR-0006 として採用理由・移行手順を記録

### 受け入れ基準

- [ ] prod で tf-state / secrets / RDS が CMK で暗号化
- [ ] CloudTrail で KMS key usage が監査可能
- [ ] ADR-0006 作成

---

## F-04. [infra][backend] Celery 用 Redis の分離

- **Labels**: `type:infra`, `area:bots`, `area:notifications`, `priority:medium`
- **Milestone**: `Phase 7: Bot`
- **Source**: database-reviewer PR #50 HIGH

### 目的

現状 1 台の ElastiCache Redis が Celery broker / Channels layer / cache の 3 用途を兼ねている。`maxmemory-policy = volatile-lru` で Celery キーは保護されるが、Bot / 記事配信で job 量が増えた時点で分離が望ましい。

### 作業内容

- [ ] `terraform/modules/data_replication` (新モジュール) で専用 Redis cluster
- [ ] Celery `BROKER_URL` / `CELERY_RESULT_BACKEND` を専用 Redis へ
- [ ] Channels + cache は既存 Redis 継続
- [ ] maxmemory-policy: Celery 用 = `noeviction`, 既存 = `volatile-lru` のまま

### 受け入れ基準

- [ ] job 量を scale しても Channels / cache に影響しない
- [ ] database-reviewer 承認

---

## F-05. [infra][backend] PostgreSQL 16 メジャーアップグレード検討

- **Labels**: `type:infra`, `priority:low`
- **Milestone**: `Phase 9: 本番昇格`
- **Source**: database-reviewer PR #50 MEDIUM

### 目的

現 15.12 (auto minor upgrade 有効)。PostgreSQL 16 は安定稼働実績あり、paraller query や logical replication の改善メリットがある。Phase 9 で prod 昇格時に検討。

### 作業内容

- [ ] 互換性検証 (pg_bigm, pg_stat_statements, django-storages 等の依存)
- [ ] ADR-0007 として採用判断
- [ ] stg でアップグレードテスト (RDS blue/green deployment)
- [ ] prod へ展開

### 受け入れ基準

- [ ] stg で 16.x 動作確認済み
- [ ] 移行手順書作成

---

## F-06. [infra] fck-nat / Interface Endpoints の AZ 最適化

- **Labels**: `type:infra`, `priority:low`
- **Milestone**: `Phase 9: 本番昇格`
- **Source**: architect PR #47 MEDIUM

### 目的

現状 stg は AZ-a に fck-nat 1 台、AZ-c の ECS タスクは cross-AZ transit 料金が発生。prod Multi-AZ 化時に per-AZ fck-nat へ拡張。また Interface Endpoints を AZ-c に配置するコストも stg では過剰なので絞れる。

### 作業内容

- [ ] `network` モジュールに `var.fcknat_multi_az` 追加
- [ ] `aws_network_interface.fcknat` を AZ ごとに作成する条件分岐
- [ ] Interface Endpoint の subnet_ids を `var.environment == "prod" ? all : first_only` に

### 受け入れ基準

- [ ] prod apply で 2 AZ に fck-nat
- [ ] stg は 1 AZ を維持

---

## F-07. [infra] ecs-sg / rds-sg / redis-sg の egress を VPC CIDR 限定

- **Labels**: `type:infra`, `priority:medium`
- **Milestone**: `Phase 9: 本番昇格`
- **Source**: architect PR #47 MEDIUM

### 目的

現状 DB / Redis / ECS 各 SG の egress が全開 (`0.0.0.0/0`)。defense-in-depth で VPC CIDR に限定する。ECS は外部 API を叩くので全開維持が必要だが、RDS / Redis は VPC 内部通信のみで十分。

### 作業内容

- [ ] `network` モジュールの rds / redis SG の egress を `var.vpc_cidr` に絞る
- [ ] ECS は据え置き (外部 API 通信のため)

### 受け入れ基準

- [ ] terraform plan で差分確認
- [ ] RDS / Redis が外向き通信できないことを確認 (試しに `aws rds create-db-snapshot-copy` 等が影響を受けない)

---

## F-08. [infra][ci] CostCenter / Owner タグ標準化

- **Labels**: `type:infra`, `priority:low`
- **Milestone**: `Phase 9: 本番昇格`
- **Source**: security-reviewer PR #48 MEDIUM / architect PR #46 MEDIUM

### 目的

Cost Explorer の配賦精度を上げるため、全モジュールに `CostCenter` / `Owner` / `Service` タグを追加。

### 作業内容

- [ ] `terraform/environments/stg/versions.tf` の `default_tags` に追加
- [ ] provider default_tags で全リソース自動付与
- [ ] モジュール内の tags = merge(...) を整理

### 受け入れ基準

- [ ] AWS Console の Tag Editor で `CostCenter = sns-stg` でフィルタ可能
- [ ] Cost Explorer で月次配賦が見える

---

## F-09. [infra] S3 Access Logs 有効化

- **Labels**: `type:infra`, `area:moderation`, `priority:medium`
- **Milestone**: `Phase 9: 本番昇格`
- **Source**: security-reviewer PR #48 MEDIUM

### 目的

media / static / backup バケットの S3 Access Logs を同リージョンの専用バケットへ。誰が何時どのオブジェクトにアクセスしたかを証明できる状態にする。

### 作業内容

- [ ] `storage` モジュールに `s3_access_logs` バケットを追加
- [ ] 3 バケットの aws_s3_bucket_logging を有効化

---

## F-10. [frontend] Next.js /api/healthz route handler の新設

- **Labels**: `type:feature`, `layer:frontend`, `priority:medium`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート` (**Phase 1 冒頭 Week 0 の準備タスク**、本体の認証実装より先)
- **Source**: architect PR #51 MEDIUM

### 目的

ALB target group の next tg health_check.path が `/` で SSR フルレンダするのは 30s 間隔で重い。Next.js App Router の軽量 route handler に差し替え。

### 作業内容

- [ ] `client/src/app/api/healthz/route.ts` で `{"status":"ok"}` を返す
- [ ] compute モジュールの next tg health_check.path を `/api/healthz` に変更

---

## F-11. [frontend] components-demo をバンドル外へ

- **Labels**: `type:refactor`, `layer:frontend`, `priority:low`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート` (**Phase 1 冒頭 Week 0 の 5 分タスク**)
- **Source**: a11y-architect PR #41 MEDIUM

### 目的

現状 `/components-demo` は `NODE_ENV !== "development"` で 404 するが、ページバンドル自体は production build に含まれる。`@/dev-only/` 配下への移動 + NextConfig exclude で完全除外。

---

## F-12. [ci] サードパーティ Action を SHA pin

- **Labels**: `type:ci`, `priority:medium`
- **Milestone**: `Phase 9: 本番昇格`
- **Source**: security-reviewer PR #43 MEDIUM / PR #58 MEDIUM

### 目的

`docker/build-push-action@v6`, `aws-actions/configure-aws-credentials@v4` 等のサードパーティ (AWS 公式以外) を SHA ピン化。供給元のタグ書き換え攻撃耐性を得る。

---

## F-13. [infra] Terraform backend.tf の env 別分離

- **Labels**: `type:infra`, `priority:medium`
- **Milestone**: `Phase 9: 本番昇格`
- **Source**: architect PR #45 MEDIUM

### 目的

現状 backend.tf は stg 固定 (bucket `sns-stg-tf-state`)。prod 環境追加時は `-backend-config` 全上書きか、environments/prod/backend.hcl 分離。

---

## F-14. [ci] pre-commit で修正されるリポジトリ全体の whitespace/EOL

- **Labels**: `type:chore`, `priority:low`
- **Milestone**: `Phase 1: 認証・プロフィール・基本ツイート`
- **Source**: typescript-reviewer PR #56 (CI failure log)

### 目的

`.pre-commit-config.yaml` が blocking する trailing-whitespace / end-of-file-fixer 違反が Claude Code 由来の無関係ファイルに残っている。一度まとめて clean up すれば以降の CI が安定する。

### 作業内容

- [ ] `pre-commit run --all-files` を実行して修正箇所を確認
- [ ] 修正を 1 コミットでまとめる (review 負荷を抑える)

---

## F-15. [infra][backend] Django の pg_bigm / pg_trgm CREATE EXTENSION マイグレーション

- **Labels**: `type:feature`, `layer:backend`, `area:search`, `priority:high`
- **Milestone**: **`Phase 2: TL・リアクション・検索`** (doc-updater 指摘: 検索は Phase 2 で実装なので、extension も Phase 2 冒頭で作る方が依存関係と整合)
- **Source**: data モジュール README (P0.5-03)

### 目的

RDS の parameter group で `shared_preload_libraries = pg_bigm,pg_stat_statements` を設定済みだが、extension 自体の作成 (`CREATE EXTENSION IF NOT EXISTS`) は Django migration で行う必要がある。

### 作業内容

```python
# apps/common/migrations/0001_extensions.py
from django.contrib.postgres.operations import BigmExtension, TrigramExtension
from django.db import migrations

class Migration(migrations.Migration):
    initial = True
    operations = [
        BigmExtension(),
        TrigramExtension(),
    ]
```

### 受け入れ基準

- [ ] `python manage.py migrate` で拡張が有効化
- [ ] `SELECT extname FROM pg_extension;` に `pg_bigm` / `pg_trgm` が存在
