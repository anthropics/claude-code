# S3 backend for stg state.
#
# ハルナさんが scripts/bootstrap-tf-state.sh を先に実行して
# `sns-stg-tf-state` bucket と `sns-stg-tf-lock` DynamoDB table を作成している前提。
# 初期化コマンド:
#   cd terraform/environments/stg
#   terraform init
terraform {
  backend "s3" {
    bucket         = "sns-stg-tf-state"
    key            = "stg/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "sns-stg-tf-lock"
    encrypt        = true
  }
}
