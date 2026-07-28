# Task Decomposition Guide

## Decomposition Patterns

### Pattern 1: Layer-Based Split
Split by architectural layers when the task spans multiple layers.
- Wave 1: Data layer (models, types, schemas)
- Wave 2: Logic layer (services, middleware, utilities)
- Wave 3: Interface layer (routes, controllers, UI components)
- Wave 4: Tests and documentation

### Pattern 2: Feature-Based Split
Split by independent features when the task involves multiple features.
- Wave 1: Shared infrastructure (types, config, utilities)
- Wave 2+: Each feature as a separate agent (parallel)
- Final wave: Integration tests

### Pattern 3: Component-Based Split
Split by UI components when the task is frontend-heavy.
- Wave 1: Shared state/store changes
- Wave 2: Independent component implementations (parallel)
- Wave 3: Integration and E2E tests

### Pattern 4: Migration Split
For data or API migrations.
- Wave 1: New schema/types/interfaces
- Wave 2: Migration logic + backward compatibility
- Wave 3: Consumer updates (parallel per consumer)
- Wave 4: Remove old code + tests

## File Conflict Resolution

When two subtasks need the same file:
1. **Prefer sequencing**: Put them in different waves
2. **Prefer merging**: Combine into one subtask if small enough
3. **Split the file**: If the file is large, the first agent can split it, second agent modifies the new file
4. **Accept shared read**: Multiple agents CAN read the same file, just not write to it

## Sizing Guidelines

- **1 agent**: Task touches 1-3 files, straightforward changes — skip orchestration, do it directly
- **2 agents**: Task has 2 independent concerns (e.g., backend + frontend)
- **3 agents**: Task spans 3+ layers or features
- **4-5 agents**: Large refactor or migration across many files
- **>5 agents**: Consider breaking into separate orchestrations

## Anti-Patterns

- Don't create agents for trivial changes (1-line fix doesn't need an agent)
- Don't split tightly coupled files across agents
- Don't put test-writing in wave 1 (tests depend on implementation)
- Don't create circular dependencies between waves
- Don't over-decompose — 2 focused agents beat 5 scattered ones
