# Project Init Plugin

Initialize new projects with a single command. Creates a directory, initializes git, and sets up Claude Code configuration.

## Commands

### `/new-project <project-name>`

Creates a new project directory with:
- Git repository initialized
- `CLAUDE.md` template for project context
- `.gitignore` with common defaults
- Initial commit

**Usage:**
```bash
/new-project my-awesome-app
```

**What it creates:**
```
my-awesome-app/
├── .git/
├── .gitignore
└── CLAUDE.md
```

## Installation

This plugin is included in the Claude Code plugins directory. To use it:

1. Ensure Claude Code is installed
2. The plugin is automatically available when running Claude Code from the repository
3. Or install via the plugin marketplace

## Why Use This?

This plugin streamlines the project creation workflow. Instead of:
```bash
mkdir my-project
cd my-project
git init
# manually create CLAUDE.md
# manually create .gitignore
git add -A
git commit -m "Initial commit"
```

Just run:
```bash
/new-project my-project
```

## Feature Request

This plugin serves as a workaround until native support is added to the Claude Code CLI. See the feature request: [Add project name argument to init command](https://github.com/anthropics/claude-code/issues/18024)
