# RFC 001: Plugin Component Badges and Expanded View

## Summary

Enhance the Claude Code plugin discovery and management UI by displaying component badges (agents, commands, skills, hooks, MCPs) and providing an expanded view with detailed composition information.

## Problem Statement

Currently, when users browse plugins in the Claude Code marketplace or plugin list, they only see:
- Plugin name
- Version number
- Short description

**Users cannot tell:**
- What components a plugin includes (agents, commands, skills, hooks, MCP servers)
- The "weight" or complexity of a plugin
- Whether a plugin fits their tech stack
- Approximate context impact

This makes it difficult to:
1. Compare plugins with similar functionality
2. Understand what you're installing before installation
3. Find plugins that match specific needs (e.g., "I want a plugin with code review agents")

## Proposed Solution

### 1. Component Badges in Plugin List

Display component counts as badges in the plugin listing:

```
feature-dev v1.0.0
├─ 🤖 3 agents  📝 0 skills  ⚡ 1 command  🪝 0 hooks
└─ 🏷️ feature-development, architecture, workflow
```

### 2. Expanded View on Selection

When a user selects a plugin, show detailed composition:

```
feature-dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agents (3):              Commands (1):
• code-explorer          • /feature-dev
• code-architect
• code-reviewer

Skills (0)               Hooks (0)

MCP Servers (0)

Tags: feature-development, architecture, workflow
```

### 3. Filter Options in Discover

Allow users to filter plugins by component type:

```
[x] Has agents
[ ] Has skills only
[ ] Has MCP servers
[ ] Filter by tag: [workflow ▼]
```

## Schema Changes

This PR extends the `plugin.json` schema with two new optional fields:

### `components` Object

```json
{
  "components": {
    "agents": ["agent-name-1", "agent-name-2"],
    "commands": ["command-1", "command-2"],
    "skills": ["skill-1"],
    "hooks": ["PreToolUse", "Stop"],
    "mcpServers": ["server-1"]
  }
}
```

### `metadata` Object

```json
{
  "metadata": {
    "tags": ["git", "workflow", "automation"]
  }
}
```

## Complete Example

```json
{
  "name": "pr-review-toolkit",
  "version": "1.0.0",
  "description": "Comprehensive PR review agents...",
  "author": {
    "name": "Daisy",
    "email": "daisy@anthropic.com"
  },
  "components": {
    "agents": [
      "code-reviewer",
      "code-simplifier",
      "comment-analyzer",
      "pr-test-analyzer",
      "silent-failure-hunter",
      "type-design-analyzer"
    ],
    "commands": ["review-pr"],
    "skills": [],
    "hooks": [],
    "mcpServers": []
  },
  "metadata": {
    "tags": ["code-review", "pull-request", "testing", "quality"]
  }
}
```

## Implementation Notes

### Phase 1: Schema (This PR)
- Add `components` and `metadata` fields to all official plugins
- Document the extended schema

### Phase 2: UI (Future - requires Claude Code changes)
- Parse `components` field in plugin browser
- Render badges in list view
- Render expanded view on selection
- Add filter controls

## Benefits

1. **Better Discoverability**: Users can quickly identify what a plugin offers
2. **Informed Decisions**: See exactly what you're installing
3. **Easier Comparison**: Compare plugins by their composition
4. **Stack Filtering**: Find plugins relevant to your tech stack via tags

## Backwards Compatibility

**Critical**: The new fields MUST be optional and non-breaking.

### For Existing Plugins (without new fields)
- Plugins without `components` or `metadata` fields MUST continue to work
- The UI should gracefully handle missing fields by not showing badges
- No validation errors should occur for missing optional fields

### For New Schema (with new fields)
- Adding extra fields to JSON typically doesn't break parsers
- If Claude Code uses strict schema validation (`additionalProperties: false`), the schema would need updating
- Recommended: Test with existing Claude Code version before merging

### Graceful Degradation Example
```javascript
// UI should handle missing components gracefully
const agents = plugin.components?.agents ?? [];
const commands = plugin.components?.commands ?? [];
// Only show badges if data exists
if (agents.length > 0) showBadge('agents', agents.length);
```

## Open Questions

1. Should we include estimated token impact in metadata?
2. Should tags be free-form or from a controlled vocabulary?
3. Should component lists be auto-generated from directory structure or manually maintained?

---

**Author**: richlira (Claude CDMX Community)
**Date**: December 2025
**Status**: Proposal
