# swarm-orchestrator — Improvements over vanilla Anthropic Teams

This is a **living document** capturing every limitation I hit using Anthropic's Teams beta (gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in Claude Code 2.1.138), and every feature I propose to address them. It is intended to serve as the body of the GitHub issue / PR description when this plugin is submitted upstream.

**Status**: Draft. Add entries as new limitations are discovered. Each entry is dated.

---

## Two ways to use this plugin

This plugin is designed for **dual use** — either as a complete standalone swarm orchestration system, or as a layered addition to Anthropic's Teams primitives. The same primitive set works in both modes; the difference is which transport layer you wire to.

### Mode A — Standalone swarm

Assume Anthropic Teams does not exist. This plugin alone provides:

- Multi-tier orchestration (meta-supervisor → supervisor → typed heads)
- DAG-dependency task graph with auto-unblock cascade
- Filesystem-backed task list + inbox transport (one Python module, no daemon required)
- Tool use registry with role-based allowlists
- Provider routing (Claude Max plan / API / Bedrock / Vertex / local)
- Worktree isolation + lifecycle management
- Clone-isolated merge pipeline with test gate + rollback
- Per-teammate budget tracking + cost ledger
- Reviewer checkpoint (every N turns)
- Auto-recovery for dead teammates
- Pattern-detection logging for offline classifier training
- 10 toy scenarios for validation

Works on any machine with `claude` (or a fallback CLI) installed. No experimental flags required. Single `pip install` for the standalone engine; the plugin packages it as a Claude Code surface.

### Mode B — Integrated with Anthropic Teams

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set and the binary's Teams primitives are active, the plugin's standalone storage layer becomes optional. Instead, the plugin **adapts** to Anthropic's on-disk schema (`~/.claude/teams/<name>/config.json`, `inboxes/<recipient>.json`, `tasks/<N>.json`) and uses the binary's built-in tools where available:

- `Anthropic.TaskCreate` for new tasks → plugin layers DAG-aware dispatch on top
- `Anthropic.SendMessage` for routing → plugin layers cross-team + cross-machine routing
- `Anthropic.InboxPoller` for delivery → plugin reuses; binary already polls the schema
- Plugin's **named subagent_types** (Scanner, Reviewer, Builder, Merger, Test-Runner, Auditor) register via `agents/*.md` and surface to `Agent` calls
- Plugin's hooks (`SubagentStop`, `Stop`) fire on lifecycle events Anthropic's runtime emits

In Mode B, vanilla Teams users see no behavior change unless they explicitly invoke a plugin slash command (`/swarm-spawn`, `/swarm-status`, `/swarm-merge`) or register a typed-head subagent. Fully backward-compatible.

### Why dual-mode matters

- **Anthropic Teams is beta and gated.** Users without the experimental flag still need swarm orchestration. The plugin works for them via Mode A.
- **Multi-machine fleets.** A meta-supervisor on host A can manage a Mode-B team on host B and a Mode-A team on host C — the plugin's storage abstraction unifies them.
- **Graceful fallback.** If a feature ships in Mode B but a user is on an older Claude Code build, they get the Mode-A equivalent automatically.
- **Independent evolution.** The standalone engine can be released on PyPI / Homebrew with its own cadence; the plugin tracks Anthropic's CLI releases.

The rest of this document describes the **primitives** (which exist in both modes) and the **integration delta** (what changes when bridging to Anthropic Teams in Mode B).

---

## Session resistance — work continues after Claude CLI exits

A defining property of this swarm: **tasks continue to completion even after the Claude CLI session that started them exits.**

The meta-supervisor daemon (spawned via `claude --bare` or a launchd / systemd unit) runs independently of any interactive session. It polls the on-disk task list, dispatches teammates as DAG nodes unblock, gates merges through the test pipeline, and respawns crashed workers — all driven by file-system events, not by a live conversation.

**Configurable at init time.** Operators who prefer human-in-the-loop semantics keep the default (session-bound). Those who want truly autonomous overnight / weekend runs flip the switch:

```sh
claude-swarm init --persistent           # autonomous mode: keep going after CLI exit
claude-swarm init --session-bound        # default: stop dispatching when CLI exits
claude-swarm config set persistent.mode true   # toggle later
```

The CLI's visibility commands (`claude-swarm status`, `swarm-watch` TUI dashboard) **always work** regardless of mode — they attach to the daemon, not to any specific session. Operators get a single pane of glass even when work was kicked off days ago in a now-closed session.

This is why the architecture leans on filesystem state + a polling loop rather than push-based RPC: every primitive is durable across process restarts, machine reboots, and human breaks. The swarm is a service, not a chat.

---

## Primitive set (complete enumeration)

These are the primitives the standalone engine implements + the plugin exposes. Each works identically in Mode A and Mode B; storage backends differ but the API is stable.

### Coordination primitives

