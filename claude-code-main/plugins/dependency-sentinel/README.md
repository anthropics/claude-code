# Dependency Sentinel Plugin

Automatically updates dependencies with intelligent changelog parsing and risk assessment.

## Overview

Dependency Sentinel watches your project's dependencies and automatically creates PRs to update them. It intelligently parses changelogs, detects breaking changes, assesses security risks, and decides whether updates are safe to auto-merge or need manual review.

## Features

- **Automated Dependency Updates**: Checks for updates daily/weekly
- **Intelligent Changelog Parsing**: Understands semantic versioning and breaking changes
- **Security Risk Assessment**: Flags security-related updates as critical
- **Compatibility Analysis**: Checks for breaking changes and deprecations
- **Automated Testing**: Runs tests before proposing updates
- **Smart PR Generation**: Creates excellent PRs with detailed changelog analysis
- **Auto-merge Safe Updates**: Auto-merges patch/minor updates that pass tests

## Command: `/dependency-check`

Checks for available dependency updates.

**Usage:**
```bash
/dependency-check
```

Scans package.json/requirements.txt and identifies updates.

## Update Levels

- **Patch (1.0.0 → 1.0.1)**: Auto-merge if tests pass (bug fixes, most are safe)
- **Minor (1.0.0 → 1.1.0)**: Create PR with tests (new features, usually safe)
- **Major (1.0.0 → 2.0.0)**: Manual review required (breaking changes likely)
- **Pre-release**: Flag for review (beta/rc versions)
- **Security Updates**: Highest priority, fast-track review

## Features

- npm/yarn/pnpm support
- Python pip/poetry support
- Go modules support
- Changelog parsing and summarization
- Breaking change detection
- Security vulnerability scanning
- Automated test execution
- Maven, Gradle, Composer support
