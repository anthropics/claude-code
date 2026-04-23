#!/usr/bin/env bash
# bootstrap-tf-state.sh - Terraform state 保存用 S3 + DynamoDB lock テーブルを作成 (P0.5-01)
#
# 前提:
#   - aws CLI v2 がインストール済み (`aws --version`)
#   - 事前に `aws sso login` or `aws configure` で管理権限が取得済み
#   - 実行するアカウントで S3 CreateBucket / DynamoDB CreateTable が許可されている
#
# 使い方:
#   ./scripts/bootstrap-tf-state.sh
#     [--region ap-northeast-1]
#     [--bucket sns-stg-tf-state]
#     [--table  sns-stg-tf-lock]
#
# 冪等性:
#   S3 バケット / DynamoDB テーブルが既に存在する場合はスキップし exit 0。
#   バージョニング・暗号化・Public Access Block は毎回 apply し直す (差分なければ no-op)。

set -euo pipefail

REGION="ap-northeast-1"
BUCKET="sns-stg-tf-state"
TABLE="sns-stg-tf-lock"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    --bucket) BUCKET="$2"; shift 2 ;;
    --table)  TABLE="$2";  shift 2 ;;
    *) echo "❌ unknown arg: $1" >&2; exit 2 ;;
  esac
done

if ! command -v aws >/dev/null 2>&1; then
  echo "❌ aws CLI が見つかりません。https://docs.aws.amazon.com/cli/ からインストールしてください" >&2
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)
if [[ -z "$ACCOUNT_ID" ]]; then
  echo "❌ AWS 認証情報が取得できません。aws sso login または aws configure を先に実行してください" >&2
  exit 1
fi

echo "🔐 AWS Account: ${ACCOUNT_ID}  /  Region: ${REGION}"
echo "📦 Bucket: ${BUCKET}"
echo "🔒 Lock table: ${TABLE}"
echo ""
read -r -p "続行しますか? (y/N) " confirm
if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
  echo "中止しました"; exit 0
fi

# ---------- S3 bucket ----------
if aws s3api head-bucket --bucket "${BUCKET}" --region "${REGION}" 2>/dev/null; then
  echo "ℹ️  S3 bucket ${BUCKET} は既に存在します。設定更新のみ行います。"
else
  echo "📦 S3 bucket 作成中..."
  if [[ "${REGION}" == "us-east-1" ]]; then
    # us-east-1 だけは LocationConstraint を指定しない特殊仕様
    aws s3api create-bucket --bucket "${BUCKET}" --region "${REGION}" \
      --object-ownership BucketOwnerEnforced
  else
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --region "${REGION}" \
      --object-ownership BucketOwnerEnforced \
      --create-bucket-configuration "LocationConstraint=${REGION}"
  fi
fi

# SECURITY: Public Access Block は最初に適用する (architect PR #45 HIGH)。
# 他の設定より前に置くことで、create-bucket 直後の短い窓で public ACL を
# 受け付けてしまう race condition を塞ぐ。
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration '{
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }'

# バージョニング (state の巻き戻し・監査目的)
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

# 暗号化 (SSE-S3、KMS でも可だが bootstrap はシンプルに S3 managed)
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [
      { "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" } }
    ]
  }'

# タグ付け (コスト配分・監査用。DynamoDB テーブルとキーを揃える)
aws s3api put-bucket-tagging \
  --bucket "${BUCKET}" \
  --tagging "TagSet=[
    {Key=Project,Value=engineer-sns},
    {Key=Environment,Value=stg},
    {Key=ManagedBy,Value=bootstrap-tf-state}
  ]"

echo "✅ S3 bucket 準備完了"

# ---------- DynamoDB lock table ----------
if aws dynamodb describe-table --table-name "${TABLE}" --region "${REGION}" >/dev/null 2>&1; then
  echo "ℹ️  DynamoDB table ${TABLE} は既に存在します。スキップ。"
else
  echo "🔒 DynamoDB lock table 作成中..."
  aws dynamodb create-table \
    --table-name "${TABLE}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "${REGION}" \
    --tags Key=Project,Value=engineer-sns Key=ManagedBy,Value=bootstrap-tf-state
  aws dynamodb wait table-exists --table-name "${TABLE}" --region "${REGION}"
fi

echo "✅ DynamoDB table 準備完了"

cat <<MSG

🎉 Bootstrap 完了。

次のステップ:
  cd terraform/environments/stg
  terraform init    # -> S3 backend に state が保存される
  terraform plan

詳細は docs/operations/tf-state-bootstrap.md を参照。
MSG
