# Claude apps gateway — Terraform (ECS Fargate)

Terraform equivalent of `../setup.sh`. Lets end-users provision and manage
the gateway with `terraform apply`. Covers the same scope ([walkthrough](https://code.claude.com/docs/en/claude-apps-gateway-on-aws) §1–7,
ECS track): security groups → task + execution IAM roles → ECR repository →
private-subnet RDS for PostgreSQL → Secrets Manager secrets → ECS Fargate
service behind an internal ALB. The VPC and private subnets are walkthrough
prerequisites, passed in as variables — unlike the GCP example, no network is
created here.

## Files

| File | Purpose |
|------|---------|
| `versions.tf` | Provider pins (aws, random) |
| `variables.tf` | All inputs (defaults match `setup.sh`'s) |
| `main.tf` | Resources |
| `outputs.tf` | ALB DNS name + zone ID, image, roles, DB endpoint |
| `terraform.tfvars.example` | Copy to `terraform.tfvars` and edit |

## Prerequisites

1. **`../gateway.yaml` created and FULLY filled in** — copy the template first:
   `cp ../gateway.yaml.example ../gateway.yaml`, then replace every `REPLACE_ME`
   (Terraform reads this file and enforces no `REPLACE_ME` via a precondition).
   Unlike the GCP example there is no placeholder-first-pass: the config is
   **baked into the image**, and `public_url` is your own internal hostname,
   which you choose up front (you already hold its ACM certificate).
   `gateway.yaml` is gitignored; the committed template is `gateway.yaml.example`.
2. The **prebuilt linux-x64 `claude` binary at `../claude`** — the Claude Code
   release binary, which includes the `gateway` subcommand (see the
   [walkthrough](https://code.claude.com/docs/en/claude-apps-gateway-on-aws)).
   See `../setup.sh`'s `DIST_URL`/`DIST_SHA256` download path for a
   checksum-verified fetch.
3. A **VPC with two+ private subnets** in different AZs and NAT egress, an **ACM
   certificate** for your internal gateway hostname, and **Bedrock model access**
   enabled in the console (cross-region `us.anthropic.*` profiles need it in each
   region the profile spans), with the one-time use case form submitted.
4. A **remote backend** for shared use (see below). State holds secrets — never commit it.

## Deploy

Terraform creates the ECR repository but does **not** build/push the image, so
the apply is two passes: a targeted apply to create the repo, then build/push,
then the full apply.

```bash
cp terraform.tfvars.example terraform.tfvars   # edit it
terraform init

# Pin providers in your copy (once, then commit .terraform.lock.hcl and drop
# its .gitignore line): versions.tf pins by range only, so without a committed
# lock the registry serves the newest in-range build — a platform-complete
# lock gives hash continuity across machines/CI and makes provider upgrades
# reviewable diffs.
terraform providers lock -platform=linux_amd64 -platform=linux_arm64 \
  -platform=darwin_amd64 -platform=darwin_arm64 -platform=windows_amd64

# 1. Create just the ECR repository (the -target warning is expected):
terraform apply -target=aws_ecr_repository.repo

# 2. Build and push the image (gateway.yaml and the RDS CA bundle are baked in;
#    the COPY sources are context-relative — the build context `..` is aws/, so
#    `claude`, `gateway.yaml`, and `rds-global-bundle.pem`).
#    The CA bundle is the trust anchor for the connection string's
#    sslmode=verify-full (AWS rotates it; download it when absent — don't commit it):
curl -fL --proto '=https' -o ../rds-global-bundle.pem \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build --platform=linux/amd64 --provenance=false \
  -f ../Dockerfile --build-arg CLAUDE_BINARY=claude --build-arg GATEWAY_CONFIG=gateway.yaml \
  -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/claude-gateway:<version> ..
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/claude-gateway:<version>

# 3. Full apply:
terraform apply
```

Set in `terraform.tfvars`:

- `region`, `vpc_id`, `private_subnet_ids`, `corporate_cidr`
- `acm_certificate_arn` — the certificate for your internal gateway hostname
  (`gateway.yaml`'s `public_url` host), served by the ALB's HTTPS listener
- `image_tag` (after building/pushing — step 2 above). The repo enforces
  **immutable tags**, so a `gateway.yaml` edit means a rebuild under a **new**
  tag and an `image_tag` bump (`../setup.sh` automates this by tagging
  `<version>-cfg<sha8-of-gateway.yaml>`)
- **`oidc_client_secret`** — required (the ECS tasks inject `latest` of this
  secret at start; with no version they fail with
  `ResourceInitializationError`). Terraform creates the secret + version from it.

## Tear down

Tear down a trial with `terraform destroy`: set `deletion_protection = false`,
run `terraform apply` to record that on RDS and the ALB (and to flip RDS to
`skip_final_snapshot` — the provider checks the value in **state**, not config,
so destroy would still refuse otherwise), then `terraform destroy`.

The same switch drives the Secrets Manager recovery window: the three secrets
have **fixed names**, and a secret deleted with the default 30-day recovery
window keeps its name reserved — a later `terraform apply` would fail with a
name conflict until the window elapses. With `deletion_protection = false` the
destroy deletes them immediately (`recovery_window_in_days = 0`). If you
destroyed a deployment that still had `deletion_protection = true` (or tore
down an older copy of this module), clear the scheduled deletions before
re-applying:

```bash
for s in gateway-postgres-url gateway-jwt-secret gateway-oidc-client-secret; do
  aws secretsmanager delete-secret --secret-id "$s" --force-delete-without-recovery
done
```

## Guard rails

Tuned so accidental deletion is hard but greenfield teardown stays easy:

- `deletion_protection = true` (variable, default true) on RDS and the ALB —
  blocks accidental deletion; set `false` when you intend to `terraform destroy`.
  The same switch controls RDS `skip_final_snapshot`, so a protected instance
  always leaves a final snapshot.
- ECR tags are **immutable** and **scanned on push** — a deployed tag can never
  be silently re-pointed at different bytes. For production, also restrict push
  rights on the repo to your CI / image-promotion pipeline rather than operator
  credentials.
- The IAM roles carry only the walkthrough's least-privilege documents: Bedrock
  invoke on the Anthropic model ARNs (task role) and `secretsmanager:GetSecretValue`
  on exactly the three secrets this module creates (by ARN) plus the AWS-managed
  ECS execution policy (execution role). Inline policies are scoped to these
  roles, so nothing else in the account is touched.
- TLS everywhere it terminates: the ALB listener pins
  `ELBSecurityPolicy-TLS13-1-2-2021-06` (no TLS 1.0/1.1), and the store
  connection uses `sslmode=verify-full` against the RDS CA bundle baked into
  the image, with `rds.force_ssl=1` enforcing TLS server-side.

## Private access

The ALB is **internal** with `ip_address_type = "ipv4"` (a dual-stack internal
ALB publishes public-range AAAA records, which the CLI's `/login`
private-network check rejects), and its security group admits only
`corporate_cidr` on 443. Reaching it from on-prem requires your existing
routing into the VPC (Direct Connect / VPN) — **operator / network-team-owned**
plumbing this module does not create.

After the apply, give developers a privately resolvable hostname: in a Route 53
private hosted zone, alias the host of `gateway.yaml`'s `public_url` to the ALB
(`alb_dns_name` / `alb_zone_id` outputs). The ALB's own `*.elb.amazonaws.com`
name can't carry your ACM certificate, so use your own name.

The tasks run in the private subnets with no public IP; all egress (Bedrock,
the IdP, Secrets Manager, ECR, CloudWatch Logs) goes through the NAT gateway.
To keep Bedrock traffic off the public path, create a `bedrock-runtime`
interface VPC endpoint and point the upstream's `base_url` at it (see
`../gateway.yaml.example`); the IdP still needs internet egress.

## Remote state (recommended for teams)

Add a backend so state is shared and locked (and out of git):

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket       = "<your-tf-state-bucket>"
    key          = "claude-gateway/ecs"
    region       = "us-east-1"
    use_lockfile = true # S3-native locking (Terraform >= 1.10); or set dynamodb_table
  }
}
```

## After deploy

- `terraform output alb_dns_name` / `alb_zone_id` — create the Route 53 alias.
- Register `<public_url>/oauth/callback` on the Okta OIDC web app and make sure
  `../gateway.yaml` `public_url` matches the host you aliased.
- Notes: Terraform does not build the image. To ship a new gateway version **or
  a config edit**, rerun the docker build/push under a new tag and bump
  `image_tag` — secrets-only rotations roll the service without a rebuild (the
  task definition stamps a hash of the managed secret values), but a
  `gateway.yaml` edit reaches the container only through the rebuilt image.
