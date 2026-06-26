# Data Source Value Map

This map explains why each account, integration, and connector matters.

## NeonPanel Account

A NeonPanel account gives Claude access to commerce operations workflows
through the NeonPanel MCP server.

## Amazon Integration

Connect Amazon here:

https://my.neonpanel.com/app/integrations/amazon

Enables:

- Catalog and ASIN context.
- Seller operations workflows.
- Inventory and replenishment analysis.
- Brand Analytics and keyword workflows where available.
- Advertising and search-term analysis where available.
- Financial, COGS, and margin workflows when supporting data is present.

Most impacted skills:

- Dorian for replenishment.
- Nina for supply chain and inventory.
- April for market intelligence.
- Mark for listing optimization.
- Marta and Sanjay for financial analysis.

## Shopify Integration

Connect Shopify here if applicable:

https://my.neonpanel.com/app/integrations/shopify

Enables:

- DTC/channel context.
- Customer/order context where available.
- Better cross-channel operational analysis.

## NeonaSphera Account And Workspace

Create or access NeonaSphera here:

https://my.neonasphera.com

Create a workspace in the interface, then connect:

https://admin.neonasphera.com/mcp

Enables:

- Shared Workspace collaboration.
- Workspace memory.
- File-memory workflows.
- Team context that Claude can use across sessions where authorized.

## Recommended Setup Order

1. Create/log into NeonPanel.
2. Connect Amazon.
3. Connect Shopify if relevant.
4. Add the NeonPanel MCP server in Claude.
5. Create/log into NeonaSphera if Shared Workspace or file memory matters.
6. Create a workspace.
7. Add the NeonaSphera MCP server in Claude.
8. Ask: "Help me decide which NeonPanel agent to use first."
