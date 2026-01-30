# verify-claims

[![Tests](https://github.com/anthropics/claude-code/actions/workflows/test.yml/badge.svg)](https://github.com/anthropics/claude-code/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-purple.svg)](https://claude.ai/code)

A Claude Code plugin that automatically verifies Claude's claims about code changes before allowing task completion.

## Overview

When Claude claims to have created files, fixed bugs, or ensured tests pass, this plugin intercepts the completion attempt and verifies those claims are actually true. If verification fails, completion is blocked and Claude must address the discrepancy.

## Features

- **Automatic Claim Detection**: Parses Claude's responses for verifiable claims
- **Multi-Framework Support**: Auto-detects npm, pytest, cargo, go, and more
- **Configurable Verification**: Override commands per-project
- **Session State Tracking**: Remembers what files were written and commands run
- **Infinite Loop Prevention**: Limits retries and detects active hooks

## Installation

### From GitHub

```bash
claude plugin install https://github.com/anthropics/claude-code/tree/main/plugins/verify-claims.git
```

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/anthropics/claude-code/tree/main/plugins/verify-claims.git ~/.claude/plugins/verify-claims

# Enable it in your Claude settings or use:
claude --plugin-dir ~/.claude/plugins/verify-claims
```

## How It Works

### Stop Hook

When Claude attempts to complete a task, the Stop hook:

1. Reads the last 3 assistant messages from the transcript
2. Parses for verifiable claims using pattern matching
3. Runs appropriate verifiers for each claim
4. Blocks completion if any verification fails

### PostToolUse Hook

Tracks Write, Edit, and Bash tool uses to:

- Record which files were created/modified
- Track test/lint/build command results
- Enable smarter verification decisions

## Claim Types

| Type | Example Phrases | Verification Method |
|------|-----------------|---------------------|
| `file_created` | "I created config.json" | `os.path.exists()` |
| `tests_pass` | "All tests pass" | Run detected test command |
| `lint_clean` | "No lint errors" | Run detected linter |
| `build_success` | "Build succeeded" | Run detected build command |
| `bug_fixed` | "Fixed the bug" | Check `git diff` for changes |

## Configuration

### Default Configuration

Located at `config/default_config.json`:

```json
{
  "verifiers": {
    "file_created": { "enabled": true },
    "tests_pass": { "enabled": true, "timeout": 60 },
    "lint_clean": { "enabled": true, "timeout": 30 },
    "build_success": { "enabled": true, "timeout": 120 },
    "bug_fixed": { "enabled": true }
  },
  "behavior": {
    "block_on_failure": true,
    "max_retries": 3,
    "confidence_threshold": 0.7,
    "cleanup_days": 30
  },
  "debug": false
}
```

### Project Overrides

Create `.claude/verify-claims.json` in your project:

```json
{
  "verifiers": {
    "tests_pass": {
      "command": "npm run test:unit -- --coverage"
    },
    "lint_clean": {
      "command": "npm run lint:strict"
    }
  },
  "behavior": {
    "block_on_failure": false
  }
}
```

## Framework Detection

The plugin auto-detects project type and appropriate commands:

### Test Commands

| Indicator | Command |
|-----------|---------|
| `package.json` with `test` script | `npm test` |
| `pytest.ini` or `pyproject.toml` | `pytest` |
| `Cargo.toml` | `cargo test` |
| `go.mod` | `go test ./...` |
| `Gemfile` + `spec/` | `bundle exec rspec` |

### Lint Commands

| Indicator | Command |
|-----------|---------|
| `package.json` with `lint` script | `npm run lint` |
| `.eslintrc.*` | `npx eslint .` |
| `ruff.toml` or `[tool.ruff]` | `ruff check .` |
| `Cargo.toml` | `cargo clippy` |
| `go.mod` | `golangci-lint run` |

### Build Commands

| Indicator | Command |
|-----------|---------|
| `package.json` with `build` script | `npm run build` |
| `tsconfig.json` | `npx tsc --noEmit` |
| `Cargo.toml` | `cargo build` |
| `go.mod` | `go build ./...` |
| `Makefile` | `make` |

## Manual Verification

Use the `/verify-claims:verify` command to manually run verifications:

```
/verify-claims:verify          # Verify all claims
/verify-claims:verify tests    # Only run test verification
/verify-claims:verify files    # Only check file existence
```

## Session State

State is stored in `~/.claude/verify_claims_state_{session_id}.json`:

```json
{
  "session_id": "abc123",
  "files_written": [
    {"path": "/project/src/file.ts", "tool": "Write", "timestamp": 1234567890}
  ],
  "commands_run": [
    {"command": "npm test", "exit_code": 0, "is_test": true, "timestamp": 1234567890}
  ],
  "verification_results": [],
  "verification_count": 0
}
```

## Troubleshooting

### Plugin Not Running

Check that the plugin is properly installed:

```bash
ls -la ~/.claude/plugins/verify-claims/.claude-plugin/plugin.json
```

### Verification Always Failing

1. Check debug logs at `~/.claude/logs/verify_claims.log`
2. Enable debug mode in config: `"debug": true`
3. Verify your project has the expected config files

### Too Many False Positives

Increase the confidence threshold:

```json
{
  "behavior": {
    "confidence_threshold": 0.85
  }
}
```

### Disable for Specific Project

Create `.claude/verify-claims.json`:

```json
{
  "behavior": {
    "block_on_failure": false
  }
}
```

## Development

### File Structure

```
verify-claims/
├── .claude-plugin/
│   └── plugin.json         # Plugin manifest
├── hooks/
│   └── hooks.json          # Hook definitions
├── scripts/
│   ├── verify_claims.py    # Main Stop hook
│   ├── track_tool_use.py   # PostToolUse tracker
│   ├── claim_parser.py     # Claim extraction
│   ├── transcript_reader.py # JSONL parsing
│   ├── verifiers/          # Verification modules
│   └── utils/              # Shared utilities
├── commands/
│   └── verify.md           # Manual command
├── config/
│   └── default_config.json
├── tests/                  # Test suite
│   ├── test_claim_parser.py
│   ├── test_transcript_reader.py
│   ├── test_config.py
│   ├── test_state.py
│   └── test_verifiers.py
└── README.md
```

### Running Tests

```bash
cd ~/.claude/plugins/verify-claims
pip install -e ".[test]"
pytest tests/
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Author

**augmnt**
- Website: [augmnt.sh](https://augmnt.sh)
- GitHub: [@augmnt](https://github.com/augmnt)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
