# Sprint

> Autonomous multi-agent development plugin for Claude Code. Spec-driven, iterative sprints with specialized agents.

**Part of [Agentic Forge](https://github.com/damienlaine/agentic-forge)** — Claude Code plugins for autonomous AI workflows.

**Stop prompting in circles.** Sprint replaces ad-hoc AI coding with structured, specification-driven development. Write specs, run `/sprint`, and let coordinated agents handle the rest.

At its core, the `/sprint` command is a **spec-driven, self-iterative state machine** — it reads your specifications, orchestrates specialized agents through defined phases, and loops autonomously until the work is done or validation passes.

## What is Sprint?

Sprint is a Claude Code plugin that turns Claude into an autonomous development team:

- **Project Architect** analyzes requirements, creates specifications, and coordinates work
- **Implementation Agents** (Python, Next.js, CI/CD, or any tech via allpurpose-agent) build features according to specs
- **Testing Agents** (QA, UI) validate the implementation
- **Sprint Orchestrator** — the self-iterative state machine that manages phases, handoffs, and convergence

```
You write specs → Agents implement → Tests validate → Iterate until done
```

The orchestrator drives the loop: specs in, working code out. No manual intervention required between phases.

### Why It Works

Unlike single-shot prompting where context bloats and AI mistakes compound, Sprint uses a **convergent multi-pass approach**:

- **Context preservation** — Each agent receives only what it needs (specs, contract, relevant code). No wasted tokens on irrelevant history.
- **Specs shrink, not grow** — Completed work is removed from specs. Each iteration focuses only on what remains.
- **Errors get erased** — Working code stays untouched while issues get fixed. The signal-to-noise ratio improves with each pass.

Think of it like a **diffusion process**: the picture starts noisy, but with each iteration, the noise reduces and clarity emerges. By the final pass, only the solution remains.

Most sprints converge well before 5 iterations. If they don't, the system pauses and asks you what to do — adjust specs, continue iterating, or intervene manually. You stay in control.

### Multi-Paradigm Design

Sprint is **technology-agnostic**. While it includes specialized agents for Python/FastAPI and Next.js, the system works with any tech stack:

- The `allpurpose-agent` adapts to Go, Rust, Flutter, Ruby, or any technology
- Create your own specialized agents for your preferred stack
- The architect automatically selects appropriate agents based on project structure

### The Second Brain Effect

Two files give agents persistent memory across sprints — reducing token usage and keeping context focused:

**`.claude/project-goals.md`** — The business brain *(you maintain this)*
- Product vision and target audience
- Market analysis and differentiators
- Success metrics and constraints
- What you're building and *why*

The more detail you provide, the sharper and more shrewd the architect becomes.

**`.claude/project-map.md`** — The technical brain *(architect maintains this)*
- Project structure and architecture
- API surface and database schema
- Routes, components, environment variables
- *Where* everything lives and *how* it connects

Agents read this instead of scanning the entire codebase. The architect keeps it lean and current.

## Installation

### From Agentic Forge (recommended)

```bash
# Add the marketplace
/plugin marketplace add damienlaine/agentic-forge

# Install the plugin
/plugin install sprint

# Update to latest version
/plugin marketplace update damienlaine/agentic-forge
```

### Local Development

```bash
# Clone this repo
git clone https://github.com/damienlaine/agentic-sprint.git

# Run Claude Code with the plugin
claude --plugin-dir ./agentic-sprint
```

## Quick Start

### 1. Set Up Your Project

```bash
# Interactive project onboarding
/sprint:setup
```

This creates both Second Brain documents through guided questions:
- `.claude/project-goals.md` (business vision)
- `.claude/project-map.md` (technical architecture)

### 2. Create Your First Sprint

```bash
/sprint:new
```

This creates `.claude/sprint/1/specs.md`. Edit it with your requirements.

### 3. Run the Sprint

```bash
/sprint
```

Watch the agents work:
1. Architect analyzes specs and creates detailed specifications
2. Implementation agents build in parallel
3. Testing agents validate the work
4. Architect reviews and iterates (up to 5 times)
5. Sprint completes with a status summary

## Commands

| Command | Description |
|---------|-------------|
| `/sprint` | Run the full sprint workflow |
| `/sprint:new` | Create a new sprint |
| `/sprint:setup` | Interactive project onboarding |
| `/sprint:test` | Manual UI testing with live browser |
| `/sprint:generate-map` | Generate project-map.md |
| `/sprint:clean` | Remove old sprint directories |

### Manual Testing Mode

Sometimes you want to explore the UI yourself rather than run automated tests. There are two ways:

#### Within a Sprint

Set `UI Testing Mode: manual` in your `specs.md`:

```markdown
## Testing
- UI Testing: required
- UI Testing Mode: manual
```

When the architect requests UI testing:
1. **Chrome opens a browser tab** pointing to your app
2. **You interact with the app manually** — click around, test forms, explore edge cases
3. **Console errors are monitored** in real-time
4. **Close the browser tab** when you're done testing
5. Sprint continues with architect review of your session report

For Next.js projects, a diagnostics agent also monitors for compilation and hydration errors.

#### Standalone Testing

For quick testing outside of sprints:

```bash
/sprint:test
```

Opens a browser, monitors errors, and saves a report when you say "finish testing".

**Reports feed into sprints:** The report is saved to `.claude/sprint/[N]/manual-test-report.md`. When you run `/sprint`, the architect sees your observations and prioritizes fixing the issues you discovered.

## Plugin Structure

```
sprint/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── commands/                  # Slash commands
│   ├── sprint.md              # Main workflow (/sprint)
│   ├── new.md                 # Create sprints (/sprint:new)
│   ├── setup.md               # Project onboarding
│   ├── test.md                # Manual UI testing
│   ├── generate-map.md        # Generate project map
│   └── clean.md               # Cleanup utility
├── agents/                    # Agent definitions
│   ├── project-architect.md   # Coordinator agent
│   ├── python-dev.md          # Python/FastAPI backend
│   ├── nextjs-dev.md          # Next.js frontend
│   ├── allpurpose-agent.md    # Any tech stack
│   ├── qa-test-agent.md       # API/unit testing
│   ├── ui-test-agent.md       # E2E browser testing
│   ├── nextjs-diagnostics-agent.md  # Next.js monitoring (optional)
│   ├── cicd-agent.md          # CI/CD pipelines
│   └── website-designer.md    # Static websites
├── skills/                    # Knowledge modules
│   ├── sprint-workflow/       # How sprints work
│   ├── spec-writing/          # Writing effective specs
│   ├── agent-patterns/        # Agent coordination
│   └── api-contract/          # Contract design
└── docs/                      # Documentation
```

## Agents

### Implementation Agents

| Agent | Tech Stack | Description |
|-------|------------|-------------|
| `python-dev` | FastAPI, PostgreSQL | Python backend development |
| `nextjs-dev` | Next.js 16, React 19 | Next.js frontend development |
| `cicd-agent` | GitHub Actions, Docker | CI/CD pipelines |
| `allpurpose-agent` | Any | Adapts to any technology |
| `website-designer` | Static HTML/CSS | Marketing websites |

### Testing Agents

| Agent | Purpose | Tools |
|-------|---------|-------|
| `qa-test-agent` | API & unit tests | pytest, jest, vitest |
| `ui-test-agent` | E2E browser tests | Chrome browser MCP |
| `nextjs-diagnostics-agent` | Runtime monitoring (Next.js only) | Next.js DevTools MCP |

### Writing Your Own Agents

Create a markdown file in your project's `.claude/agents/` or contribute to this plugin:

```yaml
---
name: your-agent
description: What this agent does
model: opus
---

[Agent instructions...]
```

The architect can then request your agent via SPAWN REQUEST blocks.

## Specification Files

**`specs.md`** - Your input (minimal or detailed):
```markdown
# Sprint 1: User Authentication

## Goal
Add user authentication with email/password login

## Scope
### In Scope
- Registration endpoint
- Login endpoint
- JWT tokens

### Out of Scope
- OAuth providers
- Password reset

## Testing
- QA: required
- UI Testing: required
- UI Testing Mode: automated
```

**`api-contract.md`** - Generated shared interface:
```markdown
## POST /api/auth/login
Request: { email: string, password: string }
Response: { token: string, user: User }
```

## Skills

Sprint includes knowledge modules that Claude can load when needed:

- **sprint-workflow** — Convergent diffusion model, phase lifecycle
- **spec-writing** — How to write effective specifications
- **agent-patterns** — SPAWN REQUEST format, report structure
- **api-contract** — Designing shared contracts

## Best Practices

1. **Run setup first** — Use `/sprint:setup` to create project-goals.md and project-map.md
2. **Write clear specs** — The better your `specs.md`, the better the output
3. **Iterate small** — Multiple small sprints beat one big sprint
4. **Checkpoint often** — Commit before running sprints
5. **Review reports** — Agent reports show what was done and why

## Troubleshooting

### Sprint stuck in iteration loop
- Check `status.md` for blockers
- Review agent reports for errors
- Max 5 iterations before pause

### Agents not following specs
- Ensure `api-contract.md` is clear and complete
- Check for conflicting information in spec files
- Architect may need to clarify specs

## Documentation

- [Agent Architecture](docs/AGENTS.md) - Deep dive into agent system

## License

MIT License - See [LICENSE](LICENSE)

## Contributing

**Contributions are highly encouraged!** This is a community project — the built-in agents are just a starting point.

Ways to contribute:
- **Add new agents** for different tech stacks (Go, Rust, Vue, Django, etc.)
- **Improve existing agents** with better prompts, patterns, or capabilities
- **Share your workflows** — what sprint configurations work well?
- **Report issues** — what breaks? what's confusing?
- **Improve docs** — help others get started

---

Built with Claude Code. Part of [Agentic Forge](https://github.com/damienlaine/agentic-forge).
