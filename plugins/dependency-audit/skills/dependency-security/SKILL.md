---
name: Dependency Security Best Practices
description: Use this skill when implementing dependency security policies, setting up security automation, or learning about supply chain security. Covers npm, pip, cargo, maven security practices.
version: 1.0.0
---

# Dependency Security Best Practices

This skill provides comprehensive guidance on securing your software supply chain and managing dependencies safely.

## Overview

Modern applications can have hundreds of dependencies, each representing a potential security risk. This skill covers:

- Security scanning and auditing
- License compliance
- Update strategies
- Supply chain attack prevention
- CI/CD security integration

## Core Security Principles

### 1. Minimal Dependencies

**Less is more:**
- Evaluate necessity before adding dependencies
- Prefer well-maintained, popular packages
- Consider implementing simple functionality yourself
- Remove unused dependencies regularly

**Evaluation checklist:**
- [ ] Do we really need this package?
- [ ] Can we use a smaller alternative?
- [ ] Is it actively maintained?
- [ ] What are its transitive dependencies?

### 2. Lock Files

**Always commit lock files:**

| Package Manager | Lock File |
|-----------------|-----------|
| npm | package-lock.json |
| yarn | yarn.lock |
| pnpm | pnpm-lock.yaml |
| pip | requirements.txt (pinned) / Pipfile.lock |
| cargo | Cargo.lock |
| composer | composer.lock |

**Why:**
- Ensures reproducible builds
- Prevents surprise updates
- Detects tampering via integrity checks

### 3. Version Pinning

**Strategies:**

```json
// Exact version (most secure)
"lodash": "4.17.21"

// Patch updates only
"lodash": "~4.17.21"

// Minor updates (careful)
"lodash": "^4.17.21"

// Never use in production
"lodash": "*"
"lodash": "latest"
```

**Recommendation:** Use exact versions for critical dependencies, allow patch updates for others.

### 4. Registry Security

**Private registries:**
```ini
# .npmrc
@company:registry=https://npm.company.com/
//npm.company.com/:_authToken=${NPM_TOKEN}
```

**Prevent dependency confusion:**
```json
// package.json
{
  "name": "@company/my-package",
  "publishConfig": {
    "registry": "https://npm.company.com/"
  }
}
```

## Security Scanning

### npm

```bash
# Basic audit
npm audit

# JSON output for CI
npm audit --json

# Fix automatically
npm audit fix

# Fix with breaking changes (careful!)
npm audit fix --force
```

### yarn

```bash
yarn audit

# With specific severity
yarn audit --level high
```

### pip

```bash
# Install pip-audit
pip install pip-audit

# Run audit
pip-audit

# With fix suggestions
pip-audit --fix
```

### cargo

```bash
# Install cargo-audit
cargo install cargo-audit

# Run audit
cargo audit

# Fix vulnerabilities
cargo audit fix
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Audit

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run security audit
        run: npm audit --audit-level=high

      - name: Check for outdated packages
        run: npm outdated || true
```

### GitLab CI

```yaml
security-audit:
  stage: test
  script:
    - npm ci
    - npm audit --audit-level=high
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
```

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: npm-audit
        name: npm audit
        entry: npm audit --audit-level=high
        language: system
        pass_filenames: false
```

## License Compliance

### Understanding Licenses

**Permissive (Generally Safe):**
| License | Commercial Use | Modification | Distribution | Patent Grant |
|---------|---------------|--------------|--------------|--------------|
| MIT | ✅ | ✅ | ✅ | ❌ |
| Apache-2.0 | ✅ | ✅ | ✅ | ✅ |
| BSD-3-Clause | ✅ | ✅ | ✅ | ❌ |
| ISC | ✅ | ✅ | ✅ | ❌ |

**Copyleft (Careful):**
| License | Commercial Use | Derivative Work | Distribution |
|---------|---------------|-----------------|--------------|
| GPL-3.0 | ✅ | Must be GPL | Source required |
| LGPL-3.0 | ✅ | Dynamic linking OK | Source for changes |
| AGPL-3.0 | ✅ | Network use = distribution | Source required |

### Automated License Checking

```bash
# npm
npx license-checker --summary
npx license-checker --failOn "GPL-3.0;AGPL-3.0"

