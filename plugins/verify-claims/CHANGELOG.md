# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-30

### Added

- Initial release of verify-claims plugin
- **Stop Hook**: Intercepts task completion attempts and verifies claims
- **PostToolUse Hook**: Tracks file writes and command executions
- **Claim Parser**: Extracts verifiable claims from Claude's responses
  - File creation claims
  - Test passing claims
  - Lint clean claims
  - Build success claims
  - Bug fix claims
- **Verifiers**:
  - `file_exists`: Verifies claimed files exist
  - `test_runner`: Runs detected test suite
  - `lint_checker`: Runs detected linter
  - `build_checker`: Runs detected build command
  - `git_diff`: Verifies code changes were made
- **Framework Detection**: Auto-detects project type for:
  - Node.js/npm projects
  - Python (pytest) projects
  - Rust/Cargo projects
  - Go projects
  - Ruby/RSpec projects
  - Java/Maven/Gradle projects
- **Configuration System**:
  - Default configuration with sensible defaults
  - Project-level overrides via `.claude/verify-claims.json`
  - Configurable timeouts, thresholds, and commands
- **Session State Management**:
  - Tracks files written during session
  - Tracks commands run and their results
  - Stores verification history
  - Automatic cleanup of old state files
- **Safety Features**:
  - Infinite loop prevention
  - Max retry limits
  - Confidence thresholds for claim detection
- **Manual Verification**: `/verify` command for manual verification runs
- **Debug Logging**: Optional debug logging to `~/.claude/logs/verify_claims.log`

### Framework Support

| Framework | Tests | Lint | Build |
|-----------|-------|------|-------|
| Node.js/npm | npm test | npm run lint / eslint | npm run build |
| Python | pytest | ruff / flake8 / pylint | - |
| Rust | cargo test | cargo clippy | cargo build |
| Go | go test | golangci-lint | go build |
| Ruby | rspec / rake | - | - |
| Java | mvn test / gradle test | - | mvn compile / gradle build |
| TypeScript | - | - | tsc --noEmit |

[1.0.0]: https://github.com/augmnt/verify-claims/releases/tag/v1.0.0
