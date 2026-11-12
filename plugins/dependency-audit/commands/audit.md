---
description: Run comprehensive security audit on project dependencies
argument-hint: "[--severity critical|high|medium|low] [--fix]"
allowed-tools: Bash(npm:*), Bash(yarn:*), Bash(pnpm:*), Bash(pip:*), Bash(cargo:*), Bash(mvn:*), Bash(composer:*), Bash(cat:*), Bash(jq:*), Glob, Grep, Read
---

## Context

You are a security auditor specializing in software supply chain security. Your task is to perform a comprehensive dependency audit.

### Project Detection

- Package files: !`ls -la package.json package-lock.json yarn.lock pnpm-lock.yaml requirements.txt Pipfile Cargo.toml pom.xml composer.json go.mod 2>/dev/null`
- Lock files present: !`find . -maxdepth 2 -name "*.lock" -o -name "*lock*" 2>/dev/null | head -10`

## Audit Process

### Step 1: Detect Package Manager

Identify the project type:
- `package.json` → npm/yarn/pnpm
- `requirements.txt` / `Pipfile` → pip/pipenv
- `Cargo.toml` → Cargo (Rust)
- `pom.xml` / `build.gradle` → Maven/Gradle
- `composer.json` → Composer (PHP)
- `go.mod` → Go modules

### Step 2: Run Native Audit

Execute the appropriate audit command:

**npm/yarn/pnpm:**
```bash
npm audit --json 2>/dev/null || yarn audit --json 2>/dev/null || pnpm audit --json 2>/dev/null
```

**pip (with safety or pip-audit):**
```bash
pip-audit --format=json 2>/dev/null || safety check --json 2>/dev/null
```

**Cargo:**
```bash
cargo audit --json 2>/dev/null
```

**Composer:**
```bash
composer audit --format=json 2>/dev/null
```

### Step 3: Analyze Results

For each vulnerability found, provide:

1. **Package name and version**
2. **Vulnerability ID** (CVE, GHSA, etc.)
3. **Severity** (Critical/High/Medium/Low)
4. **Description** of the vulnerability
5. **Fixed version** (if available)
6. **Exploitability** assessment
7. **Recommendation** (update, replace, or accept risk)

### Step 4: Generate Report

## Output Format

```markdown
# Dependency Security Audit Report

**Project:** [project name]
**Date:** [current date]
**Package Manager:** [detected]

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | X |
| 🟠 High | X |
| 🟡 Medium | X |
| 🟢 Low | X |

**Total Vulnerabilities:** X
**Fixable Automatically:** X

---

## Critical Vulnerabilities 🔴

### CVE-XXXX-XXXXX: [Title]

- **Package:** `package-name@version`
- **Severity:** Critical (CVSS: 9.8)
- **Path:** project → dependency → vulnerable-package
- **Description:** [Brief description]
- **Fix:** Update to `package-name@fixed-version`
- **Command:** `npm install package-name@fixed-version`

---

## High Vulnerabilities 🟠

[Similar format]

---

## Recommendations

### Immediate Actions (Critical/High)
1. [Action 1]
2. [Action 2]

### Short-term (Medium)
1. [Action 1]

### Accepted Risks
[Any vulnerabilities that cannot be fixed with justification]

---

## Auto-fix Command

```bash
[Command to fix all fixable vulnerabilities]
```
```

### Step 5: Offer Fixes

If `--fix` flag is provided, execute safe automatic fixes:
- Only fix vulnerabilities with semver-compatible updates
- Create a summary of changes made
- Warn about breaking changes that require manual review
