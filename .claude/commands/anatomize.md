# Anatomize & Adversarially Optimize

You are executing a two-phase methodology: **Anatomize** then **Adversarially Optimize**. The target is: **$ARGUMENTS**

If no target is provided, ask the user to specify one (e.g., "native tools", "API endpoints", "database models", "CI/CD pipelines", "authentication flows").

---

## Phase 1: Anatomize

Produce a comprehensive anatomical document of every instance of the target. For each item, document:

### 1. Identity
- **Name** (canonical, aliases, historical names)
- **Category** (which logical group it belongs to)
- **Purpose** (one-sentence description of what it does and why it exists)

### 2. Anatomical Architecture
- **Parameters / Inputs** — every parameter with: name, type, required/optional, default value, constraints (min/max/enum values/regex), and description
- **Outputs / Return Shape** — what it produces, including structure, max size, truncation behavior
- **Internal Mechanics** — how it works (execution model, delegation, transformation pipeline)
- **State Effects** — what it reads from, writes to, or mutates

### 3. Dependencies
- **Upstream** — what must exist or be configured for this to function (prerequisites, feature flags, servers, environment)
- **Downstream** — what depends on this, what breaks if this changes
- **Peer Relationships** — tools/components it commonly pairs with, mutual exclusions, ordering constraints

### 4. Constraints & Limitations
- **Hard Constraints** — enforced limits (schema validation, size caps, rate limits, timeout ceilings)
- **Soft Constraints** — guidance and best practices (recommended usage patterns, anti-patterns)
- **Behavioral Properties** — read-only, concurrency-safe, requires permission, sandboxed, auto-allowed
- **Availability Conditions** — feature flags, platform requirements, configuration prerequisites

### Methodology
1. Use `Explore` subagents to search the codebase, installed packages, and configuration files
2. Cross-reference source of truth (actual runtime schemas/code) against any existing documentation
3. Produce structured markdown with tables for parameters and bullet lists for properties
4. Include a Quick Reference matrix at the top and a Glossary for domain-specific terms

### Output
Write the anatomical document to a file. Propose a sensible path based on the target (e.g., `docs/<target>-reference.md`). Include:
- Glossary of domain terms
- Quick Reference summary table
- Full per-item anatomy sections
- Cross-reference notes between related items
- Configuration reference (env vars, CLI flags, config files) if applicable

---

## Phase 2: Adversarially Optimize

Once the anatomical document exists, launch **parallel subagents** to adversarially evaluate it. Each subagent gets ONE rubric dimension and must return:
- **Score** (1-5)
- **Specific findings** (what's wrong, missing, or improvable — with line references)
- **Concrete recommendations** (exact changes, not vague suggestions)

### Rubric Dimensions

Launch these **6 subagents in parallel**:

#### R1: Convex Easy Wins
> Score how many high-impact, low-effort improvements exist.
- Are there missing defaults that take 1 line to add?
- Are there incorrect values that are a simple find-and-fix?
- Are there missing cross-references that just need a "See also: X" line?
- Are there inconsistencies in formatting/structure that a single pass fixes?
- **Scoring:** 5 = no easy wins left (already polished), 1 = many trivial fixes remaining

#### R2: Extending Capabilities
> Score how well the document enables users to push beyond basic usage.
- Does each item document its full parameter space (not just the common ones)?
- Are advanced features, edge cases, and power-user patterns documented?
- Are composition patterns shown (how items combine for emergent capability)?
- Are extension points documented (hooks, plugins, custom configurations)?
- **Scoring:** 5 = comprehensive advanced coverage, 1 = basic-only documentation

#### R3: Reducing Steps to Accurate Results
> Score how efficiently a reader can go from question to correct answer.
- Is there a Quick Reference for the 80% use case?
- Are "Use this, not that" decision tables present?
- Are workflow patterns documented with step-by-step sequences?
- Can a reader find the right tool/item without reading the entire document?
- Are common errors and their fixes documented inline?
- **Scoring:** 5 = minimal steps to any answer, 1 = requires full document read

#### R4: Improvement-Integration Points
> Score how well the document identifies where the system can be improved.
- Are limitations framed as improvement opportunities?
- Are gaps between current and ideal behavior identified?
- Are automation opportunities noted (scripts, CI, generators)?
- Are version/drift detection strategies suggested?
- **Scoring:** 5 = clear roadmap for improvement, 1 = static reference only

#### R5: Accuracy & Source-of-Truth Fidelity
> Score correctness against the actual runtime artifact.
- Cross-reference parameter types, defaults, and constraints against source code/schemas
- Identify any documentation lies (stated behavior != actual behavior)
- Check enum values are exhaustive
- Verify constraints match runtime enforcement
- **Scoring:** 5 = fully verified against source, 1 = unverified or contains errors

#### R6: Structural & Navigational Quality
> Score the document's architecture as a reference artifact.
- Is the ToC complete and correctly linked?
- Is the Glossary comprehensive (no undefined jargon)?
- Are section headings consistent and scannable?
- Is the metadata template consistent across all items?
- Are related items cross-referenced bidirectionally?
- **Scoring:** 5 = professional reference quality, 1 = inconsistent/hard to navigate

### Synthesis

After all 6 subagents return:
1. **Aggregate scores** into a summary table
2. **Deduplicate** overlapping findings
3. **Prioritize** by impact (convex wins first, then capability extensions, then structural)
4. **Apply** all improvements to the anatomical document
5. **Commit** with a detailed message listing what changed and why

### Target Scores
- Phase 1 baseline is expected around 2-3/5 (first drafts always have gaps)
- After Phase 2 application, target 4+/5 across all dimensions
- If any dimension remains below 3/5, run a focused follow-up pass on that dimension
