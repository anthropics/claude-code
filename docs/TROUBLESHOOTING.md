# 🛠️ Troubleshooting Guide

*Solutions to common issues encountered during Claude Code & GitHub setup*

## 🚨 Authentication Issues

### Problem: GITHUB_TOKEN Environment Variable Conflicts

**Symptoms:**
```bash
gh auth status
# Shows: "Failed to log in using token (GITHUB_TOKEN) - token is invalid"
# Even after running gh auth login successfully
```

**Root Cause:**
- `GITHUB_TOKEN` set as Windows User Environment Variable
- Overrides GitHub CLI's stored keyring credentials
- Often set by VS Code/GitHub Copilot extension

**💡 SOLUTION (Permanent Fix):**

1. **Remove from Windows Environment:**
   ```bash
   powershell.exe -Command "[Environment]::SetEnvironmentVariable('GITHUB_TOKEN', '', 'User')"
   ```

2. **Clear current session:**
   ```bash
   unset GITHUB_TOKEN
   export GITHUB_TOKEN=""
   ```

3. **Re-authenticate GitHub CLI:**
   ```bash
   gh auth logout --hostname github.com
   gh auth login --hostname github.com --web --scopes 'repo,workflow'
   ```

4. **Restart VS Code** to prevent re-setting the environment variable

**Verification:**
```bash
gh auth status  # Should show keyring authentication as active
printenv | grep -i github  # Should NOT show GITHUB_TOKEN
```

---

### Problem: GitHub CLI Can't Create Pull Requests

**Symptoms:**
```bash
gh pr create --repo nexcallai/code --title "Test"
# Error: HTTP 401: Bad credentials
```

**Solutions:**

**Option A: Use Manual PR Creation**
- Git provides direct link when pushing: `https://github.com/nexcallai/code/pull/new/branch-name`

**Option B: Clean Environment Execution**
```bash
env -i PATH="$PATH" bash -c "gh auth login && gh pr create ..."
```

---

### Problem: GitHub App Installation Failed

**Symptoms:**
```bash
/install-github-app
# Error: Failed to access repository nexcallai/code
```

**Root Causes:**
- Authentication conflicts (GITHUB_TOKEN issues above)
- Repository permissions (need admin access)
- Fork limitations (some GitHub Apps prefer main repos)

**💡 SOLUTION: Manual Installation**

1. **Install Claude GitHub App:**
   - Visit: https://github.com/apps/claude
   - Click "Install" and select repository

2. **Add Repository Secret:**
   - Go to: `https://github.com/nexcallai/code/settings/secrets/actions`
   - Create: `ANTHROPIC_API_KEY` with your API key

3. **Verify Permissions:**
   - Contents: Read & Write
   - Issues: Read & Write
   - Pull Requests: Read & Write

---

## 🔧 Environment Issues

### Problem: .env Files Not Loading

**Check File Locations:**
```bash
ls -la .env*
# Should show: .env.local (your keys) and .env.example (template)
```

**Check .gitignore Protection:**
```bash
grep -n "\.env" .gitignore
# Should include: .env, .env.local, .env.*.local
```

---

### Problem: Wrong Claude Model Names

**Incorrect (Old Names):**
```bash
CLAUDE_CODE_MODEL=claude-3-5-sonnet-20241022  # Outdated
```

**✅ CORRECT (2025 API Names):**
```bash
# Choose based on task complexity:
CLAUDE_CODE_MODEL=claude-opus-4-1-20250805      # Complex tasks
CLAUDE_CODE_MODEL=claude-sonnet-4-20250514      # Daily tasks  
CLAUDE_CODE_MODEL=claude-3-5-haiku-20241022     # Quick tasks
```

---

## ⚙️ Workflow Issues

### Problem: Claude Actions Not Triggering

**Check Workflow File:**
```bash
ls -la .github/workflows/claude.yml
```

**Check Repository Secrets:**
- Verify `ANTHROPIC_API_KEY` exists in repository secrets
- Key should start with `sk-ant-`

**Test Trigger:**
- Comment `@claude` on any PR or issue
- Should see GitHub Action start running

---

### Problem: Copilot Not Following Instructions

**Check Instructions File:**
```bash
ls -la .github/copilot-instructions.md
```

**Verify Format:**
- File must be exactly `.github/copilot-instructions.md`
- Must be in Markdown format
- Must be committed to repository

**Test Instructions:**
- Write code and see if Copilot suggests following your style rules
- May take a few minutes to take effect after committing

---

## 🔍 Diagnostic Commands

**Check Authentication:**
```bash
gh auth status
printenv | grep -i github
```

**Check Repository Setup:**
```bash
git remote -v
git status
ls -la .github/
```

**Check Environment:**
```bash
ls -la .env*
head -5 .env.local  # Should show your API key (first few chars only)
```

**Check Models:**
```bash
curl https://api.anthropic.com/v1/models \
     --header "x-api-key: $ANTHROPIC_API_KEY" \
     --header "anthropic-version: 2023-06-01"
```

---

## 🆘 Still Having Issues?

1. **Restart everything:**
   - Close terminal/VS Code completely
   - Restart and try again

2. **Check order of operations:**
   - GitHub App installation first
   - Repository secrets second
   - Local environment third

3. **Verify repository permissions:**
   - Must have admin access to install GitHub Apps
   - Must have push access for Actions

---

## 📚 Quick Reference Links

- **Anthropic API Keys**: https://console.anthropic.com/settings/keys
- **GitHub CLI Docs**: https://cli.github.com/manual/
- **Claude GitHub App**: https://github.com/apps/claude
- **Repository Secrets**: https://github.com/nexcallai/code/settings/secrets/actions

---

*💡 Most issues stem from environment variable conflicts or authentication problems. The permanent fixes above resolve 95% of setup issues.*