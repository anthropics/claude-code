---
name: skill-creator
description: This skill should be used when the user asks to "create a skill", "make a new skill", "build a skill for Claude", "add a skill to a plugin", "write a SKILL.md", "create a custom skill", or wants guidance on developing skills for Claude Code plugins.
version: 1.0.0
---

# Skill Creator

This skill guides the creation of new skills for Claude Code plugins — modular knowledge packages that give Claude specialized capabilities.

## What Skills Are

Skills are directories containing a `SKILL.md` file (and optional resources) that teach Claude how to handle specific tasks. When a user's request matches the skill's description, Claude loads the skill's content and uses it to guide the response.

## Quick-Start Checklist

To create a new skill:

1. Create directory: `plugins/<plugin-name>/skills/<skill-name>/`
2. Create `SKILL.md` with proper frontmatter
3. Add optional `references/`, `examples/`, `scripts/` subdirectories
4. Test that the skill triggers correctly

## SKILL.md Template

```markdown
---
name: skill-name
description: This skill should be used when the user asks to "verb phrase 1", "verb phrase 2", "verb phrase 3", or when [specific context]. Brief description of what the skill provides.
version: 1.0.0
---

# Skill Title

One paragraph overview of what this skill does and when to use it.

## Core Concepts

[Essential knowledge Claude needs]

## Workflow

[Step-by-step process]

## Examples

[Concrete examples]

## Best Practices

[Key dos and don'ts]

## Additional Resources

- **`references/detailed-guide.md`** — In-depth documentation
- **`scripts/helper.sh`** — Utility script
```

## Writing the Description (Critical)

The `description` frontmatter field determines **when the skill loads**. Write it carefully:

**Format**: `This skill should be used when the user asks to "trigger phrase 1", "trigger phrase 2", ...`

**Good examples**:
```yaml
description: This skill should be used when the user asks to "create a hook", "add a PreToolUse hook", "validate tool use", or mentions hook events.
```

**Bad examples**:
```yaml
description: Provides hook guidance.          # No trigger phrases
description: Use this skill for hooks.        # Wrong person ("Use" not "This skill should")
description: When user needs hook help.       # Not third person
```

Include 3–6 specific trigger phrases that users would actually say.

## Writing the Body

Use **imperative form** (not second person):

| ❌ Don't write | ✅ Write instead |
|----------------|-----------------|
| "You should start by..." | "Start by..." |
| "You need to configure..." | "Configure..." |
| "The user can run..." | "Run..." |

Keep the body **lean** (1,500–2,000 words). Move detailed content to `references/`.

## Directory Structure Options

### Minimal skill

```
skill-name/
└── SKILL.md
```

Good for: Simple knowledge that fits in one file

### Standard skill

```
skill-name/
├── SKILL.md
└── references/
    └── detailed-guide.md
```

Good for: Most skills with supporting documentation

### Full skill

```
skill-name/
├── SKILL.md
├── references/
│   ├── patterns.md
│   └── advanced.md
├── examples/
│   └── working-example.sh
└── scripts/
    └── validate.sh
```

Good for: Complex domains with utilities and examples

## Progressive Disclosure

Load content at the right time:

| Layer | Content | When Loaded |
|-------|---------|-------------|
| Frontmatter | name + description | Always |
| SKILL.md body | Core procedures | When skill triggers |
| `references/` | Detailed docs | When Claude decides it's needed |
| `scripts/` | Utility scripts | When executed |

Keep SKILL.md under 3,000 words. Anything longer should go in `references/`.

## Validation Steps

Before shipping a skill:

1. **Trigger test**: Do the description phrases match what users would actually say?
2. **Style check**: Is the body in imperative form, not second person?
3. **Length check**: Is SKILL.md under 3,000 words?
4. **Reference check**: Do all `references/` paths mentioned in SKILL.md actually exist?
5. **Content check**: Is the skill body substantive and actionable?

## Example: Creating a Database Skill

```bash
mkdir -p plugins/my-plugin/skills/postgres/{references,scripts}
touch plugins/my-plugin/skills/postgres/SKILL.md
```

SKILL.md frontmatter:
```yaml
---
name: postgres
description: This skill should be used when the user asks to "query PostgreSQL", "connect to Postgres", "write a SQL query", "optimize a database query", "create a database schema", or work with PostgreSQL databases.
version: 1.0.0
---
```

Then write the body covering: connection setup, common queries, schema design, performance tips.

## Common Mistakes

- **Vague descriptions**: "Helps with databases" won't trigger reliably
- **Too much in SKILL.md**: Move anything over 3,000 words to references/
- **Second person writing**: "You should..." → "..."
- **Missing resource references**: If you create `references/guide.md`, mention it in SKILL.md
- **No concrete trigger phrases**: Include actual phrases users would type
