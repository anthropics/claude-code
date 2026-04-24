# S3 presigned URL 画像アップロード (P1-04 / Issue #90)

## 概要

アバター / ヘッダー画像は **クライアントから S3 に直接 PUT** でアップロードする。
サーバーは presigned URL の発行だけ行い、画像本体は一切経由しない。

- 帯域節約: Django サーバーを経由しない。
- CPU 節約: multipart 解析・サムネイル生成をサーバーでやらない。
- セキュリティ: `content_type` / `content_length` をサーバー側で固定して署名するため、
  クライアントが sign 後に中身をすり替えることを防ぐ (S3 側で検証される)。

## API

### `POST /api/v1/users/me/avatar-upload-url/`

### `POST /api/v1/users/me/header-upload-url/`

| 項目       | 値                                                               |
| ---------- | ---------------------------------------------------------------- |
| 認証       | 必須 (Cookie JWT + CSRF)                                         |
| リクエスト | `application/json`                                               |
| 成功       | `200 OK`                                                         |
| 失敗       | `400 Bad Request` (body validation), `401 Unauthorized` (未認証) |

#### リクエスト body

```json
{
	"content_type": "image/webp",
	"content_length": 123456
}
```

- `content_type`: `image/webp` / `image/jpeg` / `image/png` のいずれか。
- `content_length`: 1 以上 5,242,880 (5 MiB) 以下の整数 (bytes)。

#### レスポンス body

```json
{
	"upload_url": "https://<bucket>.s3.<region>.amazonaws.com/users/42/avatar/<uuid>.webp?X-Amz-...",
	"object_key": "users/42/avatar/<uuid>.webp",
	"expires_at": "2026-04-23T12:15:00+00:00",
	"public_url": "https://cdn.example.com/users/42/avatar/<uuid>.webp"
}
```

- `upload_url`: presigned PUT URL。**15 分間有効**。
- `object_key`: S3 object key。
- `expires_at`: presigned URL の失効時刻 (ISO 8601 / UTC)。
- `public_url`: アップロード後の公開 URL。`AWS_S3_CUSTOM_DOMAIN` (= CloudFront)
  が設定されていればそれを、無ければ S3 virtual host 形式を返す。

## クライアント側のアップロードフロー

```typescript
// 1. サーバーから presigned URL を取得 (認証済みセッションで叩く)
const res = await fetch("/api/v1/users/me/avatar-upload-url/", {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		"X-CSRFToken": csrfToken,
	},
	credentials: "include",
	body: JSON.stringify({
		content_type: file.type,
		content_length: file.size,
	}),
});
const { upload_url, object_key, public_url } = await res.json();

// 2. 取得した URL に対して直接 PUT (Cookie / Authorization は送らない)
//    credentials: "omit" を明示することで Cookie (session / CSRF) が S3 に
//    送られないようにし、S3 側の署名検証 / CORS エラーを避ける。
//    これを付けないとブラウザが same-site / third-party cookie を送るケースがあり、
//    presigned URL の署名対象外ヘッダーが混入して "SignatureDoesNotMatch" になる。
await fetch(upload_url, {
	method: "PUT",
	headers: {
		// サーバー側で署名に含めた値と完全一致させる必要がある。
		"Content-Type": file.type,
	},
	credentials: "omit",
	body: file,
});

// 3. アップロード完了後、PATCH /api/v1/users/me/ で avatar_url を保存
await fetch("/api/v1/users/me/", {
	method: "PATCH",
	headers: {
		"Content-Type": "application/json",
		"X-CSRFToken": csrfToken,
	},
	credentials: "include",
	body: JSON.stringify({ avatar_url: public_url }),
});
```

### ポイント

- S3 への PUT には **必ず `credentials: "omit"` を付ける**。上記サンプル参照。
  Cookie / Authorization header を送ってしまうと署名対象外ヘッダーが混入して
  `SignatureDoesNotMatch` になるケースがある。
- `Content-Type` は presigned URL 発行時と **完全に一致** させる。
  ずれると S3 側で `SignatureDoesNotMatch` エラーになる。
- クライアント側でも事前に「画像か?」「5MB 以下か?」を UI レベルでチェック
  して UX を改善すること (サーバー側でも validate はしている)。

## S3 bucket CORS 設定

S3 bucket には CORS を以下のように設定する。`AllowedOrigins` は必ず
**本番 / staging の frontend URL に限定** すること (ワイルドカード禁止)。

```json
[
	{
		"AllowedMethods": ["PUT"],
		"AllowedOrigins": ["https://app.example.com", "https://stg.example.com"],
		"AllowedHeaders": ["Content-Type", "Content-Length"],
		"ExposeHeaders": [],
		"MaxAgeSeconds": 3000
	},
	{
		"AllowedMethods": ["GET"],
		"AllowedOrigins": ["*"],
		"AllowedHeaders": [],
		"ExposeHeaders": [],
		"MaxAgeSeconds": 86400
	}
]
```

- PUT はアップロード用のため frontend origin 限定。
- GET は画像配信 (`<img src>`) 用のため `*` で OK (CloudFront 経由推奨)。

## Terraform bucket policy

以下は最小限のサンプル。詳細は `terraform/modules/storage/s3.tf` (別 PR で整備) を参照。

```hcl
resource "aws_s3_bucket" "media" {
  bucket = "sns-${var.stage}-media"
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = var.frontend_origins
    allowed_headers = ["Content-Type", "Content-Length"]
    max_age_seconds = 3000
  }

  cors_rule {
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 86400
  }
}
```

- BucketOwnerEnforced にすることで ACL を無効化し、object ownership を bucket 所有者に統一する。
- CloudFront 経由の配信は OAC (Origin Access Control) を使い、直接公開は行わない構成を推奨。

## 運用上の注意

- **孤立オブジェクト**: presigned URL を発行したが実際にアップロードしなかった
  / `PATCH /api/v1/users/me/` で `avatar_url` を更新しなかった場合、S3 上に
  参照されないオブジェクトが残る。ライフサイクルルールで 7 日以上古い `users/`
  prefix の未参照オブジェクトを削除する lambda を別途走らせること (P1-04 scope 外)。
- **鍵の rotation**: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` を rotate
  したら Django pod を再起動 (env 反映)。presigned URL 発行に使う credentials は
  15 分間の署名にしか使わないので rotate 耐性は高い。
- **サイズ制限**: サーバー側 `validate_upload_request` で 5 MiB 上限を enforce
  するが、S3 presigned URL に `Content-Length` を入れて署名しているため、
  クライアントが sign 後にサイズを偽装しても S3 側で reject される (二重防御)。
