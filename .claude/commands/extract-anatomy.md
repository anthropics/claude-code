# Extract Anatomy

Produce a comprehensive anatomical document of all instances of the target: **$ARGUMENTS**

If no target is provided, ask the user to specify one.

---

## Phase 0: Reconnaissance

Before extraction, run a fast **discovery scan** to determine:

1. **Where the target lives** — codebase, installed packages, config files, runtime artifacts
2. **How many instances exist** — rough count to determine parallelization strategy
3. **What the source of truth is** — source code, schemas, bundle, config parsers, API specs

Use an `Explore` subagent for this. Output: a manifest of locations and estimated instance count.

---

## Phase 1: Parallel Extraction

Fan-out extraction across **parallel subagents**, each responsible for one extraction dimension. Launch these **simultaneously in a single message**:

### Subagent E1: Identity & Inventory
> Discover and catalog every instance of the target.
- **Name** (canonical, aliases, historical names, user-facing name)
- **Category** / logical group
- **Purpose** (one sentence: what it does and why it exists)
- Output: complete inventory list, confirm nothing is missing

### Subagent E2: Inputs, Outputs & Schemas
> Extract the full parameter and return shape anatomy.
- **Parameters / Inputs** — every parameter with: name, type, required/optional, default value, constraints (min/max/enum values/regex), description
- **Outputs / Return Shape** — what it produces, including structure, max size, truncation behavior
- Source: read actual schema definitions (Zod, JSON Schema, OpenAPI, TypeScript types, function signatures)
- Output: structured parameter tables per item

### Subagent E3: Internal Mechanics & State Effects
> Understand how each item actually works at runtime.
- **Execution model** — synchronous/async, sandboxed, delegated, queued
- **Transformation pipeline** — what happens between input and output
- **State effects** — what it reads from, writes to, or mutates (files, env, memory, network)
- **Behavioral properties** — read-only, concurrency-safe, requires permission, auto-allowed
- Source: read implementation code, trace execution paths
- Output: mechanics summary per item

### Subagent E4: Dependencies & Relationships
> Map the dependency graph between items and the broader system.
- **Upstream** — prerequisites, feature flags, servers, environment requirements, configuration
- **Downstream** — what depends on this, what breaks if it changes
- **Peer relationships** — common pairings, mutual exclusions, ordering constraints, composition patterns
- **Cross-references** — which items reference or invoke each other
- Source: trace imports, invocations, configuration wiring
- Output: dependency map and relationship matrix

### Subagent E5: Constraints, Limitations & Availability
> Catalog every hard and soft limit.
- **Hard constraints** — enforced by schema/code: validation rules, size caps, rate limits, timeout ceilings, numeric bounds
- **Soft constraints** — guidance: best practices, recommended patterns, anti-patterns, "do not" rules
- **Availability conditions** — feature flags, platform requirements, configuration prerequisites, mutual exclusivity
- Source: read validators, error handlers, feature flag checks, conditional enablement logic
- Output: constraint table per item

### Subagent E6: Configuration & Environment
> Extract all configuration surfaces that affect the target.
- **Environment variables** — name, default, what they affect
- **CLI flags** — name, description, interaction with the target
- **Configuration files** — paths, schemas, scopes (project/local/user/global)
- **Runtime settings** — programmatic configuration options
- Source: read env var readers, argument parsers, config file loaders
- Output: configuration reference tables

---

## Phase 2: Synthesis

After all 6 extraction subagents return:

### Merge
1. Use E1's inventory as the canonical item list
2. For each item, merge in E2's parameter tables, E3's mechanics, E4's dependencies, E5's constraints, E6's configuration
3. Resolve conflicts (if two subagents report different defaults, E2's schema-extracted value wins over E3's observed value)

### Structure the Document

Write to `docs/<target>-reference.md` (or propose a better path). Assemble in this order:

1. **Title and introduction** — one paragraph describing what this reference covers
2. **Glossary** — domain-specific terms discovered across all subagents (each subagent should flag terms it had to define)
3. **Quick Reference matrix** — summary table with one row per item, columns for category, purpose, key properties
4. **Tool Selection Guide / Use-Case Table** — "If you want to X, use Y" (derived from E4's relationship data)
5. **Common Workflow Patterns** — composition sequences derived from E4's peer relationships
6. **Per-item anatomy sections** — full detail, one section per item, in category order
7. **Configuration reference** — consolidated from E6
8. **Cross-reference index** — bidirectional links derived from E4
9. **Summary table** — category → items mapping
10. **Historical names / aliases** — from E1's alias data

### Validate Completeness

Before finalizing, verify:
- [ ] Every item from E1's inventory has a full section
- [ ] Every parameter from E2 appears in its item's table
- [ ] Every behavioral property from E3 is listed
- [ ] Every dependency from E4 has a cross-reference
- [ ] Every constraint from E5 is documented
- [ ] Every config surface from E6 is in the configuration reference

---

## Why Parallel Extraction

| Serial Approach | Parallel Approach |
|----------------|-------------------|
| One subagent extracts everything per item, one item at a time | Six subagents each extract one dimension across ALL items simultaneously |
| Bottlenecked on sequential item processing | All dimensions extracted concurrently |
| Evaluator fatigue: later items get less attention | Each subagent has a narrow focus, consistent depth |
| Schema + mechanics + dependencies tangled in one pass | Clean separation: schema expert, dependency expert, constraint expert |
| Conflicts hidden within single output | Conflicts surfaced during merge (different subagents report different values → resolution) |

The key insight: **extraction dimensions are independent**. Knowing an item's parameters doesn't require knowing its dependencies. Knowing its constraints doesn't require knowing its mechanics. So they parallelize cleanly.

### When to Add More Subagents

If the target has **>20 instances**, consider splitting E2 (schemas) and E3 (mechanics) further by category:
```
E2a: Schemas for File I/O tools
E2b: Schemas for Search tools
E2c: Schemas for Agent tools
...
```

If the target has **cross-system dependencies** (e.g., frontend + backend + database), add:
```
E7: Cross-system integration points
```

If the target has **versioning concerns**, add:
```
E8: Version history and migration paths
```
