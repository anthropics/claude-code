# MCP Integration Framework

## Core Principle

Agents detect available MCP servers at runtime. If present, use them to enhance deliverables with real tool operations. If absent, produce text-based output as before. NEVER fail because MCP is missing.

## Detection Pattern

Before operations that could benefit from tool integration, agents check:
1. Is an MCP server of the relevant category available in your tool list?
2. If yes, use it for the operation and note what was done
3. If no, fall back to text output with clear "manual action needed" notes

## Tool Categories

| Category | MCP Server Pattern | Agent Use Case |
|----------|-------------------|----------------|
| Project Management | *jira*, *linear*, *asana*, *shortcut* | Create issues, sync roadmap items, update sprint boards |
| Communication | *slack*, *teams*, *discord* | Post updates, notify stakeholders, share decisions |
| Documents | *notion*, *confluence*, *google-docs* | Publish docs, sync wiki pages, update knowledge bases |
| Analytics | *amplitude*, *mixpanel*, *posthog* | Pull metrics for outcome reviews, adoption tracking |
| Email | *gmail*, *outlook* | Send stakeholder briefs, campaign emails |
| CRM | *hubspot*, *salesforce*, *pipedrive* | Sync customer feedback, pipeline data |
| Repository | *github*, *gitlab*, *bitbucket* | Create PRs, track issues, link commits to features |
| Design | *figma* | Access design specs, comment on designs |

## Graceful Fallback Pattern

When an MCP tool is not available for an operation:

1. **Produce the deliverable as markdown** (current behavior — always works)
2. **Add a "Next Steps" section** noting what manual actions are needed:
   ```
   ## Next Steps (Manual)
   - [ ] Create Jira tickets from the user stories table above
   - [ ] Post launch announcement to #product-updates Slack channel
   - [ ] Update Confluence page with the finalized PRD
   ```
3. **If partially available** — use what's connected, note what's missing

## Agent Instructions

When your task could benefit from tool integration:

1. **Check your available tools** — look for MCP tool names matching the categories above
2. **If available**: Use them directly as part of your workflow
   - Create Jira issues from user stories you write
   - Post Slack notifications for launch updates
   - Pull analytics data for outcome reviews
3. **If not available**: Produce text output as normal
   - Add "Next Steps (Manual)" section with actionable items
   - Format output so it's easy to copy into the target tool

## Example: PM Creating User Stories

**With Jira MCP available:**
```
I've created the user stories and pushed them to Jira:
- PROJ-101: User login with SSO (Story, 5 points)
- PROJ-102: Password reset flow (Story, 3 points)
- PROJ-103: Session timeout handling (Story, 2 points)
```

**Without Jira MCP:**
```
Here are the user stories ready for your project tracker:

| Title | Type | Points | Acceptance Criteria |
|-------|------|--------|---------------------|
| User login with SSO | Story | 5 | Given a user with SSO config... |
| Password reset flow | Story | 3 | Given a user clicks "forgot password"... |
| Session timeout handling | Story | 2 | Given an idle session of 30 min... |

## Next Steps (Manual)
- [ ] Create these stories in your project management tool
- [ ] Assign to appropriate sprint
- [ ] Link to parent epic
```

## Integration Setup

For setup instructions on connecting specific tools, see `integrations/README.md`.

## V2V Operating Principle

> "Real tools amplify agent intelligence. But intelligence should never depend on tools being present. The plugin works everywhere — tools make it work better."
