# Setup Checklist

Use this checklist to guide a new user through setup.

## 1. Confirm Accounts

Ask:

- Do you already have a NeonPanel account?
- Do you already have a NeonaSphera account?
- Are you setting up commerce data, shared workspace memory, or both?

## 2. NeonPanel Setup

If the user does not have a NeonPanel account, send them to:

https://my.neonpanel.com/register

If they do have an account, ask which channels they use.

Required for Amazon seller workflows:

https://my.neonpanel.com/app/integrations/amazon

Optional if they use Shopify:

https://my.neonpanel.com/app/integrations/shopify

Then connect the NeonPanel MCP server in Claude with Add Custom Connector:

https://mcp.neonpanel.com/mcp

## 3. NeonaSphera Setup

If the user does not have a NeonaSphera account, send them to:

https://my.neonasphera.com

After signup/login, they should create a workspace in the interface. For
Shared Workspace, memory, and file-memory workflows, connect the NeonaSphera
MCP server in Claude with Add Custom Connector:

https://admin.neonasphera.com/mcp

## 4. Verify

Ask the user to run one verification prompt per connected system:

- NeonPanel: "Check whether my NeonPanel account is connected."
- NeonaSphera: "Check whether you can access my NeonaSphera workspace."
