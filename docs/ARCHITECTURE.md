# システムアーキテクチャ（stg 環境）

> Version: 0.2 (Draft)
> 最終更新: 2026-04-21
> 対象環境: **stg のみ**（prod は後続、dev はローカル Docker Compose）
> 関連: [SPEC.md](./SPEC.md), [ER.md](./ER.md), [ROADMAP.md](./ROADMAP.md)
>
> v0.1 → v0.2 主要変更（architect レビュー反映）:
> - CloudFront を 3 本 → 1 本に集約、Webhook 用のみ ALB 直の別ホスト (C-1, H-1)
> - NAT Instance → fck-nat ASG + VPC Interface Endpoints (H-2)
> - ALB スティッキーセッション + `idle_timeout=3600s` (H-3)
> - Meilisearch → PostgreSQL `pg_bigm` + Lindera 仮採用、Phase 2 で PoC 判断 (H-5)
> - Next.js SSR の記述矛盾修正 (H-9)
> - Terraform モジュール 10 → 5 に集約 (M-3)
> - Celery Spot 運用の冪等性メモ追加 (M-1)
> - RDS 容量問題への対応策明記 (M-2)

---

## 1. 全体構成図

```
                          ┌─────────────────┐
                          │   お名前.com    │
                          │   (ドメイン)    │
                          └────────┬────────┘
                                   │ NS 委任
                                   ▼
                          ┌─────────────────┐
                          │   Route 53      │
                          │ (Hosted Zone)   │
                          └────────┬────────┘
                                   │
             ┌─────────────────────┴──────────────────────┐
             │                                            │
             ▼                                            ▼
   stg.example.com                              webhook.stg.example.com
   (+ api.stg.example.com alias)                (Webhook 専用、CloudFront 非経由)
             │                                            │
             ▼                                            ▼
   ┌─────────────────────┐                        ┌──────────────────┐
   │   CloudFront        │                        │   ALB (直接)     │
   │ (単一ディスト)       │                        │  + IP 制限       │
   │  Behaviors:         │                        │  (Stripe/GitHub  │
   │  /api/*  → ALB       │                        │   公式 IP のみ)  │
   │  /ws/*   → ALB (WS)  │                        └────────┬─────────┘
   │  /media/* → S3 (OAC) │                                 │
   │  /*      → ALB       │                                 │
   └──────────┬──────────┘                                 │
              │                                            │
              ▼                                            │
   ┌─────────────────────┐                                 │
   │  Application Load   │◄────────────────────────────────┘
   │  Balancer           │
   │  + sticky session   │
   │  + idle_timeout=1h  │
   └──────────┬──────────┘
              │
              ▼
    ┌────────────────────────────────────┐
    │  ECS Fargate (private subnet)       │
    │  ┌───────┐ ┌─────────┐ ┌──────────┐│
    │  │ nginx │→│ django  │ │ next-ssr ││
    │  │       │ │ gunicorn│ │          ││
    │  └───────┘ └─────────┘ └──────────┘│
    │  ┌────────┐ ┌──────────────────┐  │
    │  │ daphne │ │ celery worker    │  │
    │  │ (WS)   │ │ + beat (singleton│  │
    │  │        │ │   non-Spot)      │  │
    │  └────────┘ └──────────────────┘  │
    │                                    │
    │  [search backend - TBD]            │
    │  (a) pg_bigm on RDS (MVP 仮採用)    │
    │  (b) Meilisearch on EC2 (Phase 2+) │
    └─────┬───────────────────┬───────┬──┘
          │                   │       │
          ▼                   ▼       │
    ┌──────────┐    ┌──────────────┐ │
    │   RDS    │    │ ElastiCache  │ │
    │ Postgres │    │   Redis      │ │
    │ (+pg_bigm)│   │              │ │
    └──────────┘    └──────────────┘ │
                                     │
              VPC Interface Endpoints▼
              (ECR API/DKR, Secrets, Logs, STS)
              fck-nat ASG で外部API向け出力経路を冗長化

    外部:
    ├─ Mailgun (ログイン系メール + 運営お知らせ)
    ├─ Stripe (決済) ← Webhook は webhook.stg.example.com へ
    ├─ OpenAI API  (RSS 要約・翻訳、gpt-4o-mini)
    ├─ Claude API  (記事下書き AI, Premium のみ)
    ├─ GitHub API  (記事 push のみ、MVP は pull しない)
    └─ Sentry       (エラートラッキング)
```

