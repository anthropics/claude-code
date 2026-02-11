# Analytics Integration

Covers integration with analytics platforms: Amplitude, Mixpanel, PostHog, and similar.

## What It Enables

| Agent | Capabilities |
|-------|-------------|
| @value-realization | Pull adoption metrics, feature usage data |
| @bizops | Access KPIs, conversion funnels, business metrics |
| @ci | Pull competitive usage data, market signals |
| @pm | Check feature adoption post-launch |

## MCP Servers

Several analytics MCP servers are available:

| Platform | Package | Notes |
|----------|---------|-------|
| Amplitude | Community MCP servers | Check npmjs.com for latest |
| Mixpanel | Community MCP servers | Check npmjs.com for latest |
| PostHog | Community MCP servers | Check npmjs.com for latest |
| Generic SQL | `@anthropic/mcp-postgres` | Query analytics warehouse directly |

## Setup Pattern

### 1. Install the Relevant Package

```bash
npm install -g @package/analytics-mcp-server
```

### 2. Configure `.mcp.json`

```json
{
  "mcpServers": {
    "analytics": {
      "command": "npx",
      "args": ["@package/analytics-mcp-server"],
      "env": {
        "API_KEY": "your-analytics-api-key",
        "PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

### 3. Verify

Ask your AI assistant to query a known metric to confirm the connection.

## Agent Workflows

### Outcome Reviews
When @value-realization runs `/outcome-review`:
- Pulls actual adoption metrics for the feature
- Compares against success criteria defined in the original bet
- Shows trend data over the evaluation period

### KPI Tracking
When @bizops reviews business performance:
- Pulls funnel conversion rates
- Shows retention cohort data
- Compares current period to targets

### Post-Launch Checks
When @pm reviews feature performance:
- Checks feature adoption rate
- Reviews user engagement metrics
- Identifies drop-off points in user flows

## Alternative: SQL Warehouse

If your analytics data lives in a data warehouse (PostgreSQL, BigQuery, Snowflake), you can use a SQL MCP server instead:

```json
{
  "mcpServers": {
    "analytics-db": {
      "command": "npx",
      "args": ["@anthropic/mcp-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@host:5432/analytics"
      }
    }
  }
}
```

This lets agents write SQL queries against your analytics tables directly.
