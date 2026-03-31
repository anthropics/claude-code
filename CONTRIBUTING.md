# Contributing to Claude Code Plugins

Thank you for your interest in contributing to our plugin ecosystem! This guide will help you create amazing plugins that extend Claude Code.

## Ways to Contribute

### 1. **Create New Plugins** (⭐ Most Valuable)
Build a plugin solving a specific development problem:
- Domain-specific tooling (e.g., Docker workflows, Kubernetes validation)
- Language-specific helpers (e.g., Rust safety checks, Go concurrency)
- Industry-specific tools (e.g., healthcare compliance, fintech security)
- Integration plugins (GitHub, GitLab, Jira, Datadog, etc.)

### 2. **Improve Existing Plugins**
- Enhance accuracy of analysis
- Add new features/commands
- Improve performance
- Better error messages
- More comprehensive documentation

### 3. **Report Issues & Feedback**
- Bug reports with reproducible steps
- Performance issues
- Feature requests
- Documentation improvements

### 4. **Improve Documentation**
- Add examples
- Clarify complex concepts
- Translate to other languages
- Create video tutorials

### 5. **Test & Validation**
- Test plugins on real projects
- Report edge cases
- Suggest optimizations

---

## Plugin Development Guide

### Step 1: Plan Your Plugin

Before coding, ask yourself:
- **What problem does it solve?**
- **What's the target audience?** (all developers? specific domain?)
- **What category?** (development, productivity, security, learning)
- **One command or multiple?**

### Step 2: Create Plugin Structure

```bash
cd plugins/
mkdir your-plugin-name/
cd your-plugin-name/
```

Create these files:
```
your-plugin-name/
├── README.md                          # User documentation
├── commands/
│   ├── your-command-1.md              # Command implementation
│   └── your-command-2.md              # (optional)
└── agents/                            # (optional)
    └── specialist.md                  # Multi-agent implementation
```

### Step 3: Write README.md

```markdown
# Your Plugin Name

## Description
Clear, concise explanation of what it does.

## Commands

### `/your-command`
Description of the command functionality.

**Usage:**
\`\`\`
/your-command [arguments]
\`\`\`

**Example:**
\`\`\`
/your-command --option value
\`\`\`

## Features
- Feature 1
- Feature 2

## Configuration
Optional configuration instructions.
```

### Step 4: Write Commands

Each command is a Markdown file with YAML frontmatter:

```markdown
---
description: "Clear description of what this command does"
category: "development|productivity|security|learning"
---

# Command Name

You are an expert [domain specialist]. Your role is to [specific task].

## Your Process

### Step 1: [First step]
- Action 1
- Action 2

### Step 2: [Second step]
- Action 1
- Action 2

## Output Format

Report results as:
\`\`\`
[formatted output]
\`\`\`
```

### Example Plugin: Language Validator

```markdown
---
description: "Validates code syntax across multiple languages"
category: "development"
---

# Language Syntax Validator

You are an expert code validator across JavaScript, TypeScript, Python, Go, Rust, and Java.

## Your Role
Analyze code files and report syntax errors with fixes.

## Validation Process

### Step 1: Detect Language
- Check file extension
- Analyze import statements
- Identify language syntax

### Step 2: Parse Code
- Use language-specific parser
- Identify syntax errors
- Record line numbers

### Step 3: Report Findings
Report as:
\`\`\`
SYNTAX VALIDATION REPORT
======================

✓ VALID: src/main.rs (Rust code, correct syntax)

❌ ERROR: src/app.js (line 45)
  Error: Unexpected token }
  Fix: Remove extra closing brace
\`\`\`
```

### Step 5: Update marketplace.json

Add your plugin to the registry:

```json
{
  "id": "your-plugin-name",
  "name": "Your Plugin Name",
  "description": "What it does",
  "version": "1.0.0",
  "author": "Your Name",
  "source": "plugins/your-plugin-name",
  "category": "development"
}
```

### Step 6: Test Locally

```bash
# Launch Claude Code
claude

# Try your command
/your-command

# Test with different inputs
/your-command --option value
```

---

## Best Practices

### ✅ DO:
- **Be specific:** Clear descriptions, precise outputs
- **Be helpful:** Explain not just what's wrong, but how to fix it
- **Be safe:** Never auto-merge/delete without confidence scoring
- **Be fast:** Optimize for performance
- **Be clear:** Use tables, lists, code blocks for readability
- **Guide users:** Provide examples and common use cases
- **Handle errors:** Gracefully report what went wrong

### ❌ DON'T:
- **Assume context:** Explain what you're doing step-by-step
- **Be too clever:** Prioritize clarity over brevity
- **Hardcode secrets:** Use environment variables
- **Make breaking changes:** Maintain backward compatibility
- **Use jargon:** Explain technical terms
- **Ignore edge cases:** Test with unusual inputs

---

## Plugin Categories

### Development
For tools that improve coding: architecture, patterns, refactoring, testing, performance, code generation

**Examples:** architecture-enforcer, dead-code-cremator, fullstack-automation

### Productivity  
For tools that save time: automation, CI/CD, DevOps, deployment, monitoring

