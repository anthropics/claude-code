# Claude Gateway on Cloud Run — Terraform equivalent of setup.sh.
# Section markers (§N) map to setup.sh and the walkthrough:
# https://code.claude.com/docs/en/claude-apps-gateway-on-gcp

locals {
  config_path    = var.gateway_config_path != "" ? var.gateway_config_path : "${path.module}/../gateway.yaml"
  gateway_config = file(local.config_path)
  image          = "${var.region}-docker.pkg.dev/${var.project_id}/${var.ar_repo}/${var.image_name}:${var.image_tag}"

  apis = [
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "sqladmin.googleapis.com",
    "secretmanager.googleapis.com",
    "iamcredentials.googleapis.com",
    "iam.googleapis.com",
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "run.googleapis.com",
  ]
}

# ── 1 Project & API setup ───────────────────────────────────────────────────
resource "google_project_service" "apis" {
  for_each = toset(local.apis)
  project  = var.project_id
  service  = each.value
  # Don't disable APIs (or delete anything) when this config is torn down.
  disable_on_destroy         = false
  disable_dependent_services = false
}

# ── 2 Service account & IAM (least-privilege) ───────────────────────────────
resource "google_service_account" "gateway" {
  project      = var.project_id
  account_id   = var.sa_name
  display_name = "Claude Gateway"
  depends_on   = [google_project_service.apis]
}

# Non-authoritative (_member) so we never clobber other project bindings.
#
# Only aiplatform.user is granted: the gateway reaches Cloud SQL over the VPC at
# its private IP with a password user (direct TCP via Direct VPC egress — see §7
# below), not via the Cloud SQL Auth Proxy / connector, so it never calls
# cloudsql.instances.connect and no roles/cloudsql.client grant is needed.
# Direct private-IP keeps the gateway's store a plain postgres_url with no proxy
# sidecar/socket plumbing, and the connection string is portable across Cloud
# Run and GKE.
resource "google_project_iam_member" "vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user" # Agent Platform inference
  member  = "serviceAccount:${google_service_account.gateway.email}"
}

# ── 3 Artifact Registry repo ────────────────────────────────────────────────
# NOTE: image build/push is a separate step (see README) — Terraform only makes the repo.
resource "google_artifact_registry_repository" "repo" {
  project       = var.project_id
  location      = var.region
  repository_id = var.ar_repo
  format        = "DOCKER"
  description   = "Claude Gateway container images"
  depends_on    = [google_project_service.apis]
}

# ── 4 VPC + Private Services Access ──────────────────────────────────────────
resource "google_compute_network" "vpc" {
  project                 = var.project_id
  name                    = var.vpc_network
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "subnet" {
  project       = var.project_id
  name          = var.subnet
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.subnet_range
}

resource "google_compute_global_address" "psa_range" {
  project       = var.project_id
  name          = "google-managed-services-${var.vpc_network}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = var.psa_prefix_length
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "psa" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.psa_range.name]
  # ABANDON: on destroy, leave the producer peering in place (deleting it can hang
  # and would affect any other private-IP service on this VPC).
  deletion_policy = "ABANDON"
  # If the peering already exists (e.g. a previous apply failed partway), patch it
  # instead of failing the create.
  update_on_creation_fail = true
  depends_on              = [google_project_service.apis]
}

# ── 4 Cloud SQL (private IP only) ───────────────────────────────────────────
resource "google_sql_database_instance" "db" {
  project             = var.project_id
  name                = var.db_instance
  region              = var.region
  database_version    = var.db_version
  deletion_protection = var.deletion_protection
  depends_on          = [google_service_networking_connection.psa]

  settings {
    tier = var.db_tier
    ip_configuration {
      ipv4_enabled    = false # private IP only (org policy: sql.restrictPublicIp)
      private_network = google_compute_network.vpc.id
      ssl_mode        = "ENCRYPTED_ONLY"
    }
  }
}

resource "google_sql_database" "db" {
  project  = var.project_id
  name     = var.db_name
  instance = google_sql_database_instance.db.name
}

