terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

# Default provider: ap-northeast-1 (stg リージョン)
provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "sns"
      Environment = "stg"
      ManagedBy   = "terraform"
    }
  }
}

# us-east-1 provider alias: edge モジュールが CloudFront 用 ACM 証明書を取得するのに必要
# (CloudFront は us-east-1 の証明書のみ受け付ける)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "sns"
      Environment = "stg"
      ManagedBy   = "terraform"
    }
  }
}
