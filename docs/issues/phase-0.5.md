# Phase 0.5: 最小 stg デプロイ — Issue 一覧ドラフト

> Phase 目標: Hello World レベルで AWS stg 環境を先行構築、以降の各 Phase 末に逐次デプロイ可能にする
> マイルストーン: `Phase 0.5: 最小 stg デプロイ`
> 見積工数: 5〜7 日
> 並列化: Terraform module 間と app 実装は部分的に並行可

## 依存グラフ

```
P0.5-01 (tf-state bootstrap)
    │
    ▼
P0.5-02 (network module) ──────┐
    │                          │
    ▼                          ▼
P0.5-03 (data module)    P0.5-04 (compute module)
    │                          │
    └────────┬─────────────────┘
             ▼
        P0.5-05 (edge module)
             │
             ▼
        P0.5-06 (observability module)
             │
             ▼
        P0.5-07 (stg env main.tf)
             │
             ▼
        P0.5-08 (S3 buckets) ← 並列
        P0.5-09 (Secrets Manager)
             │
             ▼
        P0.5-10 (お名前.com NS 委任・手動)
             │
             ▼
        P0.5-11 (Django Hello) ← 並列 with P0.5-12
        P0.5-12 (Next.js Hello)
             │
             ▼
        P0.5-13 (GitHub Actions OIDC)
             │
             ▼
        P0.5-14 (cd-stg.yml workflow)
             │
             ▼
        P0.5-15 (stg 初回デプロイ)
             │
             ▼
        P0.5-16 (運用手順書)
```

---

## P0.5-01. [infra] Terraform state 用 S3 + DynamoDB Lock を bootstrap

- **Labels**: `type:infra`, `layer:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: S (< 4h)
- **Parallel**: なし（最初）
- **Depends on**: AWS アカウント準備（ハルナさん手動で完了済みと仮定）

### 目的

Terraform state を S3 に保存しロックするための bootstrap リソースを作成する。これ自体は Terraform で管理せず、bootstrap スクリプトで一度だけ実行。

### 作業内容

- [ ] `scripts/bootstrap-tf-state.sh` を作成（`aws cli` で以下を作成）:
  - S3 バケット `sns-stg-tf-state`（バージョニング有効、暗号化有効）
  - DynamoDB テーブル `sns-stg-tf-lock`（PK: `LockID`）
- [ ] `terraform/backend.tf` に backend 設定を追加:
  ```hcl
  terraform {
    backend "s3" {
      bucket         = "sns-stg-tf-state"
      key            = "stg/terraform.tfstate"
      region         = "ap-northeast-1"
      dynamodb_table = "sns-stg-tf-lock"
      encrypt        = true
    }
  }
  ```
- [ ] README に bootstrap 手順追記

### 受け入れ基準

- [ ] S3 バケット + DynamoDB テーブルが作成
- [ ] `terraform init` が成功

---

## P0.5-02. [infra] `terraform/modules/network` を実装

- **Labels**: `type:infra`, `layer:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: L (1-2d)
- **Parallel**: ❌ 最もコア
- **Depends on**: P0.5-01

### 目的

VPC・サブネット・SG・NAT（fck-nat ASG）・VPC Endpoints を一括で定義する。

### 作業内容

- [ ] VPC (`10.0.0.0/16`)
- [ ] サブネット 6 つ（public/private/db × 2 AZ）
- [ ] IGW + Route Tables
- [ ] **fck-nat ASG**（t4g.nano、Min 1/Max 1）
- [ ] Security Groups: `alb-sg`, `ecs-sg`, `rds-sg`, `redis-sg`, `fcknat-sg`
- [ ] VPC Interface Endpoints: ECR API/DKR, Secrets Manager, CloudWatch Logs, STS
- [ ] S3 Gateway Endpoint
- [ ] モジュール output: `vpc_id`, `public_subnets`, `private_subnets`, `db_subnets`, `sg_*`

### 受け入れ基準

- [ ] `terraform plan` がクリーン
- [ ] `terraform apply` で VPC 作成成功
- [ ] fck-nat AMI から ASG が起動、外向き HTTPS 通信可能
- [ ] architect 承認

---

## P0.5-03. [infra] `terraform/modules/data` を実装（RDS + ElastiCache）

