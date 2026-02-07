---
name: clear-demo
description: (Optional) Remove demo content for a clean context folder
model: haiku
tools:
  - Read
  - Bash
  - Glob
---

# Clear Demo Content (Optional)

Remove demo content from the context layer for a clean folder structure.

**Note:** This is optional. Demo data **auto-filters** once you have production data:
- When no production data exists → Demo included, marked `[DEMO]`
- When production data exists → Demo excluded by default
- Override with `--include-demo` or `--demo-only` flags

Use `/clear-demo` only if you want to physically remove demo files.

## Trigger Patterns

- `/clear-demo` - Interactive, confirms before clearing
- `/clear-demo --force` - Clear without confirmation

## Behavior

### 1. Show What Will Be Removed

List all demo content that will be deleted:

```markdown
## Demo Content to Remove

### Decisions (3 files)
- DR-DEMO-001-pricing-model.md
- DR-DEMO-002-api-versioning.md
- DR-DEMO-003-mobile-first.md

### Strategic Bets (2 files)
- SB-DEMO-001-enterprise-tier.md
- SB-DEMO-002-self-serve.md

### Feedback (1 file)
- feedback-samples.md

### Documents (1 file)
- prd-dashboard-redesign.md

### Index (1 file)
- index.md

**Total**: 8 files in context/demo/
```

### 2. Confirm (Unless --force)

```
Are you sure you want to remove all demo content? This cannot be undone.

To restore demo content later, run: /reset-demo

[Proceed] [Cancel]
```

### 3. Clear Demo Content

Delete contents of:
- `context/demo/decisions/`
- `context/demo/bets/`
- `context/demo/feedback/`
- `context/demo/documents/`
- `context/demo/index.md`

**Preserve**:
- The `context/demo/` folder structure (empty folders)
- All non-demo content in main context folders

### 4. Update JSON Index

If `context/index.json` contains demo entries (IDs containing "DEMO"):
- Remove all entries where ID contains "DEMO"
- Update topicIndex, typeIndex, phaseIndex accordingly
- Update lastUpdated timestamp

### 5. Confirm Completion

```markdown
## Demo Content Cleared

Removed:
- 3 demo decisions
- 2 demo strategic bets
- 7 demo feedback entries
- 1 demo document

Your context layer is now empty and ready for your organizational data.

**Next steps:**
- `/context-save` - Save your first decision or bet
- `/feedback-capture` - Capture your first feedback
- `@pm` - Start working with the PM agent

To restore demo content: `/reset-demo`
```

## Safety

- Only deletes files in `context/demo/` folder
- Only removes JSON index entries with "DEMO" in ID
- Preserves folder structure
- Preserves all user-created content
- Reversible via `/reset-demo`

## Notes

- **This is optional** - demo content auto-filters when production data exists
- Demo content uses isolated `context/demo/` folder
- Real organizational context goes in main context folders
- Demo content can be restored anytime with `/reset-demo`
- Use `--include-demo` flag on context queries to see demo alongside production data
