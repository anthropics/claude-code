# Changelog

All notable changes to Product Org OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.1] - 2026-02-13

### Changed
- **Agent Skills Standard Alignment** — All 93 SKILL.md files updated to align with Anthropic's Agent Skills open standard
  - Enhanced `description:` fields with trigger phrases for improved auto-routing and skill discovery
  - Added `user-invocable:` field to all agent skills (false for agents, true for template skills)
  - Added `metadata:` block (author, version, category) to all skills for distribution readiness
  - Added `compatibility:` field declaring Product Org OS v3+ dependency
  - Zero functional changes — all existing behavior preserved

### Scope
- 13 OS agent SKILL.md files
- 8 OS alias SKILL.md files
- 2 OS gateway SKILL.md files
- 61 OS template/workflow SKILL.md files
- 9 misc SKILL.md files (marketing-growth, developer-workflow, creative-process)

## [3.0.0] - 2026-02-10

### Added
- **Product Mentor agent** (`@mentor` / `@product-mentor`) — Career coaching, PM skill assessment, stakeholder navigation, OS usage optimization

- **MCP Integration Framework** — agents auto-detect and use connected tools
  - `rules/mcp-integration.md` — core integration rule with detection pattern and graceful fallback
  - `integrations/` folder with 6 setup templates (Jira, Linear, Slack, Notion, GitHub, Analytics)
  - Integration Awareness section added to 8 agent SKILL.md files
  - Tool integration line added to agent spawn protocol (Section 2)

- **9 Domain Knowledge Packs** in `reference/knowledge/`
  - Prioritization, Pricing Frameworks, Discovery Methods, Metrics Frameworks
  - Competitive Frameworks, GTM Playbooks, Stakeholder Management
  - User Research, Financial Modeling
  - Three-layer architecture: V2V Process → Domain Knowledge → Agent Persona
  - Knowledge Sources section added to 12 agent SKILL.md files
  - Knowledge pack catalog added to `rules/skill-awareness.md`

- **Enhanced Context Layer**
  - `rules/auto-context.md` — automatic context injection before deliverable creation
  - `rules/context-graph.md` — cross-reference graph connecting decisions, bets, feedback, learnings
  - `context/index.json` upgraded to v3.0 schema with structured indexes
  - Enhanced 6 context skill SKILL.md files with graph traversal and auto-linking
  - Updated `rules/context-management.md`, `CONTEXT-LAYER-DESIGN.md`, `context/README.md`

- **4 Agent Delegation Patterns**
  - `rules/delegation-protocol.md` — Consultation, Delegation, Review, Structured Debate
  - Updated `rules/agent-spawn-protocol.md` Section 5 with pattern selection
  - Updated `rules/parallel-execution.md` with delegation-enhanced patterns

- **Claude Agent SDK Design** (Project SaaS)
  - `sdk-bridge-design.md` — OS-to-SDK architecture mapping
  - `api-contract.md` — REST + WebSocket API specifications
  - `data-model.md` — PostgreSQL schema for cloud context layer
  - `agent-runtime.md` — CLI vs. cloud execution model
  - `migration-guide.md` — CLI to cloud migration path

### Changed
- **Conversational-First Response Model** — all 13 agents keep responses to 2-4 paragraphs, create documents for detailed analysis. Prevents parent session compression from losing agent voice. Enforced via agent spawn protocol Section 2.
- **Meeting Mode Enforcement** — Claude Code is invisible infrastructure when Product Org is active. Agent responses are the complete output with zero preamble/postamble. Synthesis attributed to named senior agent, never unnamed. `rules/meeting-mode.md` defines format and self-check.
- **No Fabricated Numbers Rule** — agents never invent financial projections, timeline estimates, or implementation costs. Use frameworks, placeholders (`[TBD]`), and calculation structures instead. `rules/no-estimates.md` expanded with detailed examples and redirect patterns.

- **Agent Skills Standard Alignment** — all SKILL.md files updated
  - `tools:` → `allowed-tools:` in all frontmatter (63 files)
  - `user-invocable: true/false` added to all SKILL.md files
  - `plugin.json` updated to v3.0.0 with `"standard": "agent-skills"`
  - Cross-platform compatibility with Cursor, Copilot, Gemini CLI

- **Documentation Overhaul**
  - README.md rewritten with v3 features, cross-platform support
  - PRODUCT-ORG-CLAUDE.md updated with 5 new sections (MCP, Knowledge, Delegation, Context, Cross-Platform)
  - Plugin statistics updated (5 gateways, 9 knowledge packs, 6 integration templates, 4 delegation patterns)
  - Cross-platform language audit throughout

- **Setup Command** (`/setup`) updated for v3
  - Pre-flight audit expanded from 28 to 32 items (added v3 rules)
  - `context/index.json` template upgraded to v3.0 schema
  - Tour language updated for cross-platform

## [2.4.1] - 2026-01-25

### Added
- **`/tour` skill** - Interactive 5-step walkthrough of Product Org OS
  - Gateways → Agents → Skills → Documents → Utilities
  - Works anytime, not just during setup
  - Uses demo data for hands-on learning
- **Demo Auto-Filtering** - Demo data hides automatically in production
  - `rules/demo-data-handling.md` defines filtering behavior
  - Demo excluded from queries when production data exists
  - Use `--include-demo` flag to see demo alongside production
  - Use `--demo-only` flag for testing/learning
