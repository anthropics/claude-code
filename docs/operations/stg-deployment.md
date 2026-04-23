# stg 運用手順書 (P0.5-16)

> 最終更新: 2026-04-23
> 対象: staging 環境のみ (prod は Phase 9 で追加予定)
> 関連: [SPEC.md](../SPEC.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [tf-state-bootstrap.md](./tf-state-bootstrap.md), [dns-delegation.md](./dns-delegation.md)

stg のデプロイ・ロールバック・緊急対応・コスト監視をまとめる。初回 stg 立ち上げは
§1 を、以降の運用は §2 以降を参照。

---

## 1. 初回デプロイ手順 (P0.5-15)

Phase 0.5 の最後、stg 環境を「一度起動する」作業。新規 AWS アカウントを前提に、
起きる順序でチェックリスト化する。

### 事前準備

- [ ] **AWS アカウント**を確保 (個人アカウントでも可、Organizations 配下推奨)
- [ ] **ドメインを取得** (お名前.com 等、apex 1 本 例: `example.com`)
- [ ] **ローカルツール** インストール
  - [ ] AWS CLI v2 (`aws --version` で `2.x.x` を確認)
  - [ ] Terraform >= 1.9 (`terraform --version`)
  - [ ] Docker Desktop (build image 用、ローカルでも stg でも利用)
  - [ ] `gh` CLI (`gh auth status` が ログイン済みを示す)
- [ ] **AWS 認証** (`aws sso login` or `aws configure`)
- [ ] `aws sts get-caller-identity` で自分の Account ID を確認

### Step 1. Terraform state backend を bootstrap

```bash
cd /path/to/repo
./scripts/bootstrap-tf-state.sh
```

- S3 bucket `sns-stg-tf-state` + DynamoDB `sns-stg-tf-lock` が作成される
- 既に存在する場合は設定のみ更新
- 詳細: [docs/operations/tf-state-bootstrap.md](./tf-state-bootstrap.md)

### Step 2. terraform.tfvars を作成

```bash
cd terraform/environments/stg
cp terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars` を編集:

```hcl
domain_name = "example.com"          # 取得したドメイン
alert_email = "<your-email>"         # SNS topic subscription 用
```

### Step 3. 初回 apply (bootstrap phase)

```bash
terraform init
terraform plan                        # 変更内容を確認
terraform apply                       # yes で実行
```

所要時間: 20-30 分 (CloudFront 作成 + ACM 検証待ちが大半)

この段階で:

- VPC / subnets / SG / fck-nat が立ち上がる
- RDS / ElastiCache が作成される
- S3 bucket 3 本
- Secrets Manager エントリ 9 本 (自動生成 2 + placeholder 7)
- ECS Cluster + ALB + ECR repos
- CloudFront + Route53 Hosted Zone + ACM (PENDING)
- CloudWatch Log Groups + Alarms

### Step 4. Route53 NS 委任 (手作業)

```bash
terraform output -json route53_name_servers | jq -r '.[]'
```

4 本の NS をお名前.com で設定する。詳細手順:
[docs/operations/dns-delegation.md](./dns-delegation.md)

### Step 5. ACM 発行完了を待つ (15 分〜数時間)

```bash
# ap-northeast-1 (ALB 用)
aws acm describe-certificate --region ap-northeast-1 \
  --certificate-arn "$(terraform output -raw acm_alb_arn)" \
  --query 'Certificate.Status'

# us-east-1 (CloudFront 用)
aws acm describe-certificate --region us-east-1 \
  --certificate-arn "$(terraform output -raw cloudfront_distribution_arn | sed 's|:distribution/|:certificate/|')" \
  --query 'Certificate.Status'
```

両方が `ISSUED` になったら次へ。

### Step 6. 二段階目 apply (HTTPS + bucket policy)

```bash
terraform output -raw cloudfront_distribution_arn
terraform output -raw acm_alb_arn
```

`terraform.tfvars` に追記:

```hcl
cloudfront_distribution_arn_override = "arn:aws:cloudfront::..."
alb_certificate_arn_override         = "arn:aws:acm:ap-northeast-1:...:certificate/..."
```

```bash
terraform apply
```

### Step 7. SNS topic サブスクリプション承認

`alert_email` 宛に `AWS Notification - Subscription Confirmation` が届く → リンクをクリック

### Step 8. Placeholder シークレットに実値を書き込む

```bash
# Sentry
aws secretsmanager put-secret-value \
  --secret-id sns/stg/sentry/dsn \
  --secret-string '{"value":"https://xxx@xxx.ingest.sentry.io/xxx"}'

# Mailgun (後で)
# Stripe (Phase 8 で)
# OpenAI / Anthropic (Phase 7/8 で)
```

### Step 9. GitHub Actions Variables を設定

Settings → Secrets and variables → Actions → Variables:

```
AWS_REGION              = ap-northeast-1
AWS_DEPLOY_ROLE_ARN     = <github_oidc モジュールの role_arn>
ECR_BACKEND_REPOSITORY  = <account>.dkr.ecr.ap-northeast-1.amazonaws.com/sns-stg-backend
ECR_FRONTEND_REPOSITORY = <account>.dkr.ecr.ap-northeast-1.amazonaws.com/sns-stg-frontend
ECR_NGINX_REPOSITORY    = <account>.dkr.ecr.ap-northeast-1.amazonaws.com/sns-stg-nginx
ECS_CLUSTER             = sns-stg-cluster
SMOKE_URL               = https://stg.<your-domain>
```

### Step 10. Hello World を main にマージして CD 動作確認

この時点で `cd-stg.yml` が発火し、最初の deploy が走る。
Phase 0.5 ではマイグレーション / ECS サービスが未配線なので warning 止まりでも OK。

### Step 11. 疎通確認

```bash
# ブラウザで
open "https://$(terraform output -raw app_fqdn)"
# Next.js Hello World (P0.5-12) が表示されれば stg 起動完了
```

---

## 2. 通常のデプロイフロー

1. PR 作成 → レビュー通過 → main にマージ (squash)
2. `.github/workflows/cd-stg.yml` が自動トリガー
3. Build → ECR push → ECS rolling update → smoke test → Sentry release
4. 失敗時はメール通知 (workflow failure)

手動デプロイが必要な場合:

```bash
gh workflow run cd-stg.yml -f image_tag=<git-sha>
```

---

## 3. ロールバック

**推奨優先度**: §3.1 → §3.2 → §3.3。ECS service レベルで戻せるならそれが最も安全。

### 3.1 ECS service レベル（最優先）

直前の task definition revision に戻す (Phase 1 で aws_ecs_service が入ったら有効):

```bash
aws ecs describe-services \
  --cluster sns-stg-cluster \
  --services sns-stg-django \
  --query 'services[0].taskDefinition'

# 一つ前の revision (例: 42 → 41)
aws ecs update-service \
  --cluster sns-stg-cluster \
  --service sns-stg-django \
  --task-definition sns-stg-django:41
```

### 3.2 Image レベル (stg-latest タグを前の SHA に向ける)

⚠️ **warning**: `stg-latest` タグ上書きは、同時に `cd-stg.yml` がデプロイ中だと
競合する。§3.1 が機能するなら先にそちらを試すこと。どうしても image タグ自体を
戻したい時だけ実行する。

```bash
aws ecr batch-get-image \
  --repository-name sns-stg-backend \
  --image-ids imageTag=stg-<prev-sha> \
  --query 'images[0].imageManifest' --output text \
  | aws ecr put-image \
    --repository-name sns-stg-backend \
    --image-tag stg-latest \
    --image-manifest file:///dev/stdin
```

### 3.3 Terraform レベル

意図しない infra 変更を戻す場合:

```bash
cd terraform/environments/stg
git log terraform.tfvars         # 変更履歴
git checkout <commit> -- terraform.tfvars
terraform plan                    # 差分確認
terraform apply
```

状態の破壊的な巻き戻しが必要なら S3 backend のバージョニングから tfstate を復元:

```bash
aws s3api list-object-versions --bucket sns-stg-tf-state --prefix stg/terraform.tfstate
aws s3api get-object \
  --bucket sns-stg-tf-state --key stg/terraform.tfstate \
  --version-id <version> \
  recovered.tfstate
# 手動で現 state と比較、必要なら置換 (極めて慎重に)
```

---

## 4. データベースマイグレーション手動実行

> **前提**: この章は **Phase 1 以降で有効**。Phase 0.5 時点では
> `sns-stg-django-migrate` task definition が存在せず、`cd-stg.yml` の
> migrate ジョブも placeholder のみ。Phase 1 で aws_ecs_task_definition と
> aws_ecs_service が作られたら本章のコマンドが機能するようになる。

CD の migrate ジョブが失敗した時、または特定の migration だけ流したい時:

```bash
# Phase 1 以降: aws_ecs_task_definition `sns-stg-django-migrate` が存在する前提
aws ecs run-task \
  --cluster sns-stg-cluster \
  --task-definition sns-stg-django-migrate \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$(terraform output -raw private_subnet_ids | jq -r '. | join(",")')],securityGroups=[$(terraform output -raw ecs_security_group_id)]}" \
  --started-by "manual-migrate-$USER"

# ログ tail
aws logs tail /ecs/sns-stg/django --follow
```

---

## 5. ログ確認

### CloudWatch Logs Insights クエリ例

```
# 直近 1 時間の ERROR レベル
fields @timestamp, @message, request_id, user_id
| filter @message like /"level":"error"/
| sort @timestamp desc
| limit 100
```

### 特定 request の追跡

```
fields @timestamp, @message
| filter request_id = "abc123def456"
| sort @timestamp asc
```

### Celery タスク失敗

```
fields @timestamp, @message, task_name
| filter @message like /task\.failed/
| stats count(*) by task_name
```

詳細は [apps/common/logging.py](../../apps/common/logging.py) の structlog フィールド仕様参照。

---

## 6. 緊急時対応

### 6.1 アラートが鳴った

`alerts@...` メールの内容別:

| アラート                      | 一次対処                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| ECS Service CPU > 80% (15min) | `aws ecs describe-services` でタスク数確認、手動で `desired_count` を一時増         |
| RDS CPU > 80%                 | CloudWatch Performance Insights で slow query 特定、必要なら インスタンスクラス変更 |
| RDS FreeStorage < 20%         | `allocated_storage` を手動で増やす (auto-scale 有効なので通常自動)                  |
| ALB 5xx Error Rate > 1%       | Sentry で例外確認 → 必要なら前 revision にロールバック (§3.1)                       |

### 6.2 stg が完全にダウン

1. `curl -I https://stg.<domain>` で状態確認 (timeout / 502 / 503)
2. ECS Service の状態:
   ```bash
   aws ecs describe-services --cluster sns-stg-cluster --services sns-stg-django sns-stg-next sns-stg-daphne
   ```
3. 最新デプロイに問題があれば**前 revision へロールバック** (§3.1)
4. 復旧できない場合、CloudFront で「メンテナンス中」固定ページに切替 (将来 WAF rule で `/*` → 503 on fail)

### 6.3 secret がリークした

1. 該当シークレットを直ちに revoke (Sentry / Stripe / Mailgun それぞれの console)
2. 新しい値を発行
3. `aws secretsmanager put-secret-value` で上書き
4. ECS サービスを force-new-deployment で再読み込み:
   ```bash
   aws ecs update-service --cluster sns-stg-cluster --service <svc> --force-new-deployment
   ```
5. CloudTrail で漏洩時刻以降のアクセス履歴を追跡
6. **Git 履歴全体の secret スキャン** (doc-updater 指摘、`git log -p` だけでは past
   branches / deleted commits を取りこぼす):

   ```bash
   # detect-secrets で全 commit をスキャン
   detect-secrets scan --all-files > /tmp/detect-secrets.json
   detect-secrets audit /tmp/detect-secrets.json

   # gitleaks で補完 (高精度、ルールセットも広い)
   brew install gitleaks    # or: docker run -v "$PWD:/repo" zricethezav/gitleaks
   gitleaks detect --source . --log-opts="--all"
   ```

   検知された場合は**履歴書き換え** (`git filter-repo` または BFG) を検討。
   本当に履歴に混入していた場合、force push 後に全 contributor に clone し直しを依頼。

7. `.secrets.baseline` を再生成 (`detect-secrets scan --baseline .secrets.baseline`)
   し commit。

---

## 7. 一時停止 (コスト削減)

長期休暇中など、stg を一時停止してコストを下げる手段:

### 7.1 ECS サービスを `desired_count = 0` に

```bash
for svc in django next daphne celery-worker celery-beat; do
  aws ecs update-service \
    --cluster sns-stg-cluster \
    --service "sns-stg-$svc" \
    --desired-count 0
done
```

削減効果: Fargate 課金停止 (ALB / RDS / Redis は継続)。

### 7.2 RDS を stop (最大 7 日、自動再起動される)

```bash
aws rds stop-db-instance --db-instance-identifier sns-stg-postgres
```

### 7.3 完全 teardown → 再構築

```bash
cd terraform/environments/stg
terraform destroy
```

注意:

- `rds_skip_final_snapshot = false` なので final snapshot が作成される
- S3 bucket は `force_destroy = false` なので **中身を手動削除** してから destroy
  (doc-updater 指摘、具体コマンド):
  ```bash
  for bucket in sns-stg-media sns-stg-static sns-stg-backup; do
    # バージョニング有効なので全バージョン削除
    aws s3api list-object-versions --bucket "$bucket" \
      --query '{Objects: [Versions[], DeleteMarkers[]][].{Key:Key,VersionId:VersionId}}' \
      --output json > /tmp/versions-$bucket.json
    aws s3api delete-objects --bucket "$bucket" --delete "file:///tmp/versions-$bucket.json"
  done
  ```
- state bucket は teardown 後に削除する場合 [tf-state-bootstrap.md](./tf-state-bootstrap.md) の削除手順

---

## 8. コスト監視

```bash
# Cost Explorer で Project=engineer-sns, Environment=stg でフィルタ
aws ce get-cost-and-usage \
  --time-period Start=2026-04-01,End=2026-05-01 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter '{"Tags":{"Key":"Environment","Values":["stg"]}}'
```

### コスト推移の目安

(doc-updater 指摘を反映):

| 時期                                                 | 想定月額           | 内訳のドライバ                                  |
| ---------------------------------------------------- | ------------------ | ----------------------------------------------- |
| Phase 0.5 直後 (最小構成、トラフィックほぼゼロ)      | ¥10-15k ($70-100)  | RDS + Redis + ALB + fck-nat の idle コスト      |
| Phase 1-5 終了時 (開発トラフィック + テストユーザー) | ¥18-23k ($120-155) | + Fargate 実稼働時間、CloudFront 少量データ転送 |
| MVP 完成後 (初期 2000 ユーザー想定)                  | ¥22-28k ($150-185) | + Celery ジョブ / Bot / AI API / 画像配信       |

**目標**: 月 ¥20-30k を超えないこと。
**超過の主犯候補**: データ転送 (CloudFront Out) / NAT 料金 / Fargate vCPU。
超過時は Cost Explorer の日次 drill-down → 原因特定 → Sentry カスタムメトリクスで
サービス別使用量可視化、の順で切り分ける。

---

## 9. 関連ドキュメント

- [tf-state-bootstrap.md](./tf-state-bootstrap.md) — state backend の初期化 / 削除
- [dns-delegation.md](./dns-delegation.md) — お名前.com → Route 53
- [terraform/environments/stg/README.md](../../terraform/environments/stg/README.md) — 環境 apply の細部
- [docs/adr/](../adr/) — アーキテクチャ判断の背景
- [ROADMAP.md](../ROADMAP.md) — フェーズ計画
