# Quick Start: Compound Command Validation

Get visibility into compound shell commands in 2 minutes.

## What Problem Does This Solve?

When Claude Code asks to run `sleep 10 && rm -rf /tmp/test`, you might see:
- ❌ "sleep *" (unclear what else runs)
- ❌ Single opaque permission request
- ❌ No visibility into what `&&` means

With this feature, you see:
- ✅ "1. First: `sleep 10`"
- ✅ "2. THEN (if successful): `rm -rf /tmp/test`"
- ✅ Clear breakdown of each operation

## Installation (30 seconds)

```bash
# Copy the example rule to your project
cp plugins/hookify/examples/compound-command-validator.local.md \
   .claude/hookify.compound-validator.local.md

# That's it! No restart needed.
```

## Test It (30 seconds)

Ask Claude Code to run a compound command:
```
Run: sleep 5 && echo "done" || echo "failed"
```

You should see a warning showing each command component.

## Customize (1 minute)

Edit `.claude/hookify.compound-validator.local.md`:

**To block instead of warn:**
```yaml
action: block  # Change from 'warn' to 'block'
```

**To disable:**
```yaml
enabled: false  # Change from 'true' to 'false'
```

**To only warn about dangerous commands:**
```yaml
conditions:
  - field: command
    operator: is_compound
    pattern: ""
  - field: command
    operator: regex_match
    pattern: "rm|del|format|dd"  # Add dangerous command patterns
```

## What You Get

### Before
```
Permission request: sleep *
[Unclear what else will run]
```

### After
```
⚠️ Compound Command Detected

This command contains multiple operations:

1. First: `sleep 10`
2. THEN (if successful): `echo "done"`
3. OR (if failed): `echo "failed"`

Make sure you understand all parts before approving.
```

## Common Use Cases

### 1. Visibility Only (Recommended)
Keep `action: warn` - See breakdowns but allow execution

### 2. Block All Compound Commands
Set `action: block` - Force running commands one at a time

### 3. Block Dangerous Combinations
Add regex pattern to catch `rm`, `dd`, `format`, etc.

## Need More?

- Full documentation: `examples/COMPOUND_COMMANDS.md`
- Plugin README: `../README.md`
- Implementation: `../utils/command_parser.py`

## Troubleshooting

**Rule not working?**
1. Check file is in `.claude/` directory (project root)
2. Verify `enabled: true` in the file
3. Try `/hookify:list` to see loaded rules

**Want to see all rules?**
```
/hookify:list
```

**Want to disable temporarily?**
Edit the file and set `enabled: false`
