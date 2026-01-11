---
description: Recover context from recent conversation
argument-hint: "[last5 | around TIME | search KEYWORD]"
allowed-tools: Bash(python3:*), AskUserQuestion
---

# Context Recall

The user wants to recover context from this conversation.

## Step 1: Check for Quick Commands

**FIRST**, check if `$ARGUMENTS` contains a quick command:

- `last5`, `last10`, etc. → Skip to "Direct Fetch" section
- `around 2pm`, `around 14:30` → Skip to "Direct Fetch" section
- `search keyword`, `search "some phrase"` → Skip to "Direct Fetch" section

If no arguments: Continue to Step 2.

---

## Step 2: Show Conversation Index

Here is the timestamped index of all exchanges in this session:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/show_index.py`

## Step 3: Present Menu

Now that the user can see the index above, use **AskUserQuestion** to let them choose what to recall:

**Question**: "What would you like to recall?"

**Options** (use these exact labels):
1. **Recent (last 5)** - "Quick recall of the most recent exchanges"
2. **Search by keyword** - "Find exchanges containing specific text"
3. **Jump to time** - "Find exchanges around a specific time (e.g., '2pm')"

## After User Selects

### If "Recent (last 5)":
Run: `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fetch_exchanges.py last5`

### If "Search by keyword":
1. Ask for the keyword using AskUserQuestion
2. Run: `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fetch_exchanges.py search <keyword>`
3. The script will fetch and display matching exchanges (up to 10 most recent)

### If "Jump to time":
1. Ask what time using AskUserQuestion (e.g., "2pm", "11:30am", "14:30")
2. Run: `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fetch_exchanges.py around <time>`
3. The script will fetch exchanges around that time

## After Fetching

Once you've fetched the selected exchanges, provide a brief summary:
- What was being discussed
- Where we left off
- Any pending items

Ask the user to confirm your understanding before continuing.

---

## Direct Fetch (with arguments)

If `$ARGUMENTS` was provided, skip the menu and fetch directly:

**Examples:**
- `/recall last5` → `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fetch_exchanges.py last5`
- `/recall last10` → `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fetch_exchanges.py last10`
- `/recall around 2pm` → `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fetch_exchanges.py around 2pm`
- `/recall search auth` → `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fetch_exchanges.py search auth`

Run: `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/fetch_exchanges.py $ARGUMENTS`

Then summarize the fetched content and ask user to confirm understanding.