**Examples:** autonomous-pr-agent, dependency-sentinel, enterprise-knowledge

### Security
For security and compliance: vulnerability scanning, secrets detection, compliance checking

**Examples:** security-audit-bot, predictive-bug-prevention

### Learning
For education and mentorship: tutorials, best practices, learning

**Examples:** code-mentorship

---

## Confidence Scoring

Always provide confidence scores:

```
confidence = (data_quality × 0.4) + (pattern_certainty × 0.3) + (validation_checks × 0.3)

0.90-1.00  ✅ Safe - Immediate action
0.75-0.89  ⚠️  Recommend with confirmation
0.60-0.74  🔍 Manual review recommended
<0.60      ⛔ Flag for human decision
```

---

## Common Plugin Patterns

### Pattern 1: Analysis + Report
```
1. Analyze code/project
2. Identify issues
3. Report with severity
4. Suggest fixes
```

### Pattern 2: Analysis + Auto-Fix
```
1. Analyze code/project
2. Identify issues
3. Auto-fix with behavior preservation
4. Report changes
5. Confidence scoring before applying
```

### Pattern 3: Generation
```
1. Parse requirements
2. Generate code/schema/config
3. Validate generated output
4. Report with explanation
```

### Pattern 4: Multi-Agent Consensus
```
1. Multiple agents analyze independently
2. Compare findings
3. Vote on recommendations
4. Report consensus + dissenting opinions
```

---

## Testing Checklist

Before submitting:
- [ ] README is clear and complete
- [ ] Command definition has YAML frontmatter
- [ ] Examples are accurate and working
- [ ] Tested with various inputs
- [ ] Error handling works well
- [ ] Output is formatted consistently
- [ ] No hardcoded secrets
- [ ] marketplace.json updated
- [ ] Code quality is high
- [ ] Performance is acceptable

---

## Submission Process

1. **Fork** the repository
2. **Create branch** with plugin name: `git checkout -b feature/my-awesome-plugin`
3. **Develop** plugin following the guide above
4. **Test** thoroughly locally
5. **Commit** with clear messages:
   ```bash
   git add plugins/my-plugin/
   git commit -m "Add my-plugin: description of capabilities"
   ```
6. **Push** to your fork: `git push origin feature/my-awesome-plugin`
7. **Create PR** with:
   - Title: "Add plugin: [Name]"
   - Description: What it does, use cases, testing notes
   - Include: Command examples, screenshots/output
8. **Respond** to review feedback
9. **Merged!** 🎉

---

## Code Review Criteria

We look for:
- ✅ **Clarity** - Easy to understand what it does
- ✅ **Usefulness** - Solves real problems
- ✅ **Safety** - Won't break things or expose secrets
- ✅ **Performance** - Completes quickly
- ✅ **Documentation** - Clear examples and explanations
- ✅ **Testing** - Tested on real-world scenarios

---

## Getting Help

### Questions?
- Check [PLUGINS_GUIDE.md](../PLUGINS_GUIDE.md) for existing patterns
- Review existing plugins in `plugins/` for examples
- Read [TECHNICAL_DOCUMENTATION.md](../TECHNICAL_DOCUMENTATION.md)

### Stuck?
- Open a Discussion on GitHub
- Check the issue tracker for similar problems
- Ask in our Discord community

### Feature Requests?
- Submit as a GitHub issue with "Plugin idea:" prefix
- Or create a plugin yourself and submit PR!

---

## Recognition

Contributors are recognized:
- Your name in plugin author field
- Featured in monthly plugin highlights
- Invitation to plugin maintainer team
- Early access to new Claude Code features

---

## License

All plugins contributed must be MIT licensed and compatible with Claude Code's license.

---

## Code of Conduct

We're committed to providing a welcoming, inclusive environment.

- Be respectful and constructive
- Welcome diverse perspectives
- Report issues privately to maintainers
- Focus on the code, not the person

---

## Resources

- **[QUICKSTART.md](../QUICKSTART.md)** - Get started in 30 seconds
- **[PLUGINS_GUIDE.md](../PLUGINS_GUIDE.md)** - Full plugin documentation
- **[TECHNICAL_DOCUMENTATION.md](../TECHNICAL_DOCUMENTATION.md)** - Architecture details
- **[Official Docs](https://code.claude.com/docs)** - Claude Code documentation

---

## Examples of Plugins We'd Love

- **CI/CD Enhancers:** GitHub Actions validator, CircleCI optimizer
- **Language-Specific:** Rust safety, Go concurrency, Python best practices
- **Cloud Integrations:** AWS best practices, GCP recommendations, Azure compliance
- **Database Tools:** Migration helpers, query optimization, schema validation
- **API Tooling:** OpenAPI validation, REST best practices, GraphQL helpers
- **Documentation Generators:** API docs, code comments, architecture diagrams
- **Testing Frameworks:** Test generation, coverage analysis, mutation testing
- **Company-Specific:** Custom tools for your engineering standards

---

**Ready to build? Start with [QUICKSTART.md](../QUICKSTART.md) then follow the guide above!**

We can't wait to see what you create! 🚀
