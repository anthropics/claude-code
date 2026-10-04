# Inputs — mirror the env-overridable knobs in setup.sh (same defaults).

variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "Infra region for Artifact Registry, Cloud SQL, subnet, and Cloud Run. (Agent Platform region is set separately inside gateway.yaml.)"
  type        = string
  default     = "us-east5"
}

# ── Service account (§2) ────────────────────────────────────────────────────
variable "sa_name" {
  description = "Service account account_id (the part before @)."
  type        = string
  default     = "claude-gateway"
}

# ── Image (§3) ──────────────────────────────────────────────────────────────
# Terraform creates the Artifact Registry repo but does NOT build/push the image
# (that's a docker build step — see README). It references the image by tag.
variable "ar_repo" {
  description = "Artifact Registry Docker repository ID."
  type        = string
  default     = "claude-gateway"
}

variable "image_name" {
  description = "Image name within the repo."
  type        = string
  default     = "gateway"
}

variable "image_tag" {
  description = "Image tag — the Claude Code release version you build and push (must already be pushed as linux/amd64). See the README Deploy section for the build command."
  type        = string
  validation {
    condition     = can(regex("^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$", var.image_tag))
    error_message = "image_tag must be a valid OCI tag — set it to the Claude Code release version you pushed (the '<version>' in terraform.tfvars.example is a placeholder)."
  }
}

# ── Networking (§4) ─────────────────────────────────────────────────────────
variable "vpc_network" {
  description = "Custom VPC network name."
  type        = string
  default     = "cc-gateway-vpc"
}

variable "subnet" {
  description = "Subnet name (Cloud Run Direct VPC egress attaches here)."
  type        = string
  default     = "cc-gateway-subnet"
}

variable "subnet_range" {
  description = "Subnet primary CIDR."
  type        = string
  default     = "10.0.0.0/24"
}

variable "psa_prefix_length" {
  description = "Prefix length for the Private Services Access allocated range (/16 is GCP's recommendation)."
  type        = number
  default     = 16
}

# ── Cloud SQL (§4) ──────────────────────────────────────────────────────────
variable "db_instance" {
  description = "Cloud SQL instance name."
  type        = string
  default     = "claude-gateway-db"
}

variable "db_version" {
  description = "Postgres major version. The gateway supports PostgreSQL 14 or newer; 16 is the recommended default."
  type        = string
  default     = "POSTGRES_16"
}

variable "db_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-g1-small"
}

variable "db_name" {
  description = "Database name."
  type        = string
  default     = "claude_gateway"
}

variable "db_user" {
  description = "Database user (the gateway connects as this role)."
  type        = string
  default     = "gateway"
}

# ── Secrets (§5 / §6) ─────────────────────────────────────────────────────
variable "secret_name" {
  description = "Secret Manager secret holding the Postgres connection string."
  type        = string
  default     = "gateway-postgres-url"
}

variable "jwt_secret_name" {
  description = "Secret Manager secret holding the session JWT signing key."
  type        = string
  default     = "gateway-jwt-secret"
}

variable "oidc_secret_name" {
  description = "Secret Manager secret holding the Google OAuth client secret."
  type        = string
  default     = "gateway-oidc-client-secret"
}

variable "config_secret_name" {
  description = "Secret Manager secret holding gateway.yaml (mounted at /etc/claude/gateway.yaml)."
  type        = string
  default     = "gateway-config"
}

variable "oidc_client_secret" {
  description = "Google OAuth client secret value. Leave empty to NOT manage the version via Terraform (only if you add the secret version out-of-band — without one the deploy fails)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "gateway_config_path" {
  description = "Path to gateway.yaml. Empty = ../gateway.yaml relative to this module."
  type        = string
  default     = ""
}

# ── Cloud Run (§7) ──────────────────────────────────────────────────────────
variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "claude-gateway"
}

variable "min_instances" {
  description = "Minimum Cloud Run instances (1 avoids cold OIDC discovery)."
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum Cloud Run instances. Each instance opens a Postgres pool of up to 5 connections (the gateway's store.max_connections default) and db-g1-small caps at ~50 max_connections — keep max_instances × 5 below the DB tier's limit, or raise the tier before raising this."
  type        = number
  default     = 8
}

variable "ingress" {
  description = "Cloud Run ingress — Claude Code's /login only accepts gateway hosts on private addresses, so public ingress cannot serve clients: INGRESS_TRAFFIC_INTERNAL_ONLY (default; no public URL — VPC-only; reaches corp on-prem only with the private-access prerequisites in the README; public_url stays the run.app URL, so no LB or custom cert needed) or INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER (front with your own internal ALB for a custom hostname/cert)."
  type        = string
  default     = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  validation {
    condition     = contains(["INGRESS_TRAFFIC_INTERNAL_ONLY", "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"], var.ingress)
    error_message = "ingress must be INGRESS_TRAFFIC_INTERNAL_ONLY or INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER — Claude Code only connects to gateways on private addresses."
  }
}

variable "invoker_iam_disabled" {
  description = "PREFERRED public-access path: disable the Cloud Run invoker IAM check so requests reach the container with no allUsers binding (works under Domain Restricted Sharing). Real auth stays the gateway's own OIDC. When true, the allUsers grant below is skipped. May be blocked by org policy constraints/run.managed.requireInvokerIam, or unavailable for the org (\"invoker_iam_disabled is not currently available for your organization\") — then fall back to allow_unauthenticated. Requires google provider >= 6.8."
  type        = bool
  default     = false
}

variable "allow_unauthenticated" {
  description = "Fallback public-access path: grant allUsers run.invoker (the gateway needs the IAM layer open for its own OIDC). Prefer invoker_iam_disabled. Domain Restricted Sharing orgs reject allUsers — set false there and use invoker_iam_disabled, a DRS exception, or GKE."
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Provider-level deletion protection on Cloud SQL and Cloud Run. Keep true to avoid accidental deletion of the running deployment."
  type        = bool
  default     = true
}
