# Strategic Documents Registry

This registry automatically tracks all strategic documents created by skills. Documents are registered silently when created.

*Last updated: 2026-01-24*

## Registry Format

| ID | Title | Type | Skill | Date | Owner | Product | Location | Tags |
|----|-------|------|-------|------|-------|---------|----------|------|
| DOC-2026-001 | AXIA PRD V4 | PRD | `/prd` | 2026-01-23 | Product | AXIA | `AXIA/Collaterals/Version 4/PRD-V4.md` | prd, requirements, insider-risk |
| DOC-2026-002 | Product Org OS Brand Guidelines | Brand Guidelines | manual | 2026-01-24 | Product Marketing | Product Org OS | `product-org-plugin/BRAND-GUIDELINES.md` | brand, visual-identity, design-system, marketing |
| DOC-2026-003 | Phase 2 Intelligence Enhancements PRD | PRD | `/prd` | 2026-01-24 | Product Manager | Product Org OS | `V2 Planning/phase2-intelligence-enhancements-prd.md` | prd, roi-tracker, routing, context-sharing, phase-2b, intelligence |

## Document Types

| Type | Skills That Generate | V2V Phase |
|------|---------------------|-----------|
| **Strategic Foundation** | | Phase 1 |
| Strategic Intent | `/strategic-intent` | 1 |
| Vision Statement | `/vision-statement` | 1 |
| Market Analysis | `/market-analysis` | 1 |
| Competitive Landscape | `/competitive-landscape`, `/competitive-analysis` | 1 |
| Market Segment | `/market-segment` | 1 |
| **Strategic Decisions** | | Phase 2 |
| Business Case | `/business-case` | 2 |
| Business Plan | `/business-plan` | 2 |
| Pricing Strategy | `/pricing-strategy`, `/pricing-model` | 2 |
| Positioning Statement | `/positioning-statement` | 2 |
| Decision Record | `/decision-record` | 2 |
| Strategic Bet | `/strategic-bet` | 2 |
| Decision Charter | `/decision-charter` | 2 |
| **Strategic Commitments** | | Phase 3 |
| Product Roadmap | `/product-roadmap`, `/roadmap-theme`, `/roadmap-item` | 3 |
| GTM Strategy | `/gtm-strategy`, `/gtm-brief` | 3 |
| Launch Plan | `/launch-plan` | 3 |
| Strategy Communication | `/strategy-communication` | 3 |
| PRD | `/prd`, `/prd-outline` | 3 |
| Feature Spec | `/feature-spec` | 3 |
| User Story | `/user-story` | 3 |
| **Operational** | | Phase 4 |
| Campaign Brief | `/campaign-brief` | 4 |
| Sales Enablement | `/sales-enablement` | 4 |
| Stakeholder Brief | `/stakeholder-brief` | 4 |
| **Outcome Documents** | | Phase 5 |
| Onboarding Playbook | `/onboarding-playbook` | 5 |
| Value Realization Report | `/value-realization-report` | 5 |
| Customer Health Scorecard | `/customer-health-scorecard` | 5 |
| **Review Documents** | | Phase 6 |
| QBR Deck | `/qbr-deck` | 6 |
| Outcome Review | `/outcome-review` | 6 |
| Retrospective | `/retrospective` | 6 |

## Quick Filters

### By Product
*Populate as documents are added*

### By Type
*Auto-populated from skill outputs*

### By V2V Phase
- **Phase 1**: Strategic foundation documents
- **Phase 2**: Strategic decision documents
- **Phase 3**: Commitment documents (roadmaps, PRDs, GTM)
- **Phase 4**: Execution documents
- **Phase 5**: Outcome documents
- **Phase 6**: Learning documents

## ID Convention

Document IDs follow the pattern: `DOC-[YYYY]-[NNN]`

Example: `DOC-2026-001`

## Auto-Registration Rules

Documents are automatically registered when:
1. A skill completes and produces output
2. The output is written to a file (not just displayed)
3. The document represents a strategic artifact (not a transient deliverable)

Registration captures:
- Document ID (auto-generated)
- Title (from document H1 or filename)
- Type (based on skill used)
- Skill that generated it
- Date created
- Owner (from context or session)
- Product (if multi-product org)
- File location
- Auto-generated tags
