# Token Optimization --- Product Org OS

## Summary

- **Date**: February 2026
- **Goal**: Reduce context window burden from OS rules and agent SKILL.md files
- **Result**: 59% reduction in rules (128 KB to 53 KB), shared protocol deduplication across 13 OS agents + 26 Extension Team agents

---

## Problem

- 22 rule files totaling ~128 KB loaded at every session start
- Combined with CLAUDE.md, personal rules, MEMORY.md: ~180-200 KB (~45-50K tokens) baseline
- ~25% of 200K context window consumed before first message
- Agent SKILL.md files contained ~70% identical shared protocol sections across 13 agents
- Heavy baseline triggers context compression sooner in long sessions

---

## Phase 1: Rules Compression

### What Changed

| File | Action | Before | After |
|------|--------|--------|-------|
| skill-awareness.md | Major condense | 24 KB | 5.9 KB |
| agent-spawn-protocol.md | Condense + absorb meeting-mode.md | 19 KB | 10.1 KB |
| context-management.md | Condense + absorb principles-enforcement.md | 15 KB | 5.1 KB |
| v2v-flow.md | Convert to reference tables | 11 KB | 3.4 KB |
| delegation-protocol.md | Condense examples | 10 KB | 3.0 KB |
| no-estimates.md | Light condense | 5 KB | 1.5 KB |
| roi-display.md | Light condense | 4.5 KB | 1.2 KB |
| demo-data-handling.md | Light condense | 3.7 KB | 1.0 KB |
| intelligent-routing.md | Merged into skill-awareness.md | 7 KB | DELETED |
| principles-enforcement.md | Merged into context-management.md | 7 KB | DELETED |
| meeting-mode.md | Inlined into agent-spawn-protocol.md | 1.3 KB | DELETED |

### Unchanged Rules (already lean)

- mcp-integration.md (3.7 KB)
- context-graph.md (3.6 KB)
- auto-context.md (3.2 KB)
- parallel-execution.md (2.6 KB)
- maturity-context.md (1.8 KB)
- interaction-logging.md (1.6 KB)
- gtm-documents.md (1.5 KB)
- requirements.md (1.4 KB)
- roadmaps.md (1.3 KB)
- decision-system.md (1.3 KB)
- strategy-documents.md (1.2 KB)

### Result

- **22 files to 19 files** (3 deleted via merge)
- **~128 KB to 53 KB** (59% reduction, ~19K tokens saved per session)

---

## Phase 2: Agent SKILL.md Deduplication

### What Changed

#### 2a. PRINCIPLES.md (already existed)

- Updated cross-references for deleted `principles-enforcement.md`
- Canonical V2V Operating Principles: 8 principles with enforcement mapping
- Referenced by all 13 agents via `../PRINCIPLES.md`

#### 2b. shared-agent-protocol.md (new, 2.5 KB)

- Maintenance reference only, NOT loaded as a rule (zero token cost)
- Single source of truth for shared protocol text
- Contains: Context Awareness, Feedback Capture, Integration Awareness

#### 2c. Agent SKILL.md Updates (13 files)

For each agent, 4 edits applied:

1. Added `<!-- IDENTITY START -->` before heading
2. Added `<!-- IDENTITY END -->` + `<!-- SKILLS START -->` between Anti-Patterns and skills sections
3. Removed shared protocol sections (Context Awareness, Feedback Capture, Integration Awareness where present)
4. Replaced Operating Principles at bottom with `<!-- SKILLS END -->`

**Agent variations:**

| Category | Agents | Sections Removed |
|----------|--------|-----------------|
| All 3 shared sections | PM, Dir PM, Dir PMM, PMM, BizOps, CI, ProdOps, VR | Context Awareness + Feedback Capture + Integration Awareness + Operating Principles |
| 2 shared sections | VP, CPO, BizDev, UX Lead | Context Awareness + Feedback Capture + Operating Principles |
| Unique structure | Product Mentor | Context Awareness + Operating Principles only (no FC, no IA) |

**Product Mentor special handling:**

- Non-standard section order (Success Signals + Anti-Patterns after Sub-Agent Spawning)
- Unique sections preserved: Mentorship Session Logging, Skills I Teach Through, Mode Selection, Level Awareness
- `<!-- IDENTITY END -->` placed after Anti-Patterns (before V2V Phase Context)

#### 2d. Injection Template Verification

The injection template in `agent-spawn-protocol.md` Section 2 already includes:

- Context Awareness rules (lines 68-74)
- Feedback Capture rules (lines 76-77)
- Tool Integration rules (lines 97-98)

These compensate for the removed SKILL.md sections, ensuring agents still follow these protocols at runtime.

### Result

