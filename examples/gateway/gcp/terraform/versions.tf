# Provider + version pins for the Claude Gateway Cloud Run deployment.
terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.8, < 7.0" # 6.8 adds invoker_iam_disabled on google_cloud_run_v2_service
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
