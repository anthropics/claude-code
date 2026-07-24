# Compound Command Validation for Hookify Plugin

## Problem Statement

When Claude Code asks for permission to run compound shell commands like `sleep 10 && do-something-totally-different`, the permission system displays it as "sleep *" or as a single opaque command, making it unclear what operations are being approved. This creates:

- **Security concerns** - Users can't see all commands that will execute
- **Trust issues** - Unclear if the permission system understands the full command
- **Poor UX** - No visibility into what `&&`, `||`, or `;` operators will do

**Original user feedback:**
> "I'd really like that CC wouldn't combine CLI commands funnily and then ask for permissions for 'sleep *' when the command is in fact 'sleep 10 && do-something-totally-different'. I have very low confidence that the app is asking for the correct permissions."

## Solution

This PR adds compound command parsing and validation to the hookify plugin, providing:

1. **Automatic detection** of compound commands (using `&&`, `||`, `;`, `|`)
2. **Clear breakdown** showing each command component and its operator
3. **Flexible policies** - warn, block, or customize behavior
4. **Template variables** for rich messaging

### Example Output

**Before:**
```
Permission request: sleep *
```

**After:**
```
⚠️ Compound Command Detected

This command contains multiple operations:

1. First: `sleep 10`
2. THEN (if successful): `echo "done"`
3. OR (if failed): `echo "failed"`

Make sure you understand all parts before approving.
```

## Changes

### New Files
- `plugins/hookify/utils/command_parser.py` - Command parsing utilities
- `plugins/hookify/utils/test_command_parser.py` - Unit tests for parser
- `plugins/hookify/test_compound_integration.py` - Integration tests
- `plugins/hookify/examples/compound-command-validator.local.md` - Warning rule
- `plugins/hookify/examples/dangerous-compound.local.md` - Blocking rule
- `plugins/hookify/examples/COMPOUND_COMMANDS.md` - Detailed documentation
- `plugins/hookify/examples/QUICK_START_COMPOUND.md` - Quick start guide
- `plugins/hookify/examples/compound-commands-flow.txt` - Visual flow diagram
- `BUG_COMPOUND_COMMAND_PERMISSIONS.md` - Bug report documentation
- `COMPOUND_COMMAND_SOLUTION.md` - Solution overview

### Modified Files
- `plugins/hookify/core/rule_engine.py` - Added `is_compound` operator and template support
- `plugins/hookify/README.md` - Updated documentation with new features

## Features

- ✅ Detects compound commands with `&&`, `||`, `;`, `|` operators
- ✅ Breaks down commands into individual components
- ✅ Handles quoted strings correctly (e.g., `echo "hello && world"`)
- ✅ Template variables: `{{COMMAND_BREAKDOWN}}` and `{{BASE_COMMANDS}}`
- ✅ Flexible actions: warn or block
- ✅ No restart required - rules activate immediately
- ✅ Comprehensive test coverage

## Testing

All tests pass successfully:

```bash
cd plugins/hookify/utils
python3 test_command_parser.py
# ✅ All tests passed

cd plugins/hookify
python3 test_compound_integration.py
# ✅ All integration tests passed
```

Tests cover:
- Simple vs compound command detection
- All operator types (`&&`, `||`, `;`, `|`)
- Quote handling
- Template variable expansion
- Blocking behavior

## Usage

### Quick Start (30 seconds)

```bash
cp plugins/hookify/examples/compound-command-validator.local.md \
   .claude/hookify.compound-validator.local.md
```

That's it! The rule activates immediately.

### Customization

Edit `.claude/hookify.compound-validator.local.md`:

**To block instead of warn:**
```yaml
action: block
```

**To disable:**
```yaml
enabled: false
```

## Documentation

- Main documentation: `plugins/hookify/README.md`
- Detailed guide: `plugins/hookify/examples/COMPOUND_COMMANDS.md`
- Quick start: `plugins/hookify/examples/QUICK_START_COMPOUND.md`
- Visual flow: `plugins/hookify/examples/compound-commands-flow.txt`

## Benefits

1. **Transparency** - See exactly what will execute
2. **Security** - Catch dangerous combinations before execution
3. **Education** - Learn what shell operators do
4. **Control** - Choose to block, warn, or allow
5. **Flexibility** - Customize rules for your workflow

## Limitations

- Complex shell syntax (subshells, redirections) not fully parsed
- Focuses on common POSIX operators
- Visual enhancement only - doesn't change how Claude Code executes commands

## Backward Compatibility

- ✅ No breaking changes
- ✅ Existing rules continue to work
- ✅ New features are opt-in
- ✅ No dependencies added

## Related Issues

- Feedback ID: c85e77e9-9801-4315-84ef-64466ddb9a12
- Addresses compound command permission visibility concerns

## Checklist

- [x] Code follows project style guidelines
- [x] Tests added and passing
- [x] Documentation updated
- [x] No breaking changes
- [x] Examples provided
- [x] Ready for review

## Screenshots

See `plugins/hookify/examples/compound-commands-flow.txt` for visual flow diagrams.

## Reviewer Notes

This is a user-facing enhancement that improves transparency without changing core functionality. The implementation is self-contained within the hookify plugin and uses only stdlib (no new dependencies).

Key files to review:
1. `plugins/hookify/utils/command_parser.py` - Core parsing logic
2. `plugins/hookify/core/rule_engine.py` - Integration with rule engine
3. `plugins/hookify/examples/COMPOUND_COMMANDS.md` - User documentation