---

## 2. VPC / ネットワーク設計

### 2.1 VPC

- CIDR: `10.0.0.0/16`
- AZ: `ap-northeast-1a`, `ap-northeast-1c`（Single-AZ 運用だが、後の Multi-AZ 拡張のため 2 AZ でサブネット確保）

### 2.2 サブネット

| 名称 | CIDR | AZ | 用途 |
|---|---|---|---|
| public-1a | `10.0.1.0/24` | 1a | ALB |
| public-1c | `10.0.2.0/24` | 1c | ALB（Multi-AZ 準備） |
| private-1a | `10.0.11.0/24` | 1a | ECS Fargate タスク |
| private-1c | `10.0.12.0/24` | 1c | ECS Fargate（予備） |
| db-1a | `10.0.21.0/24` | 1a | RDS / ElastiCache |
| db-1c | `10.0.22.0/24` | 1c | RDS / ElastiCache Subnet Group |

### 2.3 NAT / 外向き通信

architect レビュー指摘を受け、単一 NAT Instance による SPOF を排除:

- **VPC Interface Endpoints** を優先導入（AWS サービス向け通信は NAT を経由しない）:
  - `com.amazonaws.ap-northeast-1.ecr.api`（ECR API）
  - `com.amazonaws.ap-northeast-1.ecr.dkr`（ECR Docker）
  - `com.amazonaws.ap-northeast-1.secretsmanager`（Secrets Manager）
  - `com.amazonaws.ap-northeast-1.logs`（CloudWatch Logs）
  - `com.amazonaws.ap-northeast-1.sts`（STS, OIDC 認証で必要）
  - `com.amazonaws.ap-northeast-1.s3`（S3、Gateway 型=無料）
  - コスト: Interface Endpoint 1 本 $7/月 × 5 = $35/月
- **fck-nat ASG**（外部 API 向け出力経路）:
  - インスタンスタイプ: `t4g.nano`（0 hr $3.6/月）
  - Auto Scaling Group で Min=1/Max=1、障害時に自己復旧
  - Mailgun / Stripe / OpenAI / Claude / GitHub への HTTPS 向け出力経路
- **将来 prod**: NAT Gateway（Multi-AZ）に切替、Interface Endpoint は継続利用

### 2.4 セキュリティグループ

| SG | Inbound | Outbound |
|---|---|---|
| alb-sg | 80/443 from 0.0.0.0/0 | ecs-sg:8080 |
| ecs-sg | 8080 from alb-sg | 全許可（NAT 経由 HTTPS） |
| rds-sg | 5432 from ecs-sg | なし |
| redis-sg | 6379 from ecs-sg | なし |
| meilisearch-sg | 7700 from ecs-sg | なし |

---

## 3. ECS / Fargate 設計

### 3.1 クラスタ

- クラスタ名: `sns-stg`
- Capacity Provider: `FARGATE` + `FARGATE_SPOT`（非クリティカルなワーカーのみ Spot）

### 3.2 タスク定義

| サービス | タスク数 | CPU/Memory | Spot 可否 | ポート |
|---|---|---|---|---|
| `nginx-django` | 1 | 0.25 / 0.5 GB | No | 80 (ALB target) |
| `next-ssr` | 1 | 0.5 / 1 GB | No | 3000 |
| `celery-worker` | 1 | 0.25 / 0.5 GB | Yes | - |
| `celery-beat` | 1 | 0.25 / 0.5 GB | No | - |
| `daphne-channels` | 1 | 0.25 / 0.5 GB | No | 8001 (ALB WS target) |
| `meilisearch` | 1 | 0.5 / 1 GB | No | 7700 |

合計 vCPU: 2.0, Memory: 4.0 GB。

### 3.3 コンテナ構成

