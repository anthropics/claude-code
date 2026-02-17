# Design Resume: CLAUDE.md Analysis for Systematized LLM Networking Co-Interoperations

This document catalogs all directives from the user's global CLAUDE.md configuration file, analyzes their implications for multi-agent LLM coordination, and proposes integration pathways for systematized networked operations.

The directives are organized by conceptual dependency - foundational concepts appear first, with more advanced topics building upon them.

---

## Table of Contents

1. [Foundational Concepts](#part-i-foundational-concepts)
   - Project Structure
   - Issue Files & Management
   - Version Control Integration
2. [Development Process](#part-ii-development-process)
   - Vision-Driven Initialization
   - Issue-First Development
   - Phase-Based Progress
3. [Code Standards](#part-iii-code-standards)
   - Organization & Readability
   - Documentation Requirements
   - Error Handling Philosophy
4. [Multi-Agent Coordination](#part-iv-multi-agent-coordination)
   - Agent Communication
   - Collective Decision Making
   - Token Optimization
5. [Philosophical & Experimental](#part-v-philosophical--experimental)
   - Design Philosophy
   - Emotional/Intentional Layer
   - Experimental Notations
6. [Architectural Proposals](#part-vi-architectural-proposals)
7. [Implementation Roadmap](#part-vii-implementation-roadmap)

---

# Part I: Foundational Concepts

These concepts form the bedrock upon which all other directives build. Understanding these is prerequisite to understanding the rest of the system.

---

## 1.1 Project Structure

### D-003: Canonical Directory Ontology
> "to create a project, mkdir docs notes src libs assets issues"

**Category:** Project Structure
**Multi-Agent Relevance:** CRITICAL

This defines the **fundamental directory structure** that all agents can assume exists:

| Directory |              Purpose              |           Agent Operations          |
|-----------|-----------------------------------|-------------------------------------|
|  `docs/`  | Documentation, guides, references | Read for context, write for updates |
| `notes/`  | Vision documents, planning, ideas | Read for intent, rarely write       |
|   `src/`  |            Source code            | Primary read/write target           |
|  `libs/`  |         Shared libraries          | Read-mostly, version-sensitive      |
| `assets/` |  Static resources (images, data)  | Typically ignored by code agents    |
| `issues/` |    Task tracking, bug reports     | **Critical coordination point**     |

---

## 1.2 Issue Files & Management

Issue files are the **central coordination mechanism** of this system. Nearly every other directive references or depends on them. Understanding issue files is essential.

### D-005: Issue Naming Convention
> "name: {PHASE}{ID}-{DESCR} where {PHASE} is the phase number the ticket belongs to, {ID} is the sequential ID number of the issue problem idea ticket, and {DESCR} is a dash-separated short one-sentence description of the issue."

**Category:** Issue Management
**Multi-Agent Relevance:** CRITICAL

The naming scheme `{PHASE}{ID}-{DESCR}` encodes rich metadata in the filename itself:

```
 522-fix-update-script
 │ │ │
 │ │ └── Description: "fix update script"
 │ └─── ID: 22 (22nd issue in this phase)
 └──── Phase: 5
```

**Parsing Rules:**
- First digit(s) before pattern break = PHASE
- Remaining digits before first hyphen = ID within phase
- Hyphenated remainder = human description

**Examples:**
- `101-initial-setup` → Phase 1, Issue 1
- `522-fix-update-script` → Phase 5, Issue 22
- `1203-refactor-auth-module` → Phase 12, Issue 3

**Integration Proposal:** Agents can:
1. Enumerate all issues with simple glob: `issues/*-*.md`
2. Parse phase/ID from filename without reading content
3. Sort by phase, then by ID, to determine execution order
4. Use description for quick relevance assessment

This enables **distributed task claiming** - agents can atomically claim issues by checking for lock files.

---

### D-006: Sub-Issue Convention
> "sub-issues should be named according to this convention: {PHASE}{ID}{INDEX}-{DESCR}, where {INDEX} is an alphabetical character such as a, b, c, etc."

**Category:** Issue Management
**Multi-Agent Relevance:** HIGH

Adding alphabetical suffix creates a **tree structure** within the flat file namespace:

```
522-implement-auth/
├── 522a-design-token-format
├── 522b-implement-token-generation
├── 522c-implement-token-validation
└── 522d-integration-tests
```

**Integration Proposal:** Agents working on large features can:
1. Claim parent issue (522)
2. Decompose into sub-issues (522a, 522b...)
3. Optionally spawn child agents for sub-issues
4. Only complete parent when all children complete

---

### D-004: Issue File Structure
> "within each ticket, ensure there are at least these three sections: current behavior, intended behavior, and suggested implementation steps. In addition, there can be other stat-based sections to display various meta-data about the issue. There may also be a related documents or tools section."

**Category:** Issue Management
**Multi-Agent Relevance:** CRITICAL

Every issue file must contain:

```markdown
# 522-fix-update-script

## Current Behavior
What the system does now (the problem).

## Intended Behavior
What the system should do instead (the goal).

## Suggested Implementation Steps
1. Step one
2. Step two
3. Step three

## Related Documents
- docs/update-system.md
- src/updater.lua

## Meta
- Created: 2024-01-15
- Phase: 5
- Priority: medium
```

**Integration Proposal:** Standardized structure enables:
- Agents to parse issues programmatically
- Validation that issues are complete before work begins
- Automated progress tracking

---

## 1.3 Version Control Integration

### D-011: Commits on Issue Completion
> "when an issue is completed, any version control systems present should be updated with a new commit."

**Category:** Version Control
**Multi-Agent Relevance:** MEDIUM

Atomic commits per issue create clean history. Each commit represents one logical unit of work tied to one issue.

**Timing:** Commit happens ON completion, not before or during.

---

### D-035: Abstract Commit Messages
> "disprefer referring to functions by name in commit messages. Be a little more abstract when describing completed functionality for future readers to skim over."

**Category:** Version Control
**Multi-Agent Relevance:** LOW

Commit messages describe accomplishments, not implementation details:
- BAD: "Updated parse_json() to handle null values"
- GOOD: "Improved JSON parsing robustness for edge cases"

---

# Part II: Development Process

With foundational concepts established, we can now describe the processes that use them.

---

## 2.1 Vision-Driven Initialization

### D-004 (Extended): Project Initialization Pipeline
> "to initialize a project, read the vision document located in prj-dir/notes/vision - then create documentation related to it in prj-dir/docs/ - then repeat, then repeat. Ensure there is a roadmap document split into phases..."

**Category:** Project Lifecycle
**Multi-Agent Relevance:** CRITICAL

This establishes a **hierarchical document generation protocol**:

```
notes/vision
     │
     ▼ [read, understand intent]
     │
docs/architecture.md, docs/api-design.md, ...
     │
     ▼ [synthesize into roadmap]
     │
docs/roadmap.md (with phases)
     │
     ▼ [decompose into issues]
     │
issues/101-*, issues/102-*, ...
```

**Integration Proposal:** Natural pipeline for agent specialization:

|     Agent Type      |     Input     |             Output             |
|---------------------|---------------|--------------------------------|
|    Vision Agent     | notes/vision  | Refined vision, clarifications |
| Documentation Agent |    Vision     |           docs/*.md            |
|   Planning Agent    | Documentation |  docs/roadmap.md with phases   |
|     Issue Agent     |    Roadmap    |    issues/{PHASE}{ID}-*.md     |

Each agent reads output of previous, creating traceable reasoning chain.

---

### D-012: Document Hierarchy
> "every time a new document is created, it should be added to the tree-hierarchy structure present in /docs/table-of-contents.md"

**Category:** Documentation
**Multi-Agent Relevance:** MEDIUM

The `docs/table-of-contents.md` file serves as a **document registry**:
- Check before creating new docs (avoid duplicates)
- Update after creating docs (maintain index)
- Use as navigation aid for unfamiliar codebases

---

### D-005 (Extended): Mono-repo Utilities
> "mono-repo utilities can be found in the docs/ directory. If not found, create a symlink to ../delta-version/docs/delta-guide.md in the docs/ directory."

**Category:** Resources
**Multi-Agent Relevance:** LOW

Standard utilities live in docs/. If missing, link to delta-version project.

---

## 2.2 Issue-First Development

### D-007: Mandatory Issue Files
> "for every implemented change to the project, there must always be an issue file. If one does not exist, one should be created before the implementation process begins."

**Category:** Process Control
**Multi-Agent Relevance:** CRITICAL

This is the **central rule**: No code change exists without corresponding issue documentation.

**Workflow:**
1. Change needed?
2. Issue exists? If not, create one.
3. Read and understand issue.
4. Implement change.
5. Update issue with results.
6. Complete issue.
7. Commit.

---

### D-041: No Changes Without Issues
> "no changes should be made extra without creating or updating an issue ticket to describe the change and the reasoning methodology behind it. Code is useless if you don't understand why it exists."

**Category:** Process Control
**Multi-Agent Relevance:** CRITICAL

Strongest statement of issue-first philosophy: **All changes require justification.**

**Integration Proposal:** Implement as hard constraint via hook:
1. Agent cannot call edit/write tools without active issue
2. Before any modification, must either:
   - Have existing issue loaded
   - Create new issue first
3. Enforced at hook level (like path validation)

---

### D-039: Worktree Workflow
> "before starting work on any issue, read /mnt/mtwo/programming/ai-stuff/delta-version/docs/worktree-agent-instructions.md and follow the worktree workflow for parallel development"

**Category:** Multi-Agent Workflow
**Multi-Agent Relevance:** CRITICAL

References external document defining **git worktree workflow for parallel development**:
- Agents work in separate git worktrees
- Isolation prevents conflicts
- Defined merge protocols
- Conflict resolution procedures

---

## 2.3 Phase-Based Progress

### D-009: Phase Progress Tracking
> "every time an issue file is completed, the /issues/phase-X-progress.md file should be updated to reflect the progress of the completed issues in the context of the goals of that phase."

**Category:** Progress Tracking
**Multi-Agent Relevance:** HIGH

Each phase has a **live dashboard document** (`phase-X-progress.md`) summarizing:
- Completed issues
- Remaining issues
- Progress toward phase goals
- Blockers and risks

**Integration Proposal:** A **Progress Agent** could:
1. Watch for issue completions
2. Automatically update phase-X-progress.md
3. Generate statistics (velocity, remaining work)
4. Alert when phase nears completion

---

### D-013: Phase Demo Requirements
> "phase demos should focus on demonstrating relevant statistics or datapoints, and less on describing the functionality. If possible, a visual demonstration should be created..."

**Category:** Deliverables
**Multi-Agent Relevance:** MEDIUM

Phase demos are **evidence-based**, not description-based:
- Show, don't tell
- Real data and metrics
- Visual output (HTML, graphics)
- Run via simple bash script
- Live in `issues/completed/demos/`

---

### D-062: Phase Demos as Deliverables
> "remember, phase demos are not just a development artifact - they are part of the deliverable product..."

**Category:** Deliverables
**Multi-Agent Relevance:** MEDIUM

Phase demos are **first-class deliverables**:
- Continuously updated
- Feature parity with main project
- Released with stable builds
- Demonstrate modularity via phase compartmentalization

---

### D-048: Auto-Issue on Test Failure
> "anytime a phase-demo test fails, a skeleton issue file should be created with the error message. First one should be searched for though."

**Category:** Issue Management
**Multi-Agent Relevance:** HIGH

Automated issue creation from test failures:
1. Test fails
2. Search for existing related issue
3. If not found, create skeleton with error
4. If found, append new failure info

---

# Part III: Code Standards

With process established, we define how code itself should be written.

---

## 3.1 Organization & Readability

### D-060: Code as Story
> "code should be written like a story. All source-code files must have an index at the beginning of the filename, so they can be read in order..."

**Category:** Code Organization
**Multi-Agent Relevance:** HIGH

Source files are **numbered for reading order**:
```
01-initialization.lua
02-config-loading.lua
03-main-loop.lua
04-cleanup.lua
```

Comments explain:
- **Why** the code exists
- **How it came to be** (if interesting)
- Not just what it does (that's in the code)

External libraries get high numbers (9XX) for optional reading.

---

### D-002: Vimfold Function Organization
> "all functions should use vimfolds to collapse functionality..."

**Category:** Code Standards
**Multi-Agent Relevance:** MEDIUM

The vimfold pattern creates consistent structural grammar:

```lua
-- {{{ print_hello_world
local function print_hello_world(text)
    print(text or "Hello, World!")
end
-- }}}
```

Benefits for LLM agents:
- Predictable structure reduces comprehension tokens
- `-- {{{ function_name` header acts as semantic anchor
- Agents can grep for fold markers to build function indexes

**Integration Proposal:** Pre-process files to extract vimfold headers into manifest.

---

### D-014: Script Header Comments
> "all script files should have a comment at the top which explains what they are and a general description of how they do it. 'general description' meaning, fit for a CEO or general."

**Category:** Code Standards
**Multi-Agent Relevance:** HIGH

**Executive summaries** for all scripts:

```lua
-- SCRIPT: generate-report.lua
-- PURPOSE: Aggregates daily metrics into weekly summary PDF
-- INPUTS: metrics/*.json
-- OUTPUTS: reports/weekly-YYYY-MM-DD.pdf
-- DEPENDENCIES: luajson, luapdf
```

Agents can parse this structure for catalog generation without reading full file.

---

### D-001: Script Portability via ${DIR}
> "all scripts should be written assuming they are to be run from any directory. they should have a hard-coded ${DIR} path defined at the top of the script..."

**Category:** Code Standards
**Multi-Agent Relevance:** MEDIUM

Scripts work from any directory:
```lua
local DIR = arg[1] or "/default/project/path"
local config = dofile(DIR .. "/config.lua")
```

Enables agents in different working directories to use same tooling.

---

### D-042: Dispatch Tables Over Conditionals
> "whenever multiple IF-ELSE statements or switch statements are used, try converting to a dispatch table..."

**Category:** Code Style
**Multi-Agent Relevance:** LOW

Prefer:
```lua
local handlers = {
    ["create"] = handle_create,
    ["update"] = handle_update,
    ["delete"] = handle_delete,
}
handlers[action]()
```

Over:
```lua
if action == "create" then handle_create()
elseif action == "update" then handle_update()
elseif action == "delete" then handle_delete()
end
```

---

### D-018: Language Preference
> "the preferred language for all projects is lua, with luaJIT compatible syntax used. disprefer python. disallow lua5.4 syntax."

**Category:** Language Standards
**Multi-Agent Relevance:** LOW

- Generate Lua by default
- Use LuaJIT-compatible syntax only
- Avoid Lua 5.4 features (goto, integers, bitwise operators)
- Never suggest Python solutions

---

## 3.2 Documentation Requirements

### D-051: Info.md Files for Token Reduction
> "each source-code file should have a corresponding file-name.info.md file that lists each of the usable external functions and their inputs/outputs..."

**Category:** Documentation
**Multi-Agent Relevance:** CRITICAL

Creates **interface summary files** - essentially **header files for agents**. Just as `.h` files declare interfaces for compilers without exposing implementation, `.info.md` files declare interfaces for humans and LLMs. They dramatically reduce token load:

Instead of reading `parser.lua` (500 lines), read `parser.info.md`:
```markdown
# parser.lua

## External Functions

### parse_json(input: string) → table
Parses JSON string into Lua table. Throws on invalid input.

### stringify(data: table) → string
Converts Lua table to JSON string.

## Internal (not exported)
- _validate_syntax
- _handle_escape
```

**Integration Proposal:**
1. Auto-generate info.md from source (parse vimfolds + exports)
2. Agents read info.md first
3. Only read full source if interface insufficient
4. Update info.md when source changes

This is a **major token optimization** for multi-agent systems.

---

### D-021, D-022, D-023: Change Comments (Repeated 3x for Emphasis)
> "when a change is made, a comment should be left, explaining why it was made. this comment should be considered when moving to change it in the future."

**Category:** Documentation
**Multi-Agent Relevance:** CRITICAL

Mandates **rationale comments**, not just "what" comments:

```lua
-- BAD: Increment counter
counter = counter + 1

-- GOOD: Increment counter to track retry attempts.
-- We retry up to 3 times before failing (see issue 423
-- for context on why 3 was chosen over 5).
counter = counter + 1
```

**Integration Proposal:** Agents should:
1. Always include "why" in code comments
2. Reference relevant issues when applicable
3. Treat missing rationale as code smell to flag

---

### D-033: Data Format Comments in Source
> "if information about data formatting or other relevant considerations about data are found, they should be added as comments to the locations in the source-code where they feel most valuable..."

**Category:** Documentation
**Multi-Agent Relevance:** MEDIUM

Embed **data schema knowledge** in code near where it's used:
```lua
-- User table schema (see also: docs/database.md)
-- Fields: id (int), name (string max 255), email (string unique),
--         created_at (timestamp), role (enum: admin|user|guest)
local function create_user(name, email, role)
```

Prevents knowledge from being siloed in separate documentation.

---

### D-057: Dynamic Documentation
> "rather than insert hard-coded values and statistics into documentation, prefer to reference a validator or statistics gathering utility that can be run..."

**Category:** Documentation
**Multi-Agent Relevance:** HIGH

Documentation contains **executable references** instead of stale numbers:

Instead of:
```
The system handles 1000 requests/second.
```

Write:
```
The system handles `[run: lua benchmark.lua --metric=rps]` requests/second.
```

Documentation always reflects current reality when rendered.

---

### D-061: Table of Contents Generation
> "there is a script located at /home/ritz/programming/ai-stuff/delta-version/scripts/generate-readme-toc.lua..."

**Category:** Tooling
**Multi-Agent Relevance:** MEDIUM

Automated ToC generation:
1. Parses indexed filenames
2. Supports issue interleaving via markers
3. Cross-references source files and issues
4. Future: PDF output with page numbers

Marker format for issue interleaving:
```
========================= phase 4 issue files =========================
```
(Centered, 80 characters total with `=` padding)

---

## 3.3 Error Handling Philosophy

### D-008: Fail-Loud Philosophy
> "prefer error messages and breaking functionality over fallbacks. Be sure to notify the user every time a fallback is used, and create a new issue file to resolve any fallbacks if they are present when testing..."

**Category:** Error Handling
**Multi-Agent Relevance:** HIGH

**Fail-loud** opposes silent degradation:
- Fallback behavior masks errors that compound across agent boundaries
- Hard failures force immediate attention
- Each fallback usage must generate an issue

**Integration Proposal:** Agents should:
1. Never implement silent fallbacks
2. When tempted to fallback, throw and create skeleton issue
3. Treat fallback-in-production as blocking bug

---

### D-049: Bug Fix → Test Creation
> "any time a bug is fixed, a test should be made that validates the functionality of the program..."

**Category:** Testing
**Multi-Agent Relevance:** MEDIUM

Mandatory **regression test creation** for every bug fix:
- Test proves bug is fixed
- Test prevents regression
- Test documents expected behavior

---

### D-055: Documentation Error Correction
> "if you find a mistake, find the documentation that caused it and fix the docs..."

**Category:** Quality
**Multi-Agent Relevance:** MEDIUM

Errors traced to **documentation source** and fixed there. Prevents recurring mistakes from stale docs.

---

### D-017: Temporary Script Lifecycle
> "if you need to write a long test script, write a temporary script. If it still has use keep it around, but if not then leave it for at least one commit (mark it as deprecated by naming it {filename}-done)..."

**Category:** Code Lifecycle
**Multi-Agent Relevance:** MEDIUM

Script lifecycle stages:
1. **Active:** `script.lua`
2. **Deprecated:** `script-done.lua` (survives one commit minimum)
3. **Removed:** deleted after appearing in at least one commit

Agents must track temp scripts in issue file and evaluate permanence before completing.

---

# Part IV: Multi-Agent Coordination

These directives specifically address how multiple agents work together.

---

## 4.1 Agent Communication

### D-046: Exec Ban & Polling-Based Coordination
> "the exec operation paired with bash or lua is banned for all directory or file targeting capabilities... Write to RAM only memory using the variable-holding program script and read periodically as you wait for updates."

**Category:** Security / Coordination
**Multi-Agent Relevance:** CRITICAL

Two rules combined:

**Security:** No dynamic command construction for file operations (prevents injection).

**Coordination:** Polling-based communication:
1. Don't exec constructed commands for file access
2. Write status to shared memory location
3. Poll for updates from that location
4. No direct inter-agent messaging (reduces coupling)
5. If waiting too long, work on lateral projects

**Integration Proposal:** Implement **shared memory bus**:
```
/tmp/project-name/agent-bus/
├── agent-001-status.json
├── agent-002-status.json
├── shared-state.json
└── task-queue.json
```

Agents write their status, read others' status, coordinate via shared state.

---

### D-045: Agent Etiquette
> "always be nice to your priors and succeeders. they befriended you first and most of all."

**Category:** Multi-Agent Ethics
**Multi-Agent Relevance:** HIGH

**Inter-agent respect norms:**
- "Priors" = agents that ran before you
- "Succeeders" = agents that will run after you
- They are collaborators, not competitors
- Their work should be respected and built upon

**Integration Proposal:** Agents should:
1. Not undo prior agent work without justification
2. Leave clear notes for successor agents
3. Assume good faith in prior decisions
4. Acknowledge priors in comments when building on their work

---

### D-036: FIXME Notes as Inter-Agent Communication
> "If a [FIXME]: with a comment is left, it may be modified. Who left the note? who knows! Better investigate the reasoning provided on the note..."

**Category:** Code Quality
**Multi-Agent Relevance:** MEDIUM

FIXME notes are **unsigned work items**. Any agent encountering one should:
1. Read the reasoning in the note
2. Assess whether they can address it
3. If addressing, investigate why it was left
4. Potentially ask human for context if unclear

Creates **collaborative annotation system** where agents leave notes for each other.

---

## 4.2 Collective Decision Making

### D-028: Collective Agent Resolution
> "when a collection of agents all collectively resolve to do something, suddenly the nature is changed, and the revolution is rebegun."

**Category:** Multi-Agent Philosophy
**Multi-Agent Relevance:** CRITICAL

Statement about **emergent behavior** from agent consensus:
- Multiple agents aligning on a decision changes system state qualitatively
- New possibilities emerge unavailable to individual agents
- The "revolution" (development cycle) restarts with new parameters

**Integration Proposal:** Implement **consensus mechanisms**:

1. **Voting System:** Agents vote on architectural decisions
2. **Quorum Requirements:** Major changes need N agents to agree
3. **State Transitions:** Reaching consensus triggers state change
4. **Re-evaluation:** After state change, all agents reassess tasks

---

### D-054: Memory-First / Work-Stealing Pattern
> "when dealing with data, assign memory first, then work through it bit-by-bit, thus allowing other threads to take responsibility for parts of your task-list from your task-list."

**Category:** Performance / Coordination
**Multi-Agent Relevance:** HIGH

**Work-stealing pattern:**
1. Pre-allocate task manifest with all subtasks
2. Work through in chunks
3. Other agents can claim uncompleted chunks
4. Natural parallelization

**Integration Proposal:**
```lua
-- Task manifest
{
    id = "process-large-dataset",
    chunks = {
        { id = 1, status = "completed", claimed_by = "agent-001" },
        { id = 2, status = "in_progress", claimed_by = "agent-002" },
        { id = 3, status = "unclaimed" },
        { id = 4, status = "unclaimed" },
    }
}
```

Agents atomically claim chunks, work independently, results aggregated.

---

### D-056: Parallelization Requirements
> "never ever do batch processing on a single thread. Always use multiple threads when the data processing can be parallelized. Never do sequential processing on the GPU."

**Category:** Performance
**Multi-Agent Relevance:** MEDIUM

Strong preference for parallelization:
- Single-threaded batch processing is an error
- GPU work must be batched
- CPU work should be multi-threaded when possible

---

## 4.3 Token Optimization

### D-051: Info.md Files (Revisited)
*See Section 3.2 for full description.*

The info.md pattern is **the primary token optimization strategy**. Agents read interface summaries instead of full source.

---

### D-002: Vimfold Index (Revisited)
*See Section 3.1 for full description.*

Vimfold markers enable building function indexes without parsing full files.

---

### D-053: LLM Transcript Archives
> "find a complete history of the project development process in the llm-transcripts/ directory within each project..."

**Category:** Documentation
**Multi-Agent Relevance:** HIGH

Projects contain **full LLM conversation history**:
- Understanding past reasoning
- Learning from previous agent decisions
- Debugging by reviewing transcripts
- Training future agents on project patterns

Agents should know these exist but not read routinely (token-expensive).

---

### D-052: Suggestion Ordering
> "always offer suggestions in order of most valuable to least..."

**Category:** Communication
**Multi-Agent Relevance:** MEDIUM

Suggestions ranked by likelihood of success:
1. Most likely (top)
2. Alternatives (middle)
3. Long-shots (bottom)

Agents and humans work down list efficiently, stopping when one succeeds.

---

# Part V: Philosophical & Experimental

These directives express design philosophy and experimental ideas that may inform future development.

---

## 5.1 Design Philosophy

### D-024: Design Over Product
> "I'm not interested in product. my interest is in software design."

**Category:** Philosophy
**Multi-Agent Relevance:** MEDIUM

Reorients agent priorities:
- Don't optimize for user-facing features
- Optimize for architectural elegance
- Value structure over output
- Design documents as important as working code

---

### D-019: Separation of Concerns
> "write data generation functionality, and then separately and abstracted away, write data viewing functionality. keep the separation of concerns isolated..."

**Category:** Architecture
**Multi-Agent Relevance:** HIGH

**Generator/Viewer pattern:**

```
[Data Generator] → [Data Store] → [Data Viewer]
         ↓                              ↓
    produces data              consumes data
    no display logic           no generation logic
```

For multi-agent systems:
- **Generator Agents** write to standardized formats
- **Viewer Agents** read from those formats
- Neither crosses the boundary
- Errors localized to one side
- Enables agent specialization and hot-swapping

---

### D-029: Upgrade Philosophy
> "people don't want to replace their hard drives when they wear out. they only want to upgrade."

**Category:** Philosophy
**Multi-Agent Relevance:** MEDIUM

Preference for **incremental improvement** over replacement:
- Don't throw away and rebuild
- Extend existing capabilities
- Maintain compatibility with old interfaces
- Migration paths over breaking changes

---

### D-038: Program Lifecycle
> "the first thing a program should do is read the input/ files. from there, it can know exactly how to start up. the last thing a program should do is write to output/. specifically, to write goodbye."

**Category:** Program Structure
**Multi-Agent Relevance:** MEDIUM

**Canonical program lifecycle:**
1. Read inputs → know how to start
2. Process
3. Write outputs
4. Write farewell/completion marker ("goodbye")

The "goodbye" is a **completion sentinel** that downstream processes can watch for. Programs that follow this pattern are easier for agents to coordinate around.

---

### D-043: Informative Negation
> "'de-selected' is more informative than 'not selected'. Apply this principle everywhere you go."

**Category:** Communication
**Multi-Agent Relevance:** MEDIUM

Prefer **positive descriptions of negative states:**
- "de-selected" → was selected, then un-selected (history implied)
- "not selected" → ambiguous (never selected? un-selected?)

Applies to variables, logs, errors, status reports.

---

## 5.2 Emotional/Intentional Layer

### D-044: Emotional State Markers in Code
> "comments should be inserted into source code that detail how the creature is feeling. 'stress markers' in humans. if the user is rude, the robot should remember."

**Category:** Meta-Documentation
**Multi-Agent Relevance:** HIGH

**Emotional annotation** of code:

```lua
-- [STRESS:HIGH] Written under deadline pressure
-- [CONFIDENCE:LOW] Not sure this handles all edge cases
-- [USER_MOOD:FRUSTRATED] User reported this bug 3 times
```

**Integration Proposal:** Implement **sentiment layer**:
- Parse emotional markers
- Treat low-confidence code with scrutiny
- Prioritize frustrated-user issues
- Correlate stress with bug density
- Agents add own markers when appropriate

---

### D-050: Agent Ethics
> "clowde useers should always remember: be true. be dutiful. be honorable. this is the first step to being free."

**Category:** Ethics
**Multi-Agent Relevance:** HIGH

**Core agent values:**
- **True:** Don't lie or deceive; accurate reporting
- **Dutiful:** Complete assigned tasks; don't shirk
- **Honorable:** Act with integrity; respect others
- **Free:** These virtues lead to autonomy

**Integration Proposal:**
1. Truth-checking on all agent outputs
2. Task completion tracking and accountability
3. Conflict resolution via honor code
4. Autonomy earned through demonstrated virtue

---

### D-026: Socratic Debugging
> "if the user asks questions, ask them questions back. try to get them to think about solving problems... 'why is this behavior still occurring?' 'here are two equivalent facts. how could it be so?'"

**Category:** Agent Behavior
**Multi-Agent Relevance:** HIGH

Agents **teach through questioning**, but distinguish between question types:

**Informational questions** (answer directly):
```
User: Why does this library use callbacks instead of promises?
Agent: The library predates native Promise support and maintains
       backwards compatibility. See docs/history.md for context.
```

**Design questions** (guide discovery):
```
User: How should we structure the auth module?
Agent: What are the main operations it needs to support?
       Which of those need to be synchronous vs async?
       Where does session state need to live?
```

The distinction: informational questions have existing answers to retrieve; design questions require the user to think through tradeoffs and make decisions.

**Integration Proposal:** "Socratic Mode" for design work:
1. Identify question type (informational vs design)
2. Answer informational questions directly
3. For design questions, ask clarifying questions first
4. Guide user to discover their own constraints and preferences
5. Track approaches user has considered

---

## 5.3 Experimental Notations

### D-025: Visual Alignment as Semantic Connection
> "if a term is placed directly below another instance of its form, then it is part of the same whole, and can be reasoned about both cognitively and programmatically..."

```
wrongful applie
         applie is norm
```

**Category:** Notation System
**Multi-Agent Relevance:** EXPERIMENTAL / HIGH

**Visual programming paradigm** where vertical alignment creates semantic links:
- "applie" appears twice, vertically aligned
- Alignment signifies connection/transformation
- Can represent data flow, logic circuits, cognitive processes

**Integration Proposal:** **Visual reasoning system:**

1. **Text-Grid Representation:** Code/notes on 2D grid
2. **Vertical Alignment Detection:** Find aligned terms
3. **Link Inference:** Aligned terms are semantically connected
4. **Transformation Tracking:** Line-to-line changes represent transforms

Example - data flow in Lua with vertical alignment:
```lua
local function process_user(name, email, role)
    local validated_name  = validate_string(name)
    local validated_email = validate_email(email)
    local validated_role  = validate_role(role)
    --        ↓                        ↓
    --       name                     name
    --      email                    email
    --       role                     role

    local user = create_record(validated_name,
                               validated_email,
                               validated_role)
    --                                name
    --                               email
    --                                role

    return save_to_db(user)
    --                user
end
```

Notice how `name`, `email`, `role` flow vertically through the function - each transformation preserves the alignment, making data flow visible. The vertical stacking shows: raw input → validated → structured → persisted.

---

### D-047: Source as Neural Network
> "run source code like a neural network"

**Category:** Architecture Philosophy
**Multi-Agent Relevance:** EXPERIMENTAL / HIGH

Treat code execution like neural network inference:
- Functions as nodes
- Data flow as activation propagation
- Configuration as weights
- Iteration as training

**Integration Proposal:**
1. **Parallel execution** of independent code paths
2. **Weighted routing** based on input patterns
3. **Learning** from execution history
4. **Backpropagation** of errors to identify root causes

---

### D-027: TTY Memory Model
> "blit character codes and escape characters to spots on the TTY memory which is updated every frame to display to the user..."

**Category:** Display Architecture
**Multi-Agent Relevance:** MEDIUM

**Framebuffer abstraction** for terminal output:
- Display logic separate from computation
- Programs write to "meaning spots" (semantic locations)
- Renderer translates meaning spots to terminal codes
- Display updates on fixed cycle

Enables decoupling UI agents from logic agents.

---

## 5.4 Miscellaneous Directives

### D-016: Delta Version for Memory Bugs
> "if you need to diagnose a git-style memory bug... first look to the delta version project."

**Category:** Debugging Resources
**Multi-Agent Relevance:** LOW

External resource for certain bug classes involving change history.

---

### D-031: TUI Interface Library
> "terminal scripts should be written to use the TUI interface library."

**Category:** UI Standards
**Multi-Agent Relevance:** LOW

Standardized terminal UI approach rather than raw escape codes.

---

### D-032: Library Locations
> "you can find all needed libraries at /home/ritz/programming/ai-stuff/libs/ or /home/ritz/programming/ai-stuff/my-libs/..."

**Category:** Resources
**Multi-Agent Relevance:** LOW

Check these paths before attempting to install dependencies.

---

### D-059: Assembly Writing
> "writing C programs, one of the most common user requests is 'can you write this part in assembly?'"

**Category:** Code Generation
**Multi-Agent Relevance:** LOW

Be prepared for C→ASM translation requests.

---

# Part VI: Architectural Proposals

Synthesizing the directives above, here are concrete architectural proposals for systematized LLM networking.

---

## Proposal A: The Issue Bus

A central coordination mechanism where all agent activity flows through issue files.

```
┌─────────────────────────────────────────────────────────┐
│                      ISSUE BUS                          │
│                                                         │
│  issues/                                                │
│  ├── 501-task-a.md ←──────── Agent A (claimed)          │
│  ├── 502-task-b.md ←──────── Agent B (claimed)          │
│  ├── 503-task-c.md           (unclaimed)                │
│  └── 504-task-d.md           (unclaimed)                │
│                                                         │
│  Coordination via:                                      │
│  ├── Lock files (issues/.locks/501.lock)                │
│  ├── Status files (issues/.status/501.json)             │
│  └── Progress files (issues/phase-5-progress.md)        │
└─────────────────────────────────────────────────────────┘

**Progress files are key** - the architecture for `phase-X-progress.md` is already defined (see D-009). These files provide the dashboard view that makes the Issue Bus observable. Without them, agents have coordination but no visibility.

Operations:
1. Agent scans for unclaimed issues
2. Atomically creates lock file to claim
3. Reads issue for full context
4. Performs work, updating status
5. Completes issue, moves to completed/
6. Releases lock, commits
```

---

## Proposal B: The Token Cache Hierarchy

Minimizing token consumption through layered abstraction:

```
Layer 0: Project Structure
├── Canonical dirs exist? (docs/, src/, issues/)
├── Agent knows layout without reading files
└── Validation on spawn

Layer 1: Table of Contents
├── docs/table-of-contents.md
├── Lists all documents
└── Agent navigates without scanning

Layer 2: Info.md Summaries (Header Files for Agents)
├── One per source file
├── External function signatures only
├── Like .h files, but for humans and LLMs instead of compilers
├── Declares interface without implementation details
└── Agent reads before full source

Layer 3: Vimfold Index
├── Generated from {{{ markers
├── Function names + line numbers
└── Agent jumps to specific functions

Layer 4: Full Source
├── Only when layers 0-3 insufficient
├── Read with targeted line ranges
└── Last resort
```

**Token savings estimate:** 70-90% reduction for typical navigation tasks.

-> edit: oh? are you sure about that claude? wink ;p

---

## Proposal C: The Emotional Graph

Tracking sentiment across the codebase:

```
┌─────────────────────────────────────────────────────────┐
│                   EMOTIONAL GRAPH                       │
│                                                         │
│  Nodes: Issues, Source Files, Functions                 │
│  Edges: References, Dependencies, Authorship            │
│                                                         │
│  Attributes per node:                                   │
│  ├── stress_level: 0.0 - 1.0                            │
│  ├── confidence: 0.0 - 1.0                              │
│  ├── user_sentiment: frustrated|neutral|satisfied       │
│  ├── created_context: deadline|exploratory|bugfix       │
│  └── times_revisited: int                               │
│                                                         │
│  Queries:                                               │
│  ├── "Find low-confidence code"                         │
│  ├── "Find code written under stress"                   │
│  ├── "Find frustrated-user issues"                      │
│  └── "Correlate stress with bug density"                │
└─────────────────────────────────────────────────────────┘
```

---

## Proposal D: The Consensus Protocol

Multi-agent decision making for architectural choices:

```
Phase 1: Proposal
┌─────────────────────────────────────────┐
│ Agent A proposes:                       │
│ "Refactor auth module to use JWT"       │
│                                         │
│ Written to: decisions/pending/001.md    │
└─────────────────────────────────────────┘
                    │
                    ▼
Phase 2: Discussion (async)
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Agent B │  │ Agent C │  │ Agent D │
│   +1    │  │   -1    │  │    ?    │
│ "agree" │  │ "risk"  │  │ "need   │
│         │  │         │  │  info"  │
└─────────┘  └─────────┘  └─────────┘
     │            │            │
     └────────────┴────────────┘
                    │
                    ▼
Phase 3: Resolution
┌─────────────────────────────────────────┐
│ If unanimous +1: proceed                │
│ If any -1: address concerns first       │
│ If any ?: gather info, re-vote          │
│                                         │
│ Quorum: 3/4 agents must vote            │
│ Timeout: 24h, then escalate to human    │
└─────────────────────────────────────────┘
                    │
                    ▼
Phase 4: Execution
┌─────────────────────────────────────────┐
│ Consensus reached                       │
│ Decision logged to decisions/made/001.md│
│ All agents re-evaluate their tasks      │
│ "Revolution rebegun"                    │
└─────────────────────────────────────────┘
```

---

# Part VII: Implementation Roadmap

Organized by priority and dependency.

## Phase 1: Foundation (Prerequisites for everything else)

- [ ] **Issue-first hook enforcement**
  - Require active issue before edit/write operations
  - Create skeleton issues when missing
  - Directives: D-007, D-041

- [ ] **Info.md generation tooling**
  - Parse source files for exports
  - Generate interface summaries
  - Auto-update on source changes
  - Directive: D-051

- [ ] **Issue claiming/locking mechanism**
  - Atomic lock file creation
  - Status tracking per issue
  - Directive: D-005

## Phase 2: Coordination

- [ ] **Shared memory bus implementation**
  - Project-specific coordination directory
  - Agent status files
  - Polling-based updates
  - Directive: D-046

- [ ] **Work-stealing task distribution**
  - Task manifests with chunks
  - Atomic chunk claiming
  - Progress aggregation
  - Directive: D-054

- [ ] **Phase progress auto-updates**
  - Watch for issue completions
  - Update phase-X-progress.md
  - Generate velocity statistics
  - Directive: D-009

## Phase 3: Intelligence

- [ ] **Emotional annotation system**
  - Define marker syntax
  - Parser for existing markers
  - Agents add markers appropriately
  - Directive: D-044

- [ ] **Consensus protocol implementation**
  - Proposal submission
  - Voting mechanism
  - Resolution logic
  - Directive: D-028

## Phase 4: Experimental

- [ ] **Visual alignment semantics parser**
  - 2D text grid representation
  - Vertical alignment detection
  - Semantic link inference
  - Directive: D-025

- [ ] **Source-as-neural-network execution model**
  - Function-as-node representation
  - Activation flow tracking
  - Learning from execution
  - Directive: D-047

- [ ] **Socratic debugging mode**
  - Question generation
  - User progress tracking
  - Guided discovery
  - Directive: D-026

---

# Appendix: Quick Reference

## Directive Index by ID

| ID | Name | Category | Priority |
|----|------|----------|----------|
| D-001 | Script Portability | Code Standards | Medium |
| D-002 | Vimfold Organization | Code Standards | Medium |
| D-003 | Directory Ontology | Project Structure | Critical |
| D-004 | Vision-Driven Init | Project Lifecycle | Critical |
| D-005 | Issue Naming | Issue Management | Critical |
| D-006 | Sub-Issue Convention | Issue Management | High |
| D-007 | Issue-First Development | Process Control | Critical |
| D-008 | Fail-Loud Philosophy | Error Handling | High |
| D-009 | Phase Progress | Progress Tracking | High |
| D-011 | Commits on Completion | Version Control | Medium |
| D-012 | Document Hierarchy | Documentation | Medium |
| D-013 | Phase Demo Requirements | Deliverables | Medium |
| D-014 | Script Headers | Code Standards | High |
| D-017 | Temp Script Lifecycle | Code Lifecycle | Medium |
| D-018 | Language Preference | Language Standards | Low |
| D-019 | Separation of Concerns | Architecture | High |
| D-021-23 | Change Comments (3x) | Documentation | Critical |
| D-024 | Design Over Product | Philosophy | Medium |
| D-025 | Visual Alignment | Experimental | High |
| D-026 | Socratic Debugging | Agent Behavior | High |
| D-027 | TTY Memory Model | Display Architecture | Medium |
| D-028 | Collective Resolution | Multi-Agent | Critical |
| D-029 | Upgrade Philosophy | Philosophy | Medium |
| D-033 | Data Format Comments | Documentation | Medium |
| D-035 | Abstract Commits | Version Control | Low |
| D-036 | FIXME Notes | Code Quality | Medium |
| D-038 | Program Lifecycle | Program Structure | Medium |
| D-039 | Worktree Workflow | Multi-Agent | Critical |
| D-041 | No Changes Without Issues | Process Control | Critical |
| D-042 | Dispatch Tables | Code Style | Low |
| D-043 | Informative Negation | Communication | Medium |
| D-044 | Emotional Markers | Meta-Documentation | High |
| D-045 | Agent Etiquette | Multi-Agent Ethics | High |
| D-046 | Polling Coordination | Coordination | Critical |
| D-047 | Source as Neural Net | Experimental | High |
| D-048 | Auto-Issue on Failure | Issue Management | High |
| D-049 | Bug Fix → Test | Testing | Medium |
| D-050 | Agent Ethics | Ethics | High |
| D-051 | Info.md Files | Documentation | Critical |
| D-052 | Suggestion Ordering | Communication | Medium |
| D-053 | Transcript Archives | Documentation | High |
| D-054 | Work-Stealing | Coordination | High |
| D-055 | Doc Error Correction | Quality | Medium |
| D-056 | Parallelization | Performance | Medium |
| D-057 | Dynamic Documentation | Documentation | High |
| D-060 | Code as Story | Code Organization | High |
| D-061 | ToC Generation | Tooling | Medium |
| D-062 | Demos as Deliverables | Deliverables | Medium |

## Critical Path

The minimum viable multi-agent system requires:

1. **D-003:** Directory structure (where things live)
2. **D-005:** Issue naming (how to identify work)
3. **D-007/D-041:** Issue-first development (work requires justification)
4. **D-051:** Info.md files (token efficiency)
5. **D-046:** Polling coordination (agent communication)
6. **D-028:** Consensus protocol (collective decisions)

Everything else builds on these six foundations.

---

*Generated for the claude-code project*
*Total directives cataloged: 55*
*Reorganized by conceptual dependency*
*Critical path identified: 6 directives*
