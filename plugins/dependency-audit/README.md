# Dependency Audit Plugin

A comprehensive dependency security toolkit for Claude Code that helps you audit vulnerabilities, check license compliance, prevent supply chain attacks, and manage updates safely.

## Overview

Software supply chain attacks are increasing rapidly. This plugin provides:

- **Security auditing** - Scan for known vulnerabilities (CVEs)
- **License compliance** - Check for problematic licenses
- **Outdated analysis** - Smart update strategies
- **Supply chain protection** - Detect typosquatting and malicious packages
- **Safety hooks** - Warnings before risky package operations

## Features

### Commands

| Command | Description |
|---------|-------------|
| `/audit` | Run comprehensive security audit on all dependencies |
| `/license-check` | Check all dependency licenses for compliance issues |
| `/outdated` | Analyze outdated packages and create update strategy |

### Agents

| Agent | Use When |
|-------|----------|
| `vulnerability-analyzer` | Investigating specific CVEs or security alerts |
| `dependency-advisor` | Choosing between packages or evaluating quality |
| `supply-chain-scanner` | Checking for supply chain attacks or malicious packages |

### Skills

| Skill | Content |
|-------|---------|
| `dependency-security` | Best practices, CI/CD configs, security checklists |

### Hooks

| Hook | Purpose |
|------|---------|
| `PreToolUse` (Bash) | Warns about risky package installation commands |

## Supported Package Managers

| Manager | Audit | License | Outdated |
|---------|-------|---------|----------|
| npm | ✅ | ✅ | ✅ |
| yarn | ✅ | ✅ | ✅ |
| pnpm | ✅ | ✅ | ✅ |
| pip | ✅ | ✅ | ✅ |
| cargo | ✅ | ✅ | ✅ |
| composer | ✅ | ✅ | ✅ |
| maven | ✅ | ✅ | ✅ |

## Usage Examples

### Security Audit

```
/audit
```

Output:
```markdown
# Dependency Security Audit Report

## Summary
| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 |
| 🟠 High | 3 |
| 🟡 Medium | 5 |

## Critical Vulnerabilities

### CVE-2021-23337: Prototype Pollution in lodash
- **Package:** lodash@4.17.15
- **Fix:** Update to lodash@4.17.21
```

### License Compliance

```
/license-check --policy commercial
```

Checks all dependencies against your license policy and reports any GPL or other problematic licenses.

### Analyze Outdated Packages

```
/outdated --security-only
```

Prioritizes security-related updates and creates a safe update plan.

### Vulnerability Investigation

Ask the `vulnerability-analyzer` agent:
```
"We got an alert about CVE-2024-12345 in our dependencies - is it critical for us?"
```

### Package Evaluation

Ask the `dependency-advisor` agent:
```
"Should I use axios or got for HTTP requests in our Node.js project?"
```

### Supply Chain Check

Ask the `supply-chain-scanner` agent:
```
"Check our package.json for any supply chain security risks"
```

## Safety Hooks

The plugin automatically warns you when:

- Installing packages with `@latest` or wildcard versions
- Package names look similar to popular packages (typosquatting)
- Using `--force` or `--no-audit` flags
- Installing globally instead of locally
- Running `npx` with unfamiliar packages
- Using HTTP instead of HTTPS for git dependencies

## Security Features

### Vulnerability Detection
- CVE database lookup
- CVSS scoring analysis
- Exploitability assessment
- Fix recommendations

### License Compliance
- SPDX license identification
- Policy enforcement (permissive, copyleft, commercial)
- Alternative suggestions for non-compliant packages

### Supply Chain Protection
- Typosquatting detection
- Dependency confusion alerts
- Install script analysis
- Ownership change monitoring

### Update Management
- Security-prioritized updates
- Breaking change detection
- Rollback guidance

## CI/CD Integration

The skill includes ready-to-use configurations for:

- GitHub Actions
- GitLab CI
- Dependabot
- Renovate
- Pre-commit hooks

Example GitHub Actions workflow included in the skill.

## Directory Structure

```
dependency-audit/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── audit.md
│   ├── license-check.md
│   └── outdated.md
├── agents/
│   ├── vulnerability-analyzer.md
│   ├── dependency-advisor.md
│   └── supply-chain-scanner.md
├── skills/
│   └── dependency-security/
│       ├── SKILL.md
│       └── examples/
│           └── security-configs.md
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       └── validate-package-install.sh
└── README.md
```

## Best Practices

### Before Adding Dependencies
1. Evaluate necessity - do you really need it?
2. Check security history with `dependency-advisor`
3. Verify license compatibility with `/license-check`
4. Review maintenance status

### Ongoing Security
1. Run `/audit` weekly
2. Use automated dependency updates (Dependabot/Renovate)
3. Review security alerts promptly
4. Keep lock files committed

### When Vulnerabilities Are Found
1. Assess actual impact with `vulnerability-analyzer`
2. Update if fix available
3. Implement workaround if needed
4. Document accepted risks

## Troubleshooting

### Hook not triggering

Ensure the script is executable:
```bash
chmod +x plugins/dependency-audit/hooks/scripts/validate-package-install.sh
```

### Audit command not found

Install the required tools:
```bash
# For npm
npm install -g npm-audit

# For pip
pip install pip-audit safety

# For cargo
cargo install cargo-audit
```

### False positives in license check

Customize your policy in the command:
```
/license-check --policy permissive
```

## Contributing

Contributions welcome! Areas for improvement:

- Additional package manager support (go mod, bundler)
- More vulnerability databases (Snyk, OSV)
- Custom policy configuration
- SBOM generation

## Author

Rajesh Kumar (kakumanurajeshkumar@gmail.com)

## Version

1.0.0

## License

MIT
