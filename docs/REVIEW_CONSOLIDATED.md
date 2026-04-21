# サブエージェント・レビュー統合結果

> Version: 0.1
> 最終更新: 2026-04-21
> レビュー実施者: `architect` / `planner` / `a11y-architect` サブエージェント（並列実行）
> 目的: v0.1 仕様書群（SPEC / ER / ARCHITECTURE / ROADMAP / A11Y）に対するクロスレビュー結果を統合し、v0.2 への改訂アクションを明確化

---

## 1. 全体総括

| 観点 | 評価 | 備考 |
|---|---|---|
| 機能仕様の網羅性 | ◎ | 未定義部分は少ない（限定公開トークンなど数点） |
| アーキテクチャの現実性 | ○ | Webhook 経路・NAT 冗長化など要修正箇所あり |
| フェーズ分割の妥当性 | △ | **Phase 9 最後の stg デプロイ** と **Phase 10 最後の Claude Design 取り込み** はアンチパターン |
| 工数見積の現実性 | △ | 98 日 → **115〜135 日（4〜4.5 ヶ月）** が妥当、3 ヶ月はスコープ縮退前提 |
| 予算適合性 | ○ | $118 → 実際は $145 程度、¥22-25k で収まる |
| アクセシビリティ | ◎ | A11Y.md を新規作成、WCAG 2.2 AA 準拠可能 |

---

## 2. クリティカル修正（必ず反映）

### 🔴 C-1: Stripe/GitHub Webhook を CloudFront 経由にしない

**問題**: CloudFront が Host ヘッダや body を変換する可能性があり、HMAC 署名検証が間欠的に失敗する。再現困難なため検知も遅れる。

**対応**:
- Webhook 専用サブドメイン `webhook.stg.example.com` を用意
- CloudFront を経由せず **ALB 直** で受信
- Route53 でこのホストのみ ALB のエイリアスに
- セキュリティグループで Stripe / GitHub の公式 IP レンジからのみ許可

**変更ファイル**: `ARCHITECTURE.md` §1, §5, §6.1, §6.2

### 🔴 C-2: 記事「限定公開」に `unlisted_token` が必須

**問題**: slug だけだと SEO クローラやリンク共有でリークする。下書き情報漏洩の経路になり得る。

**対応**（限定公開機能を維持する場合）:
```python
class Article(TimeStampedModel):
    # 既存フィールド...
    unlisted_token = models.CharField(max_length=43, blank=True)  # secrets.token_urlsafe(32)

    def get_absolute_url(self):
        if self.status == "unlisted":
            return f"/articles/{self.slug}?t={self.unlisted_token}"
        return f"/articles/{self.slug}"
```
- URL に `?t=<token>` パラメータが一致しない限り 404
- トークンはユーザーが再生成可能
- `noindex` メタタグ + `robots.txt` で検索クローラ除外

**変更ファイル**: `SPEC.md` §12.1, `ER.md` §2.16

### 🔴 C-3: Phase 9（最後の stg デプロイ）はアンチパターン

**問題**: WebSocket / Stripe Webhook / S3 直アップロード / GitHub Webhook / Meilisearch はローカル Docker と AWS ECS で挙動乖離が起きやすい。Phase 9 に詰めると 90% 完成で IAM・ALB・ASGI ルーティングが動かず大きな手戻りリスク。

**対応**:
- **Phase 0.5 を新設**: 最小 stg デプロイ（Django Hello + Next Hello + Postgres + Redis + ALB + Route53、3〜5 日）
- Phase 1 以降は各 Phase 完了時に stg へ自動デプロイ
- Phase 9 は「本番昇格・負荷試験・Lighthouse CI」に変更（stg は既稼働）

**変更ファイル**: `ROADMAP.md` 全体

### 🔴 C-4: Claude Design の Phase 10 取り込みは遅すぎる

**問題**: Phase 1〜9 でハンドコードした UI を Phase 10 で全面置換 → ほぼ二度書き。

