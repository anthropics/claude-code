# Repository Quality Suite

A comprehensive code quality validation plugin for Claude Code that integrates with GitHub, GitLab, and Bitbucket to provide automated linting, PR validation, and code review across multiple languages and frameworks.

## Features

- **Multi-Platform VCS Integration**: GitHub, GitLab, Bitbucket (cloud and self-hosted)
- **Language Support**: Python, Rust, JavaScript, TypeScript, JSON
- **Automated Validation**: Hooks run linters automatically after file edits
- **PR Validation**: Check merge conflicts, branch divergence, CI status
- **Documentation Checks**: Validate docstrings, generate coverage reports
- **Git Safety**: Block dangerous operations, audit API calls

## Installation

### Quick Install

```bash
# Clone or copy to your project
cp -r repo-quality-suite .claude/plugins/

# Install hook scripts
chmod +x .claude/plugins/repo-quality-suite/hooks/scripts/*.sh
chmod +x .claude/plugins/repo-quality-suite/hooks/scripts/*.py
```

### Configure MCP Servers

```bash
# GitHub (OAuth)
claude mcp add --transport http github https://api.githubcopilot.com/mcp/

# GitLab (with token)
claude mcp add --transport stdio gitlab \
  --env GITLAB_TOKEN="your-token" \
  --env GITLAB_URL="https://gitlab.com" \
  -- npx -y @modelcontextprotocol/server-gitlab

# Bitbucket (with app password)
claude mcp add --transport stdio bitbucket \
  --env BITBUCKET_USERNAME="your-username" \
  --env BITBUCKET_APP_PASSWORD="your-app-password" \
  -- npx -y @anthropic/mcp-server-bitbucket
```

### Install CLI Tools

```bash
# Python tools
pip install ruff mypy codespell pydantic

# Rust tools (via rustup)
rustup component add clippy rustfmt

# JavaScript tools
npm install -g jshint eslint prettier typescript

# Documentation tools
apt install doxygen  # or brew install doxygen
```

## Usage

### Slash Commands

#### `/validate-repo` - Full Repository Validation

```
/validate-repo                    # Validate current branch
/validate-repo all               # Validate all branches
/validate-repo --lang=python,rust # Filter by language
/validate-repo --fix             # Apply auto-fixes
/validate-repo --path=src/       # Limit to path
```

#### `/pr-check` - Pull Request Validation

```
/pr-check 123                    # Check PR #123
/pr-check 100-110               # Check PR range
/pr-check 123 --base=develop    # Custom base branch
/pr-check 123 --platform=gitlab # Use GitLab
```

#### `/lint-all` - Run All Linters

```
/lint-all                        # Check all files
/lint-all --fix                  # Auto-fix issues
/lint-all --strict               # Treat warnings as errors
/lint-all --lang=python          # Python only
```

#### `/doc-check` - Documentation Validation

```
/doc-check                       # Check all docs
/doc-check --format=google       # Google docstring format
/doc-check --generate            # Generate documentation
```

## Hooks

The plugin uses Claude Code hooks for automated validation:

| Hook | Trigger | Action |
|------|---------|--------|
| `SessionStart` | Session begins | Install/verify tools |
| `PostToolUse` (Edit/Write) | File edited | Run language linters |
| `PreToolUse` (Bash) | Git command | Block dangerous operations |
| `PreToolUse` (MCP) | VCS API call | Audit logging |
| `UserPromptSubmit` | Quality prompts | Inject repo context |
| `Stop` | Session ends | Generate summary report |

### Hook Configuration

Hooks are configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "./plugins/repo-quality-suite/hooks/scripts/validate-file.py",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

## Linter Configuration

### Python (Ruff + MyPy)

Create `ruff.toml`:
```toml
line-length = 100
select = ["E", "F", "W", "I", "N", "D"]
ignore = ["D100", "D104"]
```

Create `mypy.ini`:
```ini
[mypy]
ignore_missing_imports = True
strict = False
```

### Rust (Clippy)

Configure in `Cargo.toml`:
```toml
[lints.clippy]
all = "warn"
pedantic = "warn"
```

### JavaScript/TypeScript (ESLint)

Create `.eslintrc.json`:
```json
{
  "extends": ["eslint:recommended"],
  "env": { "node": true, "es2022": true }
}
```

## API Integration

### GitHub

```bash
# Authenticate via OAuth
/mcp  # Select GitHub > Authenticate

# Or use personal access token
export GITHUB_TOKEN="ghp_xxxx"
```

### GitLab (Self-Hosted)

```bash
export GITLAB_URL="https://gitlab.company.com"
export GITLAB_TOKEN="glpat-xxxx"
```

### Bitbucket

```bash
export BITBUCKET_URL="https://bitbucket.company.com"
export BITBUCKET_USERNAME="user"
export BITBUCKET_APP_PASSWORD="xxxx"
export BITBUCKET_WORKSPACE="workspace-id"
```

## Enterprise Features

### Enumerate All Repositories

Use MCP tools to list all accessible repositories:

```
# With GitHub MCP connected
"List all repositories I have access to in the organization"

# With Bitbucket MCP connected
"Enumerate all projects and repositories in the workspace"
```

### Batch Validation

Validate multiple repositories:

```
/validate-repo all --path=/path/to/repos/*
```

### Custom Validation Rules

Add custom validation scripts in `hooks/scripts/custom/`:

```python
#!/usr/bin/env python3
# hooks/scripts/custom/company-rules.py

def check_company_standards(file_path):
    # Your custom validation logic
    pass
```

## Benefits

- **Save Senior Engineer Time**: Automated checks for spelling, docs, formatting
- **Reduce PR Review Cycles**: Catch issues before code review
- **Consistent Code Quality**: Enforce standards across all repositories
- **Environment Friendly**: Less wasted compute from failed builds
- **Cost Efficient**: Reduce time spent on trivial code review comments

## Troubleshooting

### Tools Not Found

Run the setup script manually:
```bash
./plugins/repo-quality-suite/hooks/scripts/setup-tools.sh
```

### MCP Connection Issues

Check server status:
```
/mcp  # View connected servers
```

### Hook Errors

Enable verbose mode to see hook output:
```bash
claude --verbose
```

## License

MIT License - See LICENSE file for details.
