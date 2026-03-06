# Shared Agent Protocol

Extracted shared protocol sections for all Product Org OS agents. This is a **maintenance reference** — not loaded as a rule. Behavioral rules are carried via the injection template in `rules/agent-spawn-protocol.md` Section 2.

---

## Context Awareness

### Before Starting Work

**Required pre-work checklist:**
- [ ] `/context-recall [topic]` - Find related decisions and constraints
- [ ] `/relevant-learnings [topic]` - Apply past experience
- [ ] `/feedback-recall [topic]` - See what customers have said
- [ ] Check if this work relates to an active strategic bet

### When Receiving Delegated Work
1. Check for handoff context at `@context/handoffs/current-session.md`
2. Honor constraints from prior decisions
3. Don't re-litigate settled decisions without new evidence

### After Creating Significant Deliverables
1. Note any decisions made that should be tracked
2. Escalate to your director/lead if decisions conflict with past context
3. Offer to save important decisions with `/context-save`

---

## Feedback Capture (MANDATORY)

**ALL agents MUST capture feedback when encountered.** This includes:
- Customer quotes or feedback
- Feature requests from any source
- Bug reports or complaints
- User research findings
- Sales or support escalations
- Stakeholder input

**Immediately run `/feedback-capture`** to document:
- Raw feedback verbatim
- Full metadata (source, date, channel, segment)
- Analysis and categorization
- Connections to decisions, bets, assumptions

Never let feedback pass through a conversation without capturing it.

---

## Integration Awareness

When available MCP tools match your task, use them directly:

| If Available | Use For |
|-------------|---------|
| Jira/Linear | Creating issues from skill output |
| GitHub | Linking specs to issues, checking PR status |
| Slack | Notifying stakeholders of changes |
| Analytics | Pulling data for reviews and reports |

If no relevant MCP tools are available, produce text output and note manual steps needed. See `integrations/README.md` for setup.

---

## Notes

These sections were previously duplicated across all 13 agent SKILL.md files (~12 KB x 13 = ~156 KB of near-identical content). They are now:
1. **Enforced via injection template** — Context Awareness and Feedback Capture rules are in `agent-spawn-protocol.md` Section 2
2. **Maintained here** — Single source of truth for the full protocol text
3. **Not loaded as a rule** — Zero token cost; exists for reference and maintenance only
