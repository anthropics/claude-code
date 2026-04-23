# Terraform state backend.
#
# IMPORTANT: このブロックは環境共通の既定値だが、`terraform init` は
# 実際には環境ディレクトリ (`environments/stg/` 等) から実行する。
# 各環境では `-backend-config="key=<env>/terraform.tfstate"` を渡して
# state のキーだけ上書きする運用とする。
#
# Bootstrap:
#   S3 bucket "sns-stg-tf-state" と DynamoDB table "sns-stg-tf-lock" は
#   Terraform ではなく scripts/bootstrap-tf-state.sh で事前に作成する。
#   詳細は docs/operations/tf-state-bootstrap.md。

terraform {
  backend "s3" {
    bucket         = "sns-stg-tf-state"
    # key は環境ごとに override (terraform init -backend-config="key=stg/terraform.tfstate")
    key            = "UNSET-override-with-backend-config"
    region         = "ap-northeast-1"
    dynamodb_table = "sns-stg-tf-lock"
    encrypt        = true
  }
}
