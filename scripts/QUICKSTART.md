# One-Liner Quick Start

If you want a simple copy-paste solution, use one of these commands:

## Option 1: One-line installer and runner (Dry Run - Recommended First)

Copy and paste this entire block into your terminal:

```bash
pip install -q groq PyGithub && export GROQ_API_KEY="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" && export GITHUB_REPOSITORY="ensideanderson-nova/claude-code" && echo "Enter your GitHub token:" && read -s GITHUB_TOKEN && export GITHUB_TOKEN && python3 scripts/test_oncall_triage.py --dry-run
```

## Option 2: One-line installer and runner (Live Run)

Copy and paste this entire block into your terminal:

```bash
pip install -q groq PyGithub && export GROQ_API_KEY="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" && export GITHUB_REPOSITORY="ensideanderson-nova/claude-code" && echo "Enter your GitHub token:" && read -s GITHUB_TOKEN && export GITHUB_TOKEN && python3 scripts/test_oncall_triage.py
```

## Option 3: Use the setup script (Most User-Friendly)

```bash
# Make executable
chmod +x scripts/run_triage.sh

# Run with dry-run (recommended first)
./scripts/run_triage.sh --dry-run

# Or run live
./scripts/run_triage.sh
```

## What happens:

1. Installs `groq` and `PyGithub` packages
2. Sets the GROQ_API_KEY (already provided)
3. Prompts for your GitHub Personal Access Token
4. Sets the repository to `ensideanderson-nova/claude-code`
5. Runs the oncall triage script

## Notes:

- The dry-run option shows what would happen without making changes
- You'll need to enter your GitHub token when prompted (it won't be visible as you type for security)
- The script will show progress and results in the terminal