# pip
pip-licenses --format=markdown
pip-licenses --fail-on="GPL-3.0"
```

### License Policy File

```json
// .licensepolicy.json
{
  "allowed": [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "CC0-1.0"
  ],
  "denied": [
    "GPL-3.0",
    "AGPL-3.0"
  ],
  "requireReview": [
    "LGPL-3.0",
    "MPL-2.0"
  ]
}
```

## Supply Chain Attack Prevention

### Typosquatting Protection

```bash
# Verify package before installing
npm info <package-name>

# Check download stats
npm info <package-name> | grep downloads

# Verify publisher
npm info <package-name> | grep maintainers
```

### Install Script Auditing

```bash
# List packages with install scripts
npm ls --json | jq '.dependencies | to_entries[] | select(.value.scripts | keys | any(. == "preinstall" or . == "postinstall" or . == "install"))'

# Ignore scripts during install (careful - may break packages)
npm install --ignore-scripts
```

### Lockfile Integrity

```bash
# Verify lockfile integrity
npm ci  # Fails if lockfile doesn't match package.json

# Use lockfile-lint
npx lockfile-lint --path package-lock.json --type npm --validate-https --allowed-hosts npm
```

## Update Strategies

### Semantic Versioning

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └── Bug fixes, no API changes
  │     └──────── New features, backward compatible
  └────────────── Breaking changes
```

### Safe Update Process

```bash
# 1. Check what's outdated
npm outdated

# 2. Update patch versions (safest)
npm update

# 3. Update to latest (careful)
npx npm-check-updates -u --target minor
npm install

# 4. Test thoroughly
npm test

# 5. Commit lock file
git add package-lock.json
git commit -m "chore: update dependencies"
```

### Automated Updates

**Dependabot (.github/dependabot.yml):**
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    groups:
      development:
        dependency-type: "development"
      production:
        dependency-type: "production"
```

**Renovate (renovate.json):**
```json
{
  "extends": ["config:base"],
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true
    },
    {
      "matchUpdateTypes": ["major"],
      "labels": ["breaking-change"]
    }
  ]
}
```

## Emergency Response

### When a Vulnerability is Discovered

1. **Assess Impact**
   - Is the vulnerable code path used?
   - What data is at risk?
   - Is it in production?

2. **Check for Fix**
   - Is there a patched version?
   - Is there a workaround?

3. **Remediate**
   ```bash
   # Update specific package
   npm install package@fixed-version

   # If no fix, consider alternatives
   npm uninstall vulnerable-package
   npm install secure-alternative
   ```

4. **Verify**
   ```bash
   npm audit
   npm test
   ```

5. **Document**
   - Record the incident
   - Update security procedures
   - Consider additional protections

### When a Package is Compromised

1. **Immediately:**
   - Pin to last known good version
   - Block CI/CD from updating
   - Alert team

2. **Investigate:**
   - Check if compromised version was installed
   - Review for malicious behavior
   - Check logs for suspicious activity

3. **Remediate:**
   - Remove compromised package
   - Rotate any potentially exposed credentials
   - Consider forensic analysis

## Security Checklist

### Project Setup
- [ ] Lock files committed and up-to-date
- [ ] Security audit in CI/CD
- [ ] Automated dependency updates configured
- [ ] License policy defined

### Ongoing Maintenance
- [ ] Weekly dependency review
- [ ] Monthly security audit
- [ ] Quarterly major updates evaluation
- [ ] Annual full dependency review

### New Dependency Evaluation
- [ ] Check security history
- [ ] Verify maintainer reputation
- [ ] Review install scripts
- [ ] Check license compatibility
- [ ] Evaluate transitive dependencies