# URL-safe (alphanumeric) so it drops cleanly into the connection string.
# nosemgrep: terraform-generic-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote GCS backend (see README "Remote state")
resource "random_password" "db" {
  length  = 32
  special = false
}

# nosemgrep: terraform-gcp-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote GCS backend (see README "Remote state")
resource "google_sql_user" "gateway" {
  project  = var.project_id
  name     = var.db_user
  instance = google_sql_database_instance.db.name
  password = random_password.db.result
  # On destroy the role owns the tables it migrated at boot, so DROP ROLE can
  # fail (and races google_sql_database.db). ABANDON is harmless on the
  # greenfield teardown — the whole instance is deleted anyway.
  deletion_policy = "ABANDON"
}

# ── 5/6 Secrets + secretAccessor ────────────────────────────────────────────
# postgres-url: connection string built from the instance's private IP.
resource "google_secret_manager_secret" "postgres_url" {
  project   = var.project_id
  secret_id = var.secret_name
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

# nosemgrep: terraform-gcp-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote GCS backend (see README "Remote state")
resource "google_secret_manager_secret_version" "postgres_url" {
  secret      = google_secret_manager_secret.postgres_url.id
  secret_data = "postgres://${var.db_user}:${random_password.db.result}@${google_sql_database_instance.db.private_ip_address}:5432/${var.db_name}?sslmode=require"
}

# jwt: session signing key.
# nosemgrep: terraform-generic-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote GCS backend (see README "Remote state")
resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "google_secret_manager_secret" "jwt" {
  project   = var.project_id
  secret_id = var.jwt_secret_name
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

# nosemgrep: terraform-gcp-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote GCS backend (see README "Remote state")
resource "google_secret_manager_secret_version" "jwt" {
  secret      = google_secret_manager_secret.jwt.id
  secret_data = random_password.jwt.result
}

# oidc client secret: operator-provided (from the Google OAuth client).
resource "google_secret_manager_secret" "oidc" {
  project   = var.project_id
  secret_id = var.oidc_secret_name
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

# nosemgrep: terraform-gcp-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote GCS backend (see README "Remote state")
resource "google_secret_manager_secret_version" "oidc" {
  count       = var.oidc_client_secret != "" ? 1 : 0
  secret      = google_secret_manager_secret.oidc.id
  secret_data = var.oidc_client_secret
}

# Warn (not block) at plan time when the OIDC secret value isn't set: the Cloud
# Run service mounts gateway-oidc-client-secret:latest unconditionally, so an
# empty value with no out-of-band version means the apply fails late at
# revision creation. A warning (not a precondition) keeps the documented
# out-of-band-version mode usable.
check "oidc_client_secret_set" {
  assert {
    condition     = var.oidc_client_secret != ""
    error_message = "oidc_client_secret is empty — set it in terraform.tfvars, or add a version to the gateway-oidc-client-secret secret out-of-band before applying (the Cloud Run revision mounts it at :latest and will fail without one)."
  }
}

# config: gateway.yaml. Guard mirrors the bash REPLACE_ME check (non-comment lines).
resource "google_secret_manager_secret" "config" {
  project   = var.project_id
  secret_id = var.config_secret_name
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

# nosemgrep: terraform-gcp-secrets-in-state -- secrets in tfstate are inherent to TF; mitigated by the documented remote GCS backend (see README "Remote state")
resource "google_secret_manager_secret_version" "config" {
  secret      = google_secret_manager_secret.config.id
  secret_data = local.gateway_config

  lifecycle {
    precondition {
      condition = length([
        for line in split("\n", local.gateway_config) :
        line
        if !startswith(trimspace(line), "#") && strcontains(line, "REPLACE_ME")
      ]) == 0
      error_message = "gateway.yaml still has REPLACE_ME on a non-comment line — fill it in before applying."
    }
  }
}

resource "google_secret_manager_secret_iam_member" "postgres_url" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.postgres_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gateway.email}"
}

resource "google_secret_manager_secret_iam_member" "jwt" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.jwt.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gateway.email}"
}

