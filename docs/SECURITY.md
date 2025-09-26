# 🔐 Security Best Practices

*Comprehensive security guide for Claude Code & GitHub integration*

## 🎯 Security Philosophy

**Core Principle**: API keys and secrets are the keys to your AI kingdom. Treat them with the highest security standards.

## 🔒 API Key Security

### **✅ DO: Secure Storage**

**GitHub Actions (Production):**
- ✅ Store in GitHub Repository Secrets (`ANTHROPIC_API_KEY`)
- ✅ Use GitHub's encrypted secret storage
- ✅ Secrets are never visible in logs or PR comments
- ✅ Only accessible during workflow execution

**Local Development:**
- ✅ Store in `.env.local` (protected by `.gitignore`)
- ✅ Use personal API keys, not shared keys
- ✅ Rotate keys regularly (quarterly recommended)

### **❌ DON'T: Common Mistakes**

- ❌ **Never commit API keys to repository**
- ❌ **Never put keys in `.env` files without `.local` suffix**
- ❌ **Never share keys in team chat/email**
- ❌ **Never use production keys for local development**
- ❌ **Never commit `.env.local` files**

---

## 🛡️ Environment Variable Protection

### **Comprehensive .gitignore Coverage:**

```gitignore
# 🔐 Environment Variables (NEVER commit these!)
.env
.env.local
.env.*.local

# 🔒 Security & Secrets
*.key
*.pem
*.p12
*.pfx
secrets/
.secrets/
```

### **File Structure Security:**
```
✅ .env.example        # Template (safe to commit)
✅ .env.local          # Your keys (gitignored)  
❌ .env               # Dangerous (easily committed)
```

### **Environment Variable Hygiene:**

**Check for leaked variables:**
```bash
# Verify no GitHub tokens in environment
printenv | grep -i github | grep -v PATH

# Should be empty after our GITHUB_TOKEN cleanup
```

**Clean environment testing:**
```bash
# Test with clean environment
env -i PATH="$PATH" bash -c "echo 'Clean environment test'"
```

---

## 🔐 GitHub Security

### **Repository Secrets Configuration:**

**Required Secrets:**
- `ANTHROPIC_API_KEY`: Your Claude API key
- `GITHUB_TOKEN`: Automatically provided (never set manually)

**Security Settings:**
1. **Repository Settings** > **Secrets and variables** > **Actions**
2. **Environment protection**: Consider using environments for production
3. **Secret access**: Limit to necessary workflows only

### **GitHub App Permissions (Least Privilege):**

**Claude GitHub App Minimum Permissions:**
- ✅ Contents: Read & Write (for code access)
- ✅ Issues: Read & Write (for @claude mentions)
- ✅ Pull Requests: Read & Write (for automated reviews)
- ❌ Admin: Not required
- ❌ Settings: Not required

### **Branch Protection Rules:**
```
Main Branch Protection:
✅ Require pull request reviews
✅ Require status checks (including Claude reviews)
✅ Require up-to-date branches
✅ Restrict pushes to main branch
```

---

## 🚨 Authentication Security

### **GITHUB_TOKEN Issue Resolution:**

**Problem**: Environment variable conflicts override GitHub CLI authentication

**Permanent Solution:**
```bash
# Remove from Windows environment (one-time fix)
powershell.exe -Command "[Environment]::SetEnvironmentVariable('GITHUB_TOKEN', '', 'User')"

# Clear current session
unset GITHUB_TOKEN
export GITHUB_TOKEN=""

# Re-authenticate properly
gh auth login --hostname github.com --web --scopes 'repo,workflow'
```

**Prevention:**
- Restart VS Code after environment cleanup
- Monitor for environment variable resurrection
- Use keyring authentication over tokens

---

## 🔍 Security Monitoring

### **API Key Rotation Schedule:**

**Recommended Rotation:**
- **Personal Development Keys**: Every 90 days
- **Production/Shared Keys**: Every 30 days
- **Compromised Keys**: Immediately

**Rotation Process:**
1. Generate new key at https://console.anthropic.com/settings/keys
2. Update GitHub repository secret
3. Update local `.env.local`  
4. Delete old key from Anthropic console
5. Test all workflows