- **Labels**: `type:infra`, `layer:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: M (4-8h)
- **Parallel**: ✅ P0.5-04 と並行可（両者とも network module に依存するのみ）
- **Depends on**: P0.5-02

### 目的

Postgres と Redis を作成。

### 作業内容

- [ ] RDS PostgreSQL 15:
  - `db.t4g.micro`, 20GB gp3, Single-AZ
  - 暗号化有効、バックアップ 7 日保持
  - `pg_bigm`, `pg_trgm` 拡張を parameter group で有効化
  - マスターパスワードは Secrets Manager から参照（または Terraform ランダム生成 + output を Secrets Manager に登録）
- [ ] ElastiCache Redis 7:
  - `cache.t4g.micro`, Single-node
  - Subnet Group は db subnets
- [ ] モジュール output: `db_endpoint`, `db_port`, `redis_endpoint`, `redis_port`

### 受け入れ基準

- [ ] RDS + Redis 起動
- [ ] ECS タスクからのみアクセス可（SG 制限確認）
- [ ] database-reviewer 承認

---

## P0.5-04. [infra] `terraform/modules/compute` を実装（ECS + ALB + ECR）

- **Labels**: `type:infra`, `layer:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: L (1-2d)
- **Parallel**: ✅ P0.5-03 と並行可
- **Depends on**: P0.5-02

### 目的

ECS Cluster・ALB（sticky + idle_timeout=3600）・ECR を作成。

### 作業内容

- [ ] ECS Cluster（FARGATE + FARGATE_SPOT capacity providers）
- [ ] ALB 本体（HTTP:80 → HTTPS リダイレクト、HTTPS:443）
- [ ] ALB ターゲットグループ:
  - `app-tg`（Django、port 80）
  - `next-tg`（Next.js、port 3000）
  - `daphne-tg`（WebSocket、port 8001、sticky session 有効）
- [ ] ALB Listener Rules（ホスト + パスベース）:
  - `stg.<domain>/ws/*` → daphne-tg
  - `stg.<domain>/api/*` → app-tg
  - `stg.<domain>/*` → next-tg
  - `webhook.stg.<domain>/*` → app-tg
- [ ] ALB idle_timeout = 3600s
- [ ] ECR repositories: `sns-backend`, `sns-frontend`, `sns-nginx`
- [ ] タスク実行ロール（ECR pull, Secrets Manager read, CloudWatch Logs write）
- [ ] タスクロール（S3 read/write, SES もし使う場合）

### 受け入れ基準

- [ ] ECS + ALB + ECR が作成
- [ ] Listener rules が意図通り動作（後続 Phase で確認）
- [ ] architect + security-reviewer 承認

---

## P0.5-05. [infra] `terraform/modules/edge` を実装（CloudFront + Route53 + ACM）