resource "google_secret_manager_secret_iam_member" "oidc" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.oidc.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gateway.email}"
}

resource "google_secret_manager_secret_iam_member" "config" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.config.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.gateway.email}"
}

# ── 7 Cloud Run (Direct VPC egress) ─────────────────────────────────────────
resource "google_cloud_run_v2_service" "gateway" {
  project              = var.project_id
  name                 = var.service_name
  location             = var.region
  ingress              = var.ingress
  invoker_iam_disabled = var.invoker_iam_disabled
  deletion_protection  = var.deletion_protection

  template {
    service_account = google_service_account.gateway.email
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }
    # Secrets are mounted at version=latest, so a config edit or secret
    # rotation alone wouldn't diff this resource and the warm min_instances=1
    # revision would keep the old values. Stamping a hash of the rendered
    # config + every managed secret value forces a new revision whenever any
    # of them change — without this, tainting random_password.db ALTERs the
    # SQL role to the new password while the running revision keeps the old
    # connection string and breaks on its next reconnect, and rotating the
    # OIDC client secret leaves login failing invalid_client.
    labels = {
      config-sha = substr(sha256(join("", [
        local.gateway_config,
        random_password.db.result,
        random_password.jwt.result,
        var.oidc_client_secret,
      ])), 0, 63)
    }
    # Cloud Run's default 300s request timeout would cut off long streaming
    # /v1/messages responses mid-stream.
    timeout = "3600s"

    vpc_access {
      network_interfaces {
        network    = google_compute_network.vpc.id
        subnetwork = google_compute_subnetwork.subnet.id
      }
      egress = "PRIVATE_RANGES_ONLY" # public egress (Agent Platform, accounts.google.com) bypasses the VPC -> no Cloud NAT needed
    }

    containers {
      image = local.image
      ports { container_port = 8080 }

      # gateway.yaml mounted as a file at /etc/claude/gateway.yaml (alone in its dir).
      volume_mounts {
        name       = "config"
        mount_path = "/etc/claude"
      }

      # Cloud Run can't mount multiple secrets in one dir, so the rest are env vars
      # (gateway.yaml references them via ${ENV_VAR}).
      env {
        name = "GATEWAY_JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "OIDC_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.oidc.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "GATEWAY_POSTGRES_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.postgres_url.secret_id
            version = "latest"
          }
        }
      }
    }

    volumes {
      name = "config"
      secret {
        secret = google_secret_manager_secret.config.secret_id
        items {
          path    = "gateway.yaml"
          version = "latest"
        }
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_iam_member.config,
    google_secret_manager_secret_iam_member.jwt,
    google_secret_manager_secret_iam_member.oidc,
    google_secret_manager_secret_iam_member.postgres_url,
    google_secret_manager_secret_version.config,
    google_secret_manager_secret_version.postgres_url,
    google_secret_manager_secret_version.jwt,
    google_secret_manager_secret_version.oidc,
    google_sql_database.db,
    google_sql_user.gateway,
    google_project_service.apis,
  ]
}

# Public access at the Cloud Run IAM layer — the gateway runs its own OIDC, so the
# invoker check must be opened or disabled (real auth stays the gateway's SSO):
#   Preferred — disable it: invoker_iam_disabled=true on the service above. No allUsers
#     binding at all, and it works under Domain Restricted Sharing.
#   Fallback  — open it: this allUsers run.invoker grant. Domain Restricted Sharing orgs
#     reject allUsers, and an LB does NOT bypass that (ingress is network-layer; the IAM
#     check still runs) — use invoker_iam_disabled, a DRS exception, or GKE.
# Skipped when invoker_iam_disabled=true (the grant would be redundant, and DRS rejects it).
resource "google_cloud_run_v2_service_iam_member" "public" {
  count    = var.allow_unauthenticated && !var.invoker_iam_disabled ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.gateway.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