**対応**:
- **Phase 0 で先行取り込み**: デザイントークン（色・タイポ・余白の CSS 変数）+ コアコンポーネント（Button/Input/Card/Avatar/Tag/Dialog）のみ
- 各機能 Phase は既存トークン・コンポーネントに乗せて開発
- ビジュアルリグレッション・ページレベル仕上げは Phase 10 に残す

**変更ファイル**: `ROADMAP.md` Phase 0/1/10

---

## 3. 高優先修正

### 🟡 H-1: CloudFront 3 本 → 1 本に集約

Host/Path ベースルーティングで 1 ディストリビューションに統合:
- `stg.example.com/api/*` → ALB (Django)
- `stg.example.com/ws/*` → ALB (Daphne、WebSocket behavior)
- `stg.example.com/media/*` → S3 (OAC)
- `stg.example.com/*` → ALB (Next.js SSR)

**ただし**: `webhook.stg.example.com` のみ **CloudFront を経由せず ALB 直**（C-1）

**変更ファイル**: `ARCHITECTURE.md` §1, §4.5

### 🟡 H-2: NAT Instance の単一障害点対策

- **推奨**: VPC Interface Endpoint を優先追加（ECR API/ECR DKR/Secrets Manager/CloudWatch Logs）— $21/月だが NAT 経由を大幅削減
- 残る外部 API（Mailgun/Stripe/OpenAI/Claude/GitHub）向けは **fck-nat** の AutoScaling Group 化で自己復旧（コスト同等の t4g.nano）

**変更ファイル**: `ARCHITECTURE.md` §2.3

### 🟡 H-3: ALB スティッキーセッション + 長時間 idle timeout

Daphne ターゲットグループ:
- `stickiness.enabled=true`, `stickiness.type=lb_cookie`, duration=24h
- `deregistration_delay.timeout_seconds=300`
- ALB `idle_timeout=3600s`（デフォルト 60s だと WebSocket が 1 分で切断）

**変更ファイル**: `ARCHITECTURE.md` §3.4

### 🟡 H-4: Phase 4 を 4A/4B に分割

- **Phase 4A**（5〜7 日）: 通知 + お気に入りボックス
- **Phase 4B**（5〜7 日）: モデレーション（Block / Mute / Report）
  - Block/Mute を TL・検索・DM の全クエリに反映させる横断タスクを含む

**変更ファイル**: `ROADMAP.md` Phase 4

### 🟡 H-5: Meilisearch の採否を Phase 2 冒頭で PoC 判断

**選択肢**:
- (a) **PostgreSQL `pg_bigm` + Lindera**: 追加コスト $0、運用対象が 1 つ減る
- (b) **Meilisearch（EC2 t4g.small + EBS）**: EFS よりコスト・性能優位、日本語精度は最高水準

Phase 2 冒頭で **1〜2 日の検証スパイク** を設けて、日本語検索精度を実データで比較してから採用判断。

**MVP では (a) を仮採用**、精度が要件に届かなければ (b) へ切替。

**変更ファイル**: `ARCHITECTURE.md` §4.3, `ROADMAP.md` Phase 2

### 🟡 H-6: Phase 3 DM は S3 プリサインド URL 必須

Django 経由アップロードだと Channels イベントループを塞ぐ → **フロントが直接 S3 にアップロード**し、完了後に URL だけサーバーへ送信する方式。

**変更ファイル**: `ROADMAP.md` Phase 3

### 🟡 H-7: タグ新規作成の編集距離チェック

`react` / `reactjs` / `react-js` 等の乱立防止:
- 既存タグと Levenshtein 距離 ≤ 2 → 「もしかして `react` ですか？」サジェスト表示
- 管理者フラグ `is_official` が True のタグとは特に区別

**変更ファイル**: `SPEC.md` §4.2

### 🟡 H-8: スパム閾値を階層化

現行「1 日 1000 ツイート超で通知」は緩すぎる。

**新案**:
- 100/日 超: ユーザーに注意 UI 表示
- 500/日 超: DRF Throttle で自動レート制限
- 1000/日 超: 管理者にメール通知 + 一時凍結判断用ダッシュボード

**変更ファイル**: `SPEC.md` §14.5

### 🟡 H-9: Next.js SSR の記述矛盾修正

