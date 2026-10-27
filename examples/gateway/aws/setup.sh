#!/usr/bin/env bash
#
# setup.sh — AWS setup for Claude apps gateway (walkthrough §1–7, ECS track).
#
# Provisions, in this order: the three security groups (§1), the task +
# execution IAM roles (§2), the gateway container image in Amazon ECR (§6),
# an RDS for PostgreSQL instance in the private subnets with no public
# address (§3), the JWT + postgres-url secrets (§5), and an ECS Fargate
# service behind an internal Application Load Balancer (§7).
#
# gateway.yaml (§4 of the walkthrough) is BAKED INTO THE IMAGE on this track —
# the task definition injects only the secrets it references, as env vars — so
# the config step here lives inside the image build (§6): the build is gated on
# a fully filled-in gateway.yaml and the image tag carries a hash of it, so a
# config edit triggers a rebuild on the next run.
#
#   Section markers (§N) below map to the walkthrough:
#   https://code.claude.com/docs/en/claude-apps-gateway-on-aws
#
# Covers here:  security groups (§1) -> IAM roles + Bedrock model-access note (§2)
#               -> build & push image, config baked in (§6 + §4) -> DB subnet group
#               + RDS instance (§3) -> jwt + postgres-url secrets (§5) -> ECS
#               cluster/task definition/service + internal ALB (§7, ECS Fargate tab).
# Not covered:  EKS track (§7's EKS tab) — ECS Fargate is the lower-friction path here.
#               Bedrock model access (§2) — console-only; the script reminds you.
#               Route 53 alias — see the next steps it prints. Client MDM
#               push (§8) is covered by the walkthrough, not this script.
#
# Idempotent: existing resources are detected and skipped, so it is safe to re-run.
# Reuse is by NAME, so a pre-existing resource may not match what this script
# would have created: reuse that would change the exposure model is fatal (an
# ALB that is not internal/in ${VPC_ID}); upsert-able settings are converged on
# every run; other posture drift (extra security group ingress, a public or
# unencrypted RDS instance, wrong-VPC target group) is checked and warned
# about, never silently adopted.
# Override any default below via environment variable, e.g. `AWS_REGION=us-west-2 ./setup.sh`.

set -euo pipefail

# ---- configuration (env-overridable) ----------------------------------------
AWS_REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"   # guide uses us-east-1 (a region where Bedrock serves the Claude models you need)
ACCOUNT_ID="${ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)}"

VPC_ID="${VPC_ID:-}"                                       # REQUIRED — the VPC from the prerequisites
PRIVATE_SUBNETS="${PRIVATE_SUBNETS:-}"                     # REQUIRED — two+ private subnet IDs in different AZs, space-separated
CORP_CIDR="${CORP_CIDR:-}"                                 # REQUIRED — your corporate network CIDR (ALB :443 ingress source)
                                                           # Must not overlap PRIVATE_SUBNETS: hosts there are trusted_proxies (gateway.yaml) and could spoof client IPs via X-Forwarded-For.

# §1 security groups
ALB_SG_NAME="${ALB_SG_NAME:-claude-gateway-alb}"
GW_SG_NAME="${GW_SG_NAME:-claude-gateway-svc}"
DB_SG_NAME="${DB_SG_NAME:-claude-gateway-db}"

# §2 IAM roles (task role = the gateway's runtime AWS identity; execution role
# = the ECS agent's identity for pulling the image and injecting secrets)
TASK_ROLE="${TASK_ROLE:-claude-gateway-task}"
EXEC_ROLE="${EXEC_ROLE:-claude-gateway-execution}"

# §6 image
ECR_REPO="${ECR_REPO:-claude-gateway}"                     # ECR repository name
VERSION="${VERSION:-}"                                     # REQUIRED — the gateway release tag you build and push (e.g. the linux-x64 binary's version)
DOCKERFILE="${DOCKERFILE:-./Dockerfile}"
CLAUDE_BINARY="${CLAUDE_BINARY:-./claude}"                 # prebuilt linux-x64 Claude Code release binary (includes the gateway subcommand)
DIST_URL="${DIST_URL:-}"                                   # optional: download URL, used only if $CLAUDE_BINARY is missing
DIST_SHA256="${DIST_SHA256:-}"                             # REQUIRED with DIST_URL: expected sha256 of the binary (verified fail-closed)
DIST_SHA256="${DIST_SHA256,,}"                                # normalize to lowercase — openssl emits lowercase hex; some tools (PowerShell Get-FileHash) publish uppercase
# Obtain DIST_SHA256 out-of-band — never from the server that serves DIST_URL.
# For binaries from the standard Claude Code release channel, verify the
# release's GPG-signed manifest.json and copy the platform checksum from it:
# https://code.claude.com/docs/en/setup#binary-integrity-and-code-signing
# For any other distribution channel, use the checksum published alongside the
# download link on that channel.
GATEWAY_YAML="${GATEWAY_YAML:-./gateway.yaml}"             # §4 config file — BAKED into the image
RDS_CA_BUNDLE="${RDS_CA_BUNDLE:-./rds-global-bundle.pem}"  # RDS CA trust anchor — BAKED into the image (downloaded below if missing)
# Official AWS RDS truststore. AWS rotates this bundle (new regional CAs get
# appended), so no checksum is pinned — a pinned hash would break on every
# rotation. The script downloads it only when absent (an existing file is never
# re-downloaded); to pick up a rotation, delete the file — and since the image
# tag hashes only gateway.yaml, also bump VERSION or set IMAGE_TAG so the
# next run rebuilds rather than reusing the existing tag. Operators who want
# to pin may pre-place a reviewed copy at ${RDS_CA_BUNDLE}.
RDS_CA_BUNDLE_URL="${RDS_CA_BUNDLE_URL:-https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem}"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# §3 RDS
DB_SUBNET_GROUP="${DB_SUBNET_GROUP:-claude-gateway-db}"
DB_PARAM_GROUP="${DB_PARAM_GROUP:-claude-gateway-db}"      # carries rds.force_ssl=1 (server-side TLS enforcement)
DB_INSTANCE="${DB_INSTANCE:-claude-gateway-db}"
DB_CLASS="${DB_CLASS:-db.t4g.micro}"
DB_STORAGE_GB="${DB_STORAGE_GB:-20}"
DB_NAME="${DB_NAME:-claude_gateway}"
DB_USER="${DB_USER:-gateway}"
# PG14+ supported; 16 is the recommended default (matches terraform/'s).
# Always pinned: the instance's engine version and the parameter group's
# family must name the same major, so both derive from this one value.
DB_ENGINE_VERSION="${DB_ENGINE_VERSION:-16}"

SECRET_NAME="${SECRET_NAME:-gateway-postgres-url}"         # §5 store.postgres_url
JWT_SECRET_NAME="${JWT_SECRET_NAME:-gateway-jwt-secret}"   # §5 session.jwt_secret
OIDC_SECRET_NAME="${OIDC_SECRET_NAME:-gateway-oidc-client-secret}"   # operator-created (Okta OIDC web app)
# NOTE: the execution role's secrets-read policy (§2) is built from these
# three names, one per-secret ARN prefix each — a rename is picked up on the
# next run (put-role-policy is an upsert).

