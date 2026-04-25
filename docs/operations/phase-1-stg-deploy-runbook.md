# Phase 1 stg デプロイ + 動作確認 Runbook (#125)

> Issue: [#125][issue] — Phase 1 完了ゲート。ハルナさん手動実行前提。
>
> このドキュメントは Phase 1 の全 PR (#140 〜 #149) を main にマージした
> **あと**に、stg 環境で golden path を流して確認するための手順書です。
> `terraform apply` と手動ブラウザ確認は claude が実行できないため、
> 明示的にハルナさん側のタスクとして切り出しています。

## 前提

- [ ] Phase 0.5 の Runbook ([docs/operations/stg-deployment.md][stg-deploy])
      を一度最後まで通している (NS 委任 / ACM 検証 / secret 投入済み)
- [ ] Phase 1 の feature branch (stack) が順にマージ済み
  - #140 (axios wrapper) → #141 (login UI) → #142 (onboarding) →
    #143 (avatar crop) → #144 (composer) → #145 (tweet detail) →
    #146 (profile page) → #147 (tag page) → #148 (tweet edit) →
    #149 (Playwright E2E)

## 1. Terraform で ECS サービスを作成 (未実装部分)

**まだ作成されていない resource**:

- `aws_ecs_service` × 5 (django / next / daphne / celery-worker / celery-beat)
- `aws_ecs_task_definition.migrate` (one-off migration task)

これらは [terraform/modules/compute][compute-mod] に追加します。具体的な
Terraform コード追加はスコープが大きいため、別 Issue として切り出して
段階的に実装してください。ここでは、追加が完了したあとの **流し方** のみ
記述します:

```bash
cd terraform/environments/stg
aws-vault exec sns-stg -- terraform plan -out=phase1.tfplan
aws-vault exec sns-stg -- terraform apply phase1.tfplan
```

Plan で `aws_ecs_service.*` と `aws_ecs_task_definition.migrate` が作成
される予定であることを確認します。

## 2. cd-stg.yml の migrate / deploy ブロックを有効化

[`.github/workflows/cd-stg.yml`][cd-stg] の以下 2 か所が現在 "placeholder"
になっています:

- `jobs.migrate.steps`: `aws ecs run-task` への置換
- `jobs.deploy.steps`: `aws ecs update-service --force-new-deployment` への置換

既にコメント内にテンプレ SQL (`# 有効化する時のテンプレ:`) が記載されて
いるので、それをそのまま有効化し、placeholder の `echo "::warning::"` を削除
してください。

## 3. 初回デプロイ

```bash
git checkout main && git pull
git push origin main   # cd-stg ワークフローをトリガー
```

- GitHub Actions → `CD stg` ワークフローが走る
- 各 job が **緑** になっていることを確認
  - build (backend / frontend / nginx すべて push 完了)
  - migrate (``wait`` モードで完走、exit 0)
  - deploy (5 サービスすべて rolling update)
  - smoke-test (`GET /api/health/` が 200)

失敗した場合は CloudWatch Logs を確認し、前の task definition に戻す:

```bash
aws ecs update-service \
  --cluster sns-stg-cluster \
  --service sns-stg-django \
  --task-definition sns-stg-django:<previous-revision>
```

## 4. 手動 E2E (ブラウザで実施)

`stg.<domain>` 上で以下のシナリオを順に実施し、すべて想定通りであることを
確認します:

| # | シナリオ | 期待 |
|---|---------|------|
| 1 | `/register` でサインアップ | 「確認メールを送信しました」トースト + `/login?email=...` に遷移 |
| 2 | メール (Mailgun/SES) を開き activation リンクを踏む | `/activate/...` → `/login` に遷移 |
| 3 | `/login` で email + password 入力 → ログイン | `/onboarding` に遷移 |
| 4 | `/onboarding` で表示名 + 自己紹介を入力 → 「はじめる」 | `/` に遷移 |
| 5 | `/` の Composer でツイート「こんにちは 🎉」を投稿 | トースト「投稿しました」 |
| 6 | `/u/<handle>` に遷移 | いま投稿したツイートが表示される |
| 7 | `/tweet/<id>` に遷移 | 本文 + avatar + created_at が表示、OGP タグが `<head>` に出ている |
| 8 | `/tag/<name>` (存在するタグ) に遷移 | タグに紐づくツイートが見える |
| 9 | Google OAuth でログイン | `/` に遷移、再ログインできる |
| 10 | アバター画像アップロード (P1-15) | 5MB 超は reject、300×300 JPEG は WebP で S3 PUT → profile 反映 |

各ステップを完了したらチェックボックスを Issue にコピペして埋めてください。

## 5. 観測性の確認

`deploy` 完了後、**1 時間** 観測し以下を確認:

- [ ] Sentry (stg プロジェクト): `ERROR` レベルのイベント **0 件**
- [ ] CloudWatch Logs Insights で以下のクエリ → **結果 0 件**:

  ```
  fields @timestamp, @message
  | filter level = "ERROR"
  | limit 100
  ```

- [ ] ALB target group `sns-stg-django-tg` / `sns-stg-next-tg` の Healthy count が
      **常に > 0** (1h の CloudWatch Metrics グラフ)

## 6. コスト確認

- [ ] AWS Cost Explorer で stg タグ (`Environment=stg`) 付きリソースの
      4 日平均 × 30 で月額推定
- [ ] 目標: **¥20,000 〜 ¥30,000 / 月**
- [ ] 超過している場合は ECS tasks の `cpu` / `memory` を確認、Fargate
      Spot に移せるものがないか検討

## 7. ロールバック計画

障害発生時:

1. `aws ecs update-service --task-definition <prev-rev>` で 5 サービスを
   前 revision に戻す
2. DB migration を適用済みの場合は **ロールバック用の Django migration を
   書いて apply**。`migrate <app> <previous_migration_name>` はテンプレで
   失敗しがちなので、事前に `--plan` で確認する
3. Sentry で発火したイベントを収集し、post-mortem を書く

## 受け入れ基準 (Issue #125)

- [ ] 手動 E2E シナリオ #1 〜 #10 すべて OK
- [ ] Sentry / CloudWatch エラーログ 0 件
- [ ] ALB Healthy count 常時 > 0
- [ ] 月額見積 ¥20-30k レンジ

[issue]: https://github.com/haruna0712/claude-code/issues/125
[stg-deploy]: ./stg-deployment.md
[compute-mod]: ../../terraform/modules/compute
[cd-stg]: ../../.github/workflows/cd-stg.yml
