# Zapier Workflow Configuration Guide

This guide provides detailed step-by-step instructions for creating a Zapier workflow (Zap) that automatically transfers Otter.AI transcriptions to Notion via Claude Desktop.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create MCP Server in Zapier](#step-1-create-mcp-server-in-zapier)
3. [Step 2: Set Up Otter.AI Trigger](#step-2-set-up-otterai-trigger)
4. [Step 3: Configure Claude Processing](#step-3-configure-claude-processing)
5. [Step 4: Add Notion Action](#step-4-add-notion-action)
6. [Step 5: Testing and Activation](#step-5-testing-and-activation)
7. [Advanced Configurations](#advanced-configurations)

## Prerequisites

Before starting, ensure you have:

- Active Zapier account (free or paid)
- Otter.AI account with transcription access
- Notion workspace with admin permissions
- Claude Desktop installed and configured
- API keys and tokens ready

## Step 1: Create MCP Server in Zapier

### 1.1 Navigate to MCP Servers

1. Log in to [Zapier](https://zapier.com)
2. Click on **Actions** in the left sidebar
3. Select **MCP Servers** from the dropdown
4. Click **Create MCP Server** button

### 1.2 Configure MCP Server

1. **Server Name**: Enter "Claude Desktop - Otter Transcripts"
2. **Client Type**: Select **Claude Desktop**
3. **Description**: "Processes Otter.AI transcriptions and saves to Notion"
4. Click **Create Server**

### 1.3 Get Endpoint URL

After creation, you'll see:
- **Endpoint URL**: `https://actions.zapier.com/mcp/<unique-id>/sse`
- **API Key**: (automatically generated)

**Important**: Copy both the endpoint URL and API key. You'll need these for Claude Desktop configuration.

## Step 2: Set Up Otter.AI Trigger

### 2.1 Create New Zap

1. Go to [Zapier Dashboard](https://zapier.com/app/dashboard)
2. Click **Create Zap**
3. Name your Zap: "Otter.AI → Claude → Notion"

### 2.2 Configure Trigger

1. **Choose App**: Search for and select **Otter.ai**
2. **Choose Trigger Event**: Select one of:
   - **New Transcript Created** (triggers when transcript is ready)
   - **Transcript Updated** (triggers when transcript is edited)
   - Recommended: **New Transcript Created**

3. **Connect Account**:
   - Click **Sign in to Otter.ai**
   - Enter your Otter.AI credentials
   - Authorize Zapier to access your transcripts

4. **Configure Trigger Settings**:
   - **Folder Filter** (optional): Select specific Otter.AI folders
   - **Minimum Duration** (optional): Only trigger for meetings longer than X minutes
   - Example: Set to 5 to skip very short recordings

### 2.3 Test Trigger

1. Click **Test Trigger**
2. Zapier will fetch a recent transcript from your Otter.AI account
3. Review the sample data to ensure it contains:
   - Transcript ID
   - Title
   - Transcript text
   - Date/time
   - Duration
   - Participants (if available)

4. Click **Continue** if test is successful

## Step 3: Configure Claude Processing

### 3.1 Add Claude Action

1. Click **+** to add a new action step
2. **Choose App**: Search for **Webhooks by Zapier** or **HTTP** module
3. **Action Event**: Select **POST Request**

### 3.2 Configure Webhook to MCP

1. **URL**: Enter your MCP endpoint from Step 1.3
2. **Method**: POST
3. **Headers**:
   ```
   Content-Type: application/json
   Authorization: Bearer <YOUR_ZAPIER_API_KEY>
   ```

4. **Body** (JSON format):
   ```json
   {
     "action": "process_transcript",
     "transcript": {
       "id": "{{trigger.transcript_id}}",
       "title": "{{trigger.title}}",
       "text": "{{trigger.transcript}}",
       "date": "{{trigger.created_at}}",
       "duration": "{{trigger.duration}}",
       "participants": "{{trigger.participants}}"
     },
     "processing_instructions": {
       "generate_summary": true,
       "extract_action_items": true,
       "identify_key_points": true,
       "detect_speakers": true,
       "create_tags": true
     },
     "output_format": "notion"
   }
   ```

5. **Data Passthrough**: Enable this to receive Claude's processed output

### 3.3 Alternative: Direct Claude API Integration

If you prefer using Claude API directly:

1. **Choose App**: Search for **Anthropic (Claude)**
2. **Action Event**: Select **Send Prompt**
3. **Connect Account**: Enter your Anthropic API key
4. **Configure Prompt**:

   ```
   Process this Otter.AI meeting transcript for Notion database entry:

   Meeting Title: {{trigger.title}}
   Date: {{trigger.created_at}}
   Duration: {{trigger.duration}} minutes
   Participants: {{trigger.participants}}

   Full Transcript:
   {{trigger.transcript}}

   Please analyze and provide:
   1. A concise 2-3 sentence summary
   2. 5-7 key discussion points as bullet points
   3. All decisions made during the meeting
   4. Action items with responsible parties (if mentioned)
   5. 3-5 relevant tags for categorization
   6. Sentiment analysis (positive, neutral, negative)

   Format your response as JSON with this structure:
   {
     "summary": "...",
     "key_points": ["...", "..."],
     "decisions": ["...", "..."],
     "action_items": [
       {"task": "...", "owner": "...", "deadline": "..."}
     ],
     "tags": ["...", "...", "..."],
     "sentiment": "positive|neutral|negative"
   }
   ```

5. **Model**: Select **Claude 3.5 Sonnet** or **Claude 3 Opus**
6. **Max Tokens**: 4000 (sufficient for most transcripts)

### 3.4 Test Action

1. Click **Test Action**
2. Verify Claude processes the sample transcript
3. Check that the output includes all requested fields
4. Click **Continue**

## Step 4: Add Notion Action

### 4.1 Add Notion Step

1. Click **+** to add another action
2. **Choose App**: Search for and select **Notion**
3. **Action Event**: Select **Create Database Item**

### 4.2 Connect Notion Account

1. Click **Sign in to Notion**
2. Select your Notion workspace
3. Authorize Zapier to access your databases

### 4.3 Select Database

1. **Database**: Choose your "Transcripts" database
   - If not visible, ensure the database is shared with your Notion integration
   - You may need to refresh the database list

### 4.4 Map Fields

Map the Zapier data to your Notion database properties:

#### Basic Fields

- **Title** (Title property):
  ```
  {{trigger.title}} - {{trigger.created_at_formatted}}
  ```

- **Date** (Date property):
  ```
  {{trigger.created_at}}
  ```

- **Duration** (Number property):
  ```
  {{trigger.duration}}
  ```

#### Processed Content (from Claude)

If using Webhooks/MCP:
- **Summary** (Text property):
  ```
  {{action.summary}}
  ```

- **Key Points** (Text property):
  ```
  {{action.key_points}}
  ```

- **Decisions** (Text property):
  ```
  {{action.decisions}}
  ```

- **Action Items** (Text property):
  ```
  {{action.action_items}}
  ```

If using direct Claude API:
- Parse the JSON response and map each field
- Use **Format** step if needed to extract JSON fields

#### Additional Fields

- **Participants** (Multi-select):
  ```
  {{trigger.participants}}
  ```
  Note: Format as comma-separated values

- **Source** (Select):
  ```
  Otter.AI
  ```

- **Status** (Select):
  ```
  New
  ```

- **Tags** (Multi-select):
  ```
  {{action.tags}}
  ```

- **Transcript** (Text property):
  ```
  {{trigger.transcript}}
  ```

- **Otter Link** (URL property):
  ```
  {{trigger.url}}
  ```

### 4.5 Advanced Field Mapping

For complex fields, you may need to add a **Formatter** step:

1. Add **Format** step between Claude and Notion
2. **Action**: **Text → Split Text** or **Utilities → Line-item to Text**
3. Configure to split arrays into comma-separated text
4. Use formatted output in Notion fields

### 4.6 Test Notion Action

1. Click **Test Action**
2. Check your Notion database for the new test entry
3. Verify all fields are populated correctly
4. Make adjustments if needed

## Step 5: Testing and Activation

### 5.1 Complete End-to-End Test

1. Create a test recording in Otter.AI
   - Record a short 1-2 minute meeting
   - Add a clear title
   - Wait for transcription to complete

2. Monitor Zapier Task History
   - Go to **Zap History** in Zapier
   - Wait for the Zap to trigger (may take 1-15 minutes)
   - Click on the task to see details

3. Verify each step:
   - ✓ Otter.AI trigger captured transcript
   - ✓ Claude processed the content
   - ✓ Notion entry was created

4. Check Notion database for the new entry

### 5.2 Activate Zap

If everything works correctly:

1. Return to Zap editor
2. Click **Publish** or **Turn on Zap**
3. Confirm activation

Your Zap is now live and will automatically process new Otter.AI transcripts!

## Advanced Configurations

### Multi-Path Workflows

Create conditional logic based on transcript content:

1. Add **Filter** step after Otter.AI trigger
2. Configure conditions:
   - **Duration > 10 minutes**: Process fully
   - **Duration < 10 minutes**: Simple save without Claude processing
   - **Contains keyword**: Tag as "Important"

### Custom Notion Templates

Create different Notion pages based on meeting type:

1. Add **Paths by Zapier** after Claude processing
2. Configure paths:
   - **Path A**: Sales calls → Sales database
   - **Path B**: Team meetings → Team database
   - **Path C**: Interviews → HR database

### Email Notifications

Add email alerts for important transcripts:

1. Add **Email by Zapier** action
2. **To**: Your email or team distribution list
3. **Subject**: `New Transcript: {{trigger.title}}`
4. **Body**: Include summary and action items
5. **Condition**: Only send if action items exist

### Slack Integration

Post summaries to Slack channels:

1. Add **Slack** action after Notion
2. **Channel**: Select target channel
3. **Message**:
   ```
   📝 New Meeting Transcript: *{{trigger.title}}*

   Summary: {{action.summary}}

   View in Notion: {{notion.page_url}}
   ```

### Batch Processing

Process multiple transcripts at once:

1. Use **Schedule by Zapier** as trigger
2. Set to run hourly or daily
3. Fetch all new Otter transcripts since last run
4. Use **Looping by Zapier** to process each one

### Error Handling

Add error recovery mechanisms:

1. After each action, add **Filter** step
2. Check for successful completion
3. If error, add **Paths**:
   - **Path A**: Retry action
   - **Path B**: Log error to Google Sheets
   - **Path C**: Send error notification

## Monitoring and Optimization

### Task History

Regularly check Zapier Task History:
- Monitor success/failure rates
- Identify bottlenecks
- Track processing times

### Adjust Trigger Frequency

For faster processing:
- Upgrade Zapier plan for shorter polling intervals
- Use webhook triggers if available

### Optimize Prompts

Refine Claude prompts based on results:
- Add more specific instructions
- Adjust output format
- Include examples of desired output

## Troubleshooting

See [README.md](./README.md#troubleshooting) for common issues and solutions.

## Cost Optimization

- **Zapier Tasks**: Each Zap run counts as 1-3 tasks (depending on steps)
- **Claude API**: Each transcript costs ~$0.01-0.10 (depending on length)
- **Notion API**: Free for most use cases

**Tips**:
- Filter short/unimportant transcripts to save tasks
- Use scheduled processing instead of instant triggers
- Batch process during off-peak hours

## Next Steps

- Customize the Claude prompt for your specific needs
- Add additional processing steps (e.g., task creation in project management tools)
- Integrate with calendar apps to link meetings with transcripts
- Create dashboards in Notion to visualize transcript data

## Resources

- [Zapier Webhooks Documentation](https://zapier.com/apps/webhook/integrations)
- [Otter.AI Zapier Integration](https://zapier.com/apps/otterai/integrations)
- [Notion API Documentation](https://developers.notion.com/)
- [Claude API Documentation](https://docs.anthropic.com/)
