# Claude apps gateway on AWS

Reference deployment artifacts for running Claude apps gateway on AWS with
Amazon Bedrock as the upstream: ECS on Fargate or EKS, Amazon RDS for
PostgreSQL, AWS Secrets Manager, and IAM-role auth to Bedrock.

These files are provided as a working example rather than a supported production
deployment. Adapt them to your own environment.

- **Walkthrough**: https://code.claude.com/docs/en/claude-apps-gateway-on-aws
- **Related**: AWS-maintained samples for various customer environments at
  https://github.com/aws-samples/anthropic-on-aws/tree/main/claude-apps-gateway

| File | Purpose |
|---|---|
| `setup.sh` | Scripts the walkthrough end to end via the `aws` CLI |
| `Dockerfile` | Runtime image for the `claude gateway` binary (bakes in `gateway.yaml`) |
| `gateway.yaml.example` | Gateway config template, AWS-shaped (Bedrock upstream, Okta IdP) |
| `terraform/` | Provisions the full architecture (two-pass apply — see `terraform/README.md`) |