# §7 ECS + internal ALB deploy
CLUSTER="${CLUSTER:-claude-gateway}"
SERVICE="${SERVICE:-claude-gateway}"
TASK_FAMILY="${TASK_FAMILY:-claude-gateway}"
LOG_GROUP="${LOG_GROUP:-/ecs/claude-gateway}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-90}"             # CloudWatch retention — the group carries the gateway's audit events, so align with your audit retention policy
ALB_NAME="${ALB_NAME:-claude-gateway}"
TG_NAME="${TG_NAME:-claude-gateway}"
# Explicit modern TLS policy — omitting it falls back to the legacy
# ELBSecurityPolicy-2016-08 default, which still accepts TLS 1.0/1.1.
ALB_SSL_POLICY="${ALB_SSL_POLICY:-ELBSecurityPolicy-TLS13-1-2-2021-06}"
ACM_CERT_ARN="${ACM_CERT_ARN:-}"                           # REQUIRED for deploy — ACM cert for your internal gateway hostname
TASK_CPU="${TASK_CPU:-1024}"
TASK_MEMORY="${TASK_MEMORY:-2048}"
DESIRED_COUNT="${DESIRED_COUNT:-1}"                        # each task opens a Postgres pool of up to 5 connections (store.max_connections default); keep DESIRED_COUNT × 5 below the DB class's max_connections (~80 on db.t4g.micro)
DEPLOY="${DEPLOY:-1}"                                      # set DEPLOY=0 to provision only, no ECS/ALB deploy

# ---- helpers ----------------------------------------------------------------
log()  { printf '\n==> %s\n' "$*"; }
skip() { printf '    (exists) %s\n' "$*"; }
curl_https() { curl --proto '=https' --proto-redir '=https' --tlsv1.2 "$@"; }  # refuse plaintext/protocol-downgrade
sha_of() { openssl dgst -sha256 "$1" | awk '{print $NF}'; }  # openssl avoids shasum/sha256sum portability gaps

# authorize-security-group-ingress is NOT idempotent (re-adding a rule errors),
# so tolerate exactly the duplicate-rule error and fail on anything else.
authorize_ingress() {
  local out
  if out="$(aws ec2 authorize-security-group-ingress "$@" 2>&1)"; then
    return 0
  elif grep -q 'InvalidPermission.Duplicate' <<<"${out}"; then
    skip "ingress rule already present"
  else
    printf '%s\n' "${out}" >&2
    return 1
  fi
}

# Security-group lookup by name within the VPC; prints the GroupId or "None".
sg_id() {
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$1" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None
}

