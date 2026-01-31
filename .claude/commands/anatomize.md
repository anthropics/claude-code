# Anatomize & Adversarially Optimize

You are executing a two-phase methodology: **Anatomize** then **Adversarially Optimize**. The target is: **$ARGUMENTS**

If no target is provided, ask the user to specify one (e.g., "native tools", "API endpoints", "database models", "CI/CD pipelines", "authentication flows").

Both phases use parallel subagent orchestration. The full pipeline is:

```
Recon (1 agent) → Extract (6 parallel) → Synthesize → Evaluate (6 parallel) → Synthesize → Apply
```

---

## Phase 0: Reconnaissance

Before extraction, run a fast **discovery scan** with an `Explore` subagent to determine:

1. **Where the target lives** — codebase, installed packages, config files, runtime artifacts
2. **How many instances exist** — rough count to calibrate parallelization
3. **What the source of truth is** — source code, schemas, bundle, config parsers, API specs

Output: a manifest of locations and estimated instance count.

---

## Phase 1: Parallel Anatomical Extraction

Fan-out extraction across **6 parallel subagents**, each responsible for one extraction dimension. Launch these **simultaneously in a single message**:

### E1: Identity & Inventory
> Discover and catalog every instance of the target.
- **Name** (canonical, aliases, historical names, user-facing name)
- **Category** / logical group
- **Purpose** (one sentence: what it does and why it exists)
- Confirm nothing is missing — this is the master checklist

### E2: Inputs, Outputs & Schemas
> Extract the full parameter and return shape anatomy from actual schema definitions.
- **Parameters / Inputs** — every parameter with: name, type, required/optional, default value, constraints (min/max/enum values/regex), description
- **Outputs / Return Shape** — what it produces: structure, max size, truncation behavior
- Source: Zod schemas, JSON Schema, OpenAPI specs, TypeScript types, function signatures

### E3: Internal Mechanics & State Effects
> Understand how each item actually works at runtime.
- **Execution model** — synchronous/async, sandboxed, delegated, queued
- **Transformation pipeline** — what happens between input and output
- **State effects** — reads from, writes to, mutates (files, env, memory, network)
- **Behavioral properties** — read-only, concurrency-safe, requires permission, auto-allowed
- Source: implementation code, execution path traces

### E4: Dependencies & Relationships
> Map the dependency graph between items and the broader system.
- **Upstream** — prerequisites, feature flags, servers, environment requirements
- **Downstream** — what depends on this, what breaks if it changes
- **Peer relationships** — common pairings, mutual exclusions, ordering constraints, composition patterns
- **Cross-references** — which items reference or invoke each other
- Source: imports, invocations, configuration wiring

### E5: Constraints, Limitations & Availability
> Catalog every hard and soft limit.
- **Hard constraints** — enforced by schema/code: validation rules, size caps, rate limits, timeouts
- **Soft constraints** — guidance: best practices, recommended patterns, anti-patterns
- **Availability conditions** — feature flags, platform requirements, mutual exclusivity
- Source: validators, error handlers, feature flag checks, conditional enablement

### E6: Configuration & Environment
> Extract all configuration surfaces that affect the target.
- **Environment variables** — name, default, what they affect
- **CLI flags** — name, description, interaction with the target
- **Configuration files** — paths, schemas, scopes (project/local/user/global)
- **Runtime settings** — programmatic configuration options
- Source: env var readers, argument parsers, config file loaders

### Scaling Strategy

If the target has **>20 instances**, split E2 and E3 further by category:
```
E2a: Schemas for category A    E3a: Mechanics for category A
E2b: Schemas for category B    E3b: Mechanics for category B
```

If the target has **cross-system** scope, add `E7: Cross-system integration points`.
If the target has **versioning** concerns, add `E8: Version history and migration paths`.

---

## Phase 1.5: Merge & Assemble

After all extraction subagents return:

### Merge
1. Use E1's inventory as the canonical item list — every item here gets a full section
2. For each item, merge in: E2's parameter tables, E3's mechanics, E4's dependencies, E5's constraints, E6's configuration
3. Resolve conflicts: E2's schema-extracted values win over E3's observed values (schema is the source of truth)
4. Flag terms each subagent had to define → aggregate into glossary

### Assemble the Document

Write to `docs/<target>-reference.md`. Structure:

