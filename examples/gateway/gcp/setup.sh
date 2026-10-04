#!/usr/bin/env bash
#
# setup.sh — GCP setup for Claude Gateway (walkthrough §1–7b).
#
# Provisions, in doc order: APIs (§1), service account + IAM (§2), the gateway
# container image in Artifact Registry (§3), a Cloud SQL (PostgreSQL) backend
# with PRIVATE IP only (§4), the JWT + postgres-url secrets (§5), the
# gateway.yaml config secret (§6), and a Cloud Run deploy with Direct VPC
# egress (§7b).
#
# Private IP is required because public IP is disallowed by the org-policy constraint
# `constraints/sql.restrictPublicIp`. A Cloud SQL private IP is an address inside a VPC,
# so §4 here also provisions the prerequisite VPC + Private Services Access — the
# one-time, irreducible networking required for private IP.
#
#   Section markers (§N) below map to the walkthrough:
#   https://code.claude.com/docs/en/claude-apps-gateway-on-gcp
#
# Covers here:  APIs (§1) -> service account + IAM (§2) -> build & push image (§3)
#               -> VPC + Private Services Access -> Cloud SQL (private IP only) -> database
#               + user (§4) -> jwt + postgres-url secrets (§5) -> gateway-config
#               secret from gateway.yaml (§6) -> Cloud Run deploy (§7b).
# Not covered:  GKE track (§7a) — Cloud Run is the lower-friction path here.
#
# Idempotent: existing resources are detected and skipped, so it is safe to re-run.
# Override any default below via environment variable, e.g. `REGION=us-east5 ./setup.sh`.

set -euo pipefail

# ---- configuration (env-overridable) ----------------------------------------
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-${CLOUDSDK_COMPUTE_REGION:-us-east5}}"   # guide §1 uses us-east5 (Agent Platform model region)

SA_NAME="${SA_NAME:-claude-gateway}"                       # §2 service account
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# §3 image
AR_REPO="${AR_REPO:-claude-gateway}"                       # Artifact Registry repository
IMAGE_NAME="${IMAGE_NAME:-gateway}"
RELEASES_URL="${RELEASES_URL:-https://downloads.claude.ai/claude-code-releases}"   # public Claude Code release endpoint
VERSION="${VERSION:-}"                                     # Claude Code release to deploy; empty = latest release (resolved below)
VERSION_FILE="${VERSION_FILE:-./.claude-version}"          # pins the resolved release across re-runs; delete it (or set VERSION) to upgrade
DOCKERFILE="${DOCKERFILE:-./Dockerfile}"
CLAUDE_BINARY="${CLAUDE_BINARY:-./claude}"                 # linux-x64 Claude Code binary; downloaded from RELEASES_URL if missing
CLAUDE_SHA256="${CLAUDE_SHA256:-}"                         # optional: out-of-band sha256 pin for the downloaded binary, checked in addition to the release manifest

VPC_NETWORK="${VPC_NETWORK:-cc-gateway-vpc}"
SUBNET="${SUBNET:-cc-gateway-subnet}"
SUBNET_RANGE="${SUBNET_RANGE:-10.0.0.0/24}"

PSA_RANGE_NAME="${PSA_RANGE_NAME:-google-managed-services-${VPC_NETWORK}}"
PSA_PREFIX_LENGTH="${PSA_PREFIX_LENGTH:-16}"               # /16 is GCP's recommendation; reserved, not consumed

DB_INSTANCE="${DB_INSTANCE:-claude-gateway-db}"
DB_VERSION="${DB_VERSION:-POSTGRES_16}"   # PG14+ supported; 16 is the recommended default (§4)
DB_TIER="${DB_TIER:-db-g1-small}"
DB_NAME="${DB_NAME:-claude_gateway}"
DB_USER="${DB_USER:-gateway}"

SECRET_NAME="${SECRET_NAME:-gateway-postgres-url}"         # §5 store.postgres_url
JWT_SECRET_NAME="${JWT_SECRET_NAME:-gateway-jwt-secret}"   # §5 session.jwt_secret