- Updated `/setup` with new onboarding options:
  - "Take the tour" - 5-step interactive walkthrough
  - "Explore on my own" - Quick reference card

### Changed
- `/context-recall`, `/feedback-recall`, `/portfolio-status`, `/relevant-learnings` - Auto-filter demo data
- Skill count: 60 → 61
- Marketing site updated with demo auto-filtering messaging

## [2.4.0] - 2026-01-25

### Added
- **Demo Environment** for exploring plugin capabilities
  - Pre-populated demo content: 3 decisions, 2 strategic bets, 7 feedback entries, 1 PRD
  - `/clear-demo` skill to remove demo content for production use
  - `/reset-demo` skill to restore demo content for testing/demos
  - First-run welcome experience in `/setup`
- **ROI Tracker** for measuring time savings
  - `reference/roi-baselines.md` with time-savings estimates per skill
  - `rules/roi-display.md` for mandatory ROI display after skill completion
  - `context/roi/` for session tracking
  - `/roi-report` skill for ROI dashboard
- **Scalable Context System** with JSON indexing
  - `context/index.json` for fast topic-based retrieval
  - `/index-folder` skill for folder indexing
  - Updated `/context-save` with JSON indexing (Step 5)
  - Updated `/context-recall` with JSON index as primary search
- **New Rules**
  - `rules/intelligent-routing.md` for automatic request routing
  - `rules/no-estimates.md` to avoid time predictions

### Changed
- **All 13 agent personas enhanced** with full V2V template:
  - Core Accountability, How I Think, RACI breakdown
  - Sub-agent spawning patterns (permissive: "Don't ask for permission")
  - Anti-patterns as redirects, not blocks
  - Success signals and collaboration patterns
  - Emojis in response format for visual identity
- Skill count: 56 → 60

## [2.3.1] - 2026-01-23

### Added
- **Agent Shortcuts** for faster access to common agents
  - `/pm` → `/product-manager`
  - `/plt` → `/product-leadership-team`
  - `/pm-dir` → `/director-product-management`
  - `/pmm-dir` → `/director-product-marketing`
  - `/pmm` → `/product-marketing-manager`
  - `/vpp` → `/vp-product`
  - `/prodops` → `/product-operations`
- Documents context item in Context Layer (tracked via registry)

### Changed
- Marketing site: "Free & Open Source" now links to GitHub repo
- Marketing site: "13 Specialized Agents" → "13 Role-Based Agents"
- Marketing site: Agent cards show shortcuts (/pm, /plt, etc.)
- Marketing site: Dynamic examples use natural language patterns
- Marketing site: "How to Use It" examples are conversational
- Marketing site: Use Cases show practical team/org workflows
- Marketing site: Context Layer shows 6 balanced items including Documents
- Marketing site: Footer links to LinkedIn profile

## [2.3.0] - 2026-01-23

### Added
- **Document Intelligence** for 43 document-generating skills
  - Three modes: Create, Update, Find
  - Automatic mode detection based on user input signals
  - Confidence-based decision thresholds (≥85% auto-proceed)
  - Document Registry support for tracking strategic documents
- Document Intelligence Template (`templates/document-intelligence.md`)
- "Document Continuity Across Phases" guidance in v2v-flow.md

### Changed
- 43 skill files enhanced with Document Intelligence block
- Skill descriptions updated to reflect Create/Update capability
- Argument hints now show update path option
- Marketing site dynamic examples include agents and skills
- Marketing site "Start Creating" includes update mode examples

### Documentation
- Added "Document Intelligence" section to PRODUCT-ORG-CLAUDE.md
- Added "Document Intelligence" section to rules/skill-awareness.md
- Added "Working with Existing Documents" examples to README.md
- Added favicon to marketing site (index.html)

## [2.2.1] - 2026-01-22

### Added
- LICENSE file in plugin directory (MIT)
- CHANGELOG.md with version history

### Changed
- Fixed URLs in plugin.json to point to `yohayetsion/product-org-os`
- Fixed URLs in README.md (install command, presentation links)

### Distribution
- Submitted to official Claude Code plugin directory (PR #20135)
- Available via: `claude plugins install github:yohayetsion/product-org-os`

## [2.2.0] - 2026-01

### Added
- `/product` gateway as single entry point to the product organization
- 5 principle validator skills: `/ownership-map`, `/customer-value-trace`, `/collaboration-check`, `/scale-check`, `/phase-check`
- 4 new rules: `v2v-flow.md`, `principles-enforcement.md`, `parallel-execution.md`, `skill-awareness.md`
- V2V phase reference mapping (`reference/v2v-skill-map.md`)
- Principles tracking folder with scorecard template

### Changed
- All 13 agents now have full access to all 56 skills
- 35 skills updated with V2V phase markers
- 4 skills enhanced with principle additions (`decision-record`, `outcome-review`, `strategic-bet`, `commitment-check`)
- Context layer expanded with V2V phase tracking and principles tracking
- Updated documentation with gateway, parallel execution, and principle validators

## [2.1.0] - 2026-01

### Added
- V2V phase markers across all skills
- Principle additions to key skills
- Parallel execution patterns

## [2.0.0] - 2025-12

### Added
- Context layer for organizational memory
- Feedback capture and recall system
- 13 role-based agents

### Changed
- Skills reorganized by V2V phase

## [1.0.0] - 2025-11

### Added
- Initial release with 41 skills
- Core deliverable templates
- Basic plugin structure
