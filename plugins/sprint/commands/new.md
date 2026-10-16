---
name: new
description: Create a new sprint directory with specs.md template
argument-hint: "[goal description]"
---

# New Sprint Command

You are bootstrapping a new sprint for the user.

## Workflow

### Step 1: Determine Sprint Index

Find the next sprint number:
```bash
# Get current highest sprint number
LAST=$(ls -d .claude/sprint/*/ 2>/dev/null | sort -V | tail -1 | grep -oE '[0-9]+' | tail -1)
if [ -z "$LAST" ]; then
  NEXT=1
else
  NEXT=$((LAST + 1))
fi
echo $NEXT
```

### Step 2: Create Sprint Directory

```bash
mkdir -p .claude/sprint/[NEXT]
```

### Step 3: Gather Sprint Information

Ask the user for sprint details. Present this as a structured question:

**What would you like to build in this sprint?**

Options to clarify:
1. **Goal**: What's the main objective? (1-2 sentences)
2. **Scope**: What specific features or fixes?
3. **Testing**:
   - QA testing: required / optional / skip
   - UI testing: required / optional / skip
   - UI testing mode: automated / manual

### Step 4: Create specs.md

Based on user input, create `.claude/sprint/[NEXT]/specs.md`:

```markdown
# Sprint [NEXT] Specifications

## Goal
[User's goal description]

## Scope
[List of features/tasks]

## Testing
- QA: [required/optional/skip]
- UI Testing: [required/optional/skip]
- UI Testing Mode: [automated/manual]

## Notes
[Any additional context]
```

### Step 5: Suggest Next Steps

After creating the sprint, suggest:

```
Sprint [NEXT] created at .claude/sprint/[NEXT]/

Next steps:
1. Review and edit .claude/sprint/[NEXT]/specs.md if needed
2. Run /sprint to start the sprint workflow
3. The architect will analyze specs and create detailed specifications

Tip: For detailed specs, you can add:
- API endpoint details
- UI mockup descriptions
- Database schema changes
- Specific test scenarios
```

## Quick Mode

If the user provides a one-liner goal, create the sprint immediately:

Example: `/sprint:new Add user authentication with OAuth`

Creates:
```markdown
# Sprint [N] Specifications

## Goal
Add user authentication with OAuth

## Scope
- To be analyzed by architect

## Testing
- QA: required
- UI Testing: required
- UI Testing Mode: automated
```

## Templates

Offer templates for common sprint types:

### Feature Sprint
```markdown
# Sprint [N] Specifications

## Goal
[New feature description]

## Scope
- Backend API endpoints
- Frontend UI components
- Database migrations
- Tests

## Testing
- QA: required
- UI Testing: required
- UI Testing Mode: automated
```

### Bug Fix Sprint
```markdown
# Sprint [N] Specifications

## Goal
Fix [bug description]

## Scope
- Root cause analysis
- Fix implementation
- Regression tests

## Testing
- QA: required
- UI Testing: optional
- UI Testing Mode: automated
```

### Refactoring Sprint
```markdown
# Sprint [N] Specifications

## Goal
Refactor [component/system]

## Scope
- Code restructuring
- No functional changes
- Update tests if needed

## Testing
- QA: required
- UI Testing: skip
```

## Output

Report to user:
- Sprint number and directory created
- Summary of specs.md content
- Next steps to proceed
