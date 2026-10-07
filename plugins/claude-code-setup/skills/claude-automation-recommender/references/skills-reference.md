# Skills Recommendations

Skills are packaged expertise with workflows, reference materials, and best practices that Claude can invoke for specialized tasks.

## Built-in Agents

### Plan Agent
**Best for**: Complex implementations needing architectural planning

| Recommend When | Examples |
|----------------|----------|
| Multi-file changes needed | New feature development |
| Architectural decisions | System design |
| Unknown scope | Needs investigation first |
| Multiple valid approaches | Trade-off analysis |

**Value**: Thinks through implementation before coding, identifies files to change, considers edge cases.

### Explore Agent
**Best for**: Understanding large or unfamiliar codebases

| Recommend When | Examples |
|----------------|----------|
| Large codebase (>500 files) | Navigate efficiently |
| New to the project | Understand structure |
| Finding patterns | How is X done? |
| Debugging | Trace execution paths |

**Value**: Quickly searches, reads, and synthesizes information across many files.

---

## Document Creation Skills

### docx (Word Documents)
**Best for**: Creating and editing Word documents

| Recommend When | Examples |
|----------------|----------|
| Report generation | Technical reports |
| Contract templates | Legal documents |
| Documentation export | Share with non-developers |
| Tracked changes | Review workflows |

### xlsx (Spreadsheets)
**Best for**: Creating and analyzing Excel files

| Recommend When | Examples |
|----------------|----------|
| Data analysis | Process CSV/Excel data |
| Report generation | Formatted tables |
| Financial models | Formulas and calculations |
| Data transformation | Clean and reshape data |

### pptx (Presentations)
**Best for**: Creating PowerPoint presentations

| Recommend When | Examples |
|----------------|----------|
| Technical presentations | Architecture diagrams |
| Project updates | Status slides |
| Demo decks | Feature walkthroughs |
| Training materials | Educational content |

### pdf (PDF Documents)
**Best for**: PDF manipulation and creation

| Recommend When | Examples |
|----------------|----------|
| Form filling | Complete PDF forms |
| Document merging | Combine files |
| Text extraction | Parse PDF content |
| PDF generation | Create from data |

---

## Frontend & Design Skills

### frontend-design
**Best for**: Creating polished, production-ready UI components

| Recommend When | Examples |
|----------------|----------|
| UI component work | React, Vue, Angular |
| Landing pages | Marketing sites |
| Dashboard design | Data visualization |
| Design system work | Component libraries |

**Value**: Creates distinctive, high-quality UI instead of generic AI aesthetics.

### canvas-design
**Best for**: Creating visual art and static designs

| Recommend When | Examples |
|----------------|----------|
| Poster creation | Marketing materials |
| Visual diagrams | Architecture visuals |
| Infographics | Data visualization |

### algorithmic-art
**Best for**: Generative art with p5.js

| Recommend When | Examples |
|----------------|----------|
| Interactive visuals | Creative coding |
| Generative patterns | Flow fields, particles |
| Data art | Algorithmic visualization |

### theme-factory
**Best for**: Applying themes to artifacts

| Recommend When | Examples |
|----------------|----------|
| Brand consistency | Apply company colors |
| Document styling | Professional look |
| Presentation themes | Consistent decks |

### brand-guidelines
**Best for**: Applying Anthropic brand styling

| Recommend When | Examples |
|----------------|----------|
| Anthropic materials | Official branding |
| Partner materials | Co-branded content |

---

## Development Skills

### mcp-builder
**Best for**: Creating MCP servers to extend Claude

| Recommend When | Examples |
|----------------|----------|
| Custom tool needs | Internal APIs |
| API integrations | Third-party services |
| Workflow automation | Custom tooling |

**Value**: Guides creation of well-designed MCP servers in Python (FastMCP) or TypeScript.

### webapp-testing
**Best for**: Testing web applications with Playwright

| Recommend When | Examples |
|----------------|----------|
| UI testing needs | Verify functionality |
| Visual debugging | Screenshot issues |
| Browser automation | Interactive testing |
| Console log analysis | Debug JS errors |

### skill-creator
**Best for**: Creating new skills for Claude

| Recommend When | Examples |
|----------------|----------|
| Repeatable workflows | Standardize processes |
| Domain expertise | Package knowledge |
| Team patterns | Share best practices |

---

## Collaboration Skills

### doc-coauthoring
**Best for**: Co-authoring documentation with users

| Recommend When | Examples |
|----------------|----------|
| Technical specs | RFC documents |
| Decision docs | ADRs |
| Proposals | Feature proposals |
| Documentation | User guides |

**Value**: Structured workflow for iterative document refinement.

### internal-comms
**Best for**: Writing internal communications

| Recommend When | Examples |
|----------------|----------|
| Status reports | Project updates |
| Announcements | Team comms |
| Incident reports | Post-mortems |
| FAQs | Knowledge sharing |

---

## Multimedia Skills

### slack-gif-creator
**Best for**: Creating animated GIFs for Slack

| Recommend When | Examples |
|----------------|----------|
| Team celebrations | Achievements |
| Demo animations | Feature previews |
| Fun reactions | Custom emoji-style GIFs |

---

## Quick Reference: Detection Patterns

| Look For | Suggests Skill |
|----------|---------------|
| Complex task, multiple files | Plan agent |
| "How does X work?" | Explore agent |
| `.docx` files or doc requests | docx skill |
| `.xlsx` files or spreadsheet work | xlsx skill |
| Presentation needs | pptx skill |
| PDF files to process | pdf skill |
| React/Vue/Angular components | frontend-design |
| UI design requests | canvas-design |
| Testing local web app | webapp-testing |
| "Build an MCP server" | mcp-builder |
| Documentation writing | doc-coauthoring |
| Internal announcement | internal-comms |
