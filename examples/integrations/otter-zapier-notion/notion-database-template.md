# Notion Database Template for Otter.AI Transcripts

This guide shows you how to create a properly structured Notion database to store and organize your Otter.AI transcriptions.

## Quick Setup

### Option 1: Create from Scratch

Follow the [Detailed Setup](#detailed-setup) section below.

### Option 2: Duplicate Template

If you have access to a Notion template link (coming soon), you can duplicate the pre-built database.

## Detailed Setup

### Step 1: Create New Database

1. Open your Notion workspace
2. Navigate to the page where you want to store transcripts
3. Type `/database` and select **Database - Full page** or **Database - Inline**
4. Name the database: **"Meeting Transcripts"** or **"Otter Transcriptions"**

### Step 2: Configure Database Properties

Click **+** or the **•••** menu to add the following properties:

#### Core Properties

| Property Name | Type | Description | Configuration |
|--------------|------|-------------|---------------|
| **Title** | Title | Meeting or transcript name | Default property, rename if needed |
| **Date** | Date | When the meeting occurred | Include time if needed |
| **Status** | Select | Processing status | Options: New, Reviewed, Archived, Action Required |
| **Source** | Select | Where transcript came from | Options: Otter.AI, Manual, Other |

#### Content Properties

| Property Name | Type | Description | Configuration |
|--------------|------|-------------|---------------|
| **Summary** | Text | AI-generated meeting summary | Use regular text (not rich text for Zapier compatibility) |
| **Transcript** | Text | Full transcript text | Large text field |
| **Key Points** | Text | Main discussion points | Bulleted list format |
| **Decisions** | Text | Decisions made | Bulleted list format |
| **Action Items** | Text | Tasks and next steps | Formatted as checklist |

#### Metadata Properties

| Property Name | Type | Description | Configuration |
|--------------|------|-------------|---------------|
| **Duration** | Number | Meeting length in minutes | Format: Number |
| **Participants** | Multi-select | Meeting attendees | Add names as you process transcripts |
| **Tags** | Multi-select | Topics or categories | Examples: Sales, Engineering, HR, Strategy |
| **Sentiment** | Select | Overall meeting tone | Options: Positive, Neutral, Negative, Mixed |

#### Reference Properties

| Property Name | Type | Description | Configuration |
|--------------|------|-------------|---------------|
| **Otter Link** | URL | Link to original Otter.AI transcript | Direct link |
| **Recording Link** | URL | Link to audio/video recording | If available |
| **Related Docs** | Relation | Link to related Notion pages | Create relation to other databases |
| **Meeting Series** | Select | Recurring meeting identifier | Examples: Weekly Standup, Monthly Review |

#### Advanced Properties (Optional)

| Property Name | Type | Description | Configuration |
|--------------|------|-------------|---------------|
| **Priority** | Select | Importance level | Options: High, Medium, Low |
| **Follow-up Date** | Date | When to review action items | Date only |
| **Owner** | Person | Person responsible for follow-up | Select workspace members |
| **Project** | Relation | Related project | Link to Projects database |
| **Transcript ID** | Text | Otter.AI unique identifier | For reference/debugging |
| **Word Count** | Number | Total words in transcript | Auto-calculated via Zapier |
| **Created At** | Created time | When Notion entry was created | Auto-populated |
| **Last Edited** | Last edited time | Last modification time | Auto-populated |

### Step 3: Configure Property Settings

#### Status Options (Select)

1. Click on **Status** property
2. Add these options with colors:
   - **New** (Blue) - Just imported, not yet reviewed
   - **Reviewed** (Green) - Reviewed and processed
   - **Action Required** (Red) - Has pending action items
   - **Archived** (Gray) - Completed and archived

3. Set **New** as the default

#### Source Options (Select)

1. Click on **Source** property
2. Add options:
   - **Otter.AI** (Purple) - From Otter.AI automation
   - **Manual Upload** (Yellow) - Manually added
   - **Other** (Gray) - Other sources

3. Set **Otter.AI** as default

#### Sentiment Options (Select)

1. Click on **Sentiment** property
2. Add options:
   - **Positive** (Green) - Positive tone
   - **Neutral** (Gray) - Neutral tone
   - **Negative** (Red) - Negative tone
   - **Mixed** (Orange) - Mixed sentiments

#### Priority Options (Select)

1. Click on **Priority** property
2. Add options:
   - **High** (Red)
   - **Medium** (Yellow)
   - **Low** (Gray)

### Step 4: Create Database Views

Create multiple views to organize your transcripts:

#### View 1: All Transcripts (Table)

- **Default view**
- **Sort**: Date (descending) - newest first
- **Filter**: None
- **Properties visible**: All

#### View 2: Recent Meetings (Gallery)

1. Click **+ Add a view** → **Gallery**
2. Name: "Recent Meetings"
3. **Card Preview**: Summary or Transcript
4. **Card Size**: Medium
5. **Sort**: Date (descending)
6. **Filter**: Date is within the past 1 month
7. **Properties shown**: Title, Date, Participants, Tags

#### View 3: Needs Review (List)

1. Click **+ Add a view** → **List**
2. Name: "Needs Review"
3. **Sort**: Date (ascending) - oldest first
4. **Filter**: Status is "New" OR Status is "Action Required"
5. **Properties shown**: Title, Date, Status, Priority, Participants

#### View 4: By Tag (Board)

1. Click **+ Add a view** → **Board**
2. Name: "By Tag"
3. **Group by**: Tags
4. **Sort**: Date (descending)
5. **Properties shown**: Title, Date, Summary

#### View 5: Calendar View (Calendar)

1. Click **+ Add a view** → **Calendar**
2. Name: "Calendar"
3. **Date Property**: Date
4. **Show**: Title, Participants
5. Useful for seeing meeting distribution over time

#### View 6: Action Items (Table)

1. Click **+ Add a view** → **Table**
2. Name: "Action Items"
3. **Filter**:
   - Action Items is not empty
   - Status is not "Archived"
4. **Sort**: Follow-up Date (ascending)
5. **Properties shown**: Title, Action Items, Owner, Follow-up Date, Status

### Step 5: Set Up Templates

Create templates for different meeting types:

#### Template 1: Team Standup

1. In database, click **⌄** next to **New** button
2. Select **+ New template**
3. Name: "Team Standup Template"
4. Pre-fill properties:
   - **Meeting Series**: Weekly Standup
   - **Tags**: Team, Standup
   - **Status**: New
5. Add template content:
   ```
   ## Agenda
   - Yesterday's accomplishments
   - Today's plans
   - Blockers

   ## Summary
   [Auto-populated by Zapier]

   ## Action Items
   [Auto-populated by Zapier]
   ```

#### Template 2: Client Meeting

1. Create another template
2. Name: "Client Meeting Template"
3. Pre-fill properties:
   - **Tags**: Client, Sales
   - **Priority**: High
   - **Status**: Action Required
4. Add template content:
   ```
   ## Client Information
   - Company:
   - Contact:

   ## Meeting Purpose
   [Auto-populated by Zapier]

   ## Next Steps
   [Auto-populated by Zapier]
   ```

#### Template 3: Project Review

1. Create template: "Project Review Template"
2. Pre-fill:
   - **Tags**: Project, Review
   - **Meeting Series**: Project Review
3. Content:
   ```
   ## Project Status
   [Auto-populated]

   ## Milestones Discussed
   [Auto-populated]

   ## Decisions & Action Items
   [Auto-populated]
   ```

### Step 6: Share Database with Integration

For Zapier to write to your database:

1. Click **Share** button (top-right)
2. Click **Invite**
3. Search for your Notion integration (e.g., "Otter Transcript Sync")
4. Select the integration
5. Set permissions: **Can edit**
6. Click **Invite**

### Step 7: Get Database ID

You'll need the database ID for Zapier configuration:

1. Open your database in Notion
2. Copy the page URL
3. The database ID is the string between the workspace name and the "?v=":
   ```
   https://www.notion.so/workspace/[DATABASE_ID]?v=...
   ```
4. Example: `3a2b1c4d5e6f7g8h9i0j1k2l`
5. Save this ID for Zapier setup

## Database Formula Examples

### Auto-calculate Properties

Add calculated fields to enhance your database:

#### Formula 1: Days Since Meeting

Add a **Formula** property named "Days Ago":

```
dateBetween(now(), prop("Date"), "days")
```

Shows how many days ago the meeting occurred.

#### Formula 2: Needs Follow-up

Add a **Formula** property named "Needs Follow-up":

```
if(prop("Follow-up Date") < now() and prop("Status") != "Archived", "⚠️ Overdue", if(prop("Action Items") != "", "📋 Has Items", "✓ Complete"))
```

Flags transcripts that need attention.

#### Formula 3: Meeting Length Category

Add a **Formula** property named "Length Category":

```
if(prop("Duration") > 60, "🔴 Long", if(prop("Duration") > 30, "🟡 Medium", "🟢 Short"))
```

Categorizes meetings by duration.

#### Formula 4: Has Recording

Add a **Formula** property named "Has Recording":

```
if(empty(prop("Recording Link")), "❌ No", "✅ Yes")
```

Indicates if recording link exists.

## Automation Rules (Notion Built-in)

Set up Notion automations for additional workflows:

### Automation 1: Auto-archive Old Transcripts

1. In database, click **⚙️** → **Automations** → **New automation**
2. **Trigger**: Property edited
3. **Property**: Status
4. **When**: Status is "Reviewed"
5. **Action**: Edit property
6. **Wait**: 30 days
7. **Then**: Set Status to "Archived"

### Automation 2: Assign Owner for Action Items

1. **Trigger**: Database entry created
2. **When**: Action Items is not empty
3. **Action**: Edit property
4. **Property**: Status → "Action Required"
5. **And**: Send notification to workspace

### Automation 3: Reminder for Follow-ups

1. **Trigger**: Property edited
2. **Property**: Follow-up Date
3. **When**: Follow-up Date is today
4. **Action**: Send notification
5. **To**: Property "Owner"
6. **Message**: "Follow-up needed: {Title}"

## Sample Database Entry

Here's what a completed entry looks like:

```
Title: Q4 Planning Session - Engineering Team
Date: November 4, 2025, 2:00 PM
Status: Reviewed
Source: Otter.AI
Priority: High

Duration: 45 minutes
Participants: Alice Johnson, Bob Smith, Carol Williams
Tags: Engineering, Planning, Q4, Strategy
Sentiment: Positive

Summary:
Team discussed Q4 roadmap priorities, focusing on API v2 migration
and mobile app enhancements. Agreed on sprint allocation and timeline.
All major blockers have been resolved.

Key Points:
• Q4 focus: Complete API v2 migration by end of November
• Mobile app beta launch scheduled for mid-December
• Infrastructure upgrades approved for January
• Hiring: 2 senior engineers to join in Q4

Decisions:
• Approved API v2 architecture proposal
• Decided to delay feature X to Q1 2026
• Agreed on bi-weekly sprint cycles

Action Items:
☐ Alice: Finalize API v2 technical spec (Due: Nov 10)
☐ Bob: Review infrastructure costs and present options (Due: Nov 15)
☐ Carol: Schedule interviews for engineering positions (Due: Nov 8)

Otter Link: https://otter.ai/u/abc123xyz
Meeting Series: Quarterly Planning
Follow-up Date: November 15, 2025
Owner: Alice Johnson
Project: [Link to API v2 Migration project]
```

## Tips for Organization

### Tagging Strategy

Create consistent tags:
- **By Team**: Engineering, Sales, Marketing, HR, Finance
- **By Type**: Standup, Review, Planning, Client Meeting, Interview
- **By Priority**: Urgent, Important, Routine
- **By Project**: Project names or codes

### Naming Conventions

Use consistent naming for meetings:
```
[Type] - [Topic] - [Date]
```

Examples:
- `Weekly Standup - Engineering - Nov 4, 2025`
- `Client Meeting - Acme Corp - Q4 Review`
- `Project Review - Mobile App - Sprint 12`

### Regular Maintenance

- **Weekly**: Review "Needs Review" view and process new transcripts
- **Monthly**: Archive completed transcripts older than 30 days
- **Quarterly**: Review tagging system and update as needed

## Integration with Other Notion Databases

### Link to Projects Database

1. Create a **Projects** database
2. Add **Relation** property in Transcripts database
3. Link each transcript to its related project

### Link to Tasks Database

1. Create a **Tasks** database
2. Use **Relation** to link action items from transcripts to tasks
3. Automate task creation from action items

### Link to Contacts Database

1. Create a **Contacts** database
2. Replace **Participants** multi-select with **Relation** to Contacts
3. Track all meetings per person

## Troubleshooting

### Zapier Can't Find Database

- Ensure database is shared with your Notion integration
- Check that integration has "Can edit" permissions
- Try refreshing the database list in Zapier

### Fields Not Populating

- Verify property names match exactly (case-sensitive)
- Check property types match Zapier output
- Ensure text fields are not rich text (use plain text)

### Multi-select Not Working

- Format Zapier output as comma-separated text
- Pre-create all possible values in Notion
- Values are case-sensitive

## Resources

- [Notion API Documentation](https://developers.notion.com/)
- [Notion Database Guide](https://www.notion.so/help/guides/creating-a-database)
- [Notion Formulas Reference](https://www.notion.so/help/formulas)

## Next Steps

After setting up your database:
1. Complete the Zapier integration ([see zapier-workflow.md](./zapier-workflow.md))
2. Test with a sample transcript
3. Customize views and properties for your needs
4. Share with your team and gather feedback
