# Review Personas

Reusable persona prompts for multi-perspective code review via Claude Code subagents.

## Personas

| File | Perspective | Catches |
|------|-------------|---------|
| `econometrician.md` | PhD econometrician | Statistical correctness, numerical stability, analytical gaps |
| `research-analyst.md` | Junior/mid analyst on the team | Onboarding friction, confusing APIs, unhelpful errors |
| `software-engineer.md` | Staff engineer + security | Performance, architecture, injection, type safety |
| `gentzkow-shapiro.md` | Code and Data authors | Structural violations, reproducibility, automation gaps |
| `operations-lead.md` | Head of ops + OSS maintainer | Team productivity, packaging, extensibility |
| `business-executive.md` | Client-side executive | Output quality, figure aesthetics, presentation readiness |

## How to use

Ask Claude Code to run a multi-perspective review. It will read these files and spawn
one subagent per persona in parallel, then aggregate the findings. For example:

```
Run a multi-perspective review of the current codebase using the review personas.
```

Or scoped to specific files or modules:

```
Run all 6 review personas against src/models/ and aggregate findings by severity.
```

Each persona produces categorized findings with file paths and line numbers. The
categories vary by persona (e.g., the econometrician uses CRITICAL/IMPORTANT/SUGGESTION
while the analyst uses BLOCKED/CONFUSING/SUGGESTION) but map to a common severity scale
when aggregated.