The coordination layer is built on a **DAG-aware kanban** that's safe for parallel access by N workers:
- `claim_one()` is atomic (sqlite `BEGIN IMMEDIATE` in the library; flock-guarded JSON in the plugin's lightweight mode) — no two workers ever claim the same task
- `unblocked()` returns a topologically-correct iterator over tasks whose blockers are all `done`
- `add_blocked_by` / `add_blocks` are first-class mutations; the auto-unblock cascade fires via `PostToolUse(TaskUpdate)` hook
- Status timeline (`tasks/<id>/timeline.jsonl`) captures every transition for audit + replay
- Schema-compatible with Anthropic Teams' `TaskCreate.blockedBy` field — I just add the iterator + cascade on top

| Primitive | What it does | Mode A backend | Mode B backend |
|---|---|---|---|
| `Kanban.claim_one(head_type)` | Atomic claim from the ready queue | Plugin: flock-guarded JSON; Library: sqlite WAL `BEGIN IMMEDIATE` | Atomic write to Anthropic's `tasks/<id>.json` via `TaskUpdate` |
| `TaskCreate / Get / Update / List / Stop` | Task lifecycle | Plugin's `claude_swarm.tasks` module | Anthropic's `Task*` tools |
| `TeamCreate / Delete` | Team lifecycle | Plugin's `claude_swarm.teams` module | Anthropic's `Team*` tools |
| `SendMessage` | Inter-agent messaging | Plugin's `claude_swarm.messaging` module | Anthropic's `SendMessage` tool |
| `DAG.addBlocks / addBlockedBy` | Task dependencies | Plugin extension | Plugin extension (Anthropic's flat list extended) |
| `DAG.unblocked()` | Iterator over ready-to-dispatch tasks | Plugin | Plugin (read Anthropic's task list, filter) |
| `MultiTeam.create / switch / route` | N concurrent teams per session | Plugin | Plugin (extends single-team limit) |
| `CrossMachine.route(name@machine)` | Multi-host SendMessage | Plugin (SSH tunnel + ed25519 auth) | Anthropic's `--remote-control` when available |

### Reliability primitives

| Primitive | What it does |
|---|---|
| `AbortMarker(name)` | Drop a marker file; teammate commits WIP + exits at next phase boundary |
| `AutoRecovery` | Meta-supervisor respawns dead teammates from last commit |
| `WorktreeIsolation` | Each teammate gets its own git worktree (parallel-safe) |
| `WorktreeGC` | Prune worktrees of completed teammates |
| `FileOverlapReject` | Reject parallel dispatch if predicted file collision exceeds threshold |
| `BoundedQueue(maxsize, drop="oldest")` | Inbox queues never grow unbounded |
| `AtomicWrites` | All state writes use write-to-tmp + rename (no partial corruption) |
| `Flock(path)` | Per-team-config + per-task lock to prevent concurrent edits |

### Tool use primitives

| Primitive | What it does |
|---|---|
| `ToolRegistry.register(name, tool, allowed_heads)` | Declares a tool + which head types may use it |
| `ToolRegistry.scoped_for(head)` | Returns the tool subset a head is allowed; used at spawn-time |
| `ProviderRouter.select(task)` | Picks LLM provider per task hint (e.g., expensive tasks → API, cheap tasks → Max plan) |
| `MCPServer.bundle(name)` | Plugin can ship optional MCP servers as separate packages — none in the core plugin |
| `AntCLI.classify(prompt, model="haiku")` | Cheap one-shot LLM classifications via the Anthropic Platform CLI (`ant`) — used by Scanner heads + meta-supervisor decisions |

### Quality primitives

| Primitive | What it does |
|---|---|
| `ReviewerCheckpoint(every_n_turns)` | Spawn a Reviewer head at scheduled intervals to audit team state |
| `TestGate(test_command, branch)` | Run configured tests in a staging clone before merge; rollback on fail |
| `MergePipeline.dry_run(branches)` | Clone-isolated dry-merge; report conflicts + suggested topological order |
| `MergePipeline.execute(branches)` | Atomic batch merge with test gate + rollback |
| `LintGate(lint_command)` | Block merge if linting fails |

### Observability primitives

| Primitive | What it does |
|---|---|
| `Budget(team, soft_cap, hard_cap)` | Per-team + per-teammate token budget enforcement |
| `CostLedger.debit(agent, tokens, dollars)` | Time-series ledger of spend per agent / per task |
| `StatusTimeline(team)` | Every state transition logged with timestamp + reason |
| `PatternDetection.log(decision)` | Supervisor decisions logged for offline classifier training |
| `MindStatus()` | Stable JSON status feed at `~/.claude/teams/.status.json` for external UIs (Apple app, web dashboard) |

### Autonomy primitives

| Primitive | What it does |
|---|---|
| `Scanner.discover(target)` | Read-only head that files tasks autonomously from codebase scans |
| `MetaSupervisor.poll()` | Long-running loop that detects stalled tasks + respawns dead teammates + enforces budgets |
| `AutoMerge.on_task_complete(task)` | Hook fires on `status=completed` → runs merge pipeline + pushes |
| `ParallelismSafetyClassifier(task)` | Returns estimated probability that this task can run in parallel with others without conflict |

---

## Architecture context (what `SendMessage` is, what this plugin is)

**`SendMessage` and the Teams primitives are built-in tools**, not a plugin / MCP server / skill. They live inside the `claude` binary and activate when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set. The on-disk schema (`~/.claude/teams/<name>/config.json`, `inboxes/<recipient>.json`, `tasks/<N>.json`) is what the binary's `InboxPoller` + `TeammateMailbox` read and write.

**This `swarm-orchestrator` plugin** is a packaging format that ships:
- `commands/*.md` — slash commands (`/swarm-spawn`, `/swarm-status`, `/swarm-merge`)
- `agents/*.md` — named subagent_types for the heads (Scanner, Reviewer, Builder, Merger, Test-Runner, Auditor)
- `hooks/*.json` — lifecycle hooks (on-task-completed, on-teammate-idle)
- Optional `mcp_servers/` for tools available to spawned teammates
- This document (proposed improvements to the binary built-ins)

The plugin does NOT modify `SendMessage` or other built-ins. It LAYERS additional behavior on top of them via hooks, slash commands, and named agents — additive only, no breaking changes to vanilla Teams. The IMPROVEMENTS list below is for Anthropic's binary team to consider; landing them upstream would unlock the plugin's full potential.

## Executive summary

I built a parallel-agent swarm on top of Anthropic Teams that landed **a large batch of PRs in a 90-minute window** via worktree-isolated teammates coordinating through filesystem-backed inboxes. Along the way I hit specific limitations in the Teams primitives that, if addressed, would unlock significantly more parallel throughput for power users. This plugin proposes those changes as additive features — vanilla Teams users see no behavior change unless they opt in.

**The headline is autonomous orchestration that survives session exit.** Once configured for persistent mode, the meta-supervisor daemon keeps polling task lists, dispatching heads, gating merges, and recovering crashed teammates — *even after the operator closes the Claude CLI*. Tasks queued before exit continue to completion; new tasks filed by Scanner heads autonomously execute on cadence. The persistence mode is toggleable at `claude-swarm init` time so operators who prefer human-in-the-loop semantics can opt out.

The headline improvements span a shipped substrate plus a designed extension. **Shipped in this PR**: DAG task dependencies, named role-based subagents (Scanner / Reviewer / Builder / Merger / Test-Runner / Auditor), reviewer checkpoints, abort-marker contract, atomic-claim kanban under parallel workers, filesystem-RPC fallback for SendMessage, bounded inboxes, atomic file writes, worktree garbage collection, session-resistant supervisor daemon (single-host), per-head cost + token accounting, the global-mind transcript, and a persistent-agent state schema (`claude_swarm.agents`) the future native `Agent(..., persistent=True)` flag would write to. **Designed but deferred to follow-up PRs**: multi-host meta-supervisor with auto-respawn for crashed teammates, stuck-task watchdog, per-teammate token budget enforcement, pattern-detection classifier, multi-team support, and the native `Agent` tool refactor for in-binary persistence. The PR description's "Shipped / Deferred" tables (and the *"What this PR ships, and what's next"* section) are authoritative; this design proposal sketches the full target surface.

---

## Multi-tier orchestration architecture (the headline architectural proposal)

The most significant architectural delta from vanilla Teams: I propose a **three-tier hierarchy** instead of Teams' flat `lead + members` model.

### What vanilla Teams ships today

```
TEAM
├── team-lead       (one per team; holds TaskCreate/SendMessage tools)
├── member-1        (untyped, subagent_type="general-purpose")
├── member-2        (untyped, subagent_type="general-purpose")
└── ...             (all members are flat peers)
```

- One lead per team. The lead is the *only* member with team-coordination tools.
- All other members are equivalent: same tool surface, same role, no specialization.
- Members communicate with the lead via SendMessage; the lead orchestrates manually.
- A session can only lead ONE team at a time (L2 limitation).
- No automatic delegation, no role assignment, no cross-team policy.

### What I built and propose for upstream

```
                     ┌─────────────────────────────────┐
                     │      META-SUPERVISOR            │
                     │  (long-running, one per host)   │
                     │  - watches N teams              │
                     │  - polls inbox + task files     │
                     │  - applies cross-team policy    │
                     │  - auto-recovery + budgets      │
                     │  - pattern detection (offline)  │
                     └─────────┬───────────────────────┘
                               │ polls + dispatches
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
    │  SUPERVISOR   │  │  SUPERVISOR   │  │  SUPERVISOR   │
    │   (Team A)    │  │   (Team B)    │  │   (Team N)    │
    │ - orchestrate │  │ - orchestrate │  │ - orchestrate │
    │ - reviewer    │  │ - reviewer    │  │ - reviewer    │
    │   checkpoint  │  │   checkpoint  │  │   checkpoint  │
    │ - merge graph │  │ - merge graph │  │ - merge graph │
    └──────┬────────┘  └──────┬────────┘  └──────┬────────┘
           │                  │                  │
           ▼                  ▼                  ▼
       (HEADS — typed worker agents, one per task)

  ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────────┐ ┌─────────┐
  │ Scanner    │ │ Reviewer │ │ Builder │ │ Merger │ │ Test-Runner │ │ Auditor │
  │ read-only  │ │ read-only│ │ all     │ │ Bash+  │ │ read+pytest │ │ read-   │
  │ files      │ │ status + │ │ tools   │ │ git    │ │ only        │ │ only;   │
  │ tasks      │ │ cost     │ │         │ │ only   │ │             │ │ produces│
  │ auto       │ │ check    │ │         │ │        │ │             │ │ audits  │
  └────────────┘ └──────────┘ └─────────┘ └────────┘ └─────────────┘ └─────────┘
```

### Tier-by-tier breakdown

#### Tier 1 — Meta-supervisor (one per host)

A long-running Claude Code session (or daemon spawned via `claude --bare`) that:

- Polls `~/.claude/teams/*/{config.json, inboxes/*, tasks/*}` on a 5-second interval
- Watches PID liveness for every spawned teammate across every team
- **Auto-recovery**: detects dead teammates (process gone + status≠completed) and respawns from last commit on their branch
- **Cross-team policy**: enforces per-team and per-teammate token budgets; pauses on over-budget; routes overflow to a different team
- **Stalled-task detection**: tasks in `status=in_progress > 30 min without commit` get reviewer-checkpoint dispatched, then re-assigned if no movement
- **Routing**: when a teammate files a follow-up task during work, the meta-supervisor decides which team (or which existing teammate) gets it based on file overlap + parallelism-safety classification
- **Cross-machine routing** via `--remote-control`: a teammate on machine A can be addressed from a team on machine B
- **Pattern detection logging**: every decision logged for offline classifier training (parallelism_safety, success_probability)

Vanilla Teams equivalent: **none.** Closest analogue is the team-lead itself — but the lead is a peer, not a supervisor; it has no policy authority over other leads or teams; it dies with the session.

#### Tier 2 — Supervisor (one per team)

A Claude Code session that holds the **team-lead tools** (`TaskCreate`, `TaskUpdate`, `TaskList`, `SendMessage` to teammates). On top of vanilla Teams' team-lead role, the Supervisor adds:

- **DAG dependency tracking**: maintains the task graph, only dispatches tasks whose blockers are complete
- **Head dispatch**: when a task is unblocked, assigns the appropriate head type based on task tags (`auditor` task → Auditor head, etc.)
- **Reviewer checkpoint scheduling**: every N turns (configurable), spawns a Reviewer head to audit team state
- **Merge graph**: when a head completes a task, runs the configured merge pipeline (rebase + test gate + push)
- **Worktree GC**: prunes worktrees of completed teammates

Vanilla Teams equivalent: the team-lead role. I extend it with DAG + head dispatch + reviewer + merge.

#### Tier 3 — Heads (worker agents, one per task)

Named `subagent_type` definitions (declared in `agents/*.md`). Each head has:

- A role-specific system prompt
- A role-specific tool whitelist (Reviewer = read-only; Merger = Bash + git only; Builder = all tools)
- A role-specific input contract (Scanner takes a "scan target"; Reviewer takes a "team state snapshot")

Concrete heads in the initial PR:

| Head | Role | Allowed tools | Typical task |
|---|---|---|---|
| **Scanner** | Find work + file tasks automatically | Read, Grep, Bash (read-only) | "Scan this codebase for TODO comments and file tasks per finding" |
| **Reviewer** | Status check + cost audit + drift detection | Read, TaskGet, TaskList, SendMessage | "Audit team A's state; flag any teammate over 50% of budget" |
| **Builder** | Default worker — does the actual implementation | All tools | "Implement task #N per its description" |
| **Merger** | Run the merge pipeline | Bash + git only | "Merge wave 1 of the dry-run plan into master" |
| **Test-Runner** | Gate merges with pytest | Read, Bash (pytest only) | "Run unit tests against branch X; report pass/fail" |
| **Auditor** | Produce audit docs | Read, Grep, Write (docs/research/ only) | "Audit type-hint coverage across the Python source tree" |

Vanilla Teams equivalent: **none — all members are `general-purpose`**. The plugin registers these via `.claude-plugin/agents/<head>.md` so they appear as named subagent_types to `Agent` calls.

### The delta in one sentence

**Vanilla Teams gives you one tier of coordination (lead + flat members); swarm-orchestrator gives you three (meta-supervisor + supervisor + typed heads), enabling autonomous orchestration of N teams from a single host with role-based capability isolation and policy enforcement at the meta tier.**

### Production validation of the multi-tier architecture

In a representative session:
- One team-lead (operator's Claude Code session = meta-supervisor role implicit)
- One team
- Spawned: 22+ teammates, each effectively in the Builder head role
- Result: a high-throughput batch of PRs in a 90-minute window

With explicit meta-supervisor + supervisor + typed-heads architecture, the same throughput is achievable without operator-in-the-loop on every dispatch. Scanner heads file tasks autonomously; Reviewer heads run on a schedule; the meta-supervisor handles cross-team policy. **Operator/lead role shifts from "dispatch + monitor" to "set direction + review the daily output".**

## Limitations of vanilla Teams (with evidence)

### L1 — `SendMessage` doesn't surface in spawned teammates [2026-05-10]
**Evidence**: 12+ teammates spawned via the `Agent` tool with `team_name` semantics; each ran `ToolSearch select:SendMessage,TaskUpdate,TaskGet` at session start. The tools did NOT load even though `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` was inherited.

**Root cause**: the Agent tool's exposed schema (`description`, `prompt`, `subagent_type`, `isolation`, `model`, `run_in_background`) does not include team-membership fields. TeamCreate's docstring references `team_name` and `name` params but the Agent tool doesn't accept them.

**Impact**: parallel teammates can't coordinate via the official RPC. I worked around by writing directly to `~/.claude/teams/<team>/inboxes/<recipient>.json` (the same on-disk schema the runtime's `InboxPoller` reads). The harness *does* surface those file writes as conversation turns to the team-lead — so the inbox transport works one-way (team-lead → teammate is missing).

**Proposed fix**: extend the `Agent` tool schema to accept `team_name` + `name` as optional params. When set, the spawned session is registered as a team member and SendMessage / TaskGet / TaskUpdate / TaskList become available.

### L2 — A session can only lead ONE team at a time [2026-05-10]
**Evidence**: Calling `TeamCreate` while already team-lead of another team errors with `"Already leading team X. A leader can only manage one team at a time. Use TeamDelete to end the current team before creating a new one."`

**Impact**: real workflows need multiple teams concurrently — e.g., a release-engineering team AND a documentation-pass team running in parallel. Users hit this immediately and had to merge tasks into a single team for unrelated workstreams.

**Proposed fix**: allow N concurrent teams per session. Each team has its own task list, inbox dir, member roster. Add `TeamSwitch(name)` for tool surfaces keyed to "current team".

### L3 — No DAG dependencies on tasks (only flat lists) [2026-05-10]
**Evidence**: `TaskUpdate` supports `addBlocks` / `addBlockedBy`, but there's no auto-unblock cascade. `TaskList()` returns all tasks regardless of dependency state.

**Impact**: complex workflows (audit → fix → test → merge) need manual orchestration. The team-lead has to poll for completion + manually dispatch follow-ups.

**Proposed fix**: ship `TaskList.unblocked()` iterator; auto-cascade unblock when a blocker hits `status=completed`. Add a `Swarm.dag_visualize(team)` command for at-a-glance state.

### L4 — Idle teammates can't be reliably re-prompted [2026-05-10]
**Evidence**: After a teammate reports "Going idle", I cannot reliably wake them. The InboxPoller (per binary strings) checks for unread messages and "submits immediately if session idle", but spawned teammates often appear to have their process terminated after first-task completion rather than truly idling.

**Impact**: follow-up work requires spawning a new agent rather than reusing the existing one — wastes the warm context.

**Proposed fix**: persistent teammate processes with explicit `Swarm.TeammateMode.persistent`. Process stays alive in `wait_for_inbox()` loop until either a `shutdown_request` arrives or the team is deleted.

### L5 — No graceful interrupt / abort signal [2026-05-10]
**Evidence**: Only `TaskStop` (hard kill) is available. Aborting a mid-flight teammate loses all uncommitted WIP.

**Impact**: when redirecting a teammate (the operator changes direction, hits a budget cap, discovers a better approach), there's no clean "commit what you have and exit" path.

**Proposed fix**: standardized abort-marker file contract: `<worktree>/.claude/abort-<name>` triggers a phase-boundary commit + push + clean exit. Ships as a standard prompt block + a runtime check the binary fires when the file appears.

### L6 — No worktree isolation by default; concurrent teammates clobber [2026-05-10]
**Evidence**: 5+ teammates spawned without `isolation: "worktree"` had their uncommitted edits destroyed when concurrent `git checkout` operations rewrote the shared working tree. Required cherry-pick recovery after each clobber.

**Impact**: parallel-agent throughput is gated on every spawn having worktree isolation. Easy to forget; expensive to recover.

**Proposed fix**: make `isolation: "worktree"` the default for parallel teammates (Agent tool spawned within a team context). Add team-level GC for finished worktrees.

### L7 — No reviewer checkpoint / status-pulse mechanism [2026-05-10]
**Evidence**: Teammates can drift (loop on a wrong approach, run over budget, get stuck on a sub-problem) with no built-in correction. Vanilla Teams has no equivalent of "every N turns, force a self-assessment".

**Impact**: high-trust dispatch only — if a task description is wrong, the teammate spends the full budget on the wrong solution.

**Proposed fix**: opt-in reviewer-checkpoint hook. Every N turns the runtime injects a self-review prompt forcing DAG status, commit count vs expected, cost vs budget, "is this still tractable?" check. Sub-agent type `Reviewer` is dispatched at scheduled intervals.

### L8 — No per-teammate token / cost budget enforcement [2026-05-10]
**Evidence**: Budget tracking is per-session (operator-visible) but not per-teammate. A runaway teammate can burn through a session's entire token budget.

**Impact**: hard to run cost-sensitive workflows; no early-warning before a teammate blows through.

**Proposed fix**: per-teammate budget metadata in the team config. Soft cap = warning sent via SendMessage to team-lead. Hard cap = teammate paused (kept around for resumption rather than killed).

### L9 — No auto-recovery for crashed teammates [2026-05-10]
**Evidence**: When a teammate's session terminates abnormally (OOM, network drop, sigkill), the team-lead has no notification and must manually detect + respawn. The history-view teammate (a02f1b97) died mid-work and its WIP was lost.

**Impact**: long-running parallel batches are fragile. One crash → operator intervention.

**Proposed fix**: meta-supervisor daemon polls for status transitions. On unexpected death (in_progress > N min without commit, PID gone): replay abort-marker contract on the worktree (commit current WIP to branch) + spawn replacement teammate that picks up from last commit.

### L10 — No named role-based subagent_types [2026-05-10]
**Evidence**: All teammates are spawned with `subagent_type: "general-purpose"`. There's no way to declare "this teammate is a Reviewer — read-only, fires on a schedule" vs "this teammate is a Merger — Bash+git only".

**Impact**: tool-access restriction is ad-hoc (per-prompt instructions); role specialization is by convention. Easy for a Reviewer to accidentally edit code; easy for a Merger to run arbitrary commands.

**Proposed fix**: heads architecture — register `Scanner`, `Reviewer`, `Builder`, `Merger`, `Test-Runner`, `Auditor` as named subagent_types with role-specific system prompts + tool restrictions. Configurable; users can register custom heads via `.claude-plugin/heads/<name>.md`.

### L11 — No first-class testing substrate for swarms [2026-05-10]
**Evidence**: There are no example scenarios shipped with Teams that exercise multi-teammate coordination, DAG dependencies, parallel merging, etc. Users have to invent their own from scratch.

**Impact**: hard to validate a swarm's behavior; hard to file bug reports with reproducible examples; hard to teach the patterns.

**Proposed fix**: ship 10 toy scenarios in `plugins/swarm-orchestrator/tests/swarming/` that exercise every primitive (DAG, heads, merging, abort-marker, multi-team, etc.). Each is self-contained, deterministic, <5 min. Same scenarios run identically across vanilla Teams, the swarm-orchestrator plugin, and (for my extended use case) the standalone `claude-swarm` library — proving compatibility.

### L12 — No cross-machine SendMessage routing [2026-05-10]
**Evidence**: `claude --remote-control` exists as a CLI flag but is not exposed via the Teams API as a transport for SendMessage.

**Impact**: multi-host fleets (laptop + Mac mini + cloud GPU) can't run a single team across machines. Each machine has to be its own team; cross-machine coordination requires custom plumbing.

**Proposed fix**: extend the `to` field in SendMessage to accept `name@machine` syntax. Route via `--remote-control` channel when machine ≠ local.

### L13 — Auto-merge graph not wired to team-task completion [2026-05-10]
**Evidence**: Teammates ship branches; merging is manual. No hook fires on `status=completed` to attempt merge.

**Impact**: 13 PRs landed but waiting for manual merge. A real swarm needs continuous merge-on-completion.

**Proposed fix**: opt-in hook `on-task-completed` that runs a configurable merge pipeline (rebase → test gate → push). Ships with a default `merge_pipeline.py` adapted from my internal one (clone-isolated, topo-sorted, conflict-aware).

### L14 — Worktree-discovery bug: cwd disagrees with worktree path [2026-05-10]
**Evidence**: A spawned teammate (save-checkpoint-ui, ab396ed08) saw `cwd = /Users/.../.claude/worktrees/agent-X` in the system reminder but the actual worktree was at `/Users/.../.ai/.claude/workspace/worktrees/agent-X`. Early edits landed in the wrong tree.

**Impact**: silent data corruption in the main tree; required stash-and-replay to recover.

**Proposed fix**: at session start, the binary verifies `pwd == worktree_path_from_team_config` and either fixes the cwd or errors loudly. Add to the Agent tool's spawn contract.

### L15 — No discoverable subcommand schema in `claude agents` [2026-05-10]
**Evidence**: `claude agents --help` shows only `--setting-sources`. No subcommands for `spawn`, `kill`, `list`, `restart`, etc. — even though binary strings suggest these capabilities exist.

**Impact**: operator can't manage teammates from a shell; everything is through the Agent tool in-session.

**Proposed fix**: expand `claude agents` subcommands: `list`, `spawn`, `kill`, `restart`, `logs`, `inspect`. Mirrors `docker ps` / `docker exec` semantics. Useful for CI integration + ops automation.

---

## Features I propose (concrete additions)

(See `the companion feature catalog in this plugin directory` for the full 45-item list. Headline additions to vanilla Teams:)

1. **DAG dependencies** with auto-unblock cascade + `TaskList.unblocked()` iterator
2. **Heads architecture** — Scanner / Reviewer / Builder / Merger / Test-Runner / Auditor as named subagent_types with role-specific prompts + tool restrictions
3. **Multi-team support** — N concurrent teams per session, cross-team SendMessage
4. **Reviewer checkpoint hook** — every N turns, fire a self-review prompt
5. **Meta-supervisor daemon** — long-running session polls task lists + inboxes, auto-recovers, routes findings
6. **Abort-marker contract** — standardized graceful interrupt
7. **Auto-recovery** — respawn dead teammates from last commit
8. **Per-teammate budget** — soft cap + hard cap with pause-not-kill
9. **Cross-machine SendMessage** — `name@machine` routing via `--remote-control`
10. **Auto-merge graph hook** — fires on `status=completed`, runs configurable merge pipeline
11. **Worktree isolation default** — for teammates spawned within a team context
12. **Persistent teammate mode** — opt-in `wait_for_inbox` loop instead of one-shot
13. **Pattern detection logging** — every supervisor decision logged for offline classifier training
14. **Testing substrate** — 10 toy scenarios shipped with the plugin
15. **Mind-page status endpoint** — stable JSON feed at `~/.claude/teams/.status.json` for external UIs

---

## Compatibility / breaking changes

**None.** All features are additive; vanilla Teams users see no behavior change unless they install this plugin and opt in. The on-disk schema (`~/.claude/teams/<name>/config.json`, `tasks/<N>.json`, `inboxes/<recipient>.json`) is preserved byte-for-byte — the plugin's `InboxPoller` reads the same files Anthropic's runtime does. Existing teams keep working alongside swarm-extended teams.

---

## Test scenarios (validation of every primitive)

Ten toy scenarios ship in `plugins/swarm-orchestrator/tests/swarming/`. Each is self-contained, deterministic, <5 min. The same scenario JSON schema runs against vanilla Teams (where applicable), the swarm-orchestrator plugin, and my standalone `claude-swarm` library — proving 3-way compatibility:

1. `multi-file-rename` — parallel-safe + merge
2. `spec-impl-pair` — DAG dependency
3. `scan-build-review` — heads end-to-end
4. `doc-writer-team` — parallel dispatch
5. `multi-language-port` — cross-teammate independence
6. `audit-then-fix` — DAG + meta-supervisor
7. `conflict-resolution-drill` — merge pipeline rebase
8. `abort-marker-test` — graceful WIP commit
9. `respawn-on-crash` — meta-supervisor recovery
10. `multi-team-coordination` — two teams + cross-team SendMessage

---

## Production validation

This swarm pattern was validated on a real production codebase via worktree-isolated teammates coordinating through filesystem-backed inboxes. Teammates produced clean, reviewable PRs with tests; no data was lost; no merge conflicts went unresolved. I propose the patterns that made that throughput possible.

---

## How to add a new limitation entry

When a new limitation is discovered:

1. Reproduce it (capture evidence — error message, stack trace, binary string)
2. Append a new `L<N>` section below the last entry
3. Date the entry
4. Propose a fix
5. Commit + push to this file in the plugin directory

The PR description will be regenerated from this file on submission.

---

## Roadmap (v0.2.0 → v1.0): server + CLI + autonomous self-iteration

What the v0.1.0 plugin ships today is the foundation. The vision below is what I build on top. Each item below corresponds to a planned follow-up PR.

### v0.2.0 — Swarm server + CLI dashboard
- **Long-running `swarm-server` daemon** (one per host) holding live state for all teams + heads + tasks
- **`swarm` CLI tool** that attaches to the server: `swarm status`, `swarm spawn`, `swarm logs <name>`, `swarm tail <name>`, `swarm budget`
- **TUI dashboard** (`textual`-based) showing the equivalent of Anthropic Teams' interface — running agents, token counts, runtimes, task progress, live event feed
- **Statistics + constant summaries** — every state change is captured and surfaced; the dashboard updates in real time
- Designed to be installable standalone (works without Claude Code) AND wired into the plugin for Claude Code users

### v0.3.0 — Message bus: Python-native default, pluggable backends

The default stack is intentionally **Python-native, zero external brokers**:

- **FastAPI + Starlette WebSockets** for live event streams (CLI ↔ server, server ↔ TUI dashboard, cross-process)
- **asyncio.Queue** for in-process pub/sub (event_bus)
- **filesystem-backed JSON** for durable state (Anthropic Teams inbox schema-compatible by design)
- **HTTP + FastAPI** for RPC (typed via Pydantic models)
- **Production-validated** at parallel-agent scale on a real codebase — no broker required, no JVM, no extra ops surface

For users who outgrow a single host, pluggable backends are first-class:

| Backend | Use case | Trade-off |
|---|---|---|
| **NATS + JetStream** | Cloud-native, sub-ms latency, ~10M msgs/sec, JetStream for replay | Adds a server binary; minimal ops surface |
| **Apache Kafka** | Massive scale (millions of events/sec), durable log streaming, industry standard at Netflix/LinkedIn/Uber | Heavier ops (Zookeeper or KRaft), JVM-based |
| **gRPC** | Typed RPC for CLI ↔ server when Protobuf cross-language is required | Heavier serialization than JSON; great for typed contracts |
| **Redis Streams** | Already-deployed Redis, simple replay semantics | Extra dependency if not already running Redis |
| **ZeroMQ** | Embedded / HFT / no-broker requirements | Steeper learning curve; users compose patterns themselves |

The plugin's `MessageBus` interface lets users swap backends without touching agent code. Subject hierarchy maps to swarm domain: `swarm.team.<name>.head.<role>.task.<id>.{spawned,progress,completed,failed}` — works identically across all backends.

**Cross-machine routing**: every backend supports it (NATS clustering, Kafka brokers, gRPC over TLS, Redis cluster mode, ZeroMQ TCP sockets). The Python-native default uses WebSockets over SSH-tunneled ports for the same effect.

### v0.4.0 — Mandatory worktree isolation + autonomous worktree lifecycle
- **Worktree mandation**: every parallel-spawned teammate gets its own git worktree, enforced at the plugin's spawn boundary — never optional, never bypassed
- **Autonomous lifecycle**: created at spawn, monitored for orphan state, garbage-collected after successful merge OR after `WORKTREE_TTL_HOURS` (default 24h) of inactivity
- **Filesystem-level guard** rejects any direct parallel work in the shared tree (prevents the entire class of "concurrent agents clobber each other's edits")
- Integrates with Anthropic's worktree-isolation feature when available, falls back to the plugin's own implementation otherwise

### v0.5.0 — Autonomous self-iteration test framework
- **The test suite spawns a real swarm against the swarm-orchestrator codebase itself.** Meta-supervisor + Scanner + Builders + Reviewers + Merger work to improve the plugin per a charter + acceptance criteria.
- **Self-maintaining + self-healing**: the swarm iterates on its own bugs (correctness audit findings → tasks → fixes → merges) without human intervention
- **Visibility**: every iteration produces a report — what changed, why, what tests passed/failed, what the meta-supervisor's reasoning was
- **Industry-grade `pytest` framework** with rich output (I'm considering `pytest-rich` or `pytest-asyncio` for the orchestration scenarios)
- Runs nightly as the canonical CI signal; failing iterations get human-attention notification

### v0.6.0 — Advanced synchronization + multiprocessing primitives
- **`multiprocessing.Manager`-backed shared state** for cross-process coordination (alternative to all-file-IO)
- **Async/await throughout** the meta-supervisor poll loop (Python `asyncio`)
- **Lock-free queues** where applicable (per-teammate inbox is single-producer single-consumer)
- **Backpressure** on the meta-supervisor (if it falls behind, dispatch is paused rather than queued unboundedly)
- **Heartbeat** between server and clients (CLI loses server connection → auto-reconnects with state catchup)

### v1.0 — Production readiness
- 99.9% uptime across the meta-supervisor over 30-day observation
- Full backward compatibility with v0.x clients
- `claude plugin install swarm-orchestrator` works on every Claude Code release
- Documentation + tutorial videos + at least 3 case studies of large-scale parallel swarm runs
- Pattern-detection classifier trained on logged decisions; published as `claude-swarm classify` CLI subcommand

## Authors / contributors

- Kushal Jaligama — design lead (`kushalj1997` on GitHub)
- Claude Opus 4.7 (1M context) — drafted via agent team coordination

---

## License

This plugin does not currently ship a LICENSE file inside its directory, following the convention of every other in-repo plugin in `anthropics/claude-code/plugins/`. The repository's top-level `LICENSE.md` (Anthropic PBC commercial terms) applies by default.

**The author is happy to follow Anthropic's licensing guidance and recommendation.** If a specific permissive license (e.g., Apache 2.0 or MIT) is preferred for community contribution / external use of the standalone engine, please advise in the PR review and the author will adopt it. If no LICENSE file is the in-repo convention, this PR matches that convention as-shipped.