GATEWAY_YAML="${GATEWAY_YAML:-./gateway.yaml}"             # §6 config file
CONFIG_SECRET="${CONFIG_SECRET:-gateway-config}"           # §6 mounted at /etc/claude/gateway.yaml

# §7 Cloud Run deploy
SERVICE_NAME="${SERVICE_NAME:-claude-gateway}"
OIDC_SECRET_NAME="${OIDC_SECRET_NAME:-gateway-oidc-client-secret}"   # operator-created (Google OAuth client)
DEPLOY="${DEPLOY:-1}"                                      # set DEPLOY=0 to provision only, no Cloud Run deploy
INGRESS="${INGRESS:-internal}"                             # internal (default; no public URL) | internal-and-cloud-load-balancing (only if you front it with your own internal ALB)
MAX_INSTANCES="${MAX_INSTANCES:-8}"                        # keep MAX_INSTANCES × store.max_connections (default 5) below the DB tier's max_connections (~50 on db-g1-small); raise the tier before raising this

# ---- helpers ----------------------------------------------------------------
log()  { printf '\n==> %s\n' "$*"; }
skip() { printf '    (exists) %s\n' "$*"; }
curl_https() { curl --proto '=https' --proto-redir '=https' --tlsv1.2 "$@"; }  # refuse plaintext/protocol-downgrade
sha_of() { openssl dgst -sha256 "$1" | awk '{print $NF}'; }  # openssl avoids shasum/sha256sum portability gaps

if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROJECT_ID is not set and no gcloud default project is configured." >&2
  echo "       Set it with: export PROJECT_ID=<your-project>   (or 'gcloud config set project ...')" >&2
  exit 1
fi
# VERSION tags the image and selects the public Claude Code release to download.
# The first resolved value is pinned to ${VERSION_FILE} so the documented
# re-runs (fill gateway.yaml -> re-run; set public_url -> re-run) don't silently
# build and deploy a newer release mid-bootstrap.
if [[ -z "${VERSION}" && -f "${VERSION_FILE}" ]]; then
  VERSION="$(< "${VERSION_FILE}")"
  log "Using release pinned in ${VERSION_FILE}: ${VERSION}   (delete the file or set VERSION to change it)"
elif [[ -z "${VERSION}" ]]; then
  # /latest is the channel the official installer (claude.ai/install.sh) uses.
  VERSION="$(curl_https -fsSL "${RELEASES_URL}/latest" | tr -d '[:space:]' || true)"
  if [[ -z "${VERSION}" ]]; then
    echo "ERROR: could not resolve the latest release from ${RELEASES_URL}/latest." >&2
    echo "       Set VERSION to a Claude Code release version, e.g. export VERSION=2.1.195" >&2
    exit 1
  fi
  log "VERSION not set — using latest Claude Code release: ${VERSION}"
fi
# Reject non-version content (e.g. an HTML error page served with HTTP 200)
# before it reaches the image tag and download URLs.
if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "ERROR: '${VERSION}' is not a release version (from VERSION, ${VERSION_FILE}, or ${RELEASES_URL}/latest)." >&2
  exit 1
fi
printf '%s' "${VERSION}" > "${VERSION_FILE}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}:${VERSION}"
# Claude Code only connects to a gateway whose hostname resolves to private
# addresses (a client-side /login check), so public ingress can never serve
# clients — mirror the terraform module's validation and refuse it up front.
if [[ "${INGRESS}" != "internal" && "${INGRESS}" != "internal-and-cloud-load-balancing" ]]; then
  echo "ERROR: INGRESS must be 'internal' or 'internal-and-cloud-load-balancing' — Claude Code's" >&2
  echo "       /login only accepts gateway hosts on private addresses, so public ingress cannot serve clients." >&2
  exit 1
fi

log "Project: ${PROJECT_ID}   Region: ${REGION}   VPC: ${VPC_NETWORK}"