- **~2 KB saved per agent** (~26 KB total across 13 agents)
- **4 compile markers per agent** for future SaaS build scripts
- **0 shared protocol sections** remaining in any agent file
- **All unique content preserved**: no behavioral changes

---

## Compile Markers (SaaS Future-Proofing)

HTML comments added to each agent SKILL.md:

```
<!-- IDENTITY START -->
# {emoji} {Agent Name}
[all identity sections through Anti-Patterns]
<!-- IDENTITY END -->

<!-- SKILLS START -->
## Sub-Agent Spawning
[all skills sections]
<!-- SKILLS END -->
```

These are invisible to Claude Code (zero behavioral impact) but enable the planned SaaS `compile-prompts.ts` build script to reliably extract identity content from skills content.

---

## Final Metrics

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Rules total | ~128 KB (22 files) | 53 KB (19 files) | 75 KB (59%) |
| Rules tokens at session start | ~32K | ~13K | ~19K tokens |
| Agent shared protocol duplication | ~156 KB across 13 agents | 0 (moved to injection template) | ~26 KB total |
| Agent compile markers | 0 | 52 (4 x 13) | SaaS-ready |
| New maintenance files | 0 | 1 (shared-agent-protocol.md, 2.5 KB, not loaded) | n/a |

---

## Phase 3: Extension Teams Deduplication

### Scope

26 Extension Team agents across 3 teams, all with the same 4 shared sections as OS agents.

| Team | Agents | Before | After | Saved |
|------|--------|--------|-------|-------|
| Design | 6 | 89 KB | 78 KB | 11 KB |
| Architecture | 6 | 96 KB | 86 KB | 10 KB |
| Marketing | 14 | 171 KB | 144 KB | 27 KB |
| **Total** | **26** | **357 KB** | **308 KB** | **49 KB** |

### What Changed

Same 4 edits as OS agents applied to all 26 files:
1. Added `<!-- IDENTITY START -->` before heading
2. Added `<!-- IDENTITY END -->` + `<!-- SKILLS START -->` between Anti-Patterns and Sub-Agent Spawning
3. Removed shared protocol sections (Context Awareness, Feedback Capture, Integration Awareness)
4. Replaced Operating Principles at bottom with `<!-- SKILLS END -->`

All 26 agents had all 3 shared sections + Operating Principles (no variations like the OS agents).

Extension Teams already had per-team PRINCIPLES.md files (design: 5.3 KB, architecture: 5.2 KB, marketing: 5.3 KB), so no new files were needed.

### Result

- **49 KB removed** across 26 agents (~1.9 KB/agent average)
- **104 compile markers** added (4 x 26)
- **0 shared protocol sections** remaining
- **All unique content preserved** (Delegation Patterns, Skills, V2V Phase Context, Knowledge Sources, Parallel Execution)

---

## Combined Final Metrics

| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| Rules total | ~128 KB (22 files) | 53 KB (19 files) | 75 KB (59%) |
| Rules tokens at session start | ~32K | ~13K | ~19K tokens |
| OS agent shared protocol | ~156 KB across 13 agents | 0 | ~26 KB |
| Extension Team shared protocol | ~104 sections across 26 agents | 0 | ~49 KB |
| Total compile markers | 0 | 156 (4 x 39 agents) | SaaS-ready |
| New maintenance files | 0 | 1 (shared-agent-protocol.md, 2.5 KB, not loaded) | n/a |
| **Total deduplication** | | | **~150 KB** |

---

## What Was NOT Changed

- YAML frontmatter in agent SKILL.md (kept as-is for routing safety)
- Knowledge packs (126 KB OS + Extension Team packs, loaded on-demand)
- Skill template SKILL.md files (80+ files, already lean)
- Context layer files (data, not prompts)
- CLAUDE.md / personal rules (outside OS scope)
- GATEWAY.md files (3 Extension Team gateways, already lean)

---

## Verification Checklist

### OS Agents (Phase 1-2)
- [x] All 19 rules load cleanly
- [x] All 13 OS agents have 4 compile markers
- [x] All 13 OS agents have 0 shared protocol sections
- [x] All unique agent content preserved
- [x] Injection template compensates for removed sections
- [x] PRINCIPLES.md cross-references updated
- [x] shared-agent-protocol.md created as maintenance reference

### Extension Teams (Phase 3)
- [x] All 26 Extension Team agents have 4 compile markers
- [x] All 26 Extension Team agents have 0 shared protocol sections
- [x] All unique agent content preserved (Delegation Patterns, etc.)
- [x] Per-team PRINCIPLES.md files already existed (no changes needed)

### Overall
- [x] No behavioral changes across any agent — same rules, fewer duplicate words
- [x] 39 agents total optimized, 156 compile markers added