`ARCHITECTURE.md` §1 の「S3 (Next.js static build) + SSR 動作 via Fargate」という表記は矛盾（SSR は S3 で動かない）。正しくは「CloudFront → ALB → Fargate(next start)」、`_next/static` のみ S3/CloudFront キャッシュ。

**変更ファイル**: `ARCHITECTURE.md` §1 図

---

## 4. 中優先修正

### 🟢 M-1: Celery Spot 運用の冪等性

`acks_late=True`, `task_reject_on_worker_lost=True`, idempotency key、DLQ（Redis/SQS）。Beat は絶対 Spot 不可（二重発火防止）。

**変更ファイル**: `ARCHITECTURE.md` §3.2

### 🟢 M-2: RDS を t4g.small にスケールアップ検討

TL 集計を Celery で 5 分ごとに全ユーザー分生成する設計は t4g.micro（1GB RAM）では burst credit 枯渇しやすい。

**選択肢**:
- (a) t4g.small（+$15/月、合計 ¥25-27k）
- (b) TL 生成を **fan-out-on-read**（ユーザーアクセス時にオンデマンド）に変更してキャッシュだけ Redis に置く → `db.t4g.micro` のまま

**推奨**: (b) を採用し、キャッシュヒット率が想定を下回ったら (a) へ。

**変更ファイル**: `ARCHITECTURE.md` §4.1, `SPEC.md` §5.1

### 🟢 M-3: Terraform モジュール粒度を 10 → 5 に集約

- `network`（vpc + subnets + sg + nat + endpoints）
- `data`（rds + redis）
- `compute`（ecs + alb + ecr）
- `edge`（cloudfront + route53 + acm）
- `observability`（cloudwatch + sentry）

**変更ファイル**: `ARCHITECTURE.md` §8.5

### 🟢 M-4: Phase 0 に観測性セットアップ追加

- Sentry DSN 配線（Django / Next.js 両方）
- 構造化ログ（`structlog`）
- ADR（Architecture Decision Records）ディレクトリ `docs/adr/` 作成
- `@sentry/nextjs` 初期化

**変更ファイル**: `ROADMAP.md` Phase 0

### 🟢 M-5: Phase 6 GitHub 連携は**片方向のみ**に縮退

双方向同期（Webhook 受信 + コンフリクト解決 + Front Matter パース + 画像パス解決）は別プロダクト規模。

**MVP スコープ**:
- アプリ内編集 → GitHub push **のみ**
- GitHub 側編集の pull は **Phase 11 以降**

**SPEC 側の「コンフリクト時アプリ内優先」ルールも縮退**（pull しない = コンフリクト発生しない）。

**変更ファイル**: `SPEC.md` §12.3, `ROADMAP.md` Phase 6

---

## 5. A11Y（a11y-architect の特記事項）

`/workspace/docs/A11Y.md` を新規作成済み（451 行、WCAG 2.2 AA 準拠）。要点:

- **画像 alt の必須化**: MVP では強く推奨（警告表示）に留め、AI 自動提案は Phase 10 で検討
- **DM タイピング表示**: 3 秒超継続時のみ `role="status"` で 1 回告知（うるささ抑制）
- **TL 新着**: 自動挿入せず「新着 N 件を表示」ボタン + `aria-live="polite"`
- **リアクションメニュー**: ロングプレス代替に Alt+Enter + `role="menuitemradio"`、モバイルは「…」補助ボタン
- CI/CD 組み込み: `@axe-core/playwright` + Lighthouse CI + PR チェックリスト
- Phase 1〜10 の優先度マトリクス

---

## 6. スコープ判断が必要な項目（ハルナさんへの質問）

レビュー結果を踏まえて、以下 4 点の判断をお願いします。いずれも MVP リリース時期と直接関係します。

### Q1. GitHub 双方向同期 → 片方向（push のみ）に縮退してよいですか？

**縮退する**（推奨）:
- Phase 6 工数: 15〜20 日 → 10〜12 日
- アプリ内で編集して GitHub に push する方向のみ
- GitHub 側で直接編集 → アプリに反映する pull は Phase 11 以降