**ECS Task: `app`**（Django + Nginx サイドカー）
```
┌─────────────────────────┐
│   task: sns-stg-app     │
│  ┌────────┐ ┌─────────┐ │
│  │ nginx  │→│ django  │ │
│  │ :80    │ │ gunicorn│ │
│  │        │ │ :8000   │ │
│  └────────┘ └─────────┘ │
└─────────────────────────┘
     ↑ ALB :443→:80 (HTTP)
```

**ECS Task: `next`**（Next.js SSR）
```
┌─────────────────────────┐
│   task: sns-stg-next    │
│  ┌─────────────────┐    │
│  │  next start     │    │
│  │  :3000          │    │
│  └─────────────────┘    │
└─────────────────────────┘
     ↑ ALB :443→:3000
```

**ECS Task: `channels`**（WebSocket）
```
┌─────────────────────────┐
│ task: sns-stg-channels  │
│  ┌─────────────────┐    │
│  │ daphne          │    │
│  │ :8001           │    │
│  └─────────────────┘    │
└─────────────────────────┘
     ↑ ALB :443/ws/→:8001 (WebSocket)
```

### 3.4 ALB ターゲット・パスベースルーティング

| ホスト・パス | ターゲット | 備考 |
|---|---|---|
| `stg.example.com/api/*` | `app` (Django) | CloudFront → ALB |
| `stg.example.com/ws/*` | `channels` (Daphne) | **sticky session 必須** |
| `stg.example.com/_next/static/*` | S3 | CloudFront キャッシュ (long TTL) |
| `stg.example.com/media/*` | S3 (OAC) | 画像・動画配信 |
| `stg.example.com/*` | `next` (Next.js SSR) | それ以外すべて |
| `webhook.stg.example.com/stripe` | `app` (Django) | **CloudFront 非経由** |
| `webhook.stg.example.com/github` | `app` (Django) | **CloudFront 非経由** |

**ALB 詳細設定**（WebSocket 対応）:

```hcl
# Daphne ターゲットグループ
resource "aws_lb_target_group" "daphne" {
  name        = "sns-stg-daphne"
  port        = 8001
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  stickiness {
    enabled         = true
    type            = "lb_cookie"
    cookie_duration = 86400  # 24h
  }

  deregistration_delay = 300

  health_check {
    path                = "/ws/health"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# ALB 本体
resource "aws_lb" "main" {
  name               = "sns-stg-alb"
  load_balancer_type = "application"
  subnets            = var.public_subnets
  security_groups    = [aws_security_group.alb.id]
  idle_timeout       = 3600  # WebSocket を 1 時間維持
}
```

### 3.5 Auto Scaling（stg）

- 各サービス原則 **1 タスク固定**（最低冗長性）
- CPU 80% 超 で 2 タスクへスケール（最大 2）
- prod では Min 2 / Max 10 に変更予定

---

## 4. データストア

### 4.1 RDS PostgreSQL

- エンジン: PostgreSQL 15
- インスタンス: `db.t4g.micro`（2 vCPU / 1 GB RAM, バースト性能）
  - **注意**: TL 集計バッチ（5 分毎に全ユーザー分）が重くなると burst credit が枯渇する懸念（M-2）
  - **対応策**: TL 生成は **fan-out-on-read**（ユーザーアクセス時にオンデマンド計算 + Redis キャッシュ）で設計、`db.t4g.micro` を維持
  - キャッシュヒット率が目標（85% 以上）を下回れば `db.t4g.small`（+$15/月）にスケールアップ
- ストレージ: 20 GB gp3, 暗号化（KMS デフォルト）
- Single-AZ（stg）
- バックアップ: 日次自動、7 日保持
- メンテナンスウィンドウ: 日本時間 水曜 03:00-04:00
- **拡張機能**:
  - `pg_bigm`（日本語全文検索用、MVP 仮採用）
  - `pg_trgm`（タグ編集距離チェック用）

### 4.2 ElastiCache Redis

