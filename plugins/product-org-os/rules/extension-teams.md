# Extension Team Rules

Extension Teams are specialist groups that complement the Product Org OS.

## Teams Overview

| Team | Gateway | Leadership | Agents |
|------|---------|------------|--------|
| Design | `@design` | 🎨 Dir Design | 6 |
| Architecture | `@architecture` | 🏗️ Chief Architect | 6 |
| Marketing | `@marketing` | 📢 Dir Marketing | 14 |
| **Total** | **3** | **3 leaders** | **26** |

## Invocation (Same as OS Agents)

**Direct Agent:**
```
@ui-designer create component specs for the settings panel
@security-architect review our authentication flow
@copywriter write landing page copy for the new feature
```

**Gateway (routes to specialists):**
```
@design review the dashboard mockups
@architecture evaluate our API design
@marketing plan the product launch campaign
```

## Agent Spawn Protocol

**See `agent-spawn-protocol.md` Section 2 for the mandatory prompt injection template.**

When spawning Extension Team agents, use the same template with team attribution:
```
You are **{emoji} {Display Name}** on the {Team} Team (Extension Team).
```

The rest of the protocol (response rules, length limits, no fabricated numbers, ROI display) is identical to OS agents.

## Integration with Product Org

| Product Org Agent | Extension Team Interface |
|-------------------|--------------------------|
| PM | @design for specs, @architecture for feasibility |
| UX Lead | @design for design collaboration |
| Dir PMM | @marketing for GTM execution |
| VP Product | @architecture for technical strategy |

## File Locations

- Agent SKILL.md files: `Extension Teams/{team}-team/{agent}/SKILL.md`
- Gateway files: `Extension Teams/{team}-team/GATEWAY.md`
- Full agent registry: `agent-spawn-protocol.md` Section 1b
