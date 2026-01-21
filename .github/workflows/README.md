# GitHub Workflows Documentation

This directory contains automated workflows for the claude-code repository.

## Oncall Issue Triage Workflow

**File:** `oncall-triage.yml`

### Overview
This workflow automatically identifies and labels critical blocking issues that require immediate oncall attention. It runs every 6 hours and can also be triggered manually.

### How It Works
1. Fetches all open issues updated in the last 3 days
2. Filters issues that meet the criteria:
   - Must be a bug (has "bug" label or mentions bug in title/body)
   - Must have at least 50 engagements (comments + reactions)
3. Uses **Groqcloud AI** (via the Groq API with llama-3.3-70b-versatile model) to analyze whether the issue is truly blocking
4. Adds the "oncall" label to qualifying issues
5. Provides a summary of all actions taken

### AI Provider
This workflow uses **Groqcloud** instead of Claude for AI-powered triage decisions. Groqcloud provides:
- Fast inference with the llama-3.3-70b-versatile model
- Cost-effective API calls
- Reliable issue analysis for blocking vs non-blocking determination

### Required Secrets
This workflow requires the following GitHub secrets to be configured:

- **`GROQ_API_KEY`**: API key for Groqcloud service
  - Obtain from: https://console.groq.com/
  - Purpose: Used to make AI-powered decisions about issue severity
  - Permissions: Read access to Groq API

- **`GITHUB_TOKEN`**: Automatically provided by GitHub Actions
  - Purpose: Used to read issues and apply labels
  - Permissions: `contents: read`, `issues: write`

### Configuration
To set up the `GROQ_API_KEY` secret:
1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `GROQ_API_KEY`
4. Value: Your Groq API key from https://console.groq.com/
5. Click "Add secret"

### Triggers
- **Schedule**: Runs every 6 hours (cron: `0 */6 * * *`)
- **Manual**: Can be triggered via workflow_dispatch
- **Push**: Temporarily enabled for testing on `add-oncall-triage-workflow` branch

### Permissions
- `contents: read` - To checkout the repository
- `issues: write` - To add labels to issues

### Dependencies
- Python 3.11
- `groq` - Groq Python SDK for AI API calls
- `PyGithub` - GitHub API client for Python

### Customization
You can adjust the following parameters in the workflow:
- Issue age threshold (currently 3 days)
- Minimum engagements (currently 50)
- AI model temperature (currently 0.3 for conservative decisions)
- Maximum comment length analyzed (currently 200 characters per comment, 10 comments max)

---

## Other Workflows

### Claude Issue Triage (`claude-issue-triage.yml`)
Automatically triages new issues using Claude Code when issues are opened.

### Auto Close Duplicates (`auto-close-duplicates.yml`)
Automatically closes duplicate issues.

### Stale Issue Manager (`stale-issue-manager.yml`)
Manages stale issues by labeling or closing them after a period of inactivity.

For more information about other workflows, see their respective YAML files.