- エンジン: Redis 7
- ノード: `cache.t4g.micro`（0.5 GB）
- クラスタモード: 無効（Single-node, stg）
- 用途: Django Channels レイヤ / Celery ブローカー / アプリキャッシュ
- prod では Multi-AZ replica 1 に変更

### 4.3 全文検索バックエンド（Phase 2 冒頭で PoC 判断）

architect レビューにより、Meilisearch + EFS の組み合わせは再検討:

**MVP 仮採用: PostgreSQL `pg_bigm` + Lindera**
- 追加コスト $0（既存 RDS に拡張機能を有効化）
- 運用対象が 1 つ減る
- Django ORM から直接クエリ可能（`django-bigm` 等）
- Phase 2 冒頭で **日本語検索精度の 1〜2 日スパイク**を実施
- コードスニペット検索の精度要件を満たすかを実データで確認

**フォールバック採用: Meilisearch on EC2**
- pg_bigm の精度が要件を満たさない場合のみ
- EC2 `t4g.small` + gp3 EBS 20GB（月 $20 程度）
- EFS ではなく EBS を採用（IOPS・コスト面で有利）
- インデックスデータは EBS スナップショットで日次バックアップ

判断は ADR `docs/adr/0002-fulltext-search-backend.md` に記録する。

### 4.4 S3

| バケット | 用途 | 公開設定 |
|---|---|---|
| `sns-stg-media` | ユーザー画像（アバター/ヘッダー/ツイート画像/記事画像/DM添付） | 非公開、CloudFront OAC 経由でのみ配信 |
| `sns-stg-static` | Next.js 静的アセット | CloudFront OAC |
| `sns-stg-backup` | DB/Meilisearch バックアップ | 非公開、管理者のみ |
| `sns-stg-tf-state` | Terraform state | 非公開、バージョニング有効 |

### 4.5 CloudFront

- ディストリビューション 3 本
  1. `stg.example.com` → Next.js SSR（オリジン: ALB）
     - キャッシュ: 静的パス（`/_next/static/*`）のみ long-ttl、それ以外は no-cache
  2. `api.stg.example.com` → Django API（オリジン: ALB）
     - キャッシュ: 無効（API は常に動的）
     - WebSocket は別オリジン behavior で pass-through
  3. `media.stg.example.com` → S3 メディアバケット（オリジン: S3 + OAC）
     - キャッシュ: 長期（画像ファイル）

---

## 5. DNS（Route 53）

- お名前.com でドメイン取得 → Route 53 にホストゾーン作成
- お名前.com 側で NS レコードを Route 53 の 4 本に委任
- stg のレコード:
  - `stg.example.com` A → CloudFront
  - `api.stg.example.com` A → CloudFront
  - `media.stg.example.com` A → CloudFront
  - `_acme-challenge.stg.example.com` CNAME → AWS Certificate Manager DNS 検証用

ACM 証明書は us-east-1 と ap-northeast-1 両リージョンで取得（CloudFront は us-east-1、ALB は ap-northeast-1）。

---

## 6. 外部サービス連携

| サービス | 用途 | 認証情報格納先 |
|---|---|---|
| Mailgun | アクティベーション / パスワードリセット / 運営お知らせ | Secrets Manager |
| Stripe | プレミアム決済 | Secrets Manager |
| OpenAI API | RSS 要約・翻訳（gpt-4o-mini） | Secrets Manager |
| Anthropic Claude API | 記事下書き AI（`claude-sonnet-4-6` 想定） | Secrets Manager |
| GitHub API | 記事の GitHub 連携 | ユーザーごとの OAuth Token（DB 暗号化保存） |
| Sentry | エラートラッキング | 環境変数 (DSN) |

### 6.1 Stripe Webhook

- ALB エンドポイント `POST /api/stripe/webhook/` で受信
- 署名検証必須（`STRIPE_WEBHOOK_SECRET`）
- 処理対象イベント: `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`

### 6.2 GitHub Webhook（記事連携）

- ALB エンドポイント `POST /api/articles/github/webhook/`
- 署名検証（HMAC-SHA256）
- `push` イベント時、変更のあった `articles/*.md` を pull して Article に反映

---

## 7. シークレット管理

