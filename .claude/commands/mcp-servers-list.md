---
allowed-tools: none
description: Display MCP server status and available tools
---

## Context

List all available MCP (Model Context Protocol) servers, their connection status, and tool counts.

## Your task

Display comprehensive information about MCP servers in the current environment.

### Information to Display

1. **Server Information**
   - Server name/ID
   - Description
   - Connection status (connected/disconnected/error)
   - Version information
   - Last connection time

2. **Tool Statistics**
   - Total number of tools provided
   - Tool categories/types
   - Most recently used tools

3. **Configuration**
   - Server endpoint/URL
   - Authentication method
   - Timeout settings
   - Rate limits

4. **Health Status**
   - Response time
   - Error rate
   - Availability percentage

### Output Format Options

- **--format <type>**: Output format (table/json/yaml)
- **--status <state>**: Filter by status (all/connected/disconnected/error)
- **--verbose**: Include detailed configuration and metrics
- **--sort <field>**: Sort by field (name/status/tools/response_time)

### Example Output (Default Table Format)

```
MCP Servers Status
==================
Last updated: 2024-12-30 14:35:22 UTC

┌─────────────────┬──────────┬───────┬────────────┬──────────────┬─────────────┐
│ Server          │ Status   │ Tools │ Response   │ Last Active  │ Error Rate  │
├─────────────────┼──────────┼───────┼────────────┼──────────────┼─────────────┤
│ github          │ ✓ Active │ 12    │ 125ms      │ 2 mins ago   │ 0.0%        │
│ ide             │ ✓ Active │ 8     │ 45ms       │ 30 secs ago  │ 0.0%        │
│ filesystem      │ ✓ Active │ 15    │ 10ms       │ 5 secs ago   │ 0.0%        │
│ web_browser     │ ✓ Active │ 6     │ 250ms      │ 10 mins ago  │ 0.2%        │
│ database        │ ⚠ Slow   │ 10    │ 2500ms     │ 1 hour ago   │ 5.1%        │
│ kubernetes      │ ✗ Down   │ 0     │ timeout    │ 2 days ago   │ 100%        │
└─────────────────┴──────────┴───────┴────────────┴──────────────┴─────────────┘

Summary: 6 servers | 4 active | 1 degraded | 1 down | 51 total tools
```

### Example Output (Verbose Mode)

```
MCP Servers Detailed Status
============================

GitHub MCP Server
-----------------
Status: Connected ✓
Version: 2.1.0
Endpoint: mcp://github.internal:9001
Authentication: OAuth2 (token valid)

Tools (12):
  • Issue Management: get_issue, update_issue, create_issue, close_issue
  • Pull Requests: get_pr, create_pr, merge_pr, review_pr
  • Repository: get_repo, list_repos, search_code, get_file

Performance Metrics:
  • Average Response Time: 125ms (p50: 100ms, p95: 200ms, p99: 350ms)
  • Request Rate: 45 req/min
  • Error Rate: 0.0% (0 errors in last 1000 requests)
  • Uptime: 99.99% (last 30 days)

Configuration:
  • Timeout: 30 seconds
  • Rate Limit: 5000 requests/hour
  • Retry Policy: 3 attempts with exponential backoff
  • Cache: Enabled (TTL: 300 seconds)

Recent Activity:
  • Last Request: 2 minutes ago (get_issue #6574)
  • Total Requests Today: 234
  • Most Used Tool: get_issue (45% of requests)

[Additional servers...]
```

### Example Output (JSON Format)

```json
{
  "timestamp": "2024-12-30T14:35:22Z",
  "servers": [
    {
      "id": "github",
      "name": "GitHub MCP Server",
      "status": "connected",
      "version": "2.1.0",
      "tools": {
        "count": 12,
        "categories": {
          "issues": 4,
          "pull_requests": 4,
          "repository": 4
        }
      },
      "metrics": {
        "response_time_ms": 125,
        "error_rate": 0.0,
        "uptime_percent": 99.99,
        "requests_today": 234
      },
      "configuration": {
        "endpoint": "mcp://github.internal:9001",
        "auth_type": "oauth2",
        "timeout_seconds": 30,
        "rate_limit": {
          "requests": 5000,
          "window": "hour"
        }
      }
    }
  ],
  "summary": {
    "total_servers": 6,
    "active": 4,
    "degraded": 1,
    "down": 1,
    "total_tools": 51
  }
}
```

### Monitoring Features

The command should also support:
- **--watch**: Continuously monitor server status with updates
- **--alert**: Show only servers with issues
- **--export <file>**: Export status to file for reporting

This command provides comprehensive visibility into MCP server health and availability without invoking any tools.