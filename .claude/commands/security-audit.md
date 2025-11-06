---
description: Comprehensive security audit using security-expert agent
argument-hint: "[path or scope to audit]"
---

You are performing a **comprehensive security audit** of the codebase. This is critical to protect users and data.

## Audit Scope

Target: $ARGUMENTS

If no specific path provided, audit the entire codebase with focus on security-critical areas.

## Audit Process

### Phase 1: Security Expert Analysis

Launch the **security-expert** agent with thorough instructions:

**Task for security-expert:**

Perform a comprehensive security audit of: $ARGUMENTS

**Critical Areas to Focus On:**

1. **Authentication & Authorization**
   - Look for login mechanisms
   - Check session management
   - Verify access controls
   - Search for: `login`, `auth`, `session`, `jwt`, `token`, `permission`, `authorize`

2. **Input Validation**
   - Find all user input points
   - Check for validation and sanitization
   - Look for injection vulnerabilities
   - Search for: `req.body`, `req.query`, `req.params`, form handlers, API endpoints

3. **SQL Injection**
   - Find database queries
   - Check for string concatenation in queries
   - Verify parameterized queries usage
   - Search for: `query`, `execute`, `SELECT`, string concatenation in SQL

4. **Cross-Site Scripting (XSS)**
   - Find output rendering
   - Check for proper escaping
   - Look for `innerHTML`, `dangerouslySetInnerHTML`
   - Search for: template rendering, HTML generation

5. **Command Injection**
   - Find system command execution
   - Check for user input in commands
   - Search for: `exec`, `spawn`, `eval`, `Function(`

6. **Cryptography**
   - Find password storage
   - Check hashing algorithms
   - Look for hardcoded secrets
   - Search for: `password`, `secret`, `api_key`, `md5`, `sha1`, crypto usage

7. **Data Exposure**
   - Find sensitive data handling
   - Check for logging of sensitive info
   - Look for secrets in code
   - Search for: error handlers, logging statements, config files

8. **API Security**
   - Check for rate limiting
   - Verify authentication on endpoints
   - Look for CORS configuration
   - Search for: API routes, endpoint definitions

9. **Dependencies**
   - Check for known vulnerabilities
   - Review package.json or requirements.txt
   - Suggest: Run `npm audit` or `pip-audit`

Provide a detailed report with:
- **Severity levels** (Critical, High, Medium, Low)
- **Exact locations** (file:line)
- **Proof of concept** or example of vulnerability
- **Impact assessment** (what could happen)
- **Remediation steps** (how to fix)

Only report issues with ≥70% confidence.

### Phase 2: Automated Security Checks

Run automated security tools:

```bash
# For Node.js projects
!`npm audit` || echo "npm audit not available"

# For Python projects
!`pip-audit` || echo "pip-audit not available"

# Check for common secrets patterns
!`git secrets --scan` || echo "git-secrets not available"
```

### Phase 3: Manual Verification

Review the security-expert findings:
1. Verify each reported vulnerability
2. Assess actual risk in context
3. Prioritize fixes by severity and likelihood

### Phase 4: Remediation Plan

Create a prioritization plan:

**Critical Issues (Fix Immediately):**
- [List of critical vulnerabilities]
- Timeline: Fix within 24 hours
- Block deployment until fixed

**High Issues (Fix Before Production):**
- [List of high severity issues]
- Timeline: Fix within 1 week
- Review before next deployment

**Medium Issues (Fix Soon):**
- [List of medium severity issues]
- Timeline: Fix within 1 month
- Schedule in next sprint

**Low Issues (Best Practices):**
- [List of low severity issues]
- Timeline: Fix as time permits
- Track in backlog

### Phase 5: Security Report

Generate a comprehensive security report:

```markdown
# Security Audit Report

**Date**: [Current date]
**Scope**: $ARGUMENTS
**Auditor**: security-expert agent

## Executive Summary
- Total Issues: [Number]
- Critical: [N]
- High: [N]
- Medium: [N]
- Low: [N]

## Critical Findings
[Details from security-expert]

## High Findings
[Details from security-expert]

## Medium Findings
[Details from security-expert]

## Low Findings
[Details from security-expert]

## Security Strengths
[What's done well]

## Immediate Actions Required
1. [Action item 1]
2. [Action item 2]

## Long-term Recommendations
1. [Strategic security improvements]
2. [Process improvements]
3. [Tools to adopt]

## Next Steps
- [ ] Fix critical issues
- [ ] Implement high priority fixes
- [ ] Schedule medium priority fixes
- [ ] Document security decisions
- [ ] Set up security monitoring
```

## After the Audit

Recommended follow-up actions:

1. **Fix Critical Issues** - Do this immediately
2. **Update Security Practices** - Document learnings
3. **Add Security Tests** - Prevent regressions
4. **Set Up Security Monitoring** - Detect issues early
5. **Schedule Regular Audits** - Quarterly security reviews
6. **Security Training** - Share findings with team

---

**Remember**: Security is not a one-time check. It's an ongoing process. This audit is the first step toward building a more secure system. 🔒

**Important**: If critical vulnerabilities are found, prioritize fixing them over all other work. A security breach can destroy user trust and have serious legal/financial consequences.
