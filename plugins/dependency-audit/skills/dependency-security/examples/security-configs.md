# Security Configuration Examples

Real-world configuration examples for dependency security.

## npm / Node.js

### .npmrc for Security

```ini
# Require exact versions
save-exact=true

# Strict SSL
strict-ssl=true

# Audit on install
audit=true

# Prevent running scripts from untrusted packages
ignore-scripts=false

# Private registry for scoped packages
@company:registry=https://npm.company.com/
//npm.company.com/:_authToken=${NPM_TOKEN}

# Ensure using HTTPS
registry=https://registry.npmjs.org/
```

### package.json Security Scripts

```json
{
  "scripts": {
    "preinstall": "npx only-allow npm",
    "prepare": "husky install",
    "audit": "npm audit --audit-level=high",
    "audit:fix": "npm audit fix",
    "outdated": "npm outdated",
    "check-licenses": "npx license-checker --failOn 'GPL-3.0;AGPL-3.0'",
    "security": "npm run audit && npm run check-licenses"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

### Lockfile Lint Configuration

```json
// .lockfile-lintrc.json
{
  "path": "package-lock.json",
  "type": "npm",
  "validateHttps": true,
  "validateIntegrity": true,
  "allowedHosts": [
    "npm",
    "https://npm.company.com/"
  ]
}
```

## Python

### pip Security Setup

```ini
# pip.conf
[global]
require-virtualenv = true
timeout = 60

[install]
require-hashes = true
no-cache-dir = false
```

### requirements.txt with Hashes

```txt
# requirements.txt
requests==2.31.0 \
    --hash=sha256:58cd2187c01e70e6e26505bca751777aa9f2ee0b7f4300988b709f44e013003f
certifi==2024.2.2 \
    --hash=sha256:dc383c07b76109f368f6106eee2b593b04a011ea4d55f652c6ca24a754d1cdd1
```

### pip-audit Configuration

```toml
# pyproject.toml
[tool.pip-audit]
require-hashes = true
vulnerability-service = "osv"
progress-spinner = true
```

## Rust / Cargo

### Cargo.toml Security

```toml
[package]
name = "my-project"
version = "0.1.0"
edition = "2021"

# Deny unsafe code
[lints.rust]
unsafe_code = "forbid"

[dependencies]
# Pin exact versions for security-critical deps
ring = "=0.17.7"
rustls = "=0.22.2"

# Allow patch updates for others
serde = "1.0"
```

### cargo-deny Configuration

```toml
# deny.toml
[advisories]
db-path = "~/.cargo/advisory-db"
db-urls = ["https://github.com/rustsec/advisory-db"]
vulnerability = "deny"
unmaintained = "warn"
yanked = "deny"

[licenses]
allow = [
    "MIT",
    "Apache-2.0",
    "Apache-2.0 WITH LLVM-exception",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
]
copyleft = "deny"
unlicensed = "deny"

[bans]
multiple-versions = "warn"
wildcards = "deny"
deny = [
    # Deny specific crates
    { name = "openssl" }
]

[sources]
unknown-registry = "deny"
unknown-git = "deny"
allow-registry = ["https://github.com/rust-lang/crates.io-index"]
```

## CI/CD Configurations

### GitHub Actions Complete Security Workflow

```yaml
name: Dependency Security

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6 AM

permissions:
  contents: read
  security-events: write

jobs:
  audit:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Upload Snyk results to GitHub
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: snyk.sarif

  license-check:
    name: License Compliance
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Check licenses
        run: npx license-checker --failOn "GPL-3.0;AGPL-3.0;UNLICENSED"

  supply-chain:
    name: Supply Chain Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Verify lockfile
        run: npm ci

      - name: Check for typosquatting
        run: npx @pnpm/lockfile-audit

      - name: Lockfile lint
        run: npx lockfile-lint --path package-lock.json --type npm --validate-https --allowed-hosts npm
```

### GitLab CI Security Pipeline

```yaml
stages:
  - security

variables:
  npm_config_cache: "$CI_PROJECT_DIR/.npm"

.security-base:
  image: node:20
  cache:
    key: $CI_COMMIT_REF_SLUG
    paths:
      - .npm

dependency-audit:
  extends: .security-base
  stage: security
  script:
    - npm ci
    - npm audit --audit-level=high
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"

license-compliance:
  extends: .security-base
  stage: security
  script:
    - npm ci
    - npx license-checker --failOn "GPL-3.0;AGPL-3.0"
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

container-scan:
  stage: security
  image: docker:stable
  services:
    - docker:dind
  script:
    - docker build -t $CI_PROJECT_NAME .
    - docker run --rm -v /var/run/docker.sock:/var/run/docker.sock
      aquasec/trivy image --severity HIGH,CRITICAL $CI_PROJECT_NAME
```

## Dependabot / Renovate

### Dependabot Full Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"
    commit-message:
      prefix: "chore(deps)"
    groups:
      development:
        dependency-type: "development"
        update-types:
          - "minor"
          - "patch"
      production-minor:
        dependency-type: "production"
        update-types:
          - "minor"
          - "patch"
    ignore:
      # Ignore major updates for specific packages
      - dependency-name: "typescript"
        update-types: ["version-update:semver-major"]
```

### Renovate Advanced Configuration

```json
// renovate.json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:base",
    ":semanticCommits",
    ":preserveSemverRanges",
    "security:openssf-scorecard"
  ],
  "timezone": "America/New_York",
  "schedule": ["before 6am on Monday"],
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security"],
    "assignees": ["security-team"]
  },
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "matchCurrentVersion": "!/^0/",
      "automerge": true
    },
    {
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true
    },
    {
      "matchPackageNames": ["typescript", "eslint"],
      "matchUpdateTypes": ["major"],
      "enabled": false
    },
    {
      "matchPackagePatterns": ["^@types/"],
      "automerge": true,
      "major": {
        "automerge": false
      }
    }
  ],
  "prCreation": "not-pending",
  "prConcurrentLimit": 5,
  "branchConcurrentLimit": 10
}
```
