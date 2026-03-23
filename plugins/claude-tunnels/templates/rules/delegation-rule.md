# Delegation Rule (CRITICAL)

All work is executed through the `orchestrator/` package. PO creates execution plans via `query(cwd=project/)`, and the executor runs workspace tasks via `query(cwd=workspace/)`. Each directory's CLAUDE.md + .claude/* are automatically loaded.

## Discovery

Discover available projects by running `ls`. Read each project's `CLAUDE.md` to understand it. No hardcoded project lists.

## Decision Tree

1. Specific project task → PO determines phases, executor runs workspaces
2. Cross-project task → Each project runs in parallel via `asyncio.gather`
3. Project structure question → PO investigates with Read/Glob/Grep
4. Ambiguous project → Ask user for clarification
