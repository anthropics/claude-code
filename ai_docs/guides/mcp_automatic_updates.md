# MCP Tools Automatic Updates Guide

This guide explains how to use the automatic update system for MCP (Model Context Protocol) tools in the SAAR framework.

## Overview

The MCP Tools Automatic Update System provides:

- Scheduled automatic updates of MCP tools
- Version monitoring for all MCP tools
- Health checks after updates
- Automatic rollback of failed updates
- Detailed logging and status reporting

## Getting Started

The MCP Tools Automatic Update System is installed as part of the standard SAAR setup process. It configures default settings for weekly automatic updates during off-hours.

To check if the automatic update system is installed and running:

```bash
./saar.sh status
```

Look for the "MCP Update System" section in the output.

## Commands

The SAAR framework provides several commands for working with the MCP automatic update system:

### Checking for Updates

To check for available MCP tool updates:

```bash
./saar.sh check-mcp-updates
```

This will scan your installed MCP tools and compare them with the latest available versions. It will display a list of tools that can be updated.

### Updating MCP Tools

To update all MCP tools manually:

```bash
./saar.sh update-mcp
```

This command will:
1. Check for available updates
2. Download and install updates
3. Run health checks on updated tools
4. Rollback any tools that fail health checks (if enabled)

### Configuring Automatic Updates

To configure the automatic update system settings:

```bash
./saar.sh configure-mcp-update
```

This will launch an interactive wizard where you can set:

- Update frequency (daily, weekly, monthly, or manual)
- Update time
- Auto-restart option after updates
- Critical tools only option
- Health check settings
- Automatic rollback settings

### Viewing Update Status

To view the current update status:

```bash
./saar.sh check-mcp-updates status
```

This will show you:
- Whether updates are enabled
- The update frequency
- When the last check and update occurred
- Whether any updates are due

### Enabling/Disabling Automatic Updates

To enable automatic updates:

```bash
./saar.sh check-mcp-updates enable
```

To disable automatic updates:

```bash
./saar.sh check-mcp-updates disable
```

## Understanding Update Settings

### Update Frequency

- **daily**: Check for and apply updates once per day
- **weekly**: Check for and apply updates once per week on the specified day
- **monthly**: Check for and apply updates once per month on the specified day
- **manual**: Never automatically update, only update when manually triggered

### Critical Tools Only

When enabled, this setting ensures that only tools marked as "critical" in the tool registry will be automatically updated. This reduces the risk of system disruption by limiting updates to essential components.

### Health Checks

The system can perform health checks on tools after updating to ensure they're functioning properly. This verifies that:

1. The tool can be started
2. The tool responds correctly to basic commands
3. There are no critical errors in the tool's operation

### Automatic Rollback

If health checks fail, the system can automatically roll back to the previous version of the tool. This ensures your system remains operational even if an update introduces issues.

## Update Logs

Update logs are stored in:

```
$HOME/.claude/mcp/logs/updates.log
```

These logs include detailed information about each update operation, including which tools were updated, any failures, and the results of health checks.

## Customizing MCP Tools

The MCP tools that are monitored and updated are defined in the tool registry file:

```
$HOME/.claude/mcp/tools_registry.json
```

You can edit this file to add, remove, or modify MCP tools. Each tool has the following properties:

- `category`: Tool category for organization
- `description`: Human-readable description
- `package`: NPM package name
- `fallback`: Path to local fallback implementation (if any)
- `importance`: Tool importance ("critical", "high", "medium", "low")

Tools marked as "critical" will always be updated, even when the "criticalToolsOnly" setting is enabled.

## Troubleshooting

If you encounter issues with automatic updates:

1. Check the update logs at `$HOME/.claude/mcp/logs/updates.log`
2. Ensure you have appropriate permissions to install packages
3. Verify your connection to npm and other package repositories
4. Check that the tool registry contains the correct package information

If an update fails, you can try:

```bash
./saar.sh update-mcp
```

to manually trigger an update with verbose logging.

If the automatic update system itself is not working, you can reinstall it with:

```bash
./saar.sh setup
```

## Advanced Usage

### Manual Update Script

You can directly execute the update script for more control:

```bash
node $HOME/.claude/mcp/update_mcp_tools.js
```

### Cron Job Management

The automatic update system uses cron jobs to schedule updates. You can view the current cron job with:

```bash
crontab -l | grep update_mcp_tools
```

If you need to modify the schedule manually, you can edit the crontab:

```bash
crontab -e
```

And look for the line containing `update_mcp_tools.js`.

## Conclusion

The MCP Tools Automatic Update System ensures your MCP tools stay current with minimal manual intervention. By configuring the system to match your needs, you can balance staying current with stability requirements.