# MCP Server Status

Check the status of all MCP (Model Context Protocol) servers in the environment.

## Usage
/mcp-status

## Parameters
None

## Example
/mcp-status

The command will:
1. Check for running MCP server processes
2. Verify connectivity to each server
3. Display status information for each server
4. Show port information for active servers

A formatted table showing:
- Server name
- Status (Running/Not Running)
- Connection status (Connected/Failed)
- Port number (if active)
- Startup time and uptime

If servers show as not running or not connected, consider:
- Checking server logs for errors
- Verifying API keys are properly configured
- Restarting failed servers with the appropriate commands