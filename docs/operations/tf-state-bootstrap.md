# Terraform state backend bootstrap

Terraform state 保存用の AWS リソース (S3 バケット + DynamoDB lock テーブル) を
**Terraform 以外の手段** で 1 回だけ作成する手順。

state を保存するためのリソースを Terraform で管理してしまうと、
「state がまだ無い時点で state を作る」 chicken-and-egg が発生するため、
この 2 リソースだけはスクリプトで bootstrap する。

## 対象リソース

| リソース       | 名前 (既定)        | 用途                          |
| -------------- | ------------------ | ----------------------------- |
| S3 bucket      | `sns-stg-tf-state` | terraform state file の保存先 |
| DynamoDB table | `sns-stg-tf-lock`  | terraform apply の排他ロック  |

両リソースとも:

- リージョン: `ap-northeast-1`
- 暗号化: SSE-S3 (bucket) / PAY_PER_REQUEST (table)
- Public Access: 完全遮断
- バージョニング有効 (bucket)

## 前提

- AWS アカウント (ハルナさんが管理)
- `aws` CLI v2 インストール済み
- `aws sso login` もしくは `aws configure` で管理権限のクレデンシャルを取得済み

## 手順

### 1. リポジトリ直下で実行

```bash
./scripts/bootstrap-tf-state.sh
```

引数で bucket 名・table 名・region を上書き可能:

```bash
./scripts/bootstrap-tf-state.sh \
  --region ap-northeast-1 \
  --bucket sns-stg-tf-state \
  --table  sns-stg-tf-lock
```

### 2. 冪等性

スクリプトは既に存在する場合スキップする。バージョニング・暗号化・Public Access Block
は毎回 apply するため、設定ドリフトは自動修復される。

### 3. 作成確認

```bash
aws s3api head-bucket --bucket sns-stg-tf-state
aws dynamodb describe-table --table-name sns-stg-tf-lock --query 'Table.TableStatus'
```

## トラブルシューティング

| 症状                      | 原因                          | 対応                                                                  |
| ------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `InvalidBucketName`       | bucket 名が既に世界中で使用中 | `--bucket <your-prefix>-tf-state` で unique な名前を指定              |
| `AccessDenied`            | IAM 権限不足                  | S3:CreateBucket / DynamoDB:CreateTable / sts:GetCallerIdentity を確認 |
| `BucketAlreadyOwnedByYou` | 既に同じアカウントで作成済み  | 正常。スクリプトは続行して設定を更新する                              |

## 今後の拡張

- prod 環境では別バケット `sns-prod-tf-state` を推奨 (環境分離・権限境界)
- KMS カスタム CMK での暗号化に移行する場合、既存 state の再暗号化が必要

## 削除

stg 環境を完全に破棄する際は以下の**厳密な順序**で実行する。バージョニングが有効な
バケットは **全バージョン + delete markers** を個別削除しないと `BucketNotEmpty` で失敗する。

### 前提

- 先に `terraform destroy` で AWS 上の stg リソースを削除済み
- state ファイルはもう使わないことを確認

### 手順

```bash
BUCKET=sns-stg-tf-state
TABLE=sns-stg-tf-lock
REGION=ap-northeast-1

# 1. まず現行 state オブジェクトの全バージョンを列挙して削除
aws s3api list-object-versions \
  --bucket "${BUCKET}" \
  --region "${REGION}" \
  --output json \
  --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' \
  > /tmp/versions.json

if [ "$(jq '.Objects | length' /tmp/versions.json)" -gt 0 ]; then
  aws s3api delete-objects \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --delete "file:///tmp/versions.json"
fi

# 2. Delete markers も列挙して削除 (バージョニング有効バケット特有)
aws s3api list-object-versions \
  --bucket "${BUCKET}" \
  --region "${REGION}" \
  --output json \
  --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' \
  > /tmp/markers.json

if [ "$(jq '.Objects | length' /tmp/markers.json)" -gt 0 ]; then
  aws s3api delete-objects \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --delete "file:///tmp/markers.json"
fi

# 3. バケット削除 (空になっていることを確認してから)
aws s3api delete-bucket --bucket "${BUCKET}" --region "${REGION}"

# 4. DynamoDB lock テーブル削除
aws dynamodb delete-table --table-name "${TABLE}" --region "${REGION}"
```

### 警告

- 手順 1-2 を飛ばすと `delete-bucket` が `BucketNotEmpty` で失敗する
- MFA Delete が有効化されている場合は root account + MFA デバイスが必要
- `terraform destroy` 前に state を消すと、実リソースが残ったまま Terraform
  から追跡不能になる。必ず **terraform destroy → state 削除** の順を守ること
- prod 環境では state を消す前にスナップショット (別バケットへコピー) 推奨
