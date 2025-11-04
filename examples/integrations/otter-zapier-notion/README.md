# Otter.AI to Notion Automation via Zapier MCP

This guide shows you how to automatically download and save Otter.AI transcriptions to Notion using Claude Desktop with Zapier MCP integration. After each call or meeting ends in Otter.AI, the transcript will be automatically processed and saved to your Notion workspace.

## Overview

This automation workflow:
1. Monitors Otter.AI for new transcriptions
2. Triggers when a call/meeting ends and transcription is complete
3. Uses Zapier MCP to connect Otter.AI with Claude Desktop
4. Processes and formats the transcript
5. Automatically saves it to your Notion database

## Prerequisites

- **Claude Desktop** installed on your machine
- **Otter.AI** account with active transcriptions
- **Notion** account with API access
- **Zapier** account (free or paid plan)
- **Node.js** 18+ installed (for MCP)

## Architecture

```
Otter.AI (New Transcript)
    ↓
Zapier Trigger
    ↓
Zapier MCP Server
    ↓
Claude Desktop (Process & Format)
    ↓
Notion API (Save to Database)
```

## Quick Start

### 1. Set Up Zapier MCP Integration

#### Create Zapier MCP Server

1. Log in to [Zapier](https://zapier.com)
2. Navigate to **Actions** → **MCP Servers**
3. Click **Create MCP Server**
4. Select **Claude Desktop** as the client
5. Copy your unique MCP endpoint URL (format: `https://actions.zapier.com/mcp/<your-id>/sse`)

### 2. Configure Claude Desktop

#### Edit Configuration File

1. Open Claude Desktop
2. Go to **Settings** → **Developer** (or **Integrations**)
3. Click **Edit Config** to open `claude_desktop_config.json`

#### Add MCP Server Configuration

Add the following to your configuration file:

```json
{
  "mcpServers": {
    "zapier-mcp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://actions.zapier.com/mcp/<your-endpoint-id>/sse"
      ]
    }
  }
}
```

Replace `<your-endpoint-id>` with your actual Zapier MCP endpoint ID.

#### Restart Claude Desktop

Close and reopen Claude Desktop to load the new MCP configuration.

### 3. Create Zapier Workflow (Zap)

#### Set Up Trigger

1. In Zapier, create a new **Zap**
2. **Trigger**: Choose **Otter.ai**
3. **Event**: Select **New Transcript Created** or **Transcript Completed**
4. Connect your Otter.AI account
5. Test the trigger to ensure it can access your transcripts

#### Configure Action

1. **Action**: Choose **Anthropic (Claude)** or **Webhooks** (to send to MCP)
2. **Event**: Select **Send Prompt** or **POST Request**
3. Configure the action to:
   - Extract transcript text from Otter.AI
   - Send to Claude Desktop via MCP
   - Format for Notion

#### Add Notion Integration

1. Add another **Action** step
2. **Action**: Choose **Notion**
3. **Event**: Select **Create Database Item** or **Create Page**
4. Map fields:
   - **Title**: Meeting name or transcript title
   - **Content**: Formatted transcript text
   - **Date**: Transcript date
   - **Participants**: Meeting attendees (if available)
   - **Tags**: Custom tags or categories

5. Test the complete workflow

### 4. Set Up Notion Database

#### Create Transcripts Database

1. Open Notion
2. Create a new database with these properties:
   - **Title** (Title field) - Meeting/transcript name
   - **Date** (Date field) - When the meeting occurred
   - **Transcript** (Text field) - Full transcript content
   - **Summary** (Text field) - AI-generated summary
   - **Participants** (Multi-select) - Meeting attendees
   - **Duration** (Number) - Meeting length in minutes
   - **Source** (Select) - "Otter.AI"
   - **Status** (Select) - "New", "Reviewed", "Archived"

#### Get Notion Integration Token

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **New Integration**
3. Name it "Otter Transcript Sync"
4. Select your workspace
5. Copy the **Internal Integration Token**
6. Share your Transcripts database with this integration

## Configuration Examples

See the following files for detailed configuration examples:

- [`claude_desktop_config.json`](./claude_desktop_config.json) - Complete Claude Desktop configuration
- [`zapier-workflow.md`](./zapier-workflow.md) - Detailed Zapier workflow setup
- [`notion-database-template.md`](./notion-database-template.md) - Notion database structure

## Usage

Once configured, the automation works automatically:

1. **Record a meeting** in Otter.AI
2. **End the call** - Otter.AI processes the transcription
3. **Zapier detects** the new transcript (usually within 1-15 minutes)
4. **Claude Desktop receives** the transcript via MCP
5. **Transcript is formatted** and enhanced with:
   - Summary
   - Key points
   - Action items
   - Speaker identification
6. **Saved to Notion** in your Transcripts database

## Advanced Features

### Custom Transcript Processing

You can enhance the transcript processing by configuring Claude to:

- **Extract action items** automatically
- **Generate meeting summaries** with key takeaways
- **Identify decisions made** during the meeting
- **Tag topics** discussed
- **Create follow-up tasks** in Notion

### Example Prompt Template

In your Zapier action, use this prompt template:

```
Process this Otter.AI transcript and format it for Notion:

Transcript:
{{transcript_text}}

Meeting Info:
- Title: {{meeting_title}}
- Date: {{meeting_date}}
- Duration: {{duration}} minutes
- Participants: {{participants}}

Please provide:
1. A concise summary (2-3 sentences)
2. Key discussion points (bullet list)
3. Decisions made
4. Action items with owners (if mentioned)
5. Topics/tags for categorization

Format the output as JSON for Notion database import.
```

### Filtering Transcripts

Configure your Zapier trigger to only process specific transcripts:

- **By duration**: Only meetings longer than X minutes
- **By participants**: Only meetings with specific attendees
- **By keywords**: Only transcripts containing certain terms
- **By folder**: Only transcripts in specific Otter.AI folders

## Troubleshooting

### MCP Connection Issues

If Claude Desktop cannot connect to Zapier MCP:

1. **Check logs**:
   ```bash
   # macOS
   tail -n 20 -F ~/Library/Logs/Claude/mcp*.log

   # Windows
   type %APPDATA%\Claude\logs\mcp*.log

   # Linux
   tail -n 20 -F ~/.config/Claude/logs/mcp*.log
   ```

2. **Clear MCP cache**:
   ```bash
   rm -rf ~/.mcp-auth
   ```

3. **Verify endpoint URL** in your configuration
4. **Restart Claude Desktop**

### Zapier Trigger Not Firing

- Verify Otter.AI account connection in Zapier
- Check if test transcripts are being created
- Review Zapier task history for errors
- Ensure Zap is turned ON

### Notion Integration Failures

- Verify integration token is correct
- Check that database is shared with the integration
- Ensure all required fields exist in the database
- Review Zapier error logs for specific field issues

### Transcript Formatting Issues

- Check Claude Desktop MCP connection status
- Verify the prompt template in Zapier
- Test with a shorter transcript first
- Review Claude Desktop logs for processing errors

## Security Considerations

- **API Keys**: Store Notion and Zapier API keys securely
- **Transcript Privacy**: Ensure your Otter.AI and Notion workspaces have appropriate access controls
- **MCP Authentication**: The MCP endpoint includes authentication tokens - keep them private
- **Data Retention**: Configure Notion retention policies per your organization's requirements

## Cost Considerations

- **Otter.AI**: Check your plan's transcription limits
- **Zapier**: Free plan includes 100 tasks/month; paid plans for more volume
- **Claude API**: MCP usage may consume API credits depending on your plan
- **Notion**: Most plans support unlimited pages and databases

## Support and Resources

- [Zapier MCP Documentation](https://zapier.com/blog/zapier-mcp-guide/)
- [Claude Desktop MCP Guide](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Otter.AI API Documentation](https://otter.ai/developer)
- [Notion API Documentation](https://developers.notion.com/)

## Example Workflow Results

After setup, each Otter.AI transcript will appear in Notion like this:

**Example Notion Page**:
```
Title: Weekly Team Sync - Nov 4, 2025
Date: November 4, 2025
Duration: 45 minutes
Participants: Alice, Bob, Carol
Status: New
Source: Otter.AI

Summary:
Team discussed Q4 roadmap priorities, resolved blocker on API integration,
and aligned on sprint goals for next two weeks.

Key Points:
• Q4 focus: Complete API v2 migration
• Blocker resolved: Database connection issue fixed
• Sprint goals: 3 features for next iteration

Decisions:
• Approved moving forward with new architecture
• Agreed to weekly sync schedule

Action Items:
• Alice: Review API documentation by Friday
• Bob: Deploy hotfix by EOD
• Carol: Schedule design review for next week

[Full Transcript]
Speaker 1 (Alice): Good morning everyone...
[...]
```

## License

This integration guide is provided as-is for educational and automation purposes. Ensure compliance with each service's terms of service.