**縮退しない**: 双方向維持、ただし Phase 6 の工数が倍増

### Q2. 記事の「限定公開」機能は MVP に含めますか？

（ハルナさんは「あれば参考に、なければ実装しなくてよい」とのことでした）

- **含める**: `unlisted_token` カラム追加 + UI 1 画面分の追加実装（+2〜3 日）
- **含めない**: 下書き / 公開のみに簡素化、Phase 11 以降で追加

### Q3. Claude Design 取り込みを Phase 0 に前倒しでよいですか？

**前倒しする**（推奨）:
- Phase 0 でデザイントークン + コアコンポーネント 6 種を取り込み
- 各機能 Phase は既存コンポーネントに乗せて開発
- ハルナさんが Claude Design を先に触り、handoff bundle を出す必要あり（Phase 0 着手前のタスク）

**前倒ししない**: Phase 10 まで既存 shadcn + 自前 Tailwind で構築、最後に置換

### Q4. MVP リリース時期をどう設定しますか？

**現実的工数 115〜135 日（4〜4.5 ヶ月）** を前提に:

- (a) **4.5 ヶ月フルスコープ**: 全機能 MVP、グループ DM・トレンドタグ・おすすめユーザーすべて実装
- (b) **3 ヶ月スコープ縮退版**: 以下のうち 2〜3 を Phase 11 へ
   - グループ DM（1:1 のみに縮退）
   - トレンドタグ（初期は手動管理で済ませる）
   - おすすめユーザー（初期は「フォロワー多い順」のみに簡素化）
   - 編集履歴表示（編集回数カウントのみ）

---

## 7. v0.2 改訂アクションリスト

ハルナさんの Q1〜Q4 回答後、以下を順次実施:

### 確定事項の反映（回答不要で即実施可）
- [ ] `SPEC.md` §14.5 スパム閾値を階層化
- [ ] `SPEC.md` §4.2 タグ編集距離チェック追記
- [ ] `ER.md` §2.16 `unlisted_token` 追加（Q2 で「含める」なら）
- [ ] `ARCHITECTURE.md` §1, §5, §6 Webhook 別ホスト + CloudFront 1 本集約
- [ ] `ARCHITECTURE.md` §2.3 VPC Endpoint + fck-nat ASG
- [ ] `ARCHITECTURE.md` §3.4 ALB sticky + idle timeout
- [ ] `ARCHITECTURE.md` §4.3 Meilisearch → pg_bigm 仮採用 + Phase 2 PoC
- [ ] `ARCHITECTURE.md` §8.5 Terraform モジュール 5 本に集約
- [ ] `ARCHITECTURE.md` §1 Next.js SSR の矛盾記述修正
- [ ] `ROADMAP.md` Phase 0.5 新設（最小 stg デプロイ）
- [ ] `ROADMAP.md` Phase 4 を 4A/4B に分割
- [ ] `ROADMAP.md` Phase 0 に観測性セットアップ追加
- [ ] `ROADMAP.md` Phase 3 に S3 プリサインド明記
- [ ] `ROADMAP.md` 工数を 115〜135 日に修正
- [ ] `ROADMAP.md` リスク表を拡充（planner 指摘の 5 項目追加）

### スコープ判断待ち
- [ ] `ROADMAP.md` Phase 6 GitHub 片方向化（Q1 次第）
- [ ] `SPEC.md` §12 限定公開の扱い（Q2 次第）
- [ ] `ROADMAP.md` Phase 0/10 Claude Design 取り込みタイミング（Q3 次第）
- [ ] `ROADMAP.md` 全 Phase スコープ縮退（Q4 次第）

### 次段階
- [ ] v0.2 版を再度 planner でレビュー（スコープ確定後）
- [ ] Phase 0 着手時に `architect` + `security-reviewer` で Terraform 骨子レビュー

---

## 8. ドキュメント更新ログ

| Version | 日付 | 変更点 |
|---|---|---|
| v0.1 | 2026-04-21 | 初版作成（SPEC / ER / ARCHITECTURE / ROADMAP / A11Y） |
| v0.2 | TBD | サブエージェントレビュー結果を反映 |