# ---- 1 Project & API setup ------------------------------------------------
# walkthrough §1 list (aiplatform, artifactregistry, sqladmin, secretmanager, iamcredentials)
# plus iam/compute/servicenetworking required for the SA + private-IP networking below.
# container.googleapis.com is for the GKE track (§7a) — harmless if you stay on Cloud Run.
# We pass --project on every call rather than mutating your gcloud config.
log "Enabling required APIs (§1)"
gcloud services enable \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  iam.googleapis.com \
  compute.googleapis.com \
  container.googleapis.com \
  servicenetworking.googleapis.com \
  run.googleapis.com \
  --project="${PROJECT_ID}"

# ---- 2 Service account & IAM ----------------------------------------------
log "Creating service account ${SA_EMAIL} and granting project roles (§2)"
if gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  skip "service account ${SA_EMAIL}"
else
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="Claude Gateway" --project="${PROJECT_ID}"
fi

# add-iam-policy-binding is idempotent (re-adding an existing binding is a no-op).
# --condition=None avoids the interactive condition prompt in non-interactive runs.
#
# Only aiplatform.user is granted: the gateway reaches Cloud SQL over the VPC at
# its PRIVATE IP with a password user (§4/§7b — direct TCP, not the Cloud SQL
# Auth Proxy / connector), so it never calls cloudsql.instances.connect and no
# roles/cloudsql.client grant is needed. Direct private-IP is used because the
# gateway's store is a plain postgres_url — no proxy sidecar/socket plumbing,
# one less moving part, and the connection string is portable across Cloud Run
# and GKE.
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user" --condition=None >/dev/null    # Agent Platform inference (§2)

# ---- 3 Build & push image to Artifact Registry ----------------------------
log "Ensuring Artifact Registry repo and image (§3)"
if gcloud artifacts repositories describe "${AR_REPO}" \
     --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  skip "Artifact Registry repo ${AR_REPO}"
else
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker --location="${REGION}" --project="${PROJECT_ID}"
fi

# Image is the expensive, already-done step: skip the build+push entirely if the
# tag already exists in the registry.
if gcloud artifacts docker images describe "${IMAGE}" >/dev/null 2>&1; then
  skip "image ${IMAGE}"
else
  # The public Claude Code release includes the gateway subcommand, so the
  # binary comes straight from the release endpoint, verified against the
  # release manifest's sha256. A pre-existing ${CLAUDE_BINARY} (stale version,
  # interrupted download, hand-placed file) is verified the same way and
  # re-downloaded on mismatch, so an unverified binary can never reach the image.
  manifest="$(curl_https -fsSL "${RELEASES_URL}/${VERSION}/manifest.json" | tr -d '[:space:]' || true)"
  sha_re='"linux-x64"[^}]*"checksum":"([a-f0-9]{64})"'  # structure-based: survives pretty-printed, minified, and one-line-per-platform manifests
  if [[ ! "${manifest}" =~ ${sha_re} ]]; then
    echo "ERROR: could not read the linux-x64 sha256 from ${RELEASES_URL}/${VERSION}/manifest.json — refusing to build." >&2
    exit 1
  fi
  expected_sha="${BASH_REMATCH[1]}"
  if [[ -f "${CLAUDE_BINARY}" && "$(sha_of "${CLAUDE_BINARY}")" == "${expected_sha}" ]]; then
    skip "binary ${CLAUDE_BINARY} (sha256 matches release ${VERSION})"
  else
    if [[ -f "${CLAUDE_BINARY}" ]]; then
      log "Existing ${CLAUDE_BINARY} does not match release ${VERSION} — re-downloading"
    else
      log "Downloading Claude Code ${VERSION} (linux-x64) from ${RELEASES_URL}"
    fi
    # Until verification passes, ANY exit (curl failure, set -e, signal, the
    # error exit below) removes the file, so a partial download can't be
    # silently picked up by a later run.
    trap 'rm -f "${CLAUDE_BINARY}"' EXIT INT TERM
    curl_https -fL -o "${CLAUDE_BINARY}" "${RELEASES_URL}/${VERSION}/linux-x64/claude"
    actual_sha="$(sha_of "${CLAUDE_BINARY}")"
    if [[ "${actual_sha}" != "${expected_sha}" ]]; then
      echo "ERROR: sha256 of ${CLAUDE_BINARY} is ${actual_sha} but the release manifest says ${expected_sha} — refusing to build." >&2
      exit 1
    fi
    trap - EXIT INT TERM
    log "Verified binary sha256 ${actual_sha}"
  fi
  # Optional out-of-band pin, checked even for a pre-existing binary: the
  # manifest shares an origin with the binary, so it can't defend against a
  # compromised endpoint — CLAUDE_SHA256 can.
  if [[ -n "${CLAUDE_SHA256}" && "$(sha_of "${CLAUDE_BINARY}")" != "${CLAUDE_SHA256}" ]]; then
    echo "ERROR: sha256 of ${CLAUDE_BINARY} does not match CLAUDE_SHA256 (${CLAUDE_SHA256}) — refusing to build." >&2
    exit 1
  fi
  chmod +x "${CLAUDE_BINARY}"
  log "Building and pushing ${IMAGE}"
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
  # Cloud Run requires linux/amd64. --platform forces it (e.g. when building on an
  # Apple Silicon Mac), and --provenance=false keeps buildx from wrapping the result
  # in an OCI image index that Cloud Run rejects ("manifest ... must support amd64/linux").
  docker build --platform=linux/amd64 --provenance=false \
    -f "${DOCKERFILE}" --build-arg CLAUDE_BINARY="${CLAUDE_BINARY}" -t "${IMAGE}" .
  docker push "${IMAGE}"