- **AWS Secrets Manager** に集約
- 命名規則: `sns/stg/<service>/<key>`
- 例:
  - `sns/stg/django/secret-key`
  - `sns/stg/django/db-password`
  - `sns/stg/mailgun/api-key`
  - `sns/stg/stripe/secret-key`
  - `sns/stg/stripe/webhook-secret`
  - `sns/stg/openai/api-key`
  - `sns/stg/anthropic/api-key`
- ECS タスク定義で `secrets` 属性として参照（環境変数に展開）
- IAM ロール: タスクロールに `secretsmanager:GetSecretValue` 許可（該当リソースのみ）

---

## 8. CI/CD（GitHub Actions）

### 8.1 ブランチ戦略

- `main`: 本番相当、stg へ自動デプロイ
- `develop`: 開発統合、開発者ローカル用
- `feature/*`: 機能開発
- `hotfix/*`: 緊急修正

### 8.2 ワークフロー

```
feature/*  ── PR open ──→ [CI: lint + test + subagent review]
                                   │ pass
                                   ▼
                           main merge
                                   │
                                   ▼
                           [CD: build image → ECR → ECS update]
                                   │
                                   ▼
                               stg 反映
```

### 8.3 PR CI

以下を並列実行（サブエージェントは GitHub Actions から Claude Code CLI を起動）:

1. **Lint**
   - Python: ruff, mypy
   - TypeScript: eslint, tsc, prettier
   - CSS: stylelint
   - Terraform: tflint, tfsec
2. **テスト**
   - Django: pytest + coverage 80%+
   - Next.js: vitest + Playwright E2E
3. **サブエージェントレビュー（並列）**
   - `python-reviewer`: Python コード品質
   - `typescript-reviewer`: TS 品質
   - `security-reviewer`: セキュリティ（OWASP）
   - `database-reviewer`: マイグレーション・クエリ
   - `code-reviewer`: 汎用品質レビュー
4. **ビルド確認**
   - Docker イメージがビルド可能か
   - Terraform plan が通るか

CRITICAL 指摘があれば PR merge ブロック、HIGH 以下は警告のみ。

### 8.4 CD（main マージ後）

1. Docker イメージをビルド（バックエンド / フロントエンド / nginx）
2. ECR にプッシュ（タグ: `stg-<git-sha>`）
3. ECS タスク定義を更新、サービスを Rolling Update
4. DB マイグレーション: ECS run-task で一度だけ実行
5. Meilisearch インデックス更新: 必要時のみ Celery タスク起動
6. Sentry にリリース通知
7. Slack 通知（成功/失敗）

### 8.5 Terraform

- `terraform/` ディレクトリで管理
- state: S3 (`sns-stg-tf-state`) + DynamoDB lock table
- **モジュール粒度: 5 本に集約**（architect レビュー M-3）:
  ```
  terraform/
    modules/
      network/         # VPC, subnets, SG, fck-nat ASG, VPC Endpoints
      data/            # RDS + ElastiCache Redis
      compute/         # ECS Cluster, ALB, ECR
      edge/            # CloudFront, Route53, ACM
      observability/   # CloudWatch Logs, Alarms, SNS Topic
    environments/
      stg/
        main.tf        # モジュール呼び出し
        variables.tf
        terraform.tfvars
      prod/            # ← Phase 9 で追加
  ```
- GitHub Actions で `terraform plan` を PR で実行、`terraform apply` は main ブランチで手動承認付き
- **Secrets 管理はモジュールに含めず**、Secrets Manager のリソースは各環境の `main.tf` で直接定義（モジュール間 output 引き回しコスト削減）

---

## 9. 監視・ログ

### 9.1 ログ

- ECS: CloudWatch Logs（ロググループ `/ecs/sns-stg/<service>`）
- ALB: S3（アクセスログ）
- RDS: CloudWatch Logs（スロークエリ、エラー）

### 9.2 メトリクス

- CloudWatch 標準メトリクス（CPU / Memory / ネットワーク）
- カスタムメトリクス（アプリから発行）: アクティブユーザー数、ツイート/分、通知/分

