# Claude Gateway on Google Cloud

Reference deployment artifacts for running Claude Gateway on GCP with Agent
Platform (formerly Vertex AI) as the upstream: Cloud Run or GKE, Cloud SQL for
PostgreSQL, Secret Manager, and service-account auth to Agent Platform.

These files are provided as a working example rather than a supported production
deployment. Adapt them to your own environment.

- **Walkthrough**: https://code.claude.com/docs/en/claude-apps-gateway-on-gcp

| File | Purpose |
|---|---|
| `setup.sh` | Scripts the walkthrough end to end via `gcloud` |
| `Dockerfile` | Runtime image for the `claude gateway` binary |
| `gateway.yaml.example` | Gateway config template, GCP-shaped (Agent Platform upstream, Google Workspace IdP) |
| `terraform/` | Provisions the full architecture (two-pass apply — see `terraform/README.md`) |
