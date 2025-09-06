# 👥 Team Onboarding Guide

*Get new team members productive with Claude Code & GitHub Copilot in 30 minutes*

## 🎯 Welcome to AI-Assisted Development!

This repository uses cutting-edge AI tools to supercharge our development workflow:
- **GitHub Copilot**: Smart code completion with custom instructions
- **Claude Code Actions**: Automated PR reviews via `@claude` mentions
- **Model Selection**: Right AI tool for the right job

## ⚡ Quick Start (30-Minute Setup)

### **Step 1: Prerequisites (5 minutes)**
- [ ] **GitHub Account**: Repository access to `nexcallai/code`
- [ ] **Anthropic Account**: Sign up at https://console.anthropic.com
- [ ] **Max Plan**: Upgrade for access to latest models
- [ ] **GitHub CLI**: Install from https://cli.github.com

### **Step 2: API Keys (5 minutes)**
1. **Get Your Claude API Key**:
   - Visit: https://console.anthropic.com/settings/keys
   - Click "Create API key" 
   - Name: "Personal Development - [Your Name]"
   - Copy the key (starts with `sk-ant-`)

2. **Store Securely**:
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Edit .env.local and add your key
   ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
   ```

### **Step 3: Local Setup (10 minutes)**
1. **Clone Repository**:
   ```bash
   git clone https://github.com/nexcallai/code.git
   cd code
   ```

2. **Configure Git**:
   ```bash
   git config user.name "Your Name"
   git config user.email "your.email@company.com"
   ```

3. **Authenticate GitHub CLI**:
   ```bash
   gh auth login --hostname github.com --web
   ```

### **Step 4: Test Setup (5 minutes)**
1. **Verify Environment**:
   ```bash
   # Should show your API key
   head -1 .env.local
   
   # Should show GitHub authentication
   gh auth status
   ```

2. **Test Claude Access**:
   ```bash
   # Test API connection
   curl https://api.anthropic.com/v1/models \
        --header "x-api-key: $ANTHROPIC_API_KEY" \
        --header "anthropic-version: 2023-06-01"
   ```

### **Step 5: First AI Interaction (5 minutes)**
1. **Create Test Branch**:
   ```bash
   git checkout -b test-setup-$(date +%s)
   ```

2. **Test Copilot**: Start typing code - Copilot should follow our custom instructions
3. **Test Claude**: Create a PR and comment `@claude please review this setup`

---

## 🎓 Learning Path

### **Week 1: Basics**
- [ ] Read [SETUP.md](./SETUP.md) - Complete setup guide
- [ ] Read [MODELS.md](./MODELS.md) - Model selection strategy
- [ ] Practice with Sonnet 4 (daily driver)
- [ ] Create your first `@claude` PR review

### **Week 2: Intermediate** 
- [ ] Read [SECURITY.md](./SECURITY.md) - Security best practices
- [ ] Try different models for different tasks
- [ ] Learn GitHub Copilot custom instructions
- [ ] Set up personal shortcuts and workflows

### **Week 3: Advanced**
- [ ] Read [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [ ] Experiment with Opus 4.1 for complex tasks
- [ ] Optimize your model switching strategy
- [ ] Help onboard the next team member!

---

## 🛠️ Daily Workflows

### **Morning Routine:**
1. **Pull Latest Changes**:
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Check Environment**:
   ```bash
   # Verify your setup is working
   echo $CLAUDE_CODE_MODEL  # Should show current model
   gh auth status           # Should show authenticated
   ```

### **Feature Development:**
1. **Create Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Choose Your AI Model** (see [MODELS.md](./MODELS.md)):
   - 🎯 **Sonnet 4**: Default for daily development
   - 🚀 **Opus 4.1**: Complex features or architecture
   - ⚡ **Haiku 3.5**: Quick fixes or utilities

3. **Code with AI Assistance**:
   - Let GitHub Copilot suggest code following our standards
   - Use Claude for complex problem-solving
   - Follow our TypeScript and security guidelines

4. **Create PR with AI Review**:
   ```bash
   git push -u origin feature/your-feature-name
   # Use the provided GitHub link to create PR
   # Add comment: "@claude please review this feature"
   ```

---

## 🎯 Best Practices

### **AI Model Selection:**
```bash
# Daily development (80% of time)
CLAUDE_CODE_MODEL=claude-sonnet-4-20250514

