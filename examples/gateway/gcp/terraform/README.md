# Claude Gateway — Terraform (Cloud Run)

Terraform equivalent of `../setup.sh`. Lets end-users provision and manage
the gateway with `terraform apply`. Covers the same scope ([walkthrough](https://code.claude.com/docs/en/claude-apps-gateway-on-gcp) §1–7): APIs →
service account + IAM → Artifact Registry repo → VPC + Private Services Access →
private-IP Cloud SQL (PG16) → secrets → Cloud Run with Direct VPC egress.

## Files

| File | Purpose |
|------|---------|
| `versions.tf` | Provider pins (google, random) |
| `variables.tf` | All inputs (defaults match `setup.sh`'s) |
| `main.tf` | Resources |
| `outputs.tf` | Service URL, OAuth redirect URI, SA, DB info |
| `terraform.tfvars.example` | Copy to `terraform.tfvars` and edit |

## Prerequisites

1. **`../gateway.yaml` created and filled in** — copy the template first:
   `cp ../gateway.yaml.example ../gateway.yaml`, then replace every `REPLACE_ME`
   (Terraform reads this file and enforces no `REPLACE_ME` via a precondition).
   Leave `public_url` at its placeholder for the first apply; set it to the
   `run.app` URL (the `service_url` output) or your LB hostname and re-apply.
   `gateway.yaml` is gitignored; the committed template is `gateway.yaml.example`.
2. A **remote backend** for shared use (see below). State holds secrets — never commit it.

## Deploy

Terraform creates the Artifact Registry repo but does **not** build/push the
image, so the apply is two passes: a targeted apply to create the repo, then
build/push, then the full apply.

```bash
cp terraform.tfvars.example terraform.tfvars   # edit it
terraform init

# 1. Create just the Artifact Registry repo (the -target warning is expected):
terraform apply -target=google_artifact_registry_repository.repo

# 2. Download the public Claude Code linux-x64 release binary (it includes the
#    `gateway` subcommand; the Dockerfile picks it up at gcp/claude), verify its
#    sha256 against the release manifest, then build and push the image:
BASE="https://downloads.claude.ai/claude-code-releases"
VERSION="$(curl -fsSL --proto '=https' "${BASE}/latest")"
curl -fL --proto '=https' --proto-redir '=https' -o ../claude \
  "${BASE}/${VERSION}/linux-x64/claude"
WANT="$(curl -fsSL --proto '=https' "${BASE}/${VERSION}/manifest.json" \
  | tr -d '[:space:]' | grep -oE '"linux-x64"[^}]*' | grep -oE '[a-f0-9]{64}' | head -1)"
[ "$(openssl dgst -sha256 ../claude | awk '{print $NF}')" = "${WANT}" ] \
  && echo "sha256 OK" || { echo "checksum mismatch" >&2; rm -f ../claude; }
gcloud auth configure-docker us-east5-docker.pkg.dev --quiet
docker build --platform=linux/amd64 --provenance=false \
  -f ../Dockerfile -t "us-east5-docker.pkg.dev/<project>/claude-gateway/gateway:${VERSION}" ..
docker push "us-east5-docker.pkg.dev/<project>/claude-gateway/gateway:${VERSION}"

# 3. Full apply:
terraform apply
```

(`../setup.sh` §3 automates the same download-and-verify.)

Set in `terraform.tfvars`:

- `project_id`, `region`
- `image_tag` (after building/pushing — step 2 above)
- **`oidc_client_secret`** — required (the Cloud Run service mounts `latest` of
  this secret; with no version the deploy fails). Terraform creates the
  secret + version from it.
- `invoker_iam_disabled` / `allow_unauthenticated` — the gateway runs its own
  OIDC, so the Cloud Run invoker IAM check must be opened or disabled.
  **Preferred:** `invoker_iam_disabled = true` (no `allUsers` binding; works
  under Domain Restricted Sharing). **Fallback:** `allow_unauthenticated = true`
  grants `allUsers` `run.invoker` — fine on a normal org, but DRS orgs reject
  `allUsers` (set it `false` there, since an LB does **not** bypass the IAM
  check). If both paths are blocked by org policy, use the GKE track.
- `ingress` — defaults to **internal-only** (no public URL). Claude Code's `/login`
  only accepts gateway hosts on private addresses, so public ingress cannot serve
  clients; the two-pass OAuth bootstrap must be completed from inside the VPC (or a
  PSC-connected corp network). See "Private access" below.

Tear down a trial with `terraform destroy`: set `deletion_protection = false`,
run `terraform apply` to record that in state (the provider checks the value in
**state**, not config, so destroy would still refuse otherwise), then `terraform
destroy`. The destroy will stop at the VPC network
because the Private Services Access peering is intentionally left in place
(`deletion_policy = ABANDON` — see Guard rails below); finish by deleting the
peering manually once the Cloud SQL instance is gone, then re-run destroy:

```bash
gcloud services vpc-peerings delete --service=servicenetworking.googleapis.com \
  --network=cc-gateway-vpc --project=<project>
terraform destroy
```

## Guard rails

Tuned so accidental deletion is hard but greenfield teardown stays easy:

- `deletion_protection = true` (variable, default true) on Cloud SQL and Cloud Run —
  blocks accidental deletion; set `false` when you intend to `terraform destroy`.
- `disable_on_destroy = false` on APIs — tearing down config never disables APIs.
- `deletion_policy = ABANDON` on the PSA peering — never tears down the
  service-networking peering automatically (it's shared by every private-IP
  service on the VPC). On the dedicated VPC this module creates, that means
  `terraform destroy` stops at the network step; delete the peering manually
  per the teardown note above.
- IAM uses non-authoritative `_member` resources, so other project/secret bindings
  are never clobbered.

## Private access (internal ingress) — the default

By default the service has **no public URL** (`ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"`),
and there is no public-ingress option: Claude Code's `/login` rejects gateway hosts that
resolve to public addresses, so public exposure cannot serve clients. Reach the service
from inside the VPC, or via the private-access plumbing below.

With internal-only ingress, `public_url` stays the `run.app` URL (Google-managed cert) —
**no load balancer or your own certificate required**. But internal ingress alone does
**not** let corporate on-prem clients reach `run.app`; that needs **operator /
network-team-owned** plumbing that Cloud Run does **not** create for you (validate it's in
place before relying on internal ingress):

1. A **Private Service Connect endpoint** for Google APIs (an internal VIP in the VPC).
2. A **Cloud DNS private zone for `run.app`** resolving `*.run.app` to that endpoint IP.
3. **On-prem routing** to the endpoint over Cloud VPN / Interconnect.

This is normally managed centrally in the network/hub project, so the module does not
provision it. See [Private networking and Cloud Run](https://cloud.google.com/run/docs/securing/private-networking).
For a greenfield trial without this plumbing, complete the OAuth bootstrap from inside
the VPC — e.g. a browser proxied through an in-VPC VM (SSH SOCKS tunnel over IAP).

For a **custom internal hostname or your own TLS cert**, use
`INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` and front the service with your own internal
Application Load Balancer (also not provisioned by this module).

## Remote state (recommended for teams)

Add a backend so state is shared and locked (and out of git):

```hcl
# backend.tf
terraform {
  backend "gcs" {
    bucket = "<your-tf-state-bucket>"
    prefix = "claude-gateway/cloudrun"
  }
}
```

## After deploy

- `terraform output service_url` / `oauth_redirect_uri`.
- Register the redirect URI on the Google OAuth client and make sure
  `../gateway.yaml` `public_url` matches the host.
- Notes: Terraform does not build the image. To ship a new gateway version,
  rerun the docker build/push under a new tag and bump `image_tag` — a bare
  re-apply under an unchanged tag does **not** roll a new revision (Cloud Run
  resolves the tag to a digest only at revision creation, and an unchanged
  `image` attribute means no new revision).
