# Extract Anatomy

Produce a comprehensive anatomical document of all instances of the target: **$ARGUMENTS**

If no target is provided, ask the user to specify one.

---

## For Each Item Found, Document:

### Identity
- Name (canonical, aliases, historical names)
- Category / logical group
- Purpose (one sentence)

### Architecture
- **Parameters / Inputs** — name, type, required/optional, default, constraints (min/max/enum/regex), description
- **Outputs / Return Shape** — structure, max size, truncation behavior
- **Internal Mechanics** — execution model, delegation, transformation pipeline
- **State Effects** — reads from, writes to, mutates

### Dependencies
- **Upstream** — prerequisites, feature flags, servers, environment requirements
- **Downstream** — what depends on this, what breaks if it changes
- **Peers** — common pairings, mutual exclusions, ordering constraints

### Constraints & Limitations
- **Hard** — schema validation, size caps, rate limits, timeouts
- **Soft** — best practices, recommended patterns, anti-patterns
- **Behavioral Properties** — read-only, concurrency-safe, permissions, sandbox, auto-allowed
- **Availability** — feature flags, platform requirements, configuration prerequisites

## Methodology

1. Search codebase, installed packages, and config files using `Explore` subagents
2. Cross-reference runtime source of truth against existing documentation
3. Output structured markdown with parameter tables and property lists

## Output Structure

Write to `docs/<target>-reference.md` (or propose a better path). Include:
- Glossary of domain terms
- Quick Reference summary matrix
- Per-item anatomy sections
- Cross-references between related items
- Configuration reference (env vars, CLI flags, config files) if applicable
