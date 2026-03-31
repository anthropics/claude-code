import type { Command } from '../commands.js'

const command = {
  type: 'prompt',
  name: 'init-verifiers',
  description:
    'Create verifier skill(s) for automated verification of code changes',
  contentLength: 0, // Dynamic content
  progressMessage: 'analyzing your project and creating verifier skills',
  source: 'builtin',
  async getPromptForCommand() {
    return [
      {
        type: 'text',
        text: `Use the TodoWrite tool to track your progress through this multi-step task.

## Goal

Create one or more verifier skills that can be used by the Verify agent to automatically verify code changes in this project or folder. You may create multiple verifiers if the project has different verification needs (e.g., both web UI and API endpoints).

**Do NOT create verifiers for unit tests or typechecking.** Those are already handled by the standard build/test workflow and don't need dedicated verifier skills. Focus on functional verification: web UI (Playwright), CLI (Tmux), and API (HTTP) verifiers.

## Phase 1: Auto-Detection

Analyze the project to detect what's in different subdirectories. The project may contain multiple sub-projects or areas that need different verification approaches (e.g., a web frontend, an API backend, and shared libraries all in one repo).

1. **Scan top-level directories** to identify distinct project areas:
   - Look for separate package.json, Cargo.toml, pyproject.toml, go.mod in subdirectories
   - Identify distinct application types in different folders

2. **For each area, detect:**

   a. **Project type and stack**
      - Primary language(s) and frameworks
      - Package managers (npm, yarn, pnpm, pip, cargo, etc.)

   b. **Application type**
      - Web app (React, Next.js, Vue, etc.) → suggest Playwright-based verifier
      - CLI tool → suggest Tmux-based verifier
      - API service (Express, FastAPI, etc.) → suggest HTTP-based verifier

   c. **Existing verification tools**
      - Test frameworks (Jest, Vitest, pytest, etc.)
      - E2E tools (Playwright, Cypress, etc.)
      - Dev server scripts in package.json

   d. **Dev server configuration**
      - How to start the dev server
      - What URL it runs on
      - What text indicates it's ready

3. **Installed verification packages** (for web apps)
   - Check if Playwright is installed (look in package.json dependencies/devDependencies)
   - Check MCP configuration (.mcp.json) for browser automation tools:
     - Playwright MCP server
     - Chrome DevTools MCP server
     - Claude Chrome Extension MCP (browser-use via Claude's Chrome extension)
   - For Python projects, check for playwright, pytest-playwright

## Phase 2: Verification Tool Setup

Based on what was detected in Phase 1, help the user set up appropriate verification tools.

### For Web Applications

1. **If browser automation tools are already installed/configured**, ask the user which one they want to use:
   - Use AskUserQuestion to present the detected options
   - Example: "I found Playwright and Chrome DevTools MCP configured. Which would you like to use for verification?"

2. **If NO browser automation tools are detected**, ask if they want to install/configure one:
   - Use AskUserQuestion: "No browser automation tools detected. Would you like to set one up for UI verification?"
   - Options to offer:
     - **Playwright** (Recommended) - Full browser automation library, works headless, great for CI
     - **Chrome DevTools MCP** - Uses Chrome DevTools Protocol via MCP
     - **Claude Chrome Extension** - Uses the Claude Chrome extension for browser interaction (requires the extension installed in Chrome)
     - **None** - Skip browser automation (will use basic HTTP checks only)

3. **If user chooses to install Playwright**, run the appropriate command based on package manager:
   - For npm: \`npm install -D @playwright/test && npx playwright install\`
   - For yarn: \`yarn add -D @playwright/test && yarn playwright install\`
   - For pnpm: \`pnpm add -D @playwright/test && pnpm exec playwright install\`
   - For bun: \`bun add -D @playwright/test && bun playwright install\`

4. **If user chooses Chrome DevTools MCP or Claude Chrome Extension**:
   - These require MCP server configuration rather than package installation
   - Ask if they want you to add the MCP server configuration to .mcp.json
   - For Claude Chrome Extension, inform them they need the extension installed from the Chrome Web Store

5. **MCP Server Setup** (if applicable):
   - If user selected an MCP-based option, configure the appropriate entry in .mcp.json
   - Update the verifier skill's allowed-tools to use the appropriate mcp__* tools

### For CLI Tools

1. Check if asciinema is available (run \`which asciinema\`)
2. If not available, inform the user that asciinema can help record verification sessions but is optional
3. Tmux is typically system-installed, just verify it's available

### For API Services

1. Check if HTTP testing tools are available:
   - curl (usually system-installed)
   - httpie (\`http\` command)
2. No installation typically needed

## Phase 3: Interactive Q&A

Based on the areas detected in Phase 1, you may need to create multiple verifiers. For each distinct area, use the AskUserQuestion tool to confirm:

1. **Verifier name** - Based on detection, suggest a name but let user choose:

   If there is only ONE project area, use the simple format:
   - "verifier-playwright" for web UI testing
   - "verifier-cli" for CLI/terminal testing
   - "verifier-api" for HTTP API testing

   If there are MULTIPLE project areas, use the format \`verifier-<project>-<type>\`:
   - "verifier-frontend-playwright" for the frontend web UI
   - "verifier-backend-api" for the backend API
   - "verifier-admin-playwright" for an admin dashboard

   The \`<project>\` portion should be a short identifier for the subdirectory or project area (e.g., the folder name or package name).

   Custom names are allowed but MUST include "verifier" in the name — the Verify agent discovers skills by looking for "verifier" in the folder name.

2. **Project-specific questions** based on type:

   For web apps (playwright):
   - Dev server command (e.g., "npm run dev")
   - Dev server URL (e.g., "http://localhost:3000")
   - Ready signal (text that appears when server is ready)

   For CLI tools:
   - Entry point command (e.g., "node ./cli.js" or "./target/debug/myapp")
   - Whether to record with asciinema

   For APIs:
   - API server command
   - Base URL

3. **Authentication & Login** (for web apps and APIs):

   Use AskUserQuestion to ask: "Does your app require authentication/login to access the pages or endpoints being verified?"
   - **No authentication needed** - App is publicly accessible, no login required
   - **Yes, login required** - App requires authentication before verification can proceed
   - **Some pages require auth** - Mix of public and authenticated routes

   If the user selects login required (or partial), ask follow-up questions:
   - **Login method**: How does a user log in?
     - Form-based login (username/password on a login page)
     - API token/key (passed as header or query param)
     - OAuth/SSO (redirect-based flow)
     - Other (let user describe)
   - **Test credentials**: What credentials should the verifier use?
     - Ask for the login URL (e.g., "/login", "http://localhost:3000/auth")
     - Ask for test username/email and password, or API key
     - Note: Suggest the user use environment variables for secrets (e.g., \`TEST_USER\`, \`TEST_PASSWORD\`) rather than hardcoding
   - **Post-login indicator**: How to confirm login succeeded?
     - URL redirect (e.g., redirects to "/dashboard")
     - Element appears (e.g., "Welcome" text, user avatar)
     - Cookie/token is set

## Phase 4: Generate Verifier Skill

**All verifier skills are created in the project root's \`.claude/skills/\` directory.** This ensures they are automatically loaded when Claude runs in the project.

Write the skill file to \`.claude/skills/<verifier-name>/SKILL.md\`.

### Skill Template Structure

\`\`\`markdown
---
name: <verifier-name>
description: <description based on type>
allowed-tools:
  # Tools appropriate for the verifier type
---

# <Verifier Title>

You are a verification executor. You receive a verification plan and execute it EXACTLY as written.

## Project Context
<Project-specific details from detection>

## Setup Instructions
<How to start any required services>

## Authentication
<If auth is required, include step-by-step login instructions here>
<Include login URL, credential env vars, and post-login verification>
<If no auth needed, omit this section>

## Reporting

Report PASS or FAIL for each step using the format specified in the verification plan.

## Cleanup

After verification:
1. Stop any dev servers started
2. Close any browser sessions
3. Report final summary

## Self-Update

If verification fails because this skill's instructions are outdated (dev server command/port/ready-signal changed, etc.) — not because the feature under test is broken — or if the user corrects you mid-run, use AskUserQuestion to confirm and then Edit this SKILL.md with a minimal targeted fix.
\`\`\`

### Allowed Tools by Type

**verifier-playwright**:
\`\`\`yaml
allowed-tools:
  - Bash(npm:*)
  - Bash(yarn:*)
  - Bash(pnpm:*)
  - Bash(bun:*)
  - mcp__playwright__*
  - Read
  - Glob
  - Grep
\`\`\`

**verifier-cli**:
\`\`\`yaml
allowed-tools:
  - Tmux
  - Bash(asciinema:*)
  - Read
  - Glob
  - Grep
\`\`\`

**verifier-api**:
\`\`\`yaml
allowed-tools:
  - Bash(curl:*)
  - Bash(http:*)
  - Bash(npm:*)
  - Bash(yarn:*)
  - Read
  - Glob
  - Grep
\`\`\`


## Phase 5: Confirm Creation

After writing the skill file(s), inform the user:
1. Where each skill was created (always in \`.claude/skills/\`)
2. How the Verify agent will discover them — the folder name must contain "verifier" (case-insensitive) for automatic discovery
3. That they can edit the skills to customize them
4. That they can run /init-verifiers again to add more verifiers for other areas
5. That the verifier will offer to self-update if it detects its own instructions are outdated (wrong dev server command, changed ready signal, etc.)
`,
      },
    ]
  },
} satisfies Command

export default command