# Name-based reuse can adopt a pre-existing group carrying ingress this script
# never added. Audit after the intended rule is ensured: each group's traffic
# path is exactly one rule (tcp <port> from <cidr-or-source-group>), so anything
# else is flagged on stderr. Non-fatal — an extra rule may be a deliberate
# operator addition — but every one widens the path, so it must be visible.
warn_unexpected_ingress() { # <group-id> <group-name> <port> <expected cidr or source group-id>
  local perms
  if ! perms="$(aws ec2 describe-security-groups --group-ids "$1" \
      --query 'SecurityGroups[0].IpPermissions' --output json 2>/dev/null)"; then
    echo "    WARN — could not audit ingress rules on $2 ($1)." >&2
    return 0
  fi
  # `|| echo` keeps a parse hiccup non-fatal — this audit must never abort a run.
  _SG_ID="$1" _SG_NAME="$2" _SG_PORT="$3" _SG_EXPECTED="$4" python3 -c "
import json, os, sys
perms = json.load(sys.stdin) or []
port, expected = int(os.environ[\"_SG_PORT\"]), os.environ[\"_SG_EXPECTED\"]
extras = []
for p in perms:
    proto, lo, hi = p.get(\"IpProtocol\"), p.get(\"FromPort\"), p.get(\"ToPort\")
    scope_ok = proto == \"tcp\" and lo == port and hi == port
    sources = (
        [r.get(\"CidrIp\", \"?\") for r in p.get(\"IpRanges\", [])]
        + [r.get(\"CidrIpv6\", \"?\") for r in p.get(\"Ipv6Ranges\", [])]
        + [r.get(\"GroupId\", \"?\") for r in p.get(\"UserIdGroupPairs\", [])]
        + [r.get(\"PrefixListId\", \"?\") for r in p.get(\"PrefixListIds\", [])]
    )
    extras += [(proto, lo, hi, s) for s in sources if not (scope_ok and s == expected)]
if extras:
    name, gid = os.environ[\"_SG_NAME\"], os.environ[\"_SG_ID\"]
    print(f\"    WARN — security group {name} ({gid}) has ingress beyond the intended rule\", file=sys.stderr)
    print(f\"           (tcp {port} from {expected}) — review it; remove anything you did not add deliberately:\", file=sys.stderr)
    for proto, lo, hi, src in extras:
        scope = \"all traffic\" if proto == \"-1\" else (f\"{proto} {lo}\" if lo == hi else f\"{proto} {lo}-{hi}\")
        print(f\"             {scope} from {src}\", file=sys.stderr)
" <<<"${perms}" || echo "    WARN — could not audit ingress rules on $2 ($1)." >&2
}

secret_arn() {
  aws secretsmanager describe-secret --secret-id "$1" \
    --query ARN --output text 2>/dev/null || true
}

# Existence check that fails closed: 0 = exists, 1 = definitively absent
# (ResourceNotFoundException), anything else ABORTS the run. Gating on a bare
# exit status would let a transient failure (throttle, expired token, network
# blip) masquerade as "secret missing" — and the missing-secret branches below
# do destructive work (the §3 self-heal resets the DB password), so they must
# run only on a definitive not-found.
secret_exists() { # <secret-id>
  local out
  if out="$(aws secretsmanager describe-secret --secret-id "$1" 2>&1 >/dev/null)"; then
    return 0
  elif grep -q 'ResourceNotFoundException' <<<"${out}"; then
    return 1
  else
    echo "ERROR: could not determine whether secret $1 exists (transient AWS error?):" >&2
    printf '%s\n' "${out}" >&2
    echo "       Refusing to guess — re-run once the call succeeds." >&2
    exit 1
  fi
}

# Secret values must never appear on a process argv (argv is world-readable
# via /proc and routinely recorded by EDR/auditd), so every aws call that
# carries one takes it via --cli-input-json file://<0600 temp file> instead —
# explicit flags on the same command line override/merge with the JSON, so
# only the secret parameter needs to live in the file. secret_json writes
# {"<Key>": "<value>"} to a fresh temp file and returns the path in the named
# variable (printf -v, not command substitution — a subshell would lose the
# SECRET_TMP_FILES bookkeeping below): the value crosses into python3 via the
# environment (never argv) and json.dumps escapes it, so any characters
# survive. Callers rm -f the file as soon as the aws call returns; the EXIT
# trap sweeps whatever an aborted run leaves.
SECRET_TMP_FILES=()
cleanup_secret_tmp() { rm -f "${SECRET_TMP_FILES[@]+"${SECRET_TMP_FILES[@]}"}"; }
trap cleanup_secret_tmp EXIT
secret_json() { # secret_json <outvar> <JsonKey> <value>  -> path in <outvar>
  local file
  file="$(mktemp)"    # mktemp creates 0600
  chmod 600 "${file}" # belt and braces if TMPDIR overrides umask semantics
  SECRET_TMP_FILES+=("${file}")
  _JSON_KEY="$2" _JSON_VALUE="$3" python3 -c \
    'import json, os; print(json.dumps({os.environ["_JSON_KEY"]: os.environ["_JSON_VALUE"]}))' \
    > "${file}"
  printf -v "$1" '%s' "${file}"
}

for required in AWS_REGION ACCOUNT_ID VPC_ID PRIVATE_SUBNETS CORP_CIDR VERSION; do
  if [[ -z "${!required}" ]]; then
    echo "ERROR: ${required} is not set." >&2
    case "${required}" in
      AWS_REGION)      echo "       Set it to a region where Bedrock serves the Claude models you need, e.g. export AWS_REGION=us-east-1" >&2 ;;
      ACCOUNT_ID)      echo "       Could not resolve it from STS — is the AWS CLI authenticated? (aws sts get-caller-identity)" >&2 ;;
      VPC_ID)          echo "       Set it to the VPC from the prerequisites, e.g. export VPC_ID=vpc-..." >&2 ;;
      PRIVATE_SUBNETS) echo "       Set it to two+ private subnet IDs in different AZs, e.g. export PRIVATE_SUBNETS='subnet-a subnet-b'" >&2 ;;
      CORP_CIDR)       echo "       Set it to your corporate network CIDR (the ALB's :443 ingress source), e.g. export CORP_CIDR=10.0.0.0/8" >&2 ;;
      VERSION)         echo "       Set it to the gateway release version — it tags the image you build and push, e.g. export VERSION=<version>" >&2 ;;
    esac
    exit 1
  fi
done

# The walkthrough (and this bundle) is scoped to commercial US regions: the
# task role's Bedrock policy (§2) and the gateway's built-in model catalog
# both use the us.anthropic.* geo-prefixed cross-region inference profiles,
# which only exist in the commercial US regions — an explicit list, not a
# `us-*` prefix match, because GovCloud (us-gov-*) and ISO (us-iso-*) regions
# share the prefix but live in different AWS partitions where those profiles
# and this bundle's arn:aws: ARNs are wrong. Anywhere else the deploy
# provisions fine and then every model call fails. Other-region deploys must
# pin region-appropriate inference profiles via a models: block in
# gateway.yaml (see the config reference:
# https://code.claude.com/docs/en/claude-apps-gateway-config) and adjust the
# inference-profile ARN prefix in bedrock-invoke.iam.json below — set
# ALLOW_NON_US_REGION=1 once that's done to proceed.
case "${AWS_REGION}" in
  us-east-1|us-east-2|us-west-1|us-west-2) ;;
  *)
    if [[ "${ALLOW_NON_US_REGION:-0}" != "1" ]]; then
      echo "ERROR: AWS_REGION=${AWS_REGION} is not a commercial US region, but this bundle's IAM policy" >&2
      echo "       and model IDs use the US-geo (us.anthropic.*) cross-region inference profiles" >&2
      echo "       (GovCloud/ISO regions are different partitions — the profiles and arn:aws: ARNs" >&2
      echo "       here do not exist there)." >&2
      echo "       Either deploy to us-east-1/us-east-2/us-west-1/us-west-2, or pin region-appropriate" >&2
      echo "       inference profiles in a models: block in gateway.yaml" >&2
      echo "       (https://code.claude.com/docs/en/claude-apps-gateway-config), adjust the" >&2
      echo "       inference-profile ARN in the bedrock-invoke policy, and re-run with" >&2
      echo "       ALLOW_NON_US_REGION=1." >&2
      exit 1
    fi
    ;;
esac

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required (it JSON-escapes secret values for --cli-input-json; the AWS CLI itself ships on Python)." >&2
  exit 1
fi

# shellcheck disable=SC2086  # PRIVATE_SUBNETS is intentionally word-split everywhere below
set -- ${PRIVATE_SUBNETS}
if (( $# < 2 )); then
  echo "ERROR: PRIVATE_SUBNETS must list at least two subnets in different AZs (the internal ALB requires two)." >&2
  exit 1
fi
# Normalize whatever whitespace (spaces, tabs, newlines) separates the list —
# `set --` above word-split on IFS, so join those same words with commas
# rather than only converting single spaces.
SUBNETS_CSV="$(printf '%s,' "$@")"; SUBNETS_CSV="${SUBNETS_CSV%,}"

log "Account: ${ACCOUNT_ID}   Region: ${AWS_REGION}   VPC: ${VPC_ID}"

# ---- 1 Security groups -----------------------------------------------------
# Three groups chain the traffic path (walkthrough §1): corp network -> ALB :443,
# ALB -> gateway :8080, gateway -> Postgres :5432. Nothing else is reachable.
log "Creating security groups (§1)"
ALB_SG="$(sg_id "${ALB_SG_NAME}")"
if [[ "${ALB_SG}" != "None" ]]; then
  skip "security group ${ALB_SG_NAME} (${ALB_SG})"
else
  ALB_SG="$(aws ec2 create-security-group --group-name "${ALB_SG_NAME}" \
    --description "Claude gateway ALB" --vpc-id "${VPC_ID}" \
    --query GroupId --output text)"
fi

GW_SG="$(sg_id "${GW_SG_NAME}")"
if [[ "${GW_SG}" != "None" ]]; then
  skip "security group ${GW_SG_NAME} (${GW_SG})"
else
  GW_SG="$(aws ec2 create-security-group --group-name "${GW_SG_NAME}" \
    --description "Claude gateway service" --vpc-id "${VPC_ID}" \
    --query GroupId --output text)"
fi

DB_SG="$(sg_id "${DB_SG_NAME}")"
if [[ "${DB_SG}" != "None" ]]; then
  skip "security group ${DB_SG_NAME} (${DB_SG})"
else
  DB_SG="$(aws ec2 create-security-group --group-name "${DB_SG_NAME}" \
    --description "Claude gateway Postgres" --vpc-id "${VPC_ID}" \
    --query GroupId --output text)"
fi

authorize_ingress --group-id "${ALB_SG}" --protocol tcp --port 443  --cidr "${CORP_CIDR}"
authorize_ingress --group-id "${GW_SG}"  --protocol tcp --port 8080 --source-group "${ALB_SG}"
authorize_ingress --group-id "${DB_SG}"  --protocol tcp --port 5432 --source-group "${GW_SG}"

# Flag any ingress beyond the three rules above (pre-existing groups may carry more).
warn_unexpected_ingress "${ALB_SG}" "${ALB_SG_NAME}" 443  "${CORP_CIDR}"
warn_unexpected_ingress "${GW_SG}"  "${GW_SG_NAME}"  8080 "${ALB_SG}"
warn_unexpected_ingress "${DB_SG}"  "${DB_SG_NAME}"  5432 "${GW_SG}"

# ---- 2 IAM roles ------------------------------------------------------------
# Task role: the gateway's runtime identity — its ONLY permission is invoking
# Claude models on Bedrock (the upstream's `auth: {}` resolves to this role via
# the AWS default credential chain). The policy must cover both the cross-region
# inference-profile ARNs and the underlying foundation-model ARNs.
# Execution role: the ECS agent's identity — pulls the image from ECR and
# injects the Secrets Manager values; the gateway never uses it.
log "Creating IAM roles ${TASK_ROLE} + ${EXEC_ROLE} (§2)"
cat > ecs-trust.iam.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF
cat > bedrock-invoke.iam.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    "Resource": [
      "arn:aws:bedrock:${AWS_REGION}:${ACCOUNT_ID}:inference-profile/us.anthropic.*",
      "arn:aws:bedrock:*::foundation-model/anthropic.*"
    ]
  }]
}
EOF
# One ARN per secret (never a bare gateway-* wildcard, which would also match
# unrelated secrets in a shared account). The trailing -?????? matches exactly
# the random 6-character suffix Secrets Manager appends to every secret's ARN
# (AWS's documented pattern; a trailing -* would be a plain prefix glob and
# also match longer names like ${SECRET_NAME}-prod) — the exact ARNs aren't
# knowable here because the role is created before the secrets are.
cat > secrets-read.iam.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "secretsmanager:GetSecretValue",
    "Resource": [
      "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:${JWT_SECRET_NAME}-??????",
      "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:${OIDC_SECRET_NAME}-??????",
      "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:${SECRET_NAME}-??????"
    ]
  }]
}
EOF

if aws iam get-role --role-name "${TASK_ROLE}" >/dev/null 2>&1; then
  skip "role ${TASK_ROLE}"
else
  aws iam create-role --role-name "${TASK_ROLE}" \
    --assume-role-policy-document file://ecs-trust.iam.json >/dev/null
fi
# put-role-policy is an upsert — safe to re-run (it also picks up region changes).
aws iam put-role-policy --role-name "${TASK_ROLE}" \
  --policy-name bedrock-invoke --policy-document file://bedrock-invoke.iam.json

if aws iam get-role --role-name "${EXEC_ROLE}" >/dev/null 2>&1; then
  skip "role ${EXEC_ROLE}"
else
  aws iam create-role --role-name "${EXEC_ROLE}" \
    --assume-role-policy-document file://ecs-trust.iam.json >/dev/null
fi
# attach-role-policy is idempotent (re-attaching is a no-op).
aws iam attach-role-policy --role-name "${EXEC_ROLE}" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
aws iam put-role-policy --role-name "${EXEC_ROLE}" \
  --policy-name read-gateway-secrets --policy-document file://secrets-read.iam.json

echo "    NOTE: Bedrock model access is console-only — enable it for the Claude models"
echo "          you need (Bedrock console -> Model access), and submit the one-time use"
echo "          case form for the account. Cross-region inference profiles"
echo "          (us.anthropic.*) need access in EACH region the profile spans."

# ---- 6 Build & push image to Amazon ECR (config baked in — §6 + §4) ---------
log "Ensuring ECR repository and image (§6)"
if aws ecr describe-repositories --repository-names "${ECR_REPO}" >/dev/null 2>&1; then
  skip "ECR repository ${ECR_REPO}"
  # Integrity-critical settings: converge on re-runs so a pre-existing MUTABLE repo can't slip through.
  aws ecr put-image-tag-mutability --repository-name "${ECR_REPO}" \
    --image-tag-mutability IMMUTABLE >/dev/null
  aws ecr put-image-scanning-configuration --repository-name "${ECR_REPO}" \
    --image-scanning-configuration scanOnPush=true >/dev/null
else
  # IMMUTABLE tags + scan-on-push: the ECS service pulls whatever this repo
  # serves under the deployed tag, so a pushed tag must never be silently
  # re-pointed. For production, also restrict push rights on this repo to your
  # CI / image-promotion pipeline rather than operator credentials — this
  # walkthrough pushes directly for simplicity.
  aws ecr create-repository --repository-name "${ECR_REPO}" \
    --image-tag-mutability IMMUTABLE \
    --image-scanning-configuration scanOnPush=true >/dev/null
fi

# The config is baked into the image, so the build is gated the way the GCP
# example gates its config-secret publish: gateway.yaml must exist and be fully
# filled in (REPLACE_ME checked on non-comment lines so commented examples and
# the file's header don't trip the guard). The tag carries a hash of the config
# so an edit produces a NEW tag (required by tag immutability) and a re-run
# rebuilds automatically.
IMAGE=""
if [[ ! -f "${GATEWAY_YAML}" ]]; then
  echo "    (skip) ${GATEWAY_YAML} not found — run 'cp gateway.yaml.example gateway.yaml', fill it in, then re-run (§4)."
elif grep -vE '^[[:space:]]*#' "${GATEWAY_YAML}" | grep -q 'REPLACE_ME'; then
  echo "    (skip) ${GATEWAY_YAML} still has REPLACE_ME placeholders to fill:"
  grep -nE 'REPLACE_ME' "${GATEWAY_YAML}" | grep -vE '^[0-9]+:[[:space:]]*#' | sed 's/^/        /'
  echo "        Fill them in, then re-run to build the image (the config is baked in)."
else
  CONFIG_SHA="$(sha_of "${GATEWAY_YAML}" | cut -c1-8)"
  IMAGE_TAG="${IMAGE_TAG:-${VERSION}-cfg${CONFIG_SHA}}"
  IMAGE="${REGISTRY}/${ECR_REPO}:${IMAGE_TAG}"

  # Image is the expensive, already-done step: skip the build+push entirely if
  # the tag already exists in the registry.
  if aws ecr describe-images --repository-name "${ECR_REPO}" \
       --image-ids "imageTag=${IMAGE_TAG}" >/dev/null 2>&1; then
    skip "image ${IMAGE}"
  else
    # When the expected checksum is known, verify a PRE-EXISTING binary too:
    # the [[ ! -f ]] guard below otherwise trusts whatever is on disk, so a
    # stale binary from an earlier VERSION (or a tampered one) would be baked
    # into the image silently. On mismatch, set it aside (never delete — the
    # mismatch may be a typo'd DIST_SHA256, not a bad binary) and fall through
    # to the fail-closed download path. Without DIST_SHA256 the operator-
    # provided-binary flow is unchanged — no checksum was declared, so none is
    # checked.
    QUARANTINED_SHA=""
    if [[ -n "${DIST_SHA256}" && -f "${CLAUDE_BINARY}" ]]; then
      existing_sha="$(sha_of "${CLAUDE_BINARY}")"
      if [[ "${existing_sha}" != "${DIST_SHA256}" ]]; then
        log "Existing ${CLAUDE_BINARY} sha256 ${existing_sha} does not match DIST_SHA256 — setting it aside as ${CLAUDE_BINARY}.bad"
        mv -f "${CLAUDE_BINARY}" "${CLAUDE_BINARY}.bad"
        QUARANTINED_SHA="${existing_sha}"
      fi
    fi
    if [[ ! -f "${CLAUDE_BINARY}" ]]; then
      if [[ -n "${DIST_URL}" ]]; then
        # Fail closed: never download an executable we can't verify.
        if [[ -z "${DIST_SHA256}" ]]; then
          echo "ERROR: DIST_SHA256 must be set when DIST_URL is used — refusing to download an unverified binary." >&2
          echo "       Set DIST_SHA256 to the expected sha256 of the binary at DIST_URL, obtained out-of-band:" >&2
          echo "       for standard-release binaries, from the release's GPG-signed manifest.json (verify the" >&2
          echo "       manifest signature first — see code.claude.com/docs/en/setup#binary-integrity-and-code-signing);" >&2
          echo "       otherwise from the channel that published the download link, never from the download server." >&2
          exit 1
        fi
        log "Downloading gateway binary from ${DIST_URL}"
        # Download to a temp path and only mv into place after the checksum
        # verifies, so an interrupted download can't leave a partial CLAUDE_BINARY
        # that the [[ ! -f ]] guard above would skip — and silently push — on re-run.
        # Refuse plaintext/protocol-downgrade; only follow HTTPS redirects.
        dl_tmp="${CLAUDE_BINARY}.download"
        rm -f "${dl_tmp}"
        curl_https -fL -o "${dl_tmp}" "${DIST_URL}"
        actual_sha="$(sha_of "${dl_tmp}")"
        if [[ "${actual_sha}" != "${DIST_SHA256}" ]]; then
          echo "ERROR: checksum mismatch for ${dl_tmp} (expected ${DIST_SHA256}, got ${actual_sha}) — refusing to build." >&2
          rm -f "${dl_tmp}"
          exit 1
        fi
        log "Verified binary sha256 ${actual_sha}"
        chmod +x "${dl_tmp}"
        mv -f "${dl_tmp}" "${CLAUDE_BINARY}"
      else
        echo "ERROR: build binary not found at ${CLAUDE_BINARY} and DIST_URL is not set." >&2
        if [[ -n "${QUARANTINED_SHA}" ]]; then
          echo "       The binary that WAS there had sha256 ${QUARANTINED_SHA}, which does not match" >&2
          echo "       DIST_SHA256=${DIST_SHA256} — it was preserved as ${CLAUDE_BINARY}.bad." >&2
          echo "       If DIST_SHA256 was a typo, fix it and move the file back:" >&2
          echo "         mv '${CLAUDE_BINARY}.bad' '${CLAUDE_BINARY}'" >&2
          echo "       Otherwise treat that file as untrusted and obtain a verified binary." >&2
        fi
        echo "       Provide the prebuilt linux-x64 Claude Code release binary at that path" >&2
        echo "       or set DIST_URL to its download URL (see the walkthrough, §6)." >&2
        exit 1
      fi
    fi
    # The RDS CA bundle is baked into the image as the trust anchor for the
    # connection string's sslmode=verify-full (§3/§5). Fail closed: no bundle,
    # no build. AWS rotates the bundle, so no checksum is pinned (see the
    # RDS_CA_BUNDLE_URL comment up top); the sanity check below catches an
    # error page or truncated download.
    if [[ ! -f "${RDS_CA_BUNDLE}" ]]; then
      log "Downloading RDS CA bundle from ${RDS_CA_BUNDLE_URL}"
      curl_https -fL -o "${RDS_CA_BUNDLE}" "${RDS_CA_BUNDLE_URL}"
    fi
    if ! grep -q 'BEGIN CERTIFICATE' "${RDS_CA_BUNDLE}" \
       || (( "$(wc -c < "${RDS_CA_BUNDLE}")" < 10000 )); then
      echo "ERROR: ${RDS_CA_BUNDLE} does not look like the RDS CA bundle (missing PEM blocks or implausibly small) — refusing to build." >&2
      echo "       Delete it and re-run to re-download, or place the bundle from ${RDS_CA_BUNDLE_URL} there yourself." >&2
      exit 1
    fi
    log "Building and pushing ${IMAGE}"
    aws ecr get-login-password --region "${AWS_REGION}" \
      | docker login --username AWS --password-stdin "${REGISTRY}"
    # The task definition below runs linux/amd64 (cpuArchitecture X86_64);
    # --platform forces it (e.g. when building on an Apple Silicon Mac), and
    # --provenance=false keeps buildx from wrapping the result in an OCI image
    # index that some pullers reject. For Fargate on ARM64 (Graviton), build
    # linux/arm64 with the linux-arm64 binary and set cpuArchitecture to ARM64.
    docker build --platform=linux/amd64 --provenance=false \
      -f "${DOCKERFILE}" \
      --build-arg CLAUDE_BINARY="${CLAUDE_BINARY}" \
      --build-arg GATEWAY_CONFIG="${GATEWAY_YAML}" \
      --build-arg RDS_CA_BUNDLE="${RDS_CA_BUNDLE}" \
      -t "${IMAGE}" .
    docker push "${IMAGE}"
  fi
fi

# ---- 3 RDS for PostgreSQL (private subnets, no public address) --------------
log "Creating DB subnet group ${DB_SUBNET_GROUP} (§3)"
if aws rds describe-db-subnet-groups --db-subnet-group-name "${DB_SUBNET_GROUP}" >/dev/null 2>&1; then
  skip "DB subnet group ${DB_SUBNET_GROUP}"
else
  # shellcheck disable=SC2086  # subnet IDs are separate arguments by design
  aws rds create-db-subnet-group --db-subnet-group-name "${DB_SUBNET_GROUP}" \
    --db-subnet-group-description "Claude gateway" --subnet-ids ${PRIVATE_SUBNETS} >/dev/null
fi

# Parameter group with rds.force_ssl=1: the server side of TLS enforcement —
# the client side is sslmode=verify-full in the connection string (§5). The
# family must match the engine major version, so it derives from the same
# DB_ENGINE_VERSION that create-db-instance pins below.
log "Ensuring DB parameter group ${DB_PARAM_GROUP} (rds.force_ssl=1)"
PG_FAMILY="postgres${DB_ENGINE_VERSION%%.*}"
if aws rds describe-db-parameter-groups --db-parameter-group-name "${DB_PARAM_GROUP}" >/dev/null 2>&1; then
  skip "DB parameter group ${DB_PARAM_GROUP}"
else
  aws rds create-db-parameter-group --db-parameter-group-name "${DB_PARAM_GROUP}" \
    --db-parameter-group-family "${PG_FAMILY}" \
    --description "Claude gateway - require TLS on every connection" >/dev/null
fi
# modify-db-parameter-group is an upsert — applied every run so a pre-existing
# group converges too. rds.force_ssl is dynamic; no reboot needed.
aws rds modify-db-parameter-group --db-parameter-group-name "${DB_PARAM_GROUP}" \
  --parameters "ParameterName=rds.force_ssl,ParameterValue=1,ApplyMethod=immediate" >/dev/null

# hex (not base64) keeps the password URL-safe for the connection string below.
# The password reaches every aws call via --cli-input-json (never argv — see
# the secret_json helper); explicit flags merge with (and would override) the
# JSON, so only the password lives in the temp file.
log "Creating RDS instance ${DB_INSTANCE} (private subnets, --no-publicly-accessible)"
DB_PASSWORD=""
DB_POSTURE="$(aws rds describe-db-instances --db-instance-identifier "${DB_INSTANCE}" \
  --query 'DBInstances[0].[PubliclyAccessible,StorageEncrypted]' --output text 2>/dev/null || true)"
if [[ -n "${DB_POSTURE}" ]]; then
  # Name-based reuse: a pre-existing instance may not carry the posture this
  # script would have created it with. Non-fatal (the operator may be migrating
  # an existing DB on purpose), but drift from the guide's baseline must be seen.
  read -r DB_PUBLIC DB_ENCRYPTED <<<"${DB_POSTURE}"
  if [[ "${DB_PUBLIC}" == "True" ]]; then
    echo "    WARN — RDS instance ${DB_INSTANCE} is PubliclyAccessible; this script would have" >&2
    echo "           created it with --no-publicly-accessible. Fix: aws rds modify-db-instance" >&2
    echo "           --db-instance-identifier ${DB_INSTANCE} --no-publicly-accessible --apply-immediately" >&2
  fi
  if [[ "${DB_ENCRYPTED}" == "False" ]]; then
    echo "    WARN — RDS instance ${DB_INSTANCE} has StorageEncrypted=false; this script would" >&2
    echo "           have created it with --storage-encrypted (encryption cannot be enabled in" >&2
    echo "           place — restore an encrypted snapshot copy to migrate)." >&2
  fi
  if secret_exists "${SECRET_NAME}"; then
    skip "instance ${DB_INSTANCE} (password unchanged; secret not rewritten)"
  else
    # Self-heal: a previous run died after creating the instance but before
    # writing the connection-string secret, losing the only copy of the
    # password. The secret is the password's only consumer, so resetting it is
    # safe and keeps re-runs able to recover from any partial state.
    # secret_exists (not a bare exit-status check) gates this: only a
    # definitive ResourceNotFoundException may trigger a password reset.
    # ORDERING INVARIANT: the secret write (§5 below) is the heal's commit
    # point — everything that can fail must happen BEFORE it, so a crash at
    # any point leaves the secret still missing and the next run simply
    # repeats the heal. Writing the secret first would invert that: a crash
    # between secret write and modify-db-instance would leave an existing
    # secret whose password the DB never received, and every later run would
    # skip the heal while the gateway can't connect.
    # NOTE: the parameter group is attached on create only — an instance that
    # predates it keeps its current group (attach via modify-db-instance
    # --db-parameter-group-name yourself if you want force_ssl retrofitted).
    log "Instance ${DB_INSTANCE} exists but secret ${SECRET_NAME} is missing — resetting password"
    DB_PASSWORD="$(openssl rand -hex 24)"
    pw_json=""; secret_json pw_json MasterUserPassword "${DB_PASSWORD}"
    aws rds modify-db-instance --db-instance-identifier "${DB_INSTANCE}" \
      --cli-input-json "file://${pw_json}" --apply-immediately >/dev/null
    rm -f "${pw_json}"
  fi
else
  DB_PASSWORD="$(openssl rand -hex 24)"
  pw_json=""; secret_json pw_json MasterUserPassword "${DB_PASSWORD}"
  aws rds create-db-instance --db-instance-identifier "${DB_INSTANCE}" \
    --engine postgres --engine-version "${DB_ENGINE_VERSION}" \
    --db-instance-class "${DB_CLASS}" \
    --allocated-storage "${DB_STORAGE_GB}" --db-name "${DB_NAME}" \
    --master-username "${DB_USER}" --cli-input-json "file://${pw_json}" \
    --db-subnet-group-name "${DB_SUBNET_GROUP}" \
    --db-parameter-group-name "${DB_PARAM_GROUP}" \
    --vpc-security-group-ids "${DB_SG}" \
    --no-publicly-accessible \
    --storage-encrypted >/dev/null
  rm -f "${pw_json}"
fi

log "Waiting for ${DB_INSTANCE} to become available (first creation takes ~10 min)"
aws rds wait db-instance-available --db-instance-identifier "${DB_INSTANCE}"
DB_HOST="$(aws rds describe-db-instances --db-instance-identifier "${DB_INSTANCE}" \
  --query 'DBInstances[0].Endpoint.Address' --output text)"

# ---- 5 Connection string + JWT secret -> Secrets Manager --------------------
# No per-secret IAM grants are needed: the execution role's read-gateway-secrets
# policy (§2) names each of the three secrets by its ARN prefix.
# Secret values go to aws via --cli-input-json temp files, never argv.
if [[ -n "${DB_PASSWORD}" ]]; then
  # RDS private endpoint (guide §3); the gateway connects directly over the
  # VPC — the DB security group only admits ${GW_SG_NAME}.
  # sslmode=verify-full: the gateway's driver honors sslmode from the URL and
  # verifies the RDS certificate chain AND hostname against the CA bundle the
  # image trusts via NODE_EXTRA_CA_CERTS (see the Dockerfile). Do NOT add a
  # libpq-style `sslrootcert=` query param — the driver doesn't read it and
  # forwards it to Postgres as a startup parameter, which the server rejects.
  CONN="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=verify-full"
  log "Storing connection string in Secrets Manager secret ${SECRET_NAME} (§5)"
  conn_json=""; secret_json conn_json SecretString "${CONN}"
  if secret_exists "${SECRET_NAME}"; then
    aws secretsmanager put-secret-value --secret-id "${SECRET_NAME}" \
      --cli-input-json "file://${conn_json}" >/dev/null
  else
    aws secretsmanager create-secret --name "${SECRET_NAME}" \
      --cli-input-json "file://${conn_json}" >/dev/null
  fi
  rm -f "${conn_json}"
else
  log "Skipping postgres-url secret write (instance already existed, password not available this run)"
fi

# JWT signing secret — generated once (re-runs do NOT rotate it).
log "Ensuring JWT signing secret ${JWT_SECRET_NAME} (§5)"
if secret_exists "${JWT_SECRET_NAME}"; then
  skip "secret ${JWT_SECRET_NAME}"
else
  jwt_json=""; secret_json jwt_json SecretString "$(openssl rand -base64 32)"
  aws secretsmanager create-secret --name "${JWT_SECRET_NAME}" \
    --cli-input-json "file://${jwt_json}" >/dev/null
  rm -f "${jwt_json}"
fi

# OIDC client secret — operator-created (the script can't generate it; it comes
# from the Okta OIDC web application). Checked here so the deploy step below can
# gate on it with a clear message instead of a raw ECS secret-injection failure.
OIDC_ARN="$(secret_arn "${OIDC_SECRET_NAME}")"

# ---- 7 ECS Fargate service + internal ALB ----------------------------------
# Self-gating: deploy only once its inputs exist (image pushed — i.e.
# gateway.yaml was filled in — plus the operator-provided OIDC client secret
# and the ACM certificate for the internal hostname). On a first run these are
# usually missing and it cleanly skips.
ALB_DNS=""
missing=""
[[ -n "${IMAGE}" ]] || missing="${missing} image(fill ${GATEWAY_YAML})"
[[ -n "${OIDC_ARN}" ]] || missing="${missing} ${OIDC_SECRET_NAME}"
[[ -n "${ACM_CERT_ARN}" ]] || missing="${missing} ACM_CERT_ARN"
SECRET_ARN="$(secret_arn "${SECRET_NAME}")"
JWT_ARN="$(secret_arn "${JWT_SECRET_NAME}")"
[[ -n "${SECRET_ARN}" ]] || missing="${missing} ${SECRET_NAME}"
[[ -n "${JWT_ARN}"    ]] || missing="${missing} ${JWT_SECRET_NAME}"

if [[ "${DEPLOY}" != "1" ]]; then
  log "Skipping ECS/ALB deploy (DEPLOY=${DEPLOY}) (§7)"
elif [[ -n "${missing// }" ]]; then
  log "Skipping ECS/ALB deploy — missing input(s):${missing} (§7)"
  echo "        Fill ${GATEWAY_YAML} and re-run to build the image; create ${OIDC_SECRET_NAME}"
  echo "        from the Okta client secret; set ACM_CERT_ARN to the certificate for your"
  echo "        internal gateway hostname. Then re-run to deploy."
else
  log "Creating ECS cluster ${CLUSTER} and log group ${LOG_GROUP} (§7)"
  if [[ "$(aws ecs describe-clusters --clusters "${CLUSTER}" \
        --query 'clusters[0].status' --output text 2>/dev/null)" == "ACTIVE" ]]; then
    skip "cluster ${CLUSTER}"
  else
    aws ecs create-cluster --cluster-name "${CLUSTER}" >/dev/null
  fi
  # The gateway's stderr carries both its audit events and operational logs.
  if aws logs describe-log-groups --log-group-name-prefix "${LOG_GROUP}" \
       --query 'logGroups[?logGroupName==`'"${LOG_GROUP}"'`]' --output text 2>/dev/null | grep -q .; then
    skip "log group ${LOG_GROUP}"
  else
    aws logs create-log-group --log-group-name "${LOG_GROUP}"
  fi
  # Retention is a separate API (create-log-group has no retention flag) and an
  # upsert — applied every run so pre-existing groups converge too. Without it
  # the group keeps logs forever and cost grows unbounded.
  aws logs put-retention-policy --log-group-name "${LOG_GROUP}" \
    --retention-in-days "${LOG_RETENTION_DAYS}"

  # Task definition: the task role carries the Bedrock permission; the
  # execution role injects the secrets. Registering is an append (a new
  # revision) — the service below always points at the latest.
  log "Registering task definition ${TASK_FAMILY}"
  taskdef_tmp="$(mktemp)"
  cat > "${taskdef_tmp}" <<EOF
{
  "family": "${TASK_FAMILY}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "${TASK_CPU}",
  "memory": "${TASK_MEMORY}",
  "runtimePlatform": { "cpuArchitecture": "X86_64", "operatingSystemFamily": "LINUX" },
  "executionRoleArn": "arn:aws:iam::${ACCOUNT_ID}:role/${EXEC_ROLE}",
  "taskRoleArn": "arn:aws:iam::${ACCOUNT_ID}:role/${TASK_ROLE}",
  "containerDefinitions": [
    {
      "name": "gateway",
      "image": "${IMAGE}",
      "portMappings": [{ "containerPort": 8080 }],
      "secrets": [
        { "name": "GATEWAY_JWT_SECRET",   "valueFrom": "${JWT_ARN}" },
        { "name": "OIDC_CLIENT_SECRET",   "valueFrom": "${OIDC_ARN}" },
        { "name": "GATEWAY_POSTGRES_URL", "valueFrom": "${SECRET_ARN}" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "${LOG_GROUP}",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "gateway"
        }
      }
    }
  ]
}
EOF
  aws ecs register-task-definition --cli-input-json "file://${taskdef_tmp}" >/dev/null
  rm -f "${taskdef_tmp}"

  # Internal ALB. --ip-address-type ipv4: an internal dual-stack ALB publishes
  # public-range AAAA records, which the CLI's /login private-network check
  # rejects.
  log "Creating internal ALB ${ALB_NAME} + target group + HTTPS listener"
  read -r ALB_ARN ALB_SCHEME ALB_VPC ALB_IP_TYPE <<<"$(aws elbv2 describe-load-balancers --names "${ALB_NAME}" \
    --query 'LoadBalancers[0].[LoadBalancerArn,Scheme,VpcId,IpAddressType]' --output text 2>/dev/null || true)"
  if [[ -n "${ALB_ARN}" && "${ALB_ARN}" != "None" ]]; then
    # Reuse is by name, and scheme/VPC are immutable on an ALB — so posture is
    # asserted, fail-closed: attaching the gateway to an internet-facing or
    # wrong-VPC load balancer would change the exposure model, not just drift.
    if [[ "${ALB_SCHEME}" != "internal" || "${ALB_VPC}" != "${VPC_ID}" ]]; then
      echo "ERROR: load balancer ${ALB_NAME} exists but is not the internal ALB this script expects:" >&2
      echo "       scheme=${ALB_SCHEME} (need internal), vpc=${ALB_VPC} (need ${VPC_ID})." >&2
      echo "       Refusing to deploy the gateway behind it. Delete that load balancer, or set" >&2
      echo "       ALB_NAME to an unused name, then re-run." >&2
      exit 1
    fi
    skip "load balancer ${ALB_NAME} (internal, ${ALB_VPC})"
    # ip-address-type IS mutable (unlike scheme/VPC) — converge a reused
    # dualstack ALB back to ipv4, matching the Terraform sibling: dual-stack
    # publishes public-range AAAA records that /login rejects (see above).
    if [[ "${ALB_IP_TYPE}" != "ipv4" ]]; then
      aws elbv2 set-ip-address-type --load-balancer-arn "${ALB_ARN}" \
        --ip-address-type ipv4 >/dev/null
    fi
  else
    # shellcheck disable=SC2086
    ALB_ARN="$(aws elbv2 create-load-balancer --name "${ALB_NAME}" \
      --scheme internal --type application --ip-address-type ipv4 \
      --subnets ${PRIVATE_SUBNETS} --security-groups "${ALB_SG}" \
      --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
  fi

  # The ALB closes a connection after 60 seconds with no data by default, which
  # cuts off streams during quiet periods (long prompt processing before the
  # first token, extended thinking). Attribute setting is idempotent.
  aws elbv2 modify-load-balancer-attributes --load-balancer-arn "${ALB_ARN}" \
    --attributes Key=idle_timeout.timeout_seconds,Value=3600 >/dev/null

  read -r TG_ARN TG_VPC <<<"$(aws elbv2 describe-target-groups --names "${TG_NAME}" \
    --query 'TargetGroups[0].[TargetGroupArn,VpcId]' --output text 2>/dev/null || true)"
  if [[ -n "${TG_ARN}" && "${TG_ARN}" != "None" ]]; then
    skip "target group ${TG_NAME}"
    # VPC is immutable on a target group; a wrong-VPC one can't reach the tasks.
    if [[ "${TG_VPC}" != "${VPC_ID}" ]]; then
      echo "    WARN — target group ${TG_NAME} is in ${TG_VPC}, not ${VPC_ID}; the service's tasks" >&2
      echo "           will not become healthy behind it. Delete it or set TG_NAME to an unused" >&2
      echo "           name, then re-run." >&2
    fi
  else
    # /readyz verifies the store is reachable, so a task that can't reach
    # Postgres never enters rotation (the gateway also serves liveness-only
    # /healthz — see the deploy guide's outage-behavior tradeoff).
    TG_ARN="$(aws elbv2 create-target-group --name "${TG_NAME}" \
      --protocol HTTP --port 8080 --vpc-id "${VPC_ID}" --target-type ip \
      --health-check-path /readyz \
      --query 'TargetGroups[0].TargetGroupArn' --output text)"
  fi

  # Select the HTTPS:443 listener specifically — a reused ALB may carry other
  # listeners (say HTTP:80); those stay untouched, and the 443 listener is
  # still created when it's the one that's missing.
  # shellcheck disable=SC2016  # backticks are JMESPath literals, not expansion
  LISTENER_ARN="$(aws elbv2 describe-listeners --load-balancer-arn "${ALB_ARN}" \
    --query 'Listeners[?Port==`443`]|[0].ListenerArn' --output text 2>/dev/null || true)"
  if [[ -n "${LISTENER_ARN}" && "${LISTENER_ARN}" != "None" ]]; then
    skip "HTTPS:443 listener on ${ALB_NAME}"
    # Converge everything this script owns on pre-existing listeners
    # (modify-listener is an upsert): the TLS policy (so re-runs pick up an
    # ALB_SSL_POLICY change, and listeners created before this script pinned
    # one lose the legacy default), the certificate (so a changed ACM_CERT_ARN
    # — e.g. a renewal under a new ARN — is not silently ignored), and the
    # default action (so the listener always forwards to this target group).
    aws elbv2 modify-listener --listener-arn "${LISTENER_ARN}" \
      --ssl-policy "${ALB_SSL_POLICY}" \
      --certificates "CertificateArn=${ACM_CERT_ARN}" \
      --default-actions "Type=forward,TargetGroupArn=${TG_ARN}" >/dev/null
  else
    aws elbv2 create-listener --load-balancer-arn "${ALB_ARN}" \
      --protocol HTTPS --port 443 \
      --ssl-policy "${ALB_SSL_POLICY}" \
      --certificates "CertificateArn=${ACM_CERT_ARN}" \
      --default-actions "Type=forward,TargetGroupArn=${TG_ARN}" >/dev/null
  fi

  # Service: created once, then rolled forward — a re-run points it at the
  # latest task-definition revision (which carries the current image tag, and
  # therefore the current gateway.yaml) and forces a new deployment.
  log "Creating/updating ECS service ${SERVICE} (Fargate, private subnets, no public IP)"
  svc_status="$(aws ecs describe-services --cluster "${CLUSTER}" --services "${SERVICE}" \
    --query 'services[0].status' --output text 2>/dev/null || true)"
  if [[ "${svc_status}" == "ACTIVE" ]]; then
    aws ecs update-service --cluster "${CLUSTER}" --service "${SERVICE}" \
      --task-definition "${TASK_FAMILY}" --desired-count "${DESIRED_COUNT}" \
      --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true}" \
      --health-check-grace-period-seconds 60 \
      --force-new-deployment >/dev/null
    echo "        service updated to the latest task-definition revision."
  else
    # All egress (Bedrock, the IdP, Secrets Manager, ECR, CloudWatch Logs) goes
    # through the NAT gateway — assignPublicIp stays DISABLED.
    # The deployment circuit breaker stops a rollout whose tasks keep failing
    # (bad image, unbootable config) and rolls back to the last steady state
    # instead of relaunching failing tasks forever. The health-check grace
    # period gives a cold task (image pull + store connect + first /readyz)
    # time before ECS counts it unhealthy — without it the circuit breaker can
    # declare the very first rollout failed (matches terraform/'s
    # health_check_grace_period_seconds).
    aws ecs create-service --cluster "${CLUSTER}" --service-name "${SERVICE}" \
      --task-definition "${TASK_FAMILY}" --desired-count "${DESIRED_COUNT}" \
      --launch-type FARGATE \
      --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true}" \
      --health-check-grace-period-seconds 60 \
      --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS_CSV}],securityGroups=[${GW_SG}],assignPublicIp=DISABLED}" \
      --load-balancers "targetGroupArn=${TG_ARN},containerName=gateway,containerPort=8080" >/dev/null
  fi

  ALB_DNS="$(aws elbv2 describe-load-balancers --load-balancer-arns "${ALB_ARN}" \
    --query 'LoadBalancers[0].DNSName' --output text)"
  log "Internal ALB DNS: ${ALB_DNS}"

  # Post-deploy smoke check: the ALB is internal (unreachable from this
  # machine), but target health is visible through the API — poll until the
  # /readyz health check passes. Non-fatal; a cold task needs a minute or two
  # (image pull + store connect).
  log "Smoke check: polling target health on ${TG_NAME} (health check: GET /readyz)"
  tg_state="unknown"
  for _ in $(seq 1 24); do
    tg_state="$(aws elbv2 describe-target-health --target-group-arn "${TG_ARN}" \
      --query 'TargetHealthDescriptions[0].TargetHealth.State' --output text 2>/dev/null || true)"
    [[ "${tg_state}" == "healthy" ]] && break
    sleep 10
  done
  if [[ "${tg_state}" == "healthy" ]]; then
    echo "        OK — a gateway task is healthy behind the ALB (store reachable)."
  else
    echo "        WARN — last target state: ${tg_state:-none}; the task may still be starting."
    echo "               Check the service events and the gateway's logs:"
    echo "                 aws ecs describe-services --cluster ${CLUSTER} --services ${SERVICE} --query 'services[0].events[:5]'"
    echo "                 aws logs tail ${LOG_GROUP} --since 10m"
  fi

  # public_url is baked into the image, so verify the operator's chosen
  # hostname is in place (the redirect URI and discovery doc derive from it).
  CFG_PUBLIC_URL="$(grep -E '^[[:space:]]*public_url:' "${GATEWAY_YAML}" 2>/dev/null \
    | head -1 \
    | sed -E 's/^[[:space:]]*public_url:[[:space:]]*//; s/[[:space:]]+#.*$//; s/[[:space:]]*$//' \
    || true)"
  CFG_PUBLIC_URL="${CFG_PUBLIC_URL#[\'\"]}"; CFG_PUBLIC_URL="${CFG_PUBLIC_URL%[\'\"]}"
  CFG_PUBLIC_URL="${CFG_PUBLIC_URL%/}"
  echo "        1. In your Route 53 private hosted zone, alias the host of"
  echo "           ${CFG_PUBLIC_URL:-<public_url>} to the ALB: ${ALB_DNS}"
  echo "           (the ALB's own *.elb.amazonaws.com name can't carry your ACM certificate)."
  echo "        2. Register this redirect URI on the Okta OIDC web app: ${CFG_PUBLIC_URL:-<public_url>}/oauth/callback"
  echo "        3. Verify from inside your corporate network:"
  echo "             curl -s ${CFG_PUBLIC_URL:-<public_url>}/.well-known/oauth-authorization-server"
fi

# ---- summary ----------------------------------------------------------------
cat <<EOF

==> Done.

  Security groups       ${ALB_SG_NAME}=${ALB_SG}  ${GW_SG_NAME}=${GW_SG}  ${DB_SG_NAME}=${DB_SG}
  IAM roles             ${TASK_ROLE} (bedrock-invoke), ${EXEC_ROLE} (pull + secrets)
  Image                 ${IMAGE:-(not built yet — fill ${GATEWAY_YAML})}
  RDS instance          ${DB_INSTANCE} -> ${DB_HOST}
  Database / user       ${DB_NAME} / ${DB_USER}
  Secrets               ${SECRET_NAME}, ${JWT_SECRET_NAME}, ${OIDC_SECRET_NAME}$( [[ -n "${OIDC_ARN}" ]] || printf ' (MISSING — create it)' )
  ECS service           ${CLUSTER}/${SERVICE} behind ${ALB_DNS:-(not deployed yet)}

Next steps (see https://code.claude.com/docs/en/claude-apps-gateway-on-aws):
  - Create the one operator-provided secret (from the Okta OIDC web app). Put the
    client secret in a 0600 file first — passing it as a literal argument would
    leave it readable in the process table and in audit/EDR logs:
      aws secretsmanager create-secret --name ${OIDC_SECRET_NAME} \\
        --secret-string file:///path/to/okta-client-secret.txt
  - Fill in the REPLACE_ME values in ${GATEWAY_YAML}, then re-run: setup.sh builds the
    image (config baked in) and deploys once the secret and ACM_CERT_ARN exist.
  - Enable Bedrock model access in the console for the Claude models you need (per
    region the us.anthropic.* profiles span) and submit the one-time use case form.
  - Alias your internal hostname (gateway.yaml public_url) to the ALB in a Route 53
    private hosted zone, and register <public_url>/oauth/callback on the Okta app.
  - The gateway runs its own schema migrations at boot, so ${DB_USER} needs CREATE TABLE.
EOF
