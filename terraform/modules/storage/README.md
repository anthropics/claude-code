# `storage` module

3 本の S3 バケットを共通ポリシーで作成する。

| 論理名 | bucket name | 用途 | Lifecycle |
|---|---|---|---|
| `media` | `<project>-<env>-media` | アバター・ツイート画像・DM 添付 | noncurrent 90 日削除 |
| `static` | `<project>-<env>-static` | Next.js 静的アセット (CloudFront 配信) | 30 日で IA 移行 |
| `backup` | `<project>-<env>-backup` | RDS / Meilisearch / アプリバックアップ | 30 日 IA → 90 日 Glacier → 730 日削除 |

## 共通設定

- **Versioning**: 有効（誤削除復旧 + 監査）
- **Encryption**: SSE-S3 (AES256) + Bucket Key 有効化でコスト節約
- **Public Access Block**: 4 項目すべて True
- **Object Ownership**: `BucketOwnerEnforced` (ACL 無効化)
- **force_destroy**: false (誤削除防止)
- **中断済み Multipart Upload**: 7 日後自動破棄

## CORS

`media` バケットのみに 2 rule:
- **GET/HEAD**: all origins (CloudFront 経由配信なので広め)
- **PUT/POST**: フロントエンド origin のみ (presigned URL 経由の直アップロード用、Phase 3 DM 添付等)

## CloudFront OAC 連携 (optional)

`var.cloudfront_oac_arn` を与えると、media / static バケットの bucket policy を
CloudFront Origin Access Control 経由のみ許可するよう設定する。
edge モジュール (Phase 0.5-05) 実装前は空のままで OK (policy がそもそも付かない)。

## 使用例

```hcl
module "storage" {
  source = "../../modules/storage"

  environment = "stg"
  project     = "sns"

  # edge モジュール完成後に値を入れる
  cloudfront_oac_arn = module.edge.oac_arn
}
```

## 運用上の注意

- バケット名は global unique。名前衝突時は `project` を変更するか suffix 追加を検討
- `force_destroy = false` なので `terraform destroy` 前に手動で全オブジェクト削除が必要
  （versioning あるため delete markers + versions の削除は
   [docs/operations/tf-state-bootstrap.md](../../../docs/operations/tf-state-bootstrap.md) 末尾の手順を参考に）
- 本モジュールは **KMS CMK 暗号化に切替える余地**あり。prod では backup bucket だけ
  CMK にすると監査性が上がる（要 ADR）

## 今後の拡張

- Access Logs 有効化 (S3 Access Logs を同リージョンの別バケットへ)
- Intelligent-Tiering への自動移行 (media バケット、アクセスパターンが読めない場合)
- Replication (prod 昇格時に別リージョンへ backup 複製)
