# Installing the dependency plugins

`code-quality-pipeline` orchestrates review tools that ship in other plugins — it does not
bundle them. Install the ones you want before running the pipeline. Any step whose tool is
missing is skipped (and reported as skipped), never silently passed.

## What each step needs

| Step | Tool it needs | Provided by plugin |
|------|---------------|--------------------|
| Code Review (steps 1 & 4) | a code-review agent | `feature-dev` |
| Code Simplification (step 2) | a code-simplifier agent | `pr-review-toolkit` |
| Security Review (step 3) | a security-review tool | `code-review` |
| Holistic pre-merge review (Gate B) | a whole-diff code-review tool | `code-review` |

All three plugins are published in Anthropic's official Claude Code marketplace
(`anthropics/claude-code`).

## How to install

Use Claude Code's `/plugin` command to install each plugin from the marketplace:

```
/plugin install feature-dev@claude-code-plugins
/plugin install pr-review-toolkit@claude-code-plugins
/plugin install code-review@claude-code-plugins
```

Or run `/plugin` with no arguments to open the plugin manager, browse the marketplace, and
install and enable each one interactively.

## Substituting your own tools

These are the reference tools this pipeline was written against, but nothing is hard-wired to
them. Any equivalent from any marketplace works just as well — a different code reviewer,
simplifier, or security scanner — as long as it plays the same role in the step.