fi

# ---- 4 VPC + Private Services Access (private-IP prerequisite) -------------
log "Creating VPC network and subnet"
if gcloud compute networks describe "${VPC_NETWORK}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  skip "network ${VPC_NETWORK}"
else
  gcloud compute networks create "${VPC_NETWORK}" \
    --subnet-mode=custom --project="${PROJECT_ID}"
fi

if gcloud compute networks subnets describe "${SUBNET}" \
     --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  skip "subnet ${SUBNET}"
else
  gcloud compute networks subnets create "${SUBNET}" \
    --network="${VPC_NETWORK}" --region="${REGION}" \
    --range="${SUBNET_RANGE}" --project="${PROJECT_ID}"
fi

log "Configuring Private Services Access (allocated range + VPC peering)"
if gcloud compute addresses describe "${PSA_RANGE_NAME}" \
     --global --project="${PROJECT_ID}" >/dev/null 2>&1; then
  skip "allocated range ${PSA_RANGE_NAME}"
else
  gcloud compute addresses create "${PSA_RANGE_NAME}" \
    --global --purpose=VPC_PEERING --prefix-length="${PSA_PREFIX_LENGTH}" \
    --network="${VPC_NETWORK}" --project="${PROJECT_ID}"
fi

if gcloud services vpc-peerings list --network="${VPC_NETWORK}" --project="${PROJECT_ID}" \
     --format='value(peering)' 2>/dev/null | grep -q servicenetworking; then
  skip "servicenetworking VPC peering"
else
  gcloud services vpc-peerings connect \
    --service=servicenetworking.googleapis.com \
    --ranges="${PSA_RANGE_NAME}" \
    --network="${VPC_NETWORK}" --project="${PROJECT_ID}"
fi

# ---- 4 Cloud SQL instance (private IP only) -------------------------------
log "Creating Cloud SQL instance ${DB_INSTANCE} (private IP only)"
if gcloud sql instances describe "${DB_INSTANCE}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  skip "instance ${DB_INSTANCE}"
else
  gcloud sql instances create "${DB_INSTANCE}" \
    --database-version="${DB_VERSION}" \
    --tier="${DB_TIER}" \
    --region="${REGION}" \
    --network="projects/${PROJECT_ID}/global/networks/${VPC_NETWORK}" \
    --no-assign-ip \
    --project="${PROJECT_ID}"
fi

log "Creating database ${DB_NAME}"
if gcloud sql databases describe "${DB_NAME}" \
     --instance="${DB_INSTANCE}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  skip "database ${DB_NAME}"
