# convex-visual

Visual schema browser, dashboard, and ER diagrams for Convex databases. Opens interactive browser UIs alongside terminal output.

## Contents

| Type           | Name            | Description                                      |
| -------------- | --------------- | ------------------------------------------------ |
| **MCP Server** | `convex-visual` | Provides 3 tools for database exploration        |
| **Skill**      | `convex-schema` | Auto-invoked when users ask about Convex schemas |

## Tools

### schema_browser

Interactive schema explorer with graph view, list view, and document browser.

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

## Installation

The plugin uses an MCP server published to npm. After installing the plugin, run the setup wizard in your Convex project:

```bash
npx convex-mcp-visual --setup
```

This saves your deploy key to `.env.local` in your project folder.

Or set the environment variable manually:

```bash
export CONVEX_DEPLOY_KEY="prod:your-deployment|your-key"
```

Get your deploy key from [dashboard.convex.dev](https://dashboard.convex.dev) under Settings > Deploy Keys.

## Usage Examples

| What you say                          | Tool triggered                    |
| ------------------------------------- | --------------------------------- |
| "Show me my Convex schema"            | `schema_browser` (graph view)     |
| "What tables do I have?"              | `schema_browser` (graph view)     |
| "Browse my database"                  | `schema_browser` (graph view)     |
| "Show schema for users table"         | `schema_browser` with table param |
| "Create a dashboard for my data"      | `dashboard_view`                  |
| "Show me metrics for my app"          | `dashboard_view`                  |
| "Generate a diagram of my schema"     | `schema_diagram`                  |
| "Visualize my database relationships" | `schema_diagram`                  |

All tools open an interactive browser UI on localhost:3456 and return output to the terminal.

## Requirements

- A Convex project with tables defined
- A deploy key from your Convex dashboard

## Links

- [npm package](https://www.npmjs.com/package/convex-mcp-visual)
- [GitHub repository](https://github.com/waynesutton/convex-mcp-visual)
- [Convex documentation](https://docs.convex.dev)
