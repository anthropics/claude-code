---
description: Check dependency licenses for compliance issues
argument-hint: "[--policy permissive|copyleft|commercial] [--output json|markdown]"
allowed-tools: Bash(npm:*), Bash(npx:*), Bash(pip:*), Bash(cargo:*), Bash(cat:*), Bash(jq:*), Glob, Grep, Read
---

## Context

You are a license compliance analyst. Your task is to audit all project dependencies for license compatibility and compliance issues.

### Project Detection

- Package manifest: !`cat package.json 2>/dev/null | head -50`
- Current licenses: !`npx license-checker --summary 2>/dev/null || pip-licenses --format=markdown 2>/dev/null | head -30`

## License Audit Process

### Step 1: Extract All Dependencies

Gather the complete dependency tree including:
- Direct dependencies
- Transitive dependencies
- Dev dependencies (note separately)

### Step 2: Identify Licenses

For each dependency, identify:
- SPDX license identifier (MIT, Apache-2.0, GPL-3.0, etc.)
- License file location
- Any dual-licensing options

### Step 3: Categorize by Risk

**🟢 Permissive (Low Risk)**
- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- Unlicense
- CC0-1.0

**🟡 Weak Copyleft (Medium Risk)**
- LGPL-2.1
- LGPL-3.0
- MPL-2.0
- EPL-1.0
- EPL-2.0

**🔴 Strong Copyleft (High Risk for Commercial)**
- GPL-2.0
- GPL-3.0
- AGPL-3.0
- CC-BY-SA

**⚫ Unknown/Problematic**
- UNLICENSED
- Custom licenses
- No license specified
- Commercial/Proprietary

### Step 4: Check Compatibility

Based on the `--policy` flag:

**Permissive Policy (default):**
- ✅ All permissive licenses
- ⚠️ Weak copyleft requires review
- ❌ Strong copyleft blocked
- ❌ Unknown/Proprietary blocked

**Copyleft Policy:**
- ✅ All permissive licenses
- ✅ All copyleft licenses
- ❌ Proprietary blocked

**Commercial Policy:**
- ✅ Permissive only
- ❌ Any copyleft blocked
- ❌ Unknown blocked

## Output Format

```markdown
# License Compliance Report

**Project:** [project name]
**Policy:** [permissive|copyleft|commercial]
**Date:** [current date]

## Summary

| License Type | Count | Status |
|--------------|-------|--------|
| Permissive | X | ✅ Compliant |
| Weak Copyleft | X | ⚠️ Review |
| Strong Copyleft | X | ❌ Non-compliant |
| Unknown | X | ⚠️ Investigate |

**Total Dependencies:** X
**Compliant:** X
**Non-compliant:** X

---

## Non-Compliant Dependencies 🔴

| Package | Version | License | Issue | Action Required |
|---------|---------|---------|-------|-----------------|
| pkg-name | 1.0.0 | GPL-3.0 | Copyleft | Find alternative |

---

## Dependencies Requiring Review 🟡

| Package | Version | License | Reason |
|---------|---------|---------|--------|
| pkg-name | 1.0.0 | LGPL-3.0 | Weak copyleft - check usage |

---

## License Distribution

```
MIT: ████████████████████ 45 (60%)
Apache-2.0: ████████ 20 (27%)
BSD-3-Clause: ███ 8 (11%)
GPL-3.0: █ 2 (3%)
```

---

## Recommendations

### Must Fix
1. Replace `package-name` (GPL-3.0) with `alternative-package` (MIT)

### Should Review
1. Verify `lgpl-package` usage is compliant (dynamic linking only)

### Best Practices
- Add license checking to CI/CD pipeline
- Document accepted licenses in project policy
- Review new dependencies before adding

---

## Export for Legal Review

[JSON export of all licenses for legal team review]
```

### Step 5: Suggest Alternatives

For non-compliant packages, search for alternatives with compatible licenses.
