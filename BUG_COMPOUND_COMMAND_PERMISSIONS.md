# Bug Report: Compound Command Permission Display

## Issue Summary
When Claude Code requests permission to execute compound shell commands (using `&&`, `||`, `;`, etc.), the permission prompt doesn't clearly communicate that multiple distinct commands will be executed. This creates a trust and security concern.

## Problem Description

### Current Behavior
- User sees permission request like: "Allow: sleep *"
- Actual command being executed: `sleep 10 && do-something-totally-different`
- The wildcard pattern matching obscures what's actually happening
- User cannot tell if the app understands there are multiple commands

### Expected Behavior
Either:
1. **Split approach**: Ask for permission for each command component separately
   - "Allow: sleep 10"
   - "Allow: do-something-totally-different"
   
2. **Grouped approach**: Show all commands in a single prompt that makes it clear multiple operations will run
   - "Allow compound command (2 operations):"
   - "  1. sleep 10"
   - "  2. do-something-totally-different"

## Security Implications

This is both a UX and security issue:
- Users cannot make informed decisions about what they're approving
- Wildcard matching (`sleep *`) could match unintended commands
- Compound commands can chain safe operations with dangerous ones
- Example: `ls -la && rm -rf /` would be catastrophic if approved based on seeing "ls *"

## Technical Context

From the codebase investigation:
- Previous fixes addressed security vulnerabilities with wildcard matching (v2.1.35)
- Permission bypass via line continuation was fixed (v2.1.30)
- Complex bash command prompts were "reduced" (v2.1.27)

However, the core UX issue remains: the permission system doesn't parse and display compound commands in a way that builds user trust.

## Proposed Solution

### Phase 1: Parse Compound Commands
Implement shell command parsing to identify:
- Command separators: `&&`, `||`, `;`, `|`
- Line continuations: `\`
- Subshells: `$(...)`, `` `...` ``
- Command substitution

### Phase 2: Enhanced Permission UI
Display compound commands with:
```
┌─ Compound Command Permission Request ─────────────┐
│                                                    │
│ This command will execute 3 operations:           │
│                                                    │
│  1. sleep 10                                       │
│  2. echo "Processing..."                           │
│  3. do-something-totally-different                 │
│                                                    │
│ [ Allow Once ] [ Allow Always ] [ Deny ]          │
└────────────────────────────────────────────────────┘
```

### Phase 3: Granular Control (Optional)
Allow users to:
- Approve/deny individual commands in a chain
- Set different permission rules for each component
- See which commands match existing permission rules

## Alternative: Container-Based Approach

As the user noted, the future direction might be "fully autonomous agents in containers" where:
- Permission prompts become less critical
- Sandboxing provides the security boundary
- Users can review actions after the fact rather than approving beforehand

This could be a setting: "Sandbox Mode" vs "Permission Mode"

## Related Files
- `examples/hooks/bash_command_validator_example.py` - Shows hook-based validation
- `CHANGELOG.md` - Documents previous permission-related fixes

## Environment
- Platform: darwin
- Version: 2.1.50
- Feedback ID: c85e77e9-9801-4315-84ef-64466ddb9a12

## User Quote
> "I have very low confidence that the app is asking for the correct permissions. This should be an easy task to understand and split the CLI command to the components and manage permissions for them separately."

## Recommendation

This should be prioritized as it affects user trust in the permission system. Even if the backend logic is correct, the UI must clearly communicate what's being approved to maintain user confidence in the security model.
