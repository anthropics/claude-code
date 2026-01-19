# Oncall Issue Triage Workflow

## Overview
This workflow identifies and labels critical blocking issues that require oncall attention using Claude AI analysis.

## Requirements
- **Anthropic API Key**: This workflow requires a valid `ANTHROPIC_API_KEY` secret with sufficient credits
- The workflow uses Claude AI to analyze issues and determine which ones need oncall attention

## Current Status
⚠️ **Automatic triggers are currently DISABLED** to prevent failures when API credits are low.

## Configuration

### Triggers (Currently Disabled)
The following triggers are commented out:
- **Push to test branch**: `add-oncall-triage-workflow` (was temporary for testing only)
- **Scheduled runs**: Every 6 hours via cron

**Note**: This workflow analyzes issues, not code, so it doesn't need to run on specific branches. When re-enabling, you may want to remove the push trigger entirely and only use the schedule trigger.

### Active Triggers
- **Manual trigger only**: `workflow_dispatch` - Can be triggered manually from GitHub Actions UI

## How to Re-enable Automatic Runs

When API credits are available, you can re-enable automatic triggers. Since this workflow analyzes issues (not code), the schedule trigger is typically most useful:

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch: # Manual trigger
```

Or, if you need a push trigger for testing purposes:

```yaml
on:
  push:
    branches:
      - your-test-branch-name  # Replace with your preferred test branch
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch: # Manual trigger
```

## Troubleshooting

### "Credit balance is too low" Error
This error occurs when the Anthropic API key doesn't have sufficient credits. To resolve:
1. Add credits to your Anthropic account
2. Or keep the workflow on manual trigger only
3. Or use a different API key with credits

### Workflow Not Running
- Check that the workflow trigger conditions are met
- Verify the `ANTHROPIC_API_KEY` secret is set and valid
- Check GitHub Actions logs for detailed error messages

## Manual Execution
To manually trigger the workflow:
1. Go to the Actions tab in GitHub
2. Select "Oncall Issue Triage" workflow
3. Click "Run workflow"
4. Select the branch and click "Run workflow"
