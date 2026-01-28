# Plugin Recommendations

Plugins are installable collections of skills that extend Claude's capabilities. They bundle related skills, reference materials, and workflows together.

## Available Plugins

### anthropic-agent-skills
**The comprehensive skills bundle from Anthropic**

| Recommend When | Examples |
|----------------|----------|
| General productivity | Default recommendation |
| Document workflows | docx, xlsx, pptx, pdf |
| Frontend development | frontend-design, webapp-testing |
| Building AI tools | mcp-builder, skill-creator |
| Creative work | canvas-design, algorithmic-art |

**Includes**: docx, xlsx, pptx, pdf, frontend-design, canvas-design, algorithmic-art, mcp-builder, skill-creator, webapp-testing, doc-coauthoring, internal-comms, brand-guidelines, theme-factory, slack-gif-creator, web-artifacts-builder

**Install**: This plugin is commonly pre-installed. Check with `claude plugins list`.

---

### frontend-design
**Specialized frontend UI development**

| Recommend When | Examples |
|----------------|----------|
| React/Vue/Angular work | Component development |
| Landing pages | Marketing sites |
| Dashboard UI | Admin interfaces |
| Design system | Component libraries |

**Value**: Creates distinctive, production-grade UI avoiding generic AI aesthetics.

---

## Plugin vs Individual Skills

### When to Recommend Plugin Installation
- User needs multiple related skills
- Team standardization desired
- First-time Claude Code setup
- Comprehensive capability needed

### When to Recommend Individual Skill Usage
- Specific one-time task
- Already have plugin installed
- Just need one capability

---

## Checking Installed Plugins

```bash
# List installed plugins
claude plugins list

# Check available skills
claude skills list
```

---

## Custom Plugin Development

For teams wanting to bundle their own skills:

| Recommend When | Examples |
|----------------|----------|
| Company-specific workflows | Internal processes |
| Team best practices | Shared patterns |
| Domain expertise | Industry knowledge |
| Tool integrations | Internal tools |

Use the **skill-creator** skill to build individual skills, then bundle them into a plugin for team distribution.

---

## Quick Reference

| Need | Recommended Plugin/Skill |
|------|-------------------------|
| General productivity | anthropic-agent-skills (full bundle) |
| Document creation | docx, xlsx, pptx, pdf skills |
| Frontend work | frontend-design plugin |
| Testing | webapp-testing skill |
| Building tools | mcp-builder skill |
| Custom workflows | skill-creator skill |