- **Labels**: `type:infra`, `layer:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: M (4-8h)
- **Parallel**: ❌ compute module 完成後
- **Depends on**: P0.5-04

### 目的

CloudFront 単一ディストリ・Route53 Hosted Zone・ACM 証明書を構築。

### 作業内容

- [ ] Route53 Hosted Zone（`example.com`）
- [ ] ACM 証明書（us-east-1: `stg.example.com`, `webhook.stg.example.com`, CloudFront 用）
- [ ] ACM 証明書（ap-northeast-1: `stg.example.com`, `webhook.stg.example.com`, ALB 用）
- [ ] CloudFront ディストリビューション（単一）:
  - オリジン: ALB（`stg.example.com`）
  - オリジン: S3（`sns-stg-media`, `sns-stg-static` OAC）
  - Behaviors: `/ws/*`, `/api/*`, `/media/*`, `/_next/static/*`, `/*`
- [ ] Route53 レコード: `stg.example.com` → CloudFront, `webhook.stg.example.com` → ALB 直

### 受け入れ基準

- [ ] ACM 検証通過
- [ ] CloudFront 配信開始
- [ ] architect 承認

---

## P0.5-06. [infra] `terraform/modules/observability` を実装

- **Labels**: `type:infra`, `layer:infra`, `priority:high`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0.5-03〜P0.5-05 と並行可
- **Depends on**: P0.5-02

### 目的

CloudWatch ログ・アラーム・SNS Topic を構築。

### 作業内容

- [ ] CloudWatch Log Groups: `/ecs/sns-stg/<service>` ×5
- [ ] CloudWatch Alarms:
  - ECS Service CPU > 80% 15min
  - RDS CPU > 80% 15min
  - RDS FreeStorageSpace < 20%
  - ALB 5xx Error Rate > 1%
- [ ] SNS Topic `sns-stg-alerts` + Email サブスクリプション（ハルナさん宛）

### 受け入れ基準

- [ ] Log Groups 作成
- [ ] アラーム定義完了
- [ ] テストで意図的にアラーム発火 → メール受信確認

---

## P0.5-07. [infra] `terraform/environments/stg/main.tf` でモジュール結合

- **Labels**: `type:infra`, `layer:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: M (4-8h)
- **Parallel**: ❌
- **Depends on**: P0.5-02〜P0.5-06

### 目的

5 モジュールを結合し、stg 環境を 1 コマンドで立ち上げ可能にする。

### 作業内容

- [ ] `terraform/environments/stg/main.tf`, `variables.tf`, `terraform.tfvars`
- [ ] モジュール呼び出し順: network → data + compute + observability → edge
- [ ] `output.tf` で ALB DNS / CloudFront DNS / RDS endpoint を出力

### 受け入れ基準

- [ ] `terraform plan` クリーン
- [ ] `terraform apply` で全リソース作成

---

## P0.5-08. [infra] S3 バケット作成（media / static / backup）

- **Labels**: `type:infra`, `layer:infra`, `priority:high`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ edge module と並行可
- **Depends on**: P0.5-01

### 目的

ユーザーメディア・静的ファイル・バックアップ用のバケットを作成。

### 作業内容

- [ ] `sns-stg-media`（非公開、CloudFront OAC 経由配信）
- [ ] `sns-stg-static`（非公開、CloudFront OAC 経由配信）
- [ ] `sns-stg-backup`（非公開、Glacier 90 日後移行）
- [ ] すべてバージョニング有効、暗号化有効、Public Access Block

### 受け入れ基準

- [ ] 3 バケットが作成
- [ ] 公開設定の抜け道がないことを security-reviewer で確認

---

## P0.5-09. [infra] Secrets Manager にシークレット登録

- **Labels**: `type:infra`, `layer:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ 並行可
- **Depends on**: P0.5-01

### 目的

Django・外部 API のシークレットを Secrets Manager に登録。

### 作業内容

- [ ] 登録（Phase 0.5 で必要最小限）:
  - `sns/stg/django/secret-key`
  - `sns/stg/django/db-password`
  - `sns/stg/sentry/dsn`
- [ ] 後続 Phase で追加（Mailgun / Stripe / OpenAI / Claude / GitHub など）
- [ ] ECS タスクロールに該当リソースへの `GetSecretValue` 権限
- [ ] Terraform 内では random_password で生成し、実際の API キーは手動登録

### 受け入れ基準

- [ ] Secrets が作成
- [ ] ECS タスクから取得可能（Phase 0.5-15 で確認）

---

## P0.5-10. [docs][infra] お名前.com → Route53 への NS 委任手順書

- **Labels**: `type:docs`, `layer:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: S (< 4h, 実作業はハルナさん側 10 分)
- **Parallel**: ✅ edge module 完了後に手動実施
- **Depends on**: P0.5-05

### 目的

お名前.com で取得したドメインのネームサーバーを Route53 に切り替える手順を整備。

### 作業内容

- [ ] `docs/operations/dns-delegation.md` を作成:
  - Route53 で取得した NS 4 本を確認する手順
  - お名前.com のコンパネで NS を書き換える手順（スクショは後日）
  - DNS 伝播確認（`dig NS example.com @8.8.8.8`）
- [ ] **ハルナさん手動実施** → 完了報告を Issue にコメント

### 受け入れ基準

- [ ] `dig NS <ドメイン>` で Route53 の NS が返る
- [ ] ACM DNS 検証が通過

---

## P0.5-11. [feature][backend] Django ヘルスチェックエンドポイント

- **Labels**: `type:feature`, `layer:backend`, `priority:high`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0.5-12 と並行可
- **Depends on**: なし（Phase 0 完了後ならどの時点でも可）

### 目的

デプロイ成功確認用のエンドポイントを用意。

### 作業内容

- [ ] `apps/common/views.py` に `HealthCheckView` 実装:
  - GET `/api/health/` → `{"status": "ok", "version": "<git-sha>", "time": "<iso>"}`
  - DB 接続確認、Redis PING も含める（オプション）
- [ ] URL 登録
- [ ] pytest でテスト

### 受け入れ基準

- [ ] `curl /api/health/` で 200 OK

---

## P0.5-12. [feature][frontend] Next.js Hello World ページ

- **Labels**: `type:feature`, `layer:frontend`, `priority:high`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ P0.5-11 と並行可
- **Depends on**: なし

### 目的

Next.js のデプロイ成功確認用。

### 作業内容

- [ ] `client/src/app/page.tsx` を Hello World ページに差し替え:
  - "エンジニア特化型 SNS - stg 環境稼働中" 表示
  - ヘルスチェック API `/api/health/` を fetch して結果表示
  - 環境名（`NEXT_PUBLIC_ENVIRONMENT`）を表示

### 受け入れ基準

- [ ] `curl /` で HTML 返却、Django ヘルスチェックの結果が含まれる

---

## P0.5-13. [ci][infra] GitHub Actions OIDC IAM Role を作成

- **Labels**: `type:ci`, `layer:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: M (4-8h)
- **Parallel**: ❌
- **Depends on**: P0.5-07

### 目的

GitHub Actions から AWS へ静的キーなしで認証する OIDC ロールを作成。

### 作業内容

- [ ] Terraform で IAM OIDC Provider（`token.actions.githubusercontent.com`）
- [ ] IAM Role `sns-stg-github-actions` を作成:
  - Trust Policy: ハルナさんの GitHub Org/Repo に限定
  - 最小権限: ECR push, ECS UpdateService, Secrets Manager read
- [ ] README に AWS アカウント ID・Role ARN を記載（シークレットではない）

### 受け入れ基準

- [ ] GitHub Actions から `aws-actions/configure-aws-credentials` で認証成功
- [ ] security-reviewer 承認（権限最小化確認）

---

## P0.5-14. [ci] `.github/workflows/cd-stg.yml` を作成

- **Labels**: `type:ci`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: M (4-8h)
- **Parallel**: ❌
- **Depends on**: P0.5-13

### 目的

main マージ時に stg へ自動デプロイするワークフロー。

### 作業内容

- [ ] trigger: `push` to `main`
- [ ] jobs:
  - `build`: Backend / Frontend / Nginx のイメージをビルド、ECR push（tag: `stg-<git-sha>` + `stg-latest`）
  - `migrate`: ECS run-task で Django マイグレーション
  - `deploy`: ECS UpdateService で Rolling Update
  - `smoke-test`: デプロイ後 `curl /api/health/` と `curl /` で 200 確認
  - `notify`: 成功/失敗を Slack（or メール）に通知
- [ ] Sentry にリリース通知（`@sentry/cli` or Action）

### 受け入れ基準

- [ ] main マージで stg へデプロイ成功
- [ ] 失敗時は ECS rolling rollback

---

## P0.5-15. [infra] stg 初回デプロイを実行

- **Labels**: `type:infra`, `priority:critical`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: S (< 4h)
- **Parallel**: ❌
- **Depends on**: P0.5-10〜P0.5-14 すべて

### 目的

Hello World を stg で動かす。

### 作業内容

- [ ] `terraform apply`（インフラ）
- [ ] Docker イメージを一度手動で ECR に push（cd-stg.yml 未稼働時のため初回のみ）
- [ ] ECS サービス起動
- [ ] Route53 で `stg.<domain>` レコード設定（edge module で自動、確認のみ）
- [ ] ブラウザで `https://stg.<domain>` を確認
- [ ] `/api/health/` を確認
- [ ] CloudWatch Logs で起動ログ確認
- [ ] Sentry で stg 起動イベント確認

### 受け入れ基準

- [ ] ブラウザで Next.js Hello World が表示
- [ ] /api/health/ が 200 OK
- [ ] ログ・Sentry が配線済み

---

## P0.5-16. [docs] stg 運用手順書を作成

- **Labels**: `type:docs`, `priority:high`
- **Milestone**: `Phase 0.5: 最小 stg デプロイ`
- **Estimate**: S (< 4h)
- **Parallel**: ✅ 並行可
- **Depends on**: P0.5-15

### 目的

将来自分や他の開発者が stg を運用できる手順を残す。

### 作業内容

- [ ] `docs/operations/stg-deployment.md`:
  - デプロイフロー（main merge → ECR → ECS）
  - ロールバック手順（前の task definition revision を ECS で選択）
  - DB マイグレーション手動実行方法（ECS run-task）
  - CloudWatch Logs の見方
  - 一時的に stg を停止する手順（コスト削減）
  - 緊急時対応（ECS タスクが落ちた / RDS 接続失敗 / ALB 5xx 急増）

### 受け入れ基準

- [ ] ドキュメントが README からリンクされる
- [ ] doc-updater 承認
