# Research Loop

Compatibility plugin for [10000 Mentors Research Workflow](https://github.com/wd041216-bit/10000-mentors-research-workflow), a source-gated autonomous research loop for GitHub research repositories.

## What It Provides

- A `research-loop` skill for running one bounded research micro-step per cycle.
- Evidence-first rules: current repo HEAD and current literature outrank memory or expert profiles.
- Submission Advisor completion gate: stop only when readiness reaches `100` and `submission_ready`.
- No Ollama API key requirement in the default workflow.

## Expected Companion Project

This plugin is a compatibility wrapper. The full workflow lives in the companion repository:

```bash
git clone https://github.com/wd041216-bit/10000-mentors-research-workflow.git
cd 10000-mentors-research-workflow
python3 -m pip install -e ".[dev]"
```

Then use the skill on a research repo:

```text
Use $research-loop on https://github.com/<owner>/<research-repo> until the Submission Advisor marks it submission_ready.
```

## Safety Boundary

This plugin does not claim empirical progress unless the executor writes runnable artifacts and an `executor_manifest.json`.