### **Access Monitoring:**

**Regular Audits:**
```bash
# Check who has repository access
gh api repos/nexcallai/code/collaborators

# Check repository secrets (names only)
gh api repos/nexcallai/code/actions/secrets

# Monitor unusual API usage in Anthropic console
```

---

## 🛠️ Development Security

### **Code Review Security:**

**What Claude Reviews Should Check:**
- No hardcoded secrets or API keys
- Proper input validation and sanitization
- Secure authentication patterns
- OWASP security guidelines compliance
- Dependency vulnerabilities

**Manual Security Checks:**
```bash
# Check for accidentally committed secrets
git log --all --grep="password\|key\|secret\|token" --oneline

# Search codebase for potential secrets
rg -i "api[_-]?key|secret|password|token" --type-not=md
```

### **Dependency Security:**

**Regular Security Audits:**
```bash
# Node.js projects
npm audit
npm audit --fix

# Python projects  
pip-audit

# General dependency scanning
```

**Automated Security:**
- Enable GitHub Dependabot alerts
- Configure automated dependency updates
- Use GitHub Security Advisories

---

## 🌐 Network Security

### **API Endpoint Security:**

**Anthropic API:**
- Always use HTTPS endpoints (`https://api.anthropic.com`)
- Verify SSL certificates
- Use latest API versions
- Monitor rate limits and usage patterns

**GitHub API:**
- Use authenticated requests only
- Respect rate limiting
- Use specific scopes, not broad permissions

### **Local Development:**
```bash
# Secure local environment
export ANTHROPIC_API_BASE_URL="https://api.anthropic.com"
export ANTHROPIC_API_VERSION="2023-06-01"
```

---

## 🚀 Production Security

### **GitHub Actions Workflow Security:**

**Secure Workflow Patterns:**
```yaml
# Use specific action versions, not @latest
uses: anthropics/claude-code-action@v1.2.3

# Limit permissions
permissions:
  contents: read
  pull-requests: write
  issues: write

# Use environment protection for sensitive workflows
environment: production
```

**Secret Access Patterns:**
```yaml
# Secure secret access
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  # Never log or echo secrets
```

### **Incident Response:**

**If API Key is Compromised:**
1. **Immediately revoke** key in Anthropic console
2. **Generate new key** and update all locations
3. **Review access logs** for unusual activity
4. **Audit recent AI interactions** for sensitive data
5. **Document incident** and improve processes

---

## 📋 Security Checklist

### **Initial Setup Security:**
- [ ] API keys stored in GitHub Secrets only
- [ ] `.env.local` created and `.gitignore` updated
- [ ] No secrets in committed code
- [ ] GitHub App permissions minimized
- [ ] Branch protection rules enabled

### **Ongoing Security:**
- [ ] API keys rotated quarterly
- [ ] Dependency security audits monthly
- [ ] Access reviews quarterly
- [ ] Security incident response plan documented
- [ ] Team security training current

### **Pre-Production Checklist:**
- [ ] All secrets moved to production environment
- [ ] Workflow permissions reviewed and minimized
- [ ] Rate limiting and monitoring configured
- [ ] Incident response procedures tested

---

## 🔗 Security Resources

**Official Documentation:**
- [Anthropic Security Best Practices](https://docs.anthropic.com/en/docs/security)
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/)

**Security Tools:**
- [GitGuardian](https://gitguardian.com/) - Secret scanning
- [GitHub Advanced Security](https://github.com/features/security) - Code scanning
- [Dependabot](https://dependabot.com/) - Dependency monitoring

---

## 🚨 Security Incidents

**Report Security Issues:**
- **Repository Issues**: Create private security advisory
- **Anthropic Issues**: security@anthropic.com  
- **GitHub Issues**: https://github.com/contact/report-security

**Emergency Contacts:**
- Team Security Lead: [Contact Info]
- DevOps Team: [Contact Info]

---

*🔒 Security is everyone's responsibility. When in doubt, err on the side of caution and ask the team.*