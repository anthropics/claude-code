# Test Oncall Triage Script

This script allows you to test the oncall triage workflow logic locally without running the full GitHub Actions workflow.

## Prerequisites

1. Install required Python packages:
```bash
pip install groq PyGithub
```

2. Set up environment variables:
```bash
export GROQ_API_KEY="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"
export GITHUB_TOKEN="your-github-personal-access-token"
export GITHUB_REPOSITORY="ensideanderson-nova/claude-code"
```

## Usage

### Dry Run (Recommended first)
Test without actually adding labels:
```bash
python3 scripts/test_oncall_triage.py --dry-run
```

### Live Run
Actually add the oncall labels:
```bash
python3 scripts/test_oncall_triage.py
```

## What it does

1. Fetches all open issues updated in the last 3 days
2. Filters for bugs with at least 50 engagements (comments + reactions)
3. Uses Groq AI to determine if issues are truly blocking
4. Adds the "oncall" label to qualifying issues
5. Provides a summary of actions taken

## Output

The script will show:
- Each issue being evaluated
- Whether it meets the criteria (bug label, engagement count)
- The AI's decision (YES/NO for blocking)
- Which issues received the oncall label
- A final summary with statistics

## Example Output

```
Fetching open issues updated since 2026-01-18T05:57:33.260000+00:00
Found 5 open issues updated in the last 3 days

Evaluating issue #123: App crashes on startup
  Is bug: True, Engagements: 75
  AI Decision: YES
  ✓ Added 'oncall' label to issue #123

============================================================
ONCALL TRIAGE SUMMARY
============================================================
Total issues evaluated: 5
Issues labeled with 'oncall': 1

Issues that received the 'oncall' label:
  - Issue #123: App crashes on startup
    Reason: Bug with 75 engagements, AI determined it's blocking
============================================================
```
