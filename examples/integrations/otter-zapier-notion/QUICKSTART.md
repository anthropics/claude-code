# Quick Start Guide: Otter.AI → Notion Automation

Get your Otter.AI transcriptions automatically saved to Notion in under 30 minutes.

## Overview

This automation will:
✅ Monitor Otter.AI for new meeting transcripts
✅ Process them with Claude for summaries and insights
✅ Save everything to your Notion database
✅ Run automatically after each meeting

## What You'll Need

- [ ] Otter.AI account
- [ ] Notion workspace
- [ ] Zapier account (free tier works)
- [ ] Claude Desktop installed
- [ ] 30 minutes setup time

## 5-Step Setup

### Step 1: Set Up Notion (5 minutes)

1. **Create a new database** in Notion
2. **Add these properties**:
   - Title (text)
   - Date (date)
   - Summary (text)
   - Transcript (text)
   - Participants (multi-select)
   - Status (select: New, Reviewed, Archived)

3. **Create integration**:
   - Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Click "New integration"
   - Name: "Otter Sync"
   - Copy the **integration token**

4. **Share database**:
   - In your database, click "Share"
   - Invite your "Otter Sync" integration

📖 **Detailed guide**: [notion-database-template.md](./notion-database-template.md)

### Step 2: Configure Claude Desktop (5 minutes)

1. **Open Claude Desktop**
2. **Go to Settings** → Developer → Edit Config
3. **Add this code** to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zapier-mcp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://actions.zapier.com/mcp/<YOUR_ENDPOINT>/sse"
      ]
    }
  }
}
```

4. **Restart Claude Desktop**

You'll get the `<YOUR_ENDPOINT>` in the next step.

### Step 3: Create Zapier MCP Server (5 minutes)

1. **Log in to Zapier**: [zapier.com](https://zapier.com)
2. **Navigate to**: Actions → MCP Servers
3. **Click**: "Create MCP Server"
4. **Select**: Claude Desktop
5. **Copy the endpoint URL** (looks like: `https://actions.zapier.com/mcp/abc123/sse`)
6. **Go back to Claude Desktop** and paste this URL in your config (see Step 2)

### Step 4: Create Zapier Workflow (10 minutes)

#### A. Set Up Trigger

1. **Create new Zap**: [zapier.com/app/editor](https://zapier.com/app/editor)
2. **Trigger**: Otter.ai → "New Transcript Created"
3. **Connect** your Otter.AI account
4. **Test trigger** to confirm it works

#### B. Add Claude Processing

1. **Action**: Webhooks by Zapier → POST
2. **URL**: Your MCP endpoint from Step 3
3. **Body**:
```json
{
  "transcript_text": "{{trigger.transcript}}",
  "title": "{{trigger.title}}",
  "date": "{{trigger.created_at}}"
}
```

**OR** use direct Claude API:

1. **Action**: Anthropic (Claude) → Send Prompt
2. **Prompt**:
```
Summarize this meeting transcript in 2-3 sentences, then list key points:

{{trigger.transcript}}
```

#### C. Add Notion Action

1. **Action**: Notion → Create Database Item
2. **Database**: Select your Transcripts database
3. **Map fields**:
   - Title: `{{trigger.title}}`
   - Date: `{{trigger.created_at}}`
   - Summary: `{{claude.response}}` (from previous step)
   - Transcript: `{{trigger.transcript}}`
   - Status: `New`

4. **Test** the action

### Step 5: Test & Activate (5 minutes)

1. **Record a test meeting** in Otter.AI (even just 30 seconds)
2. **Wait 5-10 minutes** for Otter to process
3. **Check Zapier** task history
4. **Verify entry** appears in Notion
5. **Turn on your Zap** ✅

## You're Done! 🎉

From now on:
- Record a meeting in Otter.AI
- Wait for transcription (usually 5-15 minutes)
- Find it automatically in your Notion database

## Customization Ideas

Once the basic setup works, enhance it:

### Extract Action Items

Update your Claude prompt to include:
```
Also extract any action items mentioned, formatted as:
- [ ] Task description (Owner: Name)
```

### Add Tags

Have Claude suggest tags:
```
Suggest 3-5 relevant tags for this meeting (e.g., Sales, Engineering, Strategy)
```

### Filter by Duration

In Zapier trigger, add filter:
- Only continue if Duration > 5 minutes

### Send Notifications

Add Slack or Email step:
- Notify team when important meetings are transcribed

## Troubleshooting

### "Zapier can't find my Notion database"
- ✅ Ensure database is shared with your integration
- ✅ Refresh database list in Zapier
- ✅ Check integration has "Can edit" permissions

### "MCP connection failed"
- ✅ Verify endpoint URL is correct in config
- ✅ Restart Claude Desktop
- ✅ Check Claude Desktop logs

### "Transcript not appearing in Notion"
- ✅ Check Zapier task history for errors
- ✅ Verify all required Notion fields are mapped
- ✅ Test each Zap step individually

### "Claude processing is slow"
- ⚠️ Long transcripts take more time
- ⚠️ Consider using Claude 3 Haiku for faster (cheaper) processing
- ⚠️ Simplify your prompt

## Get Full Details

- **Complete setup**: [README.md](./README.md)
- **Zapier workflow**: [zapier-workflow.md](./zapier-workflow.md)
- **Notion database**: [notion-database-template.md](./notion-database-template.md)
- **Config examples**: [claude_desktop_config.json](./claude_desktop_config.json)

## Support

Need help?
- 📖 Read the detailed guides above
- 💬 Check [Zapier MCP Guide](https://zapier.com/blog/zapier-mcp-guide/)
- 🔧 Review [Claude Desktop Docs](https://docs.anthropic.com/en/docs/claude-code/overview)

## What's Next?

Now that you have automatic transcription saving:

1. **Create views** in Notion:
   - Recent meetings
   - Needs review
   - By participant

2. **Add automations**:
   - Auto-archive old transcripts
   - Create tasks from action items
   - Send weekly digest emails

3. **Integrate more tools**:
   - Link to project management (Asana, Jira)
   - Connect to CRM (Salesforce, HubSpot)
   - Sync with calendar (Google, Outlook)

Happy automating! 🚀
