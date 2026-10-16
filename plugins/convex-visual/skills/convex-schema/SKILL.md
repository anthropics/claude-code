---
name: convex-schema
description: Browse and visualize Convex database schemas. Use when exploring Convex tables, viewing document structure, understanding database relationships, or creating dashboards.
---

# Convex Schema Browser

Use the MCP tools to explore Convex databases interactively.

## When to use

- User asks to see their Convex schema
- User wants to browse tables or documents
- User needs to understand database structure
- User asks about table relationships
- User wants to visualize their data
- User asks for metrics or dashboard

## Available tools

### schema_browser

Interactive schema explorer with graph and list views.

**Parameters:**

- `table` (string, optional): Pre-select a specific table
- `showInferred` (boolean, default: true): Show inferred schemas
- `pageSize` (number, default: 50): Documents per page

### dashboard_view

Real-time metrics dashboard with charts.

**Parameters:**

- `metrics` (array): Metric definitions with aggregations
- `charts` (array): Chart configurations (line, bar, pie)
- `refreshInterval` (number, default: 5): Refresh interval in seconds

### schema_diagram

Mermaid ER diagrams showing table relationships.

**Parameters:**

- `theme` (string): Color theme (github-dark, dracula, nord, etc.)
- `ascii` (boolean): Use ASCII output for terminal
- `tables` (array): Specific tables to include

## Example prompts

- "Show me my Convex schema"
- "What tables do I have?"
- "Browse my database"
- "Show schema for the users table"
- "Generate a diagram of my schema"
- "Create a dashboard for my data"
- "Show me metrics for my app"
- "Visualize my database relationships"

## Requirements

- Convex project with `CONVEX_DEPLOY_KEY` configured
- Or run `npx convex-mcp-visual --setup` first
