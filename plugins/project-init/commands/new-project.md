---
description: Create and initialize a new project directory with git and Claude Code configuration
argument-hint: <project-name>
allowed-tools: Bash(mkdir:*), Bash(cd:*), Bash(git init:*), Bash(git add:*), Bash(git commit:*), Bash(ls:*), Bash(pwd:*), Write, AskUserQuestion
---

## Your Task

Create a new project directory and initialize it for development with Claude Code.

**Project name from arguments:** $ARGUMENTS

## Workflow

### 1. Validate Project Name

If no project name was provided (`$ARGUMENTS` is empty), ask the user:
- "What would you like to name your project?"

Validate the project name:
- Must not be empty
- Should be a valid directory name (no special characters that would cause issues)
- Should not already exist as a directory

### 2. Create Project Structure

Execute these steps:

1. **Create the project directory:**
   ```bash
   mkdir -p <project-name>
   ```

2. **Initialize git repository:**
   ```bash
   cd <project-name> && git init
   ```

3. **Create CLAUDE.md with basic structure:**
   Create a `CLAUDE.md` file in the new directory with:
   ```markdown
   # <Project Name>

   ## Overview
   [Brief description of what this project does]

   ## Tech Stack
   [List technologies, frameworks, languages used]

   ## Project Structure
   [Describe the directory layout once established]

   ## Development Guidelines
   [Any coding standards, patterns, or practices to follow]

   ## Getting Started
   [How to set up and run the project]
   ```

4. **Create .gitignore with common defaults:**
   ```
   # Dependencies
   node_modules/
   venv/
   __pycache__/

   # Environment
   .env
   .env.local

   # IDE
   .idea/
   .vscode/
   *.swp

   # OS
   .DS_Store
   Thumbs.db

   # Build
   dist/
   build/
   *.egg-info/
   ```

5. **Create initial commit:**
   ```bash
   cd <project-name> && git add -A && git commit -m "Initial commit: project scaffolding"
   ```

### 3. Report Success

After creating the project, inform the user:

1. What was created:
   - Directory: `<project-name>/`
   - Git repository initialized
   - `CLAUDE.md` created
   - `.gitignore` created
   - Initial commit made

2. Next steps:
   - `cd <project-name>` to enter the project
   - Run `claude` to start working with Claude Code
   - Edit `CLAUDE.md` to add project-specific context

## Important Notes

- Create all files in the NEW directory, not the current directory
- Use the exact project name provided (preserve casing)
- Do not create unnecessary files beyond what's specified
- If the directory already exists, ask the user how to proceed (overwrite, use different name, or cancel)