# Complex tasks (15% of time) 
CLAUDE_CODE_MODEL=claude-opus-4-1-20250805

# Quick fixes (5% of time)
CLAUDE_CODE_MODEL=claude-3-5-haiku-20241022
```

### **Effective AI Prompting:**

**Good Prompts:**
- "Implement user authentication with JWT, following our security guidelines"
- "Review this function for performance and suggest optimizations"
- "Create unit tests for this payment processing module"

**Avoid:**
- Vague requests: "make this better"
- Security-sensitive: Never share actual passwords/keys
- Overly broad: "rewrite this entire system"

### **Code Review with Claude:**

**Trigger Claude Reviews:**
```
@claude please review this PR for:
- Security best practices
- TypeScript compliance
- Test coverage
- Performance considerations
```

---

## 🔧 Troubleshooting Quick Fixes

### **Common Issues:**

**GitHub CLI Not Working:**
```bash
# Clear environment conflicts
unset GITHUB_TOKEN
gh auth login --web
```

**API Key Not Working:**
```bash
# Check your key format
echo $ANTHROPIC_API_KEY | head -c 10  # Should start with "sk-ant-"
```

**Copilot Not Following Instructions:**
- Check `.github/copilot-instructions.md` exists and is committed
- May take 5-10 minutes after committing to take effect
- Try restarting VS Code/your editor

**For detailed troubleshooting**, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 🤝 Team Communication

### **Slack Channels:**
- `#ai-development` - AI tool discussions and tips
- `#code-reviews` - PR discussions and Claude review results  
- `#devops` - Setup issues and infrastructure

### **When to Ask for Help:**
- ✅ Setup issues after trying troubleshooting guide
- ✅ Model selection questions for specific tasks
- ✅ Security concerns about AI code suggestions
- ✅ Performance optimization with Claude

### **How to Share Knowledge:**
- Document successful AI patterns in team wiki
- Share effective prompts in `#ai-development`
- Add to troubleshooting guide if you solve new issues

---

## 📚 Resources

### **Essential Reading:**
- [SETUP.md](./SETUP.md) - Complete setup guide
- [MODELS.md](./MODELS.md) - Model selection strategy
- [SECURITY.md](./SECURITY.md) - Security best practices
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues

### **External Links:**
- **Anthropic Console**: https://console.anthropic.com
- **Claude Documentation**: https://docs.anthropic.com
- **GitHub Copilot Guide**: https://docs.github.com/copilot
- **GitHub CLI**: https://cli.github.com/manual/

### **Team Knowledge Base:**
- Company Wiki: [Internal Link]
- AI Best Practices: [Internal Link]
- Code Standards: [Internal Link]

---

## 📋 Onboarding Checklist

### **Self-Assessment:**
- [ ] Can create and push feature branches
- [ ] GitHub Copilot follows our custom instructions
- [ ] Can trigger Claude PR reviews with `@claude`
- [ ] Understand when to use different Claude models
- [ ] Know security best practices for API keys
- [ ] Can troubleshoot common setup issues

### **Manager/Mentor Review:**
- [ ] Completed first week learning path
- [ ] Successfully created PR with Claude review
- [ ] Demonstrated understanding of model selection
- [ ] Followed security practices in code
- [ ] Comfortable with daily AI-assisted workflow

---

## 🎉 You're Ready!

Congratulations! You're now equipped with our AI-powered development workflow. You have access to:

- **Smart Code Completion** (GitHub Copilot)
- **Automated Code Reviews** (Claude Actions)
- **Flexible AI Models** (Opus/Sonnet/Haiku)
- **Security Best Practices**
- **Team Support System**

**Remember**: AI is here to augment your skills, not replace them. Use your judgment, follow security practices, and don't hesitate to ask the team for guidance!

---

*🚀 Welcome to the future of development! Let's build amazing things together with AI.*