else
  gcloud sql databases create "${DB_NAME}" \
    --instance="${DB_INSTANCE}" --project="${PROJECT_ID}"
fi

# hex (not base64) keeps the password URL-safe for the connection string below.
log "Creating database user ${DB_USER}"
DB_PASSWORD=""
if gcloud sql users list --instance="${DB_INSTANCE}" --project="${PROJECT_ID}" \
     --format='value(name)' 2>/dev/null | grep -qx "${DB_USER}"; then
  if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    skip "user ${DB_USER} (password unchanged; secret not rewritten)"
  else
    # Self-heal: a previous run died after creating the user but before writing
    # the connection-string secret, losing the only copy of the password. The
    # secret is the password's only consumer, so resetting it is safe and keeps
    # re-runs able to recover from any partial state.
    log "User ${DB_USER} exists but secret ${SECRET_NAME} is missing — resetting password"
    DB_PASSWORD="$(openssl rand -hex 24)"
    gcloud sql users set-password "${DB_USER}" \
      --instance="${DB_INSTANCE}" --password="${DB_PASSWORD}" \
      --project="${PROJECT_ID}"
  fi
else
  DB_PASSWORD="$(openssl rand -hex 24)"
  gcloud sql users create "${DB_USER}" \
    --instance="${DB_INSTANCE}" --password="${DB_PASSWORD}" \
    --project="${PROJECT_ID}"
fi

# ---- 5 Connection string -> Secret Manager + secretAccessor ---------------
PRIVATE_IP="$(gcloud sql instances describe "${DB_INSTANCE}" --project="${PROJECT_ID}" \
  --format='value(ipAddresses[0].ipAddress)')"

if [[ -n "${DB_PASSWORD}" ]]; then
  # direct private-IP form, ?sslmode=require (guide §4)
  CONN="postgres://${DB_USER}:${DB_PASSWORD}@${PRIVATE_IP}:5432/${DB_NAME}?sslmode=require"
  log "Storing connection string in Secret Manager secret ${SECRET_NAME}"
  if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    printf '%s' "${CONN}" | gcloud secrets versions add "${SECRET_NAME}" \
      --data-file=- --project="${PROJECT_ID}"
  else
    printf '%s' "${CONN}" | gcloud secrets create "${SECRET_NAME}" \
      --replication-policy=automatic --data-file=- --project="${PROJECT_ID}"
  fi
else
  log "Skipping secret write (user already existed, password not available this run)"
fi

if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  log "Granting ${SA_EMAIL} secretAccessor on ${SECRET_NAME}"
  gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None --project="${PROJECT_ID}" >/dev/null
fi

# JWT signing secret — generated once (re-runs do NOT rotate it).
log "Ensuring JWT signing secret ${JWT_SECRET_NAME} (§5)"
if gcloud secrets describe "${JWT_SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  skip "secret ${JWT_SECRET_NAME}"
else
  openssl rand -base64 32 | tr -d '\n' | gcloud secrets create "${JWT_SECRET_NAME}" \
    --replication-policy=automatic --data-file=- --project="${PROJECT_ID}"
fi
gcloud secrets add-iam-policy-binding "${JWT_SECRET_NAME}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None --project="${PROJECT_ID}" >/dev/null

# OIDC client secret — operator-created (the script can't generate it). Grant
# accessor here once it exists so the deploy step doesn't fail on permission.
if gcloud secrets describe "${OIDC_SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  log "Granting ${SA_EMAIL} secretAccessor on ${OIDC_SECRET_NAME}"
  gcloud secrets add-iam-policy-binding "${OIDC_SECRET_NAME}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None --project="${PROJECT_ID}" >/dev/null
fi

# ---- 6 gateway.yaml -> Secret Manager (gateway-config) --------------------
# Published only when fully filled in: refuse to push a config that still has
# REPLACE_ME placeholders (checked on non-comment lines so commented examples
# and this file's header don't trip the guard).
log "Publishing ${GATEWAY_YAML} as Secret Manager secret ${CONFIG_SECRET} (§6)"
if [[ ! -f "${GATEWAY_YAML}" ]]; then
  echo "    (skip) ${GATEWAY_YAML} not found — run 'cp gateway.yaml.example gateway.yaml', fill it in, then re-run (§6)."
elif grep -vE '^[[:space:]]*#' "${GATEWAY_YAML}" | grep -q 'REPLACE_ME'; then
  echo "    (skip) ${GATEWAY_YAML} still has REPLACE_ME placeholders to fill:"
  grep -nE 'REPLACE_ME' "${GATEWAY_YAML}" | grep -vE '^[0-9]+:[[:space:]]*#' | sed 's/^/        /'
  echo "        Fill them in, then re-run to publish ${CONFIG_SECRET}."
else
  if gcloud secrets describe "${CONFIG_SECRET}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud secrets versions add "${CONFIG_SECRET}" \
      --data-file="${GATEWAY_YAML}" --project="${PROJECT_ID}"
  else
    gcloud secrets create "${CONFIG_SECRET}" --replication-policy=automatic \
      --data-file="${GATEWAY_YAML}" --project="${PROJECT_ID}"
  fi
  gcloud secrets add-iam-policy-binding "${CONFIG_SECRET}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None --project="${PROJECT_ID}" >/dev/null
fi

# ---- 7 Cloud Run deploy (Direct VPC egress) -------------------------------
# Direct VPC egress (--network/--subnet/--vpc-egress) puts the service on the
# VPC so it reaches the Cloud SQL PRIVATE IP directly — matching the private-IP
# connection string in the postgres-url secret. private-ranges-only keeps public
# egress (Agent Platform, accounts.google.com) off the VPC, so no Cloud NAT is needed.
# We deliberately do NOT use --add-cloudsql-instances (that's the Auth Proxy /
# socket path, which would need a different connection string).
#
# Secrets: gateway.yaml is mounted as a FILE at /etc/claude (alone in its dir).
# The JWT / OIDC / Postgres secrets are injected as ENV VARS — Cloud Run cannot
# mount multiple secrets into one directory, and gateway.yaml references them via
# ${ENV_VAR}. (See the env-var names in gateway.yaml: GATEWAY_JWT_SECRET etc.)
#
# Self-gating: deploy only once its inputs exist (config secret published + the
# operator-provided OIDC client secret). On a first run these are missing and it
# cleanly skips.
RUN_URL=""
missing=""
gcloud secrets describe "${CONFIG_SECRET}" --project="${PROJECT_ID}" >/dev/null 2>&1 || missing="${missing} ${CONFIG_SECRET}"
gcloud secrets describe "${OIDC_SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1 || missing="${missing} ${OIDC_SECRET_NAME}"
# Also gate on the postgres-url secret (referenced by --set-secrets below): if it
# is somehow absent, skip with a clear message rather than failing the deploy with
# a raw Cloud Run missing-secret error.
gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1 || missing="${missing} ${SECRET_NAME}"

if [[ "${DEPLOY}" != "1" ]]; then
  log "Skipping Cloud Run deploy (DEPLOY=${DEPLOY}) (§7)"
elif [[ -n "${missing// }" ]]; then
  log "Skipping Cloud Run deploy — missing secret(s):${missing} (§7)"
  echo "        Fill ${GATEWAY_YAML} and re-run to publish ${CONFIG_SECRET}; create ${OIDC_SECRET_NAME}"
  echo "        from the Google OAuth client. Then re-run to deploy."
else
  SECRET_MOUNTS="/etc/claude/gateway.yaml=${CONFIG_SECRET}:latest"          # file mount (alone in /etc/claude)
  SECRET_MOUNTS="${SECRET_MOUNTS},GATEWAY_JWT_SECRET=${JWT_SECRET_NAME}:latest"        # env var
  SECRET_MOUNTS="${SECRET_MOUNTS},OIDC_CLIENT_SECRET=${OIDC_SECRET_NAME}:latest"       # env var
  SECRET_MOUNTS="${SECRET_MOUNTS},GATEWAY_POSTGRES_URL=${SECRET_NAME}:latest"          # env var

  log "Deploying Cloud Run service ${SERVICE_NAME} (§7b, Direct VPC egress)"
  # Deploy private (--no-allow-unauthenticated avoids the interactive prompt and
  # keeps allUsers OUT of the deploy, so a Domain-Restricted-Sharing org doesn't
  # fail the deploy on the IAM step). Public access is attempted separately below.
  #
  # --ingress is passed EXPLICITLY because it is sticky across redeploys (omitting
  # it keeps the previous value). The default, internal, keeps the *.run.app URL
  # off the public internet — reachable only from this VPC, or from corp networks
  # with the PSC endpoint + private run.app DNS plumbing (see terraform/README.md
  # "Private access"). Public ingress cannot serve clients (see the INGRESS
  # guard at the top of this script), so the two-pass OAuth bootstrap has to be
  # completed from inside the VPC (or a PSC-connected corp network). Use
  # internal-and-cloud-load-balancing instead if you front the service with
  # your own internal ALB.
  #
  # --timeout=3600 raises Cloud Run's default 300s request timeout, which would
  # otherwise cut off long streaming /v1/messages responses mid-stream.
  #
  # --max-instances bounds the Postgres connection footprint: each instance
  # opens a pool of up to 5 connections (store.max_connections default) and
  # db-g1-small caps at ~50 max_connections, so the default ceiling of 100
  # instances would crash-loop new instances under load. Keep
  # max-instances × 5 below the DB tier's max_connections; raise the DB tier
  # (or set store.max_connections lower) before raising this.
  gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE}" \
    --region="${REGION}" \
    --service-account="${SA_EMAIL}" \
    --min-instances=1 \
    --max-instances="${MAX_INSTANCES}" \
    --port=8080 \
    --timeout=3600 \
    --ingress="${INGRESS}" \
    --network="${VPC_NETWORK}" \
    --subnet="${SUBNET}" \
    --vpc-egress=private-ranges-only \
    --set-secrets="${SECRET_MOUNTS}" \
    --no-allow-unauthenticated \
    --project="${PROJECT_ID}"

  # The gateway runs its OWN OIDC, so the Cloud Run IAM layer must allow
  # unauthenticated. Attempt it separately and tolerate failure: Domain Restricted
  # Sharing (iam.allowedPolicyMemberDomains) blocks allUsers in hardened orgs.
  log "Granting public invoker (allUsers) — required for the gateway's OIDC login"
  if gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
       --region="${REGION}" --member=allUsers --role=roles/run.invoker \
       --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo "        public invoker granted."
  else
    echo "        WARN: allUsers rejected (likely Domain Restricted Sharing). The service is"
    echo "              deployed but the invoker IAM check is still enabled, so requests 403"
    echo "              before reaching the container. Preferred fix (where available):"
    echo "                gcloud run services update ${SERVICE_NAME} --no-invoker-iam-check \\"
    echo "                  --region=${REGION} --project=${PROJECT_ID}"
    echo "              Alternatively: request a DRS exception for ${SERVICE_NAME}, or use the GKE"
    echo "              track, which exposes the gateway at the network layer with no allUsers"
    echo "              binding. An LB is NOT a fix — it does not bypass the invoker IAM check."
  fi

  RUN_URL="$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" \
    --project="${PROJECT_ID}" --format='value(status.url)')"
  log "Cloud Run URL: ${RUN_URL}"

  # public_url is now required (config validation refuses a non-loopback bind
  # without it), so the template ships a placeholder for the first pass. Once we
  # know the real URL, warn on any mismatch so the operator doesn't leave the
  # placeholder — or a stale hostname — in place. Normalize quotes / inline
  # comments / a trailing slash so schema-equivalent spellings compare equal.
  # Only checked with internal ingress, where public_url should be the run.app
  # URL; behind an internal ALB it is the ALB hostname, which this script
  # cannot know.
  CFG_PUBLIC_URL="$(grep -E '^[[:space:]]*public_url:' "${GATEWAY_YAML}" 2>/dev/null \
    | head -1 \
    | sed -E 's/^[[:space:]]*public_url:[[:space:]]*//; s/[[:space:]]+#.*$//; s/[[:space:]]*$//' \
    || true)"
  CFG_PUBLIC_URL="${CFG_PUBLIC_URL#[\'\"]}"; CFG_PUBLIC_URL="${CFG_PUBLIC_URL%[\'\"]}"
  CFG_PUBLIC_URL="${CFG_PUBLIC_URL%/}"
  if [[ "${INGRESS}" == "internal" && -n "${RUN_URL}" && "${CFG_PUBLIC_URL}" != "${RUN_URL%/}" ]]; then
    echo "        NOTE — ${GATEWAY_YAML} has public_url: ${CFG_PUBLIC_URL:-<unset>}"
    echo "               but this service's URL is ${RUN_URL}."
    echo "               Set listen.public_url to ${RUN_URL} (or your LB hostname) and re-run."
  fi

  if [[ -n "${RUN_URL}" ]]; then
    # gcloud run deploy already fails the script if the revision can't boot (it
    # waits for the Ready condition), so what's left to verify is that the
    # gateway is serving. The OAuth discovery document below returns 200 only
    # after config load, OIDC discovery, upstream construction, and Postgres
    # migration all succeed, so it doubles as an end-to-end boot check (the
    # readiness probe proper is GET /readyz). With internal ingress the URL is
    # reachable only from inside the VPC (or a PSC-connected corp network), so
    # verification is left to the operator rather than attempted from here.
    log "Verify the gateway is serving (from inside the VPC, or a PSC-connected corp network):"
    echo "          curl -s ${RUN_URL}/.well-known/oauth-authorization-server"
    echo "        If it isn't responding yet, check logs:"
    echo "          gcloud run services logs read ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID}"

    log "Finish the OAuth bootstrap:"
    echo "        1. Register this redirect URI on the Google OAuth client: ${RUN_URL}/oauth/callback"
    echo "        2. Set listen.public_url in ${GATEWAY_YAML} to ${RUN_URL}, then re-run: INGRESS=${INGRESS} ./setup.sh"
    echo "           (republishes ${CONFIG_SECRET} and redeploys so the IdP redirect_uri matches)."
    echo "           With INGRESS=internal-and-cloud-load-balancing, use your internal ALB hostname"
    echo "           instead of the run.app URL in both steps."
  fi
