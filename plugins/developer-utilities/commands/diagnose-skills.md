---
description: Diagnose why Skills aren't working - check structure, permissions, and discoverability
---

## Your Task

Help users troubleshoot why their Claude Code Skills aren't being discovered or invoked. This addresses common issues found in GitHub issues #11459, #9716, #11322, and #10067.

**Related Issues:**
- [#11459](https://github.com/anthropics/claude-code/issues/11459) - Skills being interpreted as slash commands
- [#9716](https://github.com/anthropics/claude-code/issues/9716) - Skills not being discovered
- [#11322](https://github.com/anthropics/claude-code/issues/11322) - Prettier formatting breaks skill frontmatter
- [#10067](https://github.com/anthropics/claude-code/issues/10067) - Skill architecture differences

## Diagnostic Workflow

### Step 1: Check if Skills Exist

```bash
echo "=== Checking for Skills ==="
```

```bash
if [ -d .claude/skills ]; then echo "✓ Project skills directory exists (.claude/skills/)"; else echo "✗ No project skills directory found"; fi
```

```bash
if [ -d ~/.claude/skills ]; then echo "✓ Global skills directory exists (~/.claude/skills/)"; else echo "✗ No global skills directory found"; fi
```

```bash
echo "" && echo "=== Project Skills Found ===" && find .claude/skills -name "SKILL.md" -o -name "skill.md" 2>/dev/null | head -20 || echo "No SKILL.md files found in .claude/skills/"
```

```bash
echo "" && echo "=== Global Skills Found ===" && find ~/.claude/skills -name "SKILL.md" -o -name "skill.md" 2>/dev/null | head -20 || echo "No SKILL.md files found in ~/.claude/skills/"
```

### Step 2: Validate Skill Structure

For each skill found, check:

**Required structure:**
```
.claude/skills/skill-name/
└── SKILL.md (or skill.md)
```

**Common mistake #1: Wrong filename**
- ❌ `.claude/skills/my-skill.md` (file at wrong level)
- ✓ `.claude/skills/my-skill/SKILL.md` (correct)

**Common mistake #2: Case sensitivity**
- ✓ `SKILL.md` (preferred)
- ✓ `skill.md` (also works)
- ❌ `Skill.md` or `SKill.md` (may not work)

Check if users have these issues:

```bash
echo "" && echo "=== Checking for Common Structure Issues ===" && echo ""
```

```bash
echo "Files in wrong location (should be in subdirectories):" && find .claude/skills -maxdepth 1 -name "*.md" -type f 2>/dev/null || echo "None found (good!)"
```

```bash
echo "" && echo "Skills with incorrect case:" && find .claude/skills -name "*.md" -type f 2>/dev/null | grep -v "SKILL.md" | grep -v "skill.md" || echo "None found (good!)"
```

### Step 3: Validate Frontmatter

**Required YAML frontmatter:**
```yaml
---
name: skill-name
description: Clear description of what this skill does
---
```

**Common mistake #3: Prettier formatting breaks multi-line descriptions**

Check the first skill for frontmatter issues:

```bash
echo "" && echo "=== Checking Frontmatter Format ===" && echo ""
```

**If skills were found in Step 1, manually check one of them:**

```bash
find .claude/skills -name "SKILL.md" -o -name "skill.md" 2>/dev/null | head -1
```

**Then read that file:**

Use the Read tool to examine the frontmatter of the skill file shown above.

**Analyze the frontmatter and look for:**

1. **Missing pipe operator on multi-line descriptions:**
   ```yaml
   # ❌ BROKEN (Prettier does this)
   description:
     This is a long description that was wrapped
     by Prettier without a pipe operator

   # ✓ FIXED
   description: |
     This is a long description that was wrapped
     by Prettier with a pipe operator
   ```

2. **Missing name or description fields:**
   ```yaml
   # ❌ BROKEN
   ---
   title: my-skill
   ---

   # ✓ CORRECT
   ---
   name: my-skill
   description: What this skill does
   ---
   ```

### Step 4: Check Permissions

Skills require Read permissions to access SKILL.md files.

```bash
echo "" && echo "=== Checking Permission Configuration ===" && echo ""
```

```bash
if [ -f .claude/settings.json ]; then echo "Project settings exist" && cat .claude/settings.json 2>/dev/null | grep -A 10 "permissions" || echo "No permissions configured in project settings"; else echo "No project settings.json"; fi
```

```bash
echo "" && if [ -f ~/.claude/settings.json ]; then echo "Global settings exist" && cat ~/.claude/settings.json 2>/dev/null | grep -A 10 "permissions" || echo "No permissions configured in global settings"; else echo "No global settings.json"; fi
```

**Common mistake #4: Skills directory in deny list**

If you see permissions like:
```json
{
  "permissions": {
    "deny": [
      "Read(~/.claude/**)",
      "Read(.claude/**)"
    ]
  }
}
```

**This will block Skills!** Skills need to read their SKILL.md files from `.claude/skills/` or `~/.claude/skills/`.

**Fix:** Allow skill directories specifically:
```json
{
  "permissions": {
    "allow": [
      "Read(.claude/skills/**)",
      "Read(~/.claude/skills/**)"
    ],
    "deny": [
      "Read(.claude/project-caches/**)",
      "Read(~/.claude/logs/**)"
    ]
  }
}
```

### Step 5: Check for Slash Command Conflicts

**Common mistake #5: Skills being interpreted as slash commands** (Issue #11459)

```bash
echo "" && echo "=== Checking for Slash Command Conflicts ===" && echo ""
```

```bash
echo "Slash commands in .claude/commands/:" && find .claude/commands -name "*.md" -type f 2>/dev/null | sed 's|.claude/commands/||' | sed 's|.md$||' | sed 's|/|:|g' | sed 's|^|/|' || echo "No slash commands found"
```

```bash
echo "" && echo "Skills in .claude/skills/:" && find .claude/skills -type d -mindepth 1 -maxdepth 1 2>/dev/null | sed 's|.claude/skills/||' || echo "No skills found"
```

**If you see the same name in both lists, that's a conflict!**

Example conflict:
- `.claude/commands/my-tool.md` → `/my-tool` slash command
- `.claude/skills/my-tool/SKILL.md` → `my-tool` skill

**Fix:** Rename either the slash command or the skill to avoid confusion.

### Step 6: Test Skill Discovery

Ask the user to restart Claude Code and then ask:

**"What skills do you have available?"**

If skills don't appear:
1. ✅ Verified SKILL.md files exist in correct locations (Step 1)
2. ✅ Verified frontmatter has `name:` and `description:` fields (Step 3)
3. ✅ Fixed multi-line descriptions with `|` operator (Step 3)
4. ✅ Allowed `.claude/skills/` in permissions (Step 4)
5. ✅ No conflicts with slash commands (Step 5)

**If all checks pass but skills still don't work:**
- This may be a bug in Claude Code's skill discovery
- Ask user to file a GitHub issue with the diagnostic output
- Reference issues #11459, #9716, or #10067

## Common Issues Summary

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Wrong structure** | Skill not discovered | Move to `.claude/skills/name/SKILL.md` |
| **Prettier formatting** | Skill works, then stops after formatting | Add `\|` to multi-line descriptions |
| **Permissions** | Skill not accessible | Allow `Read(.claude/skills/**)` |
| **Slash command conflict** | Skill appears as `/command` | Rename skill or command |
| **Missing frontmatter** | Skill not discovered | Add `name:` and `description:` fields |
| **Case sensitivity** | Skill not discovered | Use `SKILL.md` (uppercase) |

## Expected Output

After running this diagnostic, you should:

1. ✅ Know if skills exist and where they are
2. ✅ Identify structure problems (wrong directories, wrong filenames)
3. ✅ Identify frontmatter problems (Prettier formatting, missing fields)
4. ✅ Identify permission problems (deny rules blocking skills)
5. ✅ Identify conflicts with slash commands
6. ✅ Have concrete steps to fix each problem

## To Fix Common Issues

**Prettier formatting breaking frontmatter:**
```yaml
# Add pipe operator
description: |
  Long description that spans
  multiple lines
```

**Skills blocked by permissions:**
```json
{
  "permissions": {
    "allow": [
      "Read(.claude/skills/**)"
    ]
  }
}
```

**Wrong structure:**
```bash
# Move from wrong location
mv .claude/skills/my-skill.md .claude/skills/my-skill/SKILL.md
```

## Documentation References

- [Official Skills Documentation](https://docs.claude.com/en/docs/claude-code/skills)
- [GitHub Issue #11459](https://github.com/anthropics/claude-code/issues/11459) - Skills as slash commands
- [GitHub Issue #11322](https://github.com/anthropics/claude-code/issues/11322) - Prettier formatting
- [GitHub Issue #9716](https://github.com/anthropics/claude-code/issues/9716) - Skill discovery
