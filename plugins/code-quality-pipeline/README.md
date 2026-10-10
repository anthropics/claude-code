# Code Quality Pipeline

The quality gates that stand between "code written" and "code merged." This plugin ships a single
skill, `code-quality-pipeline`, that Claude loads automatically the moment implementation is
complete and you're heading toward a PR/MR.

## What it does

Two complementary gates:

- **Gate A — per-file pipeline** — after a feature's unit + integration tests pass and before
  e2e: **Code Review → Code Simplification → Security Review → Final Review**, each step fanning
  out one subagent per changed file, with feedback applied between steps.
- **Gate B — holistic pre-merge review** — right before opening the PR/MR: one review of the
  **entire diff against the base branch** to catch cross-file interactions Gate A can't see.

## Usage

The skill auto-invokes when implementation is done, or trigger it directly:

> run the pipeline · code quality check · review before e2e · pre-merge review

## Dependencies

The pipeline **orchestrates** review tools rather than bundling them, so a step is skipped (and
reported as skipped — never silently passed) if its tool is absent. All of these are available
from this marketplace:

| Step | Tool | Install |
|------|------|---------|
| Code Review (steps 1 & 4) | `feature-dev` `code-reviewer` agent | `/plugin install feature-dev@claude-code-plugins` |
| Code Simplification (step 2) | `pr-review-toolkit` `code-simplifier` agent | `/plugin install pr-review-toolkit@claude-code-plugins` |
| Security Review (step 3) | `/security-review` | `/plugin install code-review@claude-code-plugins` |
| Holistic pre-merge review (Gate B) | `/code-review` | `/plugin install code-review@claude-code-plugins` |

## Author

By [Ron Mizrahi](https://github.com/RonMizrahi). MIT-licensed.
