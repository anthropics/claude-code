variable "environment" {
  description = "環境名 (stg / prod)"
  type        = string
  validation {
    condition     = contains(["stg", "prod"], var.environment)
    error_message = "environment は stg / prod のいずれか。"
  }
}

variable "project" {
  description = "プロジェクト名 (リソース prefix)"
  type        = string
  default     = "sns"
}

variable "vpc_cidr" {
  description = "VPC の CIDR ブロック"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "有効な IPv4 CIDR で指定してください (例: 10.0.0.0/16)。"
  }
}

variable "availability_zones" {
  description = "利用する AZ のリスト。先頭 2 つでサブネットを切る。"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "Phase 0.5 は 2 AZ 運用を前提とする (prod で拡張)。"
  }
}

variable "public_subnet_cidrs" {
  description = "ALB 用 public subnet の CIDR リスト (AZ と対応)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "ECS Fargate 用 private subnet の CIDR リスト"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "db_subnet_cidrs" {
  description = "RDS / ElastiCache 用 DB subnet の CIDR リスト"
  type        = list(string)
  default     = ["10.0.21.0/24", "10.0.22.0/24"]
}

variable "fck_nat_instance_type" {
  description = "fck-nat インスタンスタイプ (ASG)"
  type        = string
  default     = "t4g.nano"
}

variable "fck_nat_ami_id" {
  description = "fck-nat AMI ID (ap-northeast-1)。空なら最新を data source で取得。"
  type        = string
  default     = ""
}

variable "enable_vpc_endpoints" {
  description = "VPC Interface Endpoints (ECR/Secrets/Logs/STS) を作るか。Interface Endpoint は $7/月/本で合計 $28 程度。"
  type        = bool
  default     = true
}

variable "tags" {
  description = "全リソース共通タグ"
  type        = map(string)
  default     = {}
}