fi

# ---- summary ----------------------------------------------------------------
cat <<EOF

==> Done.

  Service account       ${SA_EMAIL}
                        roles: aiplatform.user, secretmanager.secretAccessor
  Image                 ${IMAGE}
  Instance              ${DB_INSTANCE}
  Connection name       ${PROJECT_ID}:${REGION}:${DB_INSTANCE}
  Private IP            ${PRIVATE_IP}
  Database / user       ${DB_NAME} / ${DB_USER}
  Secrets               ${SECRET_NAME}, ${JWT_SECRET_NAME}, ${CONFIG_SECRET}
  Cloud Run service     ${SERVICE_NAME} -> ${RUN_URL:-(not deployed yet)}   (ingress: ${INGRESS})

Next steps (see https://code.claude.com/docs/en/claude-apps-gateway-on-gcp):
  - Create the one operator-provided secret (from the Google Cloud Console OAuth client):
      printf '%s' "<client-secret>" | gcloud secrets create ${OIDC_SECRET_NAME} \\
        --data-file=- --project="${PROJECT_ID}"
    setup.sh grants ${SA_EMAIL} secretAccessor on it on the next re-run.
  - Fill in the REPLACE_ME values in ${GATEWAY_YAML}, then re-run: setup.sh publishes
    ${CONFIG_SECRET} and deploys ${SERVICE_NAME} once both secrets exist.
  - After the first deploy: set listen.public_url to the Cloud Run URL above (or your
    internal ALB hostname) and register <url>/oauth/callback on the Google OAuth client,
    then re-run to redeploy.
  - The gateway runs its own schema migrations at boot, so ${DB_USER} needs CREATE TABLE.
EOF