1. **Title and introduction** — one paragraph
2. **Glossary** — aggregated from all subagents
3. **Quick Reference matrix** — one row per item, key properties as columns
4. **Selection Guide** — "If you want to X, use Y" (from E4's relationship data)
5. **Workflow Patterns** — composition sequences (from E4's peer relationships)
6. **Permission & Security Model** — auto-allowed vs permission-required (from E3 + E5)
7. **Per-item anatomy sections** — full detail, in category order
8. **Configuration reference** — consolidated from E6
9. **Cross-reference index** — bidirectional links from E4
10. **Summary table** — category → items
11. **Historical names / aliases** — from E1

### Validate Before Proceeding

- [ ] Every item from E1 has a full section
- [ ] Every parameter from E2 appears in its item's table
- [ ] Every behavioral property from E3 is listed
- [ ] Every dependency from E4 has a cross-reference
- [ ] Every constraint from E5 is documented
- [ ] Every config surface from E6 is in the configuration reference

---

## Phase 2: Parallel Adversarial Evaluation

Once the anatomical document is assembled, launch **6 evaluation subagents in parallel**:

### R1: Convex Easy Wins
> High-impact, low-effort improvements remaining.
- Missing defaults that take 1 line to add?
- Incorrect values that are a find-and-fix?
- Missing cross-references that need a "See also: X" line?
- Formatting inconsistencies fixable in a single pass?
- **Scoring:** 5 = fully polished, 1 = many trivial fixes remaining

### R2: Extending Capabilities
> Does it enable users to push beyond basic usage?
- Full parameter space documented (not just common params)?
- Advanced features, edge cases, power-user patterns?
- Composition patterns (items combining for emergent capability)?
- Extension points (hooks, plugins, custom configurations)?
- **Scoring:** 5 = comprehensive advanced coverage, 1 = basic-only

### R3: Reducing Steps to Accurate Results
> How efficiently can a reader go from question to answer?
- Quick Reference for the 80% case?
- "Use this, not that" decision tables?
- Workflow patterns with step-by-step sequences?
- Common errors and fixes documented inline?
- **Scoring:** 5 = minimal steps to any answer, 1 = requires full read

### R4: Improvement-Integration Points
> Does it identify where the system can be improved?
- Limitations framed as improvement opportunities?
- Gaps between current and ideal behavior?
- Automation opportunities (scripts, CI, generators)?
- Version/drift detection strategies?
- **Scoring:** 5 = clear improvement roadmap, 1 = static reference only

### R5: Accuracy & Source-of-Truth Fidelity
> Is it correct against the actual runtime artifact?
- Parameter types, defaults, constraints verified against source?
- Documentation lies identified (stated != actual)?
- Enum values exhaustive?
- Constraints match runtime enforcement?
- **Scoring:** 5 = fully verified, 1 = unverified or contains errors

### R6: Structural & Navigational Quality
> Is it well-architected as a reference artifact?
- ToC complete and correctly linked?
- Glossary comprehensive (no undefined jargon)?
- Section headings consistent and scannable?
- Metadata template consistent across all items?
- Related items cross-referenced bidirectionally?
- **Scoring:** 5 = professional reference quality, 1 = inconsistent/hard to navigate

---

## Phase 2.5: Synthesize & Apply

After all 6 evaluation subagents return:

1. **Aggregate** scores into a summary table
2. **Deduplicate** overlapping findings across dimensions
3. **Prioritize** by impact:
   - Convex easy wins first (maximum value per effort)
   - Accuracy fixes (wrong > missing)
   - Step reduction (efficiency compounds)
   - Capability extensions (breadth)
   - Structural quality (polish)
   - Integration points (forward-looking)
4. **Apply** all Critical and Major fixes, then Minor, then low-effort Enhancements
5. **Commit** with detailed message listing pre/post scores and what changed

---

## Stopping Criteria

- **Target:** 4+/5 across all 6 dimensions
- **Stop when:** all dimensions 4+/5, OR a round yields <3 actionable findings, OR 3 rounds completed
- **Don't stop when:** any dimension <3/5, OR accuracy findings remain unaddressed
- **First draft baseline:** expect 2-3/5 — this is normal, not a failure
- **Diminishing returns:** round 1 captures ~60%, round 2 ~25%, round 3 ~10%
