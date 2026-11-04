---
name: setup
description: Interactive project onboarding - creates project-goals.md and project-map.md
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

# Setup Command - Interactive Project Onboarding

Initialize a project for use with Sprint by creating the two "Second Brain" documents that guide all sprint work.

## Overview

This command interactively creates:
1. `.claude/project-goals.md` - Business vision and objectives (user-maintained)
2. `.claude/project-map.md` - Technical architecture (architect-maintained)

## Workflow

### Step 1: Check Existing Files

Check if either file already exists:

```bash
test -f .claude/project-goals.md && echo "GOALS_EXISTS" || echo "NO_GOALS"
test -f .claude/project-map.md && echo "MAP_EXISTS" || echo "NO_MAP"
```

If files exist, ask the user:
- Overwrite existing files?
- Skip existing and create only missing?
- Abort setup?

### Step 2: Create .claude Directory

Ensure the directory exists:

```bash
mkdir -p .claude
```

### Step 3: Gather Project Goals (Interactive)

Use AskUserQuestion to gather business context:

**Question 1: Product Vision**
- "What is this project? Describe it in 1-2 sentences."

**Question 2: Target Users**
- "Who are the target users?"
- Options: "Developers", "End consumers", "Internal team", "Other"

**Question 3: Key Features**
- "What are the 3-5 most important features or capabilities?"

**Question 4: Success Metrics**
- "How will you measure success?"
- Options: "User adoption", "Revenue", "Performance metrics", "Other"

**Question 5: Constraints**
- "Any important constraints or requirements?"
- Examples: compliance, performance, technology restrictions

### Step 4: Generate project-goals.md

Write the gathered information to `.claude/project-goals.md`:

```markdown
# Project Goals

## Vision
[User's product vision]

## Target Users
[Target audience description]

## Key Features
- [Feature 1]
- [Feature 2]
- [Feature 3]

## Success Metrics
[How success is measured]

## Constraints
[Important constraints and requirements]

---
*This file is maintained by the user. Update it when business objectives change.*
```

### Step 5: Scan Codebase

Analyze the project structure:

```bash
# List top-level structure
ls -la

# Find key configuration files
find . -maxdepth 2 -name "package.json" -o -name "pyproject.toml" -o -name "Cargo.toml" -o -name "go.mod" -o -name "*.csproj" 2>/dev/null

# Check for common frameworks
test -f next.config.js -o -f next.config.ts && echo "NEXTJS"
test -f nuxt.config.ts && echo "NUXT"
test -f angular.json && echo "ANGULAR"
test -f vite.config.ts && echo "VITE"
test -d backend -o -f requirements.txt -o -f pyproject.toml && echo "PYTHON"
test -f go.mod && echo "GO"
test -f Cargo.toml && echo "RUST"
```

Read key files to understand the project:
- README.md (if exists)
- package.json / pyproject.toml / etc.
- Docker configuration
- CI/CD files

### Step 6: Gather Technical Context (Interactive)

Ask clarifying questions based on scan results:

**Question: Tech Stack Confirmation**
- "I detected [frameworks]. Is this correct?"
- Allow corrections

**Question: Architecture Style**
- Options: "Monolith", "Microservices", "Serverless", "Monorepo", "Other"

**Question: Database**
- Options: "PostgreSQL", "MySQL", "MongoDB", "SQLite", "None/Other"

**Question: Deployment**
- Options: "Docker", "Kubernetes", "Serverless", "Traditional hosting", "Not yet decided"

### Step 7: Generate project-map.md

Create `.claude/project-map.md` with discovered and confirmed information:

```markdown
# Project Map

## Tech Stack

### Backend
- Language: [detected/confirmed]
- Framework: [detected/confirmed]
- Database: [confirmed]

### Frontend
- Framework: [detected/confirmed]
- Styling: [detected]

### Infrastructure
- Deployment: [confirmed]
- CI/CD: [detected]

## Project Structure

```
[directory tree of main folders]
```

## Key Components

### [Component 1]
- Location: [path]
- Purpose: [description]

### [Component 2]
- Location: [path]
- Purpose: [description]

## Development Workflow

### Running Locally
[commands to start the project]

### Running Tests
[test commands]

## Current Features
- [Feature 1]
- [Feature 2]

## Known Limitations
- [Any detected issues or TODOs]

---
*This file is maintained by the project-architect agent. Updated during sprints.*
```

### Step 8: Offer First Sprint

Ask the user:
- "Would you like to create your first sprint now?"

If yes, prompt for sprint goal and run `/sprint:new` logic.

If no, provide next steps:
```
Setup complete!

Next steps:
1. Review .claude/project-goals.md and adjust as needed
2. Review .claude/project-map.md for accuracy
3. Run /sprint:new to start your first sprint
```

## Error Handling

### No Codebase Detected

If the directory appears empty or has no recognizable project structure:
- Ask if this is a new project
- Offer to create a minimal project-map.md for greenfield development
- Suggest running setup again after initial code is written

### Permission Issues

If unable to write to .claude/:
- Report the error clearly
- Suggest checking directory permissions

## Output

On completion, display:
```
✓ Created .claude/project-goals.md
✓ Created .claude/project-map.md

Your project is ready for Sprint!
Run /sprint:new to begin.
```
