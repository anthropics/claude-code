# お名前.com → Route 53 への NS 委任手順 (P0.5-10)

> 最終確認: 2026-04 (UI は時期により変わるため、差異があれば Issue を起票)

お名前.com で取得した apex ドメインのネームサーバー (NS) を AWS Route 53 に
切り替える手順。初回の stg デプロイ前に一度だけ実行する。

## 前提

- お名前.com でドメインを取得済み (例: `example.com`)
- [P0.5-07](../../.github/issues/20) の `terraform apply` で Route 53 Hosted Zone が
  作成済み (`module.edge.aws_route53_zone.this`)
- `terraform output -raw route53_name_servers` で 4 本の NS を取得可能

## 所要時間

- 手作業: 10 分
- 伝播待ち: 15 分〜最大 48 時間 (多くの場合 1-2 時間)

---

## 手順

### 1. Route 53 の NS レコードを取得

output は list 型なので `-json` で取るか、`| jq -r` で改行区切りに展開する:

```bash
cd terraform/environments/stg

# JSON array で取得 (目視用)
terraform output -json route53_name_servers

# 改行区切りで取得 (コピペしやすい)
terraform output -json route53_name_servers | jq -r '.[]'
```

出力例:

```json
[
  "ns-123.awsdns-01.com",
  "ns-456.awsdns-02.co.uk",
  "ns-789.awsdns-03.net",
  "ns-012.awsdns-04.org"
]
```

> **⚠ 4 本すべて登録が必須** (doc-updater PR #54 HIGH)。
> 一部のクライアントは 4 本をラウンドロビンで照会するため、3 本以下だと
> 一定確率で NXDOMAIN が返る。ドット (`.`) で終わる FQDN 形式だが、
> お名前.com の入力欄ではドットを付けずに貼る (下記手順 2 参照)。

### 2. お名前.com のコントロールパネルで NS を更新

> **⚠ セキュリティ** (doc-updater PR #54 MEDIUM):
> 本ステップはドメイン登録者アカウントへのログインが必要。作業前に以下を確認:
> - **2FA が有効**であること (お名前.com の「会員情報」→「2段階認証」)
> - 不審なログイン履歴がないこと
> - 作業完了後、必要ならパスワードローテーション
> DNS 権限を奪われるとフィッシング・証明書乗っ取りに直結するため。

1. お名前.com の [ドメイン Navi](https://navi.onamae.com) にログイン
2. 左サイドバー「ドメイン」→「ドメイン一覧」
3. 該当ドメインをクリック
4. 「ネームサーバー設定」タブを選択
5. 「ネームサーバー変更」ボタン
6. 「その他」タブを選び、以下のように入力:

   | フィールド | 値 |
   |---|---|
   | プライマリネームサーバー (1) | `ns-123.awsdns-01.com` |
   | セカンダリネームサーバー (2) | `ns-456.awsdns-02.co.uk` |
   | ネームサーバー (3) | `ns-789.awsdns-03.net` |
   | ネームサーバー (4) | `ns-012.awsdns-04.org` |

   **重要**: 末尾のドット `.` はお名前.com の入力フィールドでは付けない
   (AWS の出力には付いていないのでそのまま貼り付ける)。

7. 「確認画面へ進む」→ 内容確認 → 「設定する」
8. 「完了しました」のメッセージを確認

### 3. 伝播確認

DNS キャッシュが切り替わるまで数分〜数時間かかる。以下のコマンドで確認:

```bash
# 4 本の NS が Route 53 のものになっていることを確認
dig NS example.com @8.8.8.8 +short

# 期待される出力 (4 本とも awsdns-XX になっている)
# ns-123.awsdns-01.com.
# ns-456.awsdns-02.co.uk.
# ns-789.awsdns-03.net.
# ns-012.awsdns-04.org.
```

**まだお名前.com の NS が返る場合**: 伝播待ち。15 分ほど間隔を空けて再確認。

### 4. ACM 証明書の発行完了を確認

NS 切替が反映されたら、ACM の DNS 検証 (Route 53 に `_<hash>.example.com`
CNAME が自動追加済み) が自動で通る。

ACM は **リージョン別に 2 本** 発行している (edge モジュールの設計):
- **ap-northeast-1**: ALB 用 (リスナーが ACM を参照するので同リージョン必須)
- **us-east-1**: CloudFront 用 (CloudFront は us-east-1 の ACM しか受け付けない)

```bash
# ap-northeast-1 (ALB 用)
aws acm list-certificates --region ap-northeast-1 \
  --query 'CertificateSummaryList[?DomainName==`stg.example.com`]'

# us-east-1 (CloudFront 用)
aws acm list-certificates --region us-east-1 \
  --query 'CertificateSummaryList[?DomainName==`stg.example.com`]'
```

両方の `Status` が `ISSUED` になれば完了。通常 5-15 分。

### 5. stg アプリへのアクセス確認

```bash
curl -I https://stg.example.com
# HTTP/2 200 (Hello World が起動していれば)
# または HTTP/2 503 (ECS service がまだ起動していない場合、P0.5-11/12 待ち)
```

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `dig NS` が古い NS を返し続ける | DNS キャッシュ | `1.1.1.1` や `8.8.8.8` で複数回照会。最大 48 時間は伝播待ち |
| ACM が `PENDING_VALIDATION` のまま | Route 53 に検証 CNAME が無い | Route 53 ダッシュボードで `_<hash>` CNAME が存在することを確認、無ければ `terraform apply` を再実行 |
| CloudFront が 403 を返す | ACM が未発行 | 上の ACM 確認手順で ISSUED を待つ |
| CloudFront が 502/504 | ALB 側で ECS task が未起動 | `aws ecs list-tasks --cluster sns-stg-cluster` で確認 |
| ブラウザで「保護されていません」 | 証明書が `stg.example.com` と不一致 | CloudFront の `aliases` と ACM SAN が一致するか `terraform state show module.edge.aws_cloudfront_distribution.this` で確認 |

## ロールバック

NS を元の (お名前.com 標準の) ネームサーバーに戻す場合:

1. お名前.com のコントロールパネルで「ネームサーバー設定」→「お名前.com のネームサーバーを使う」
2. `dig NS example.com @8.8.8.8` で確認

Route 53 Hosted Zone 自体は削除しない限り残り、再切替はいつでも可能。

## 参照

- [AWS ドキュメント: NS レコード委任](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html)
- [お名前.com ヘルプ: ネームサーバー変更](https://help.onamae.com/answer/7883) (URL は変わる可能性あり)
- [ADR-0001](../adr/0001-use-ecs-fargate-for-stg.md) — DNS 設計の背景
- [docs/operations/tf-state-bootstrap.md](./tf-state-bootstrap.md) — 前提の bootstrap 手順
