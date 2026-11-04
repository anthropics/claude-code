---
description: Analyze outdated dependencies and create smart update strategy
argument-hint: "[--major] [--security-only] [--interactive]"
allowed-tools: Bash(npm:*), Bash(yarn:*), Bash(pnpm:*), Bash(pip:*), Bash(cargo:*), Bash(cat:*), Bash(jq:*), Glob, Grep, Read
---

## Context

You are a dependency maintenance expert. Your task is to analyze outdated packages and create a safe, prioritized update strategy.

### Project Detection

- Package manifest: !`cat package.json 2>/dev/null | jq '{dependencies, devDependencies}' 2>/dev/null | head -40`
- Outdated packages: !`npm outdated --json 2>/dev/null | head -50`

## Analysis Process

### Step 1: Gather Outdated Information

Run the appropriate command:

**npm:**
```bash
npm outdated --json
```

**yarn:**
```bash
yarn outdated --json
```

**pip:**
```bash
pip list --outdated --format=json
```

**Cargo:**
```bash
cargo outdated --format json
```

### Step 2: Categorize Updates

For each outdated package, determine:

1. **Update Type:**
   - 🔴 Major (breaking changes likely)
   - 🟡 Minor (new features, should be safe)
   - 🟢 Patch (bug fixes, safe)

2. **Priority:**
   - 🚨 Security (has known vulnerabilities)
   - ⚠️ Unmaintained (no updates in 2+ years)
   - 📦 Technical debt (many versions behind)
   - 💡 Feature (new capabilities available)

3. **Risk Assessment:**
   - Breaking changes documented?
   - Migration guide available?
   - Community adoption of new version?

### Step 3: Research Each Update

For major updates, check:
- GitHub releases/changelog
- Breaking changes
- Migration guides
- Community issues

### Step 4: Create Update Strategy

## Output Format

```markdown
# Dependency Update Report

**Project:** [project name]
**Date:** [current date]

## Summary

| Category | Count | Action |
|----------|-------|--------|
| 🚨 Security Updates | X | Update immediately |
| 🟢 Patch Updates | X | Safe to update |
| 🟡 Minor Updates | X | Review then update |
| 🔴 Major Updates | X | Plan migration |
| ⚠️ Unmaintained | X | Consider replacing |

**Total Outdated:** X
**Safe Auto-update:** X

---

## Priority 1: Security Updates 🚨

These should be updated immediately.

| Package | Current | Latest | Vulnerability |
|---------|---------|--------|---------------|
| lodash | 4.17.15 | 4.17.21 | CVE-2021-23337 (Prototype Pollution) |

**Command:**
```bash
npm install lodash@4.17.21
```

---

## Priority 2: Patch Updates 🟢

Safe updates with bug fixes only.

| Package | Current | Latest | Changes |
|---------|---------|--------|---------|
| axios | 1.4.0 | 1.4.1 | Bug fixes |

**Command:**
```bash
npm update  # Updates all patch versions
```

---

## Priority 3: Minor Updates 🟡

New features, generally backward compatible.

| Package | Current | Latest | Notable Changes |
|---------|---------|--------|-----------------|
| react | 18.2.0 | 18.3.0 | New hooks, performance improvements |

**Recommended:** Review changelog before updating.

---

## Priority 4: Major Updates 🔴

Breaking changes - require migration planning.

### `typescript` 4.9.5 → 5.4.0

**Breaking Changes:**
- Stricter type checking
- Deprecated options removed
- New config format

**Migration Guide:** https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html

**Effort Estimate:** Medium (2-4 hours)

**Recommended Steps:**
1. Read migration guide
2. Update in separate branch
3. Run type checker
4. Fix errors
5. Run tests

---

## Unmaintained Packages ⚠️

Consider replacing these abandoned packages.

| Package | Last Update | Stars | Alternative |
|---------|-------------|-------|-------------|
| moment | 2 years ago | 47k | dayjs, date-fns |
| request | 3 years ago | 25k | axios, got, node-fetch |

---

## Update Plan

### Week 1: Critical
- [ ] Security updates
- [ ] Patch updates

### Week 2: Standard
- [ ] Minor updates (test thoroughly)

### Week 3+: Planned
- [ ] Major updates (one at a time)
- [ ] Replace unmaintained packages

---

## Auto-Update Commands

**Safe updates only (patch):**
```bash
npm update
```

**All non-major updates:**
```bash
npx npm-check-updates -u --target minor && npm install
```

**Interactive update:**
```bash
npx npm-check-updates -i
```
```
