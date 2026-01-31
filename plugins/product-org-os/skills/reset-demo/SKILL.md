---
name: reset-demo
description: Restore demo content for testing or demonstration purposes
model: haiku
tools:
  - Read
  - Write
  - Bash
---

# Reset Demo Content

Restore all demo content to the context layer. Useful for demonstrations, testing, or re-exploring capabilities.

## Trigger Patterns

- `/reset-demo` - Restore all demo content
- `/reset-demo --preview` - Show what would be restored without restoring

## Behavior

### 1. Check Current State

Scan `context/demo/` to see if demo content exists:
- If exists: Warn that existing demo content will be overwritten
- If empty: Proceed with restoration

### 2. Restore Demo Files

Recreate all demo content files:

#### Decisions (context/demo/decisions/)
- `DR-DEMO-001-pricing-model.md` - Pricing model decision
- `DR-DEMO-002-api-versioning.md` - API versioning decision
- `DR-DEMO-003-mobile-first.md` - Mobile-first approach decision

#### Strategic Bets (context/demo/bets/)
- `SB-DEMO-001-enterprise-tier.md` - Enterprise tier launch bet
- `SB-DEMO-002-self-serve.md` - Self-serve growth engine bet

#### Feedback (context/demo/feedback/)
- `feedback-samples.md` - 7 sample feedback entries with themes

#### Documents (context/demo/documents/)
- `prd-dashboard-redesign.md` - Dashboard redesign PRD

#### Index (context/demo/)
- `index.md` - Demo content index

### 3. Update JSON Index

Add demo entries to `context/index.json`:

```json
{
  "entries": [
    {
      "id": "DR-DEMO-001",
      "title": "Pricing Model Strategy",
      "type": "decision",
      "path": "context/demo/decisions/DR-DEMO-001-pricing-model.md",
      "topics": ["pricing", "enterprise", "monetization"],
      "phase": "phase2"
    },
    // ... other demo entries
  ]
}
```

### 4. Confirm Completion

```markdown
## Demo Content Restored

Restored:
- 3 demo decisions
- 2 demo strategic bets
- 7 demo feedback entries (in 1 file)
- 1 demo document
- 1 demo index

**Explore demo content:**
- `/context-recall pricing` - See pricing decisions
- `/context-recall enterprise` - See enterprise context
- `/portfolio-status` - See strategic bets
- `/feedback-recall onboarding` - See feedback patterns

**Demo content is clearly marked with [DEMO DATA] tags.**

**Auto-filtering:** Once you create production data, demo content is automatically excluded from queries. No need to run `/clear-demo` - your real data takes precedence.

Optional: `/clear-demo` removes demo files if you prefer a clean folder.
```

## Demo Content Source

Demo content is embedded in this skill. The content simulates a typical SaaS product organization with:

- **Product context**: B2B SaaS with freemium and enterprise tiers
- **Strategic focus**: Enterprise expansion and self-serve growth
- **Recent decisions**: Pricing, API strategy, mobile-first design
- **Active bets**: Enterprise tier launch, self-serve growth engine
- **Feedback themes**: Enterprise security, onboarding friction, mobile UX

## Use Cases

1. **New user exploration**: Understand capabilities with realistic data
2. **Demonstrations**: Show plugin capabilities to stakeholders
3. **Testing**: Verify skills work correctly with sample data
4. **Training**: Practice using context skills before real deployment

## Notes

- Demo content uses DEMO prefix in all IDs
- All demo files include `[DEMO DATA]` marker
- Demo content is isolated in `context/demo/` folder
- Does not affect user-created content in main context folders
