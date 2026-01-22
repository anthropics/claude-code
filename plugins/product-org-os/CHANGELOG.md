# Changelog

All notable changes to Product Org OS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
