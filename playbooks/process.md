# Process

- Branches: main is protected; work in feature/* or fix/*.
- Reviews: at least one human review before merge to main.
- CI/CD: merge to main triggers VPS redeploy via webhook → Podman.
- Releases: tag vX.Y.Z; hotfix from tag back to main.
