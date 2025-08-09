---
allowed-tools:
  - Bash(gh workflow run*): "Trigger GitHub Actions workflow"
  - Bash(gh run list*): "List runs to get latest run ID"
  - Bash(gh run watch*): "Watch run status"
  - Bash(gh run download*): "Download artifacts"
description: Port a Python/C++ repo to Rust using the repo's GitHub Action (Gemini/OpenAI/Anthropic), then fetch artifacts
---

## Context

- This command uses the workflow at `.github/workflows/port-to-rust.yml` in the current repository to perform the conversion.
- You must have `GOOGLE_API_KEY` or other provider secrets configured in this repository if using Gemini/OpenAI/Anthropic.
- You must be authenticated with `gh` locally (GH_TOKEN or via `gh auth login`).

## Your task

1. Ask the user for the following if not already specified in the conversation:
   - `source_repo_url` (e.g., https://github.com/psarkerbd/Simple-Calculator)
   - `branch` (default: master or main)
   - `llm_provider` (default: google)
   - `model` (e.g., gemini-1.5-pro-latest)

2. Trigger the workflow on the current branch (or `demo` if user requests it) and pass the inputs:

   - !`gh workflow run .github/workflows/port-to-rust.yml --ref demo -f source_repo_url="<SOURCE_URL>" -f branch="<BRANCH>" -f llm_provider="<PROVIDER>" -f model="<MODEL>"`

3. Wait for the most recent run to finish, then download the artifact locally to `./port-to-rust-output`:

   - !`RUN_ID=$(gh run list --branch demo --limit 1 --json databaseId -q '.[0].databaseId')`
   - !`gh run watch "$RUN_ID" --exit-status`
   - !`gh run download "$RUN_ID" -n port-to-rust-output -D ./port-to-rust-output`

4. Confirm success to the user and briefly summarize where to find the generated Cargo project under `./port-to-rust-output/workspace/port-rust/` and logs in the same directory.

5. Do not run any other tools or do anything else beyond these steps.


