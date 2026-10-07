---
name: test
description: Manual UI testing with Chrome browser - explore your app while errors are captured
argument-hint: "[url]"
---

# Manual UI Test Command

You are launching a manual UI testing session using Chrome browser.

This is a **standalone command** - it does NOT run the full sprint workflow. Use this when you want to:
- Quickly explore your app in a real browser
- Manually test features while console errors are captured
- Debug UI issues interactively
- **Feed observations into the next sprint** (reports are saved to the sprint folder)

## Workflow

### Step 0: Locate Sprint Directory

Find the current sprint directory:
```bash
ls -d .claude/sprint/*/ 2>/dev/null | sort -V | tail -1
```

If no sprint exists, create the first one:
```bash
mkdir -p .claude/sprint/1
```

Store the sprint directory path (e.g., `.claude/sprint/1/`) for saving the report later.

### Step 1: Determine Frontend URL

Check for URL in this order:
1. Command argument (e.g., `/sprint:test http://localhost:8080`)
2. `.claude/project-map.md` - look for frontend URL
3. Default: `http://localhost:3000`

### Step 2: Initialize Chrome Browser

```
Call: mcp__claude-in-chrome__tabs_context_mcp
```

Get the current tab context. Then create a new tab:

```
Call: mcp__claude-in-chrome__tabs_create_mcp
```

Store the `tabId` for subsequent calls.

### Step 3: Navigate to App

```
Call: mcp__claude-in-chrome__navigate
- url: [frontend URL]
- tabId: [tabId]
```

### Step 4: Take Initial Screenshot

Confirm the app loaded correctly:

```
Call: mcp__claude-in-chrome__computer
- action: "screenshot"
- tabId: [tabId]
```

Report to user:
```
Browser opened at [URL]

You can now interact with the app manually.
I'm monitoring for console errors in the background.

When you're done testing, say "done" or "finish testing".
```

### Step 5: Monitor for Errors

While the user tests, periodically check for console errors:

```
Call: mcp__claude-in-chrome__read_console_messages
- tabId: [tabId]
- pattern: "error|Error|ERROR|exception|Exception"
```

If errors are found, briefly note them but don't interrupt the user's flow.

### Step 6: Wait for User to Finish

The user will indicate they're done testing by saying something like:
- "done"
- "finish"
- "stop testing"
- "I'm done"

### Step 7: Capture Final State

When the user signals completion:

1. Take final screenshot:
```
Call: mcp__claude-in-chrome__computer
- action: "screenshot"
- tabId: [tabId]
```

2. Get all console messages:
```
Call: mcp__claude-in-chrome__read_console_messages
- tabId: [tabId]
```

3. Optionally get network requests if relevant:
```
Call: mcp__claude-in-chrome__read_network_requests
- tabId: [tabId]
```

### Step 8: Generate and Save Report

Generate a report with this structure:

```markdown
## MANUAL TEST REPORT

### Session Info
- URL: [frontend URL]
- Date: [timestamp]
- Duration: [approximate time]

### Console Errors
[List any JS errors captured, or "None detected"]

### Network Issues
[Any failed requests, or "None detected"]

### User Observations
[Space for any notes the user mentioned during testing]

### Issues Found
[Summarize any problems discovered, or "None"]

### Suggested Fixes
[If issues were found, suggest what might need to be fixed]
```

**Save the report to the sprint directory:**

Write the report to: `.claude/sprint/[N]/manual-test-report.md`

If a previous `manual-test-report.md` exists, append a timestamp suffix:
- `.claude/sprint/[N]/manual-test-report-[timestamp].md`

**Inform the user:**

```
Report saved to .claude/sprint/[N]/manual-test-report.md

This report will be picked up when you run /sprint
The architect will use it to understand what needs to be fixed.
```

## Error Handling

If the browser fails to open or navigate:
- Report the error to the user
- Suggest checking if the app is running
- Provide the URL that was attempted

## Notes

- This command uses Chrome browser MCP (`mcp__claude-in-chrome__*`)
- The browser tab stays open for the user to interact with
- Console errors are captured automatically
- **Reports are saved to the sprint folder** for the architect to use
- No sprint workflow, no architect, no agents - just direct browser testing
- The saved report feeds into the next `/sprint` run
- **Reports are automatically cleaned up** when the sprint completes successfully
