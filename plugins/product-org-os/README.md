# Product Org OS

**An entire product organization that becomes your superpower.**

> Intent → Decisions → Commitments → Execution → Outcomes → Learning

13 agents • 61 skills • 5 gateways • 9 knowledge packs • MCP integrations • Context layer

[**View the Interactive Presentation →**](https://yohayetsion.github.io/product-org-os)

---

## Quick Start

```bash
# Install in Claude Code (primary platform)
claude plugins install github:yohayetsion/product-org-os

# Initialize in your project
/setup

# Start using
@product Launch freemium tier for SMBs. Context: @pricing-research.md
```

> **Cross-platform**: Also compatible with Cursor, GitHub Copilot, Gemini CLI, and other [Agent Skills](https://github.com/anthropics/agent-skills)-standard tools.

---

## Two Invocation Patterns

| Syntax | Purpose | Example |
|--------|---------|---------|
| `@agent` | **Delegate** - spawn autonomous agent | `@pm create a PRD for auth` |
| `/skill` | **Inline** - use template/workflow directly | `/prd` `/decision-record` |

### @product Gateway
Your single entry point. Routes requests to the right agents automatically.
```
@product Launch freemium for SMBs. Context: @pricing-research.md
@product Q2 planning. Inputs: @customer-interviews/ @eng-capacity.md
```

**Response Depth** (`+`/`-` modifiers):
| Modifier | Effect | Example |
|----------|--------|---------|
| `-` | Brief - executive summary | `@product What's launch status? -` |
| *(none)* | Standard - balanced depth | `@product What's launch status?` |
| `+` | Deep - full analysis | `@product What's launch status? +` |

**Meeting Mode**: When you use `@product` or `@plt`, you'll see responses from *individual agents* speaking in their own voice - like walking into a meeting room. You'll see who's engaged, their perspectives, agreements, and tensions. This isn't a monolithic AI response - it's your product org thinking together.

**Multi-Product Organizations**: Filter context by product:
```
/context-recall pricing product:AXIA
/feedback-recall onboarding product:SKYMOD
/portfolio-status product:AXIA
```

### Delegate to Agents (`@agent`)
Spawn autonomous agents to handle tasks. Each agent reasons independently and returns results.
```
@cpo review @board-feedback.pdf and update strategic intent
@pm break down @epic.md into user stories
@plt review @portfolio-health.md - should we pivot?
@bizops analyze @pricing-data.xlsx and create pricing model
```

**Agent Shortcuts:**
| Shortcut | Full Agent | Domain |
|----------|------------|--------|
| `@pm` | `@product-manager` | PRDs, specs, user stories |
| `@plt` | `@product-leadership-team` | Portfolio decisions |
| `@pm-dir` | `@director-product-management` | Roadmap governance |
| `@pmm-dir` | `@director-product-marketing` | GTM strategy |
| `@pmm` | `@product-marketing-manager` | Campaigns, enablement |
| `@ci` | `@competitive-intelligence` | Market analysis |
| `@prod-ops` | `@product-operations` | Launch, process |
| `@mentor` | `@product-mentor` | Career coaching, PM development |

### Use Skills Directly (`/skill`)
Create, update, or find specific deliverables inline.
```
Create a /prd for SSO integration - see @slack-thread.md
Run /competitive-analysis on Acme - @their-demo-notes.md
Update the /roadmap-theme for Growth with mobile initiatives
Find all authentication PRDs using /prd find
```

### Mix Both Patterns
Combine agents and skills naturally.
```
@pm-dir review @launch-data.xlsx and update the /gtm-strategy
@cpo review @board-feedback.pdf and update /strategic-intent
@vp-product review @sales-feedback.md and run /pricing-strategy
```

---

## What's Included

### 13 Role-Based Agents
CPO, VP Product, Director PM, Director PMM, Product Manager, PMM, Product Mentor, BizOps, BizDev, Competitive Intelligence, Product Operations, Value Realization, UX Lead

### 5 Gateways
Product, Product Leadership Team, Design, Architecture, Marketing — route to relevant agents automatically

### 61 Skills
PRDs, roadmaps, business cases, GTM strategies, pricing models, launch plans, QBR decks, competitive analyses, decision records, ROI tracking, and more

### 9 Knowledge Packs
Prioritization, Pricing, Discovery, Metrics, Competitive, GTM, Stakeholder Management, User Research, Financial Modeling

### Context Layer
Organizational memory that persists across sessions:
- **Auto-registration**: All skill outputs automatically tracked in `context/documents/`
- **Decisions & Bets**: Strategic choices with assumptions and re-decision triggers
- **Feedback**: Customer and market signals linked to decisions
- **Learnings**: Accumulated wisdom from retrospectives and outcomes
- **Cross-reference graph**: Decisions, bets, feedback, and learnings linked automatically
- **Interaction History**: Full conversation logging across sessions — query with `/interaction-recall [topic]`

Query anytime with `/context-recall [topic]`

### Demo Environment
Ships with pre-populated sample data so you can explore immediately:
- 3 decision records, 2 strategic bets, 7 feedback entries, 1 PRD
- Run `/tour` for a 5-step interactive walkthrough
- **Auto-filtering**: Demo data hides automatically once you add your own content
- Demo coexists safely—use `--include-demo` flag to see it alongside production data
- `/clear-demo` removes demo entirely when ready

### ROI Tracking
See time savings after every skill completion:
- Automatic display of estimated time saved
- Session totals and historical tracking
- View dashboard with `/roi-report`

### V2V Framework
Six phases from strategic intent to learning loop, with skills mapped to each phase

---

## What's New in v3

### MCP Integrations
Agents auto-detect connected tools (Jira, Slack, Analytics) and use them when available. No MCP? They fall back gracefully to text output with manual action notes. Setup templates in `integrations/`.

### 9 Domain Knowledge Packs
Professional PM frameworks that agents reference when producing deliverables. Covers prioritization (RICE, Kano, MoSCoW), pricing (value-based, freemium, Van Westendorp), competitive analysis (Porter's, SWOT, battlecards), and 6 more domains. See `reference/knowledge/`.

### Enhanced Context Layer
Auto-context injection eliminates manual `/context-recall` for common patterns. Cross-reference graph connects decisions, bets, feedback, and learnings. Structured JSON indexes for fast multi-dimensional queries.

### Agent Delegation Patterns
Four structured collaboration patterns: Consultation (quick input), Delegation (transfer ownership), Review (quality validation), and Structured Debate (opposing perspectives for decision-making).

### Cross-Platform via Agent Skills Standard
Plugin uses `allowed-tools:` and `user-invocable:` frontmatter per the Agent Skills open standard. Works in Claude Code, Cursor, Copilot, Gemini CLI, and expanding.

---

## Use Cases

| Who | What You Get |
|-----|--------------|
| **Solo PM** | Senior-level guidance on every deliverable |
| **Product Team** | Consistent standards, shared memory |
| **Product Org** | Decision frameworks, institutional knowledge |

---

## Documentation

- [Interactive Presentation](https://yohayetsion.github.io/product-org-os) - Visual overview
- [Full Documentation](./PRODUCT-ORG-CLAUDE.md) - Complete skill reference

---

## License

MIT

---

**Free & Open Source.** World-class product capabilities shouldn't be locked behind enterprise software.

Based on the Vision to Value Executive Manifesto by Yohay Etsion.

> Works with Claude Code, Cursor, Copilot, Gemini CLI, and other Agent Skills-compatible tools.
