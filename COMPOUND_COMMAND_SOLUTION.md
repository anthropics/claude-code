# Compound Command Permission Solution

## Problem Statement

When Claude Code asks for permission to run compound shell commands like:
```bash
sleep 10 && do-something-totally-different
```

The permission system may display it as "sleep *" or as a single opaque command string, making it unclear what operations you're actually approving. This creates:

1. **Security concerns** - You can't see all the commands that will execute
2. **Trust issues** - Unclear if the permission system understands the full command
3. **Poor UX** - No visibility into what "&&", "||", or ";" operators will do

## Solution Overview

This solution adds compound command parsing and validation to the hookify plugin, providing:

1. **Automatic detection** of compound commands (using `&&`, `||`, `;`, `|`)
2. **Clear breakdown** showing each command component and its operator
3. **Flexible policies** - warn, block, or customize behavior
4. **Template variables** for rich messaging

## Implementation

### New Components

1. **Command Parser** (`plugins/hookify/utils/command_parser.py`)
   - Splits compound commands into individual components
   - Handles quoted strings correctly
   - Extracts base command names
   - Formats human-readable breakdowns

2. **Enhanced Rule Engine** (`plugins/hookify/core/rule_engine.py`)
   - New `is_compound` operator for detecting compound commands
   - Template variable support: `{{COMMAND_BREAKDOWN}}` and `{{BASE_COMMANDS}}`
   - Message formatting with context-aware substitution

3. **Example Rules** (`plugins/hookify/examples/`)
   - `compound-command-validator.local.md` - Warns about all compound commands
   - `dangerous-compound.local.md` - Blocks dangerous compound operations
   - `COMPOUND_COMMANDS.md` - Comprehensive documentation

### How It Works

When you run a compound command:

```bash
sleep 10 && echo "done" || echo "failed"
```

The hookify rule detects it and shows:

```
⚠️ Compound Command Detected

This command contains multiple operations chained together. Here's what will execute:

1. First: `sleep 10`
2. THEN (if successful): `echo "done"`
3. OR (if failed): `echo "failed"`

Each command will run in sequence. Make sure you understand all parts before approving.
```

## Usage

### Quick Start

1. Copy the example rule to your project:
   ```bash
   cp plugins/hookify/examples/compound-command-validator.local.md \
      .claude/hookify.compound-validator.local.md
   ```

2. The rule activates immediately (no restart needed)

3. Try running a compound command - you'll see the breakdown

### Customization Options

**Option 1: Warn about all compound commands**
```yaml
action: warn
conditions:
  - field: command
    operator: is_compound
    pattern: ""
```

**Option 2: Block all compound commands**
```yaml
action: block
conditions:
  - field: command
    operator: is_compound
    pattern: ""
```

**Option 3: Block only dangerous combinations**
```yaml
action: block
conditions:
  - field: command
    operator: is_compound
    pattern: ""
  - field: command
    operator: regex_match
    pattern: "rm|del|format|dd"
```

## Technical Details

### Supported Operators

- `&&` - Execute next if previous succeeded
- `||` - Execute next if previous failed  
- `;` - Execute next regardless
- `|` - Pipe output to next command

### Quote Handling

The parser correctly handles quoted strings:
- `echo "hello && world"` - Treated as single command (correct)
- `echo 'test;test' && ls` - Two commands: echo and ls (correct)

### Template Variables

- `{{COMMAND_BREAKDOWN}}` - Full formatted breakdown with operators
- `{{BASE_COMMANDS}}` - Comma-separated list of command names

### Performance

- Regex patterns are cached (LRU cache, max 128)
- Parser is O(n) where n is command length
- No external dependencies (stdlib only)

## Testing

Run the test suite:
```bash
cd plugins/hookify
python3 test_compound_integration.py
```

Tests cover:
- Simple vs compound command detection
- All operator types (&&, ||, ;, |)
- Quote handling
- Template variable expansion
- Blocking behavior

## Future Enhancements

Potential improvements:

1. **Per-command permissions** - Ask for approval for each component separately
2. **Command rewriting** - Automatically split compound commands
3. **Risk scoring** - Assign risk levels based on command combinations
4. **Shell history integration** - Learn from user patterns
5. **Subshell detection** - Handle `(cmd1 && cmd2)` syntax
6. **Background jobs** - Handle `&` operator

## Benefits

1. **Transparency** - See exactly what will execute
2. **Security** - Catch dangerous combinations before execution
3. **Education** - Learn what shell operators do
4. **Control** - Choose to block, warn, or allow
5. **Flexibility** - Customize rules for your workflow

## Limitations

1. **Complex shell syntax** - Advanced features like subshells, redirections, and process substitution are not fully parsed
2. **Escape sequences** - Complex escaping may not be handled perfectly
3. **Shell-specific features** - Focuses on common POSIX operators
4. **Visual only** - This doesn't change how Claude Code executes commands, only how they're displayed

## Addressing the Original Concern

The original issue was:
> "I'd really like that CC wouldn't combine CLI commands funnily and then ask for permissions for 'sleep *' when the command is in fact 'sleep 10 && do-something-totally-different'"

This solution addresses it by:

1. ✅ **Detecting compound commands** automatically
2. ✅ **Breaking them down** into individual components
3. ✅ **Showing each part** with clear operator explanations
4. ✅ **Allowing customization** - warn, block, or customize
5. ✅ **No code changes needed** - Just add a markdown file

While this doesn't change the underlying permission system (that would require changes to Claude Code itself), it provides a transparent layer that shows you exactly what's being executed, addressing the trust and visibility concerns.

## Recommendation

For most users, start with the warning rule:
```bash
cp plugins/hookify/examples/compound-command-validator.local.md \
   .claude/hookify.compound-validator.local.md
```

This gives you visibility without blocking operations. If you want stricter control, enable the blocking rule for dangerous commands:
```bash
cp plugins/hookify/examples/dangerous-compound.local.md \
   .claude/hookify.dangerous-compound.local.md
# Edit the file and set enabled: true
```

## Documentation

- Main documentation: `plugins/hookify/README.md`
- Detailed guide: `plugins/hookify/examples/COMPOUND_COMMANDS.md`
- Example rules: `plugins/hookify/examples/*.local.md`
- Parser implementation: `plugins/hookify/utils/command_parser.py`