### 9.3 アラート（SNS → メール）

- ECS タスク不健全 > 1 分
- RDS CPU > 80% 15 分継続
- RDS FreeStorageSpace < 20%
- ALB 5xx エラー率 > 1%
- Celery キュー滞留 > 100 件

### 9.4 Sentry

- Django: `sentry-sdk[django]`
- Next.js: `@sentry/nextjs`
- DSN は環境変数経由
- Release tracking: git SHA

---

## 10. セキュリティ

### 10.1 ネットワーク

- RDS / ElastiCache / Meilisearch は private subnet のみ配置
- ALB のみ public subnet、SG で 80/443 のみ許可
- NAT を介した outbound のみ（IGW direct なし）

### 10.2 アプリケーション

- HTTPS 強制（HSTS 1 年）
- CSP（nonce ベース、`script-src 'self' 'nonce-xxx'`）
- SameSite=Lax Cookie、HttpOnly
- DRF Throttle: ユーザー 1000req/min, anon 100req/min
- Django Markdown レンダリングは `bleach` + allowlist で XSS 対策
- アップロードファイル: Content-Type 検証 + ClamAV（Phase 後半で導入検討）

### 10.3 IAM

- 最小権限原則
- タスクロール: 必要な Secrets / S3 パスのみ許可
- CI/CD ロール: OIDC 経由（静的 AWS アクセスキー不使用）

### 10.4 バックアップ・DR

- RDS: 自動バックアップ 7 日 + 手動スナップショット週次（14 日保持）
- Meilisearch: 日次ダンプ S3 保存
- S3: バージョニング + Glacier への 90 日後自動移行（コスト配慮）

---

## 11. 予算見積もり（stg のみ）

| 項目 | スペック | 月額 |
|---|---|---|
| ECS Fargate（5 タスク常駐、Meilisearch 除く） | 合計 1.5 vCPU / 3 GB | $45 |
| ALB | 1 台、LCU 少量 | $17 |
| RDS (db.t4g.micro, 20GB) | Single-AZ、pg_bigm + pg_trgm | $15 |
| ElastiCache (cache.t4g.micro) | Single-node | $12 |
| S3 + CloudFront（1 本に集約） | 50GB + 低トラフィック | $3 |
| fck-nat (t4g.nano ASG) | 自己復旧、1 台稼働 | $4 |
| VPC Interface Endpoints | 5 本 × $7 | $35 |
| Secrets Manager | 10 シークレット | $4 |
| Route 53 | 1 zone + クエリ | $1 |
| ALB アクセスログ S3 | - | $2 |
| CloudWatch Logs（取込） | 5 タスク分 | $7 |
| Data Transfer Out | CloudFront→ユーザー | $8 |
| Sentry | Free プラン | $0 |
| **合計** | | **約 $153 / 月（≒¥23,000）** |

**予算 ¥20-30k/月 内で収まる。** Meilisearch を採用した場合は +$20/月、prod 環境追加時は +$200-300/月 想定。

**削減オプション**（さらに絞る場合）:
- VPC Interface Endpoints を ECR / Secrets のみに絞れば -$21/月 → 外部 API 通信は fck-nat 経由に集約
- ALB → CloudFront → Fargate 直 (Cloud Map 経由) で ALB を廃止すれば -$17/月

---

## 12. ローカル開発環境（参考）

`local.yml`（既存）を活用:

- postgres, redis, django(api), next(client), nginx, celeryworker, flower, mailpit
- 追加予定:
  - `meilisearch` (v1.x)
  - `daphne` (Channels) ... 既存 api コンテナ内でプロセス追加 or 別サービスで起動

---

## 13. 将来拡張（prod 移行時の変更点）

- RDS を Multi-AZ 化
- ElastiCache を Multi-AZ + Replica 1
- ECS Fargate を Min 2 / Max 10 タスクに Auto Scaling
- NAT Instance → NAT Gateway
- WAF 導入（CloudFront 前段）
- GuardDuty / Security Hub
- Lambda@Edge で画像リサイズ・OGP 生成
- CloudFront のオリジンを East Asia Edge に最適化
