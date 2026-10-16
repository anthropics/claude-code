# MCP Server Recommendations

MCP (Model Context Protocol) servers extend Claude's capabilities by connecting to external tools and services.

## Setup & Team Sharing

**Connection methods:**
1. **Project config** (`.mcp.json`) - Available only in that directory
2. **Global config** (`~/.claude.json`) - Available across all projects
3. **Checked-in `.mcp.json`** - Available to entire team (recommended!)

**Tip**: Check `.mcp.json` into git so your whole team gets the same MCP servers.

**Debugging**: Use `claude --mcp-debug` to identify configuration issues.

## Documentation & Knowledge

### context7
**Best for**: Projects using popular libraries/SDKs where you want Claude to code with up-to-date documentation

| Recommend When | Examples |
|----------------|----------|
| Using React, Vue, Angular | Frontend frameworks |
| Using Express, FastAPI, Django | Backend frameworks |
| Using Prisma, Drizzle | ORMs |
| Using Stripe, Twilio, SendGrid | Third-party APIs |
| Using AWS SDK, Google Cloud | Cloud SDKs |
| Using LangChain, OpenAI SDK | AI/ML libraries |

**Value**: Claude fetches live documentation instead of relying on training data, reducing hallucinated APIs and outdated patterns.

---

## Browser & Frontend

### Playwright MCP
**Best for**: Frontend projects needing browser automation, testing, or screenshots

| Recommend When | Examples |
|----------------|----------|
| React/Vue/Angular app | UI component testing |
| E2E tests needed | User flow validation |
| Visual regression testing | Screenshot comparisons |
| Debugging UI issues | See what user sees |
| Form testing | Multi-step workflows |

**Value**: Claude can interact with your running app, take screenshots, fill forms, and verify UI behavior.

### Puppeteer MCP
**Best for**: Headless browser automation, web scraping

| Recommend When | Examples |
|----------------|----------|
| PDF generation from HTML | Report generation |
| Web scraping tasks | Data extraction |
| Headless testing | CI environments |

---

## Databases

### Supabase MCP
**Best for**: Projects using Supabase for backend/database

| Recommend When | Examples |
|----------------|----------|
| Supabase project detected | `@supabase/supabase-js` in deps |
| Auth + database needs | User management apps |
| Real-time features | Live data sync |

**Value**: Claude can query tables, manage auth, and interact with Supabase storage directly.

### PostgreSQL MCP
**Best for**: Direct PostgreSQL database access

| Recommend When | Examples |
|----------------|----------|
| Raw PostgreSQL usage | No ORM layer |
| Database migrations | Schema management |
| Data analysis tasks | Complex queries |
| Debugging data issues | Inspect actual data |

### Neon MCP
**Best for**: Neon serverless Postgres users

### Turso MCP
**Best for**: Turso/libSQL edge database users

---

## Version Control & DevOps

### GitHub MCP
**Best for**: GitHub-hosted repositories needing issue/PR integration

| Recommend When | Examples |
|----------------|----------|
| GitHub repository | `.git` with GitHub remote |
| Issue-driven development | Reference issues in commits |
| PR workflows | Review, merge operations |
| GitHub Actions | CI/CD pipeline access |
| Release management | Tag and release automation |

**Value**: Claude can create issues, review PRs, check workflow runs, and manage releases.

### GitLab MCP
**Best for**: GitLab-hosted repositories

### Linear MCP
**Best for**: Teams using Linear for issue tracking

| Recommend When | Examples |
|----------------|----------|
| Linear workspace | Issue references like `ABC-123` |
| Sprint planning | Backlog management |
| Issue creation from code | Auto-create issues for TODOs |

---

## Cloud Infrastructure

### AWS MCP
**Best for**: AWS infrastructure management

| Recommend When | Examples |
|----------------|----------|
| AWS SDK in dependencies | `@aws-sdk/*` packages |
| Infrastructure as code | Terraform, CDK, SAM |
| Lambda development | Serverless functions |
| S3, DynamoDB usage | Cloud data services |

### Cloudflare MCP
**Best for**: Cloudflare Workers, Pages, R2, D1

| Recommend When | Examples |
|----------------|----------|
| Cloudflare Workers | Edge functions |
| Pages deployment | Static site hosting |
| R2 storage | Object storage |
| D1 database | Edge SQL database |

### Vercel MCP
**Best for**: Vercel deployment and configuration

---

## Monitoring & Observtic

### Sentry MCP
**Best for**: Error tracking and debugging

| Recommend When | Examples |
|----------------|----------|
| Sentry configured | `@sentry/*` in deps |
| Production debugging | Investigate errors |
| Error patterns | Group similar issues |
| Release tracking | Correlate deploys with errors |

**Value**: Claude can investigate Sentry issues, find root causes, and suggest fixes.

### Datadog MCP
**Best for**: APM, logs, and metrics

---

## Communication

### Slack MCP
**Best for**: Slack workspace integration

| Recommend When | Examples |
|----------------|----------|
| Team uses Slack | Send notifications |
| Deployment notifications | Alert channels |
| Incident response | Post updates |

### Notion MCP
**Best for**: Notion workspace for documentation

| Recommend When | Examples |
|----------------|----------|
| Notion for docs | Read/update pages |
| Knowledge base | Search documentation |
| Meeting notes | Create summaries |

---

## File & Data

### Filesystem MCP
**Best for**: Enhanced file operations beyond built-in tools

| Recommend When | Examples |
|----------------|----------|
| Complex file operations | Batch processing |
| File watching | Monitor changes |
| Advanced search | Custom patterns |

### Memory MCP
**Best for**: Persistent memory across sessions

| Recommend When | Examples |
|----------------|----------|
| Long-running projects | Remember context |
| User preferences | Store settings |
| Learning patterns | Build knowledge |

**Value**: Claude remembers project context, decisions, and patterns across conversations.

---

## Containers & DevOps

### Docker MCP
**Best for**: Container management

| Recommend When | Examples |
|----------------|----------|
| Docker Compose file | Container orchestration |
| Dockerfile present | Build images |
| Container debugging | Inspect logs, exec |

### Kubernetes MCP
**Best for**: Kubernetes cluster management

| Recommend When | Examples |
|----------------|----------|
| K8s manifests | Deploy, scale pods |
| Helm charts | Package management |
| Cluster debugging | Pod logs, status |

---

## AI & ML

### Exa MCP
**Best for**: Web search and research

| Recommend When | Examples |
|----------------|----------|
| Research tasks | Find current info |
| Competitive analysis | Market research |
| Documentation gaps | Find examples |

---

## Quick Reference: Detection Patterns

| Look For | Suggests MCP Server |
|----------|-------------------|
| Popular npm packages | context7 |
| React/Vue/Next.js | Playwright MCP |
| `@supabase/supabase-js` | Supabase MCP |
| `pg` or `postgres` | PostgreSQL MCP |
| GitHub remote | GitHub MCP |
| `.linear` or Linear refs | Linear MCP |
| `@aws-sdk/*` | AWS MCP |
| `@sentry/*` | Sentry MCP |
| `docker-compose.yml` | Docker MCP |
| Slack webhook URLs | Slack MCP |
| `@anthropic-ai/sdk` | context7 for Anthropic docs |
