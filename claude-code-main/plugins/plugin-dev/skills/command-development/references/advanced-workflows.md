# Advanced Workflow Patterns

Multi-step command sequences and composition patterns for complex workflows.

## Overview

Advanced workflows combine multiple commands, coordinate state across invocations, and create sophisticated automation sequences. These patterns enable building complex functionality from simple command building blocks.

## Multi-Step Command Patterns

### Sequential Workflow Command

Commands that guide users through multi-step processes:

```markdown
---
description: Complete PR review workflow
argument-hint: [pr-number]
allowed-tools: Bash(gh:*), Read, Grep
---

# PR Review Workflow for #$1

## Step 1: Fetch PR Details
!`gh pr view $1 --json title,body,author,files`

## Step 2: Review Files
Files changed: !`gh pr diff $1 --name-only`

For each file:
- Check code quality
- Verify tests exist
- Review documentation

## Step 3: Run Checks
Test status: !`gh pr checks $1`

Verify:
- All tests passing
- No merge conflicts
- CI/CD successful

## Step 4: Provide Feedback

Summarize:
- Issues found (critical/minor)
- Suggestions for improvement
- Approval recommendation

Would you like to:
1. Approve PR
2. Request changes
3. Leave comments only

Reply with your choice and I'll help complete the action.
```

**Key features:**
- Numbered steps for clarity
- Bash execution for context
- Decision points for user input
- Next action suggestions

### State-Carrying Workflow

Commands that maintain state between invocations:

```markdown
---
description: Initialize deployment workflow
allowed-tools: Write, Bash(git:*)
---

# Initialize Deployment

Creating deployment tracking file...

Current branch: !`git branch --show-current`
Latest commit: !`git log -1 --format=%H`

Deployment state saved to `.claude/deployment-state.local.md`:

\`\`\`markdown
---
initialized: true
branch: $(git branch --show-current)
commit: $(git log -1 --format=%H)
timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)
status: initialized
---

# Deployment Tracking

Branch: $(git branch --show-current)
Started: $(date)

Next steps:
1. Run tests: /deploy-test
2. Build: /deploy-build
3. Deploy: /deploy-execute
\`\`\`

State saved. Run `/deploy-test` to continue.
```

**Next command** (`/deploy-test`):
```markdown
---
description: Run deployment tests
allowed-tools: Read, Bash(npm:*)
---

Reading deployment state from `.claude/deployment-state.local.md`...

Running tests: !`npm test`

Updating state to 'tested'...

Tests complete. Run `/deploy-build` to continue.
```

**Pattern benefits:**
- Persistent state across commands
- Clear workflow progression
- Safety checkpoints
- Resume capability

### Conditional Workflow Branching

Commands that adapt based on conditions:

```markdown
---
description: Smart deployment workflow
argument-hint: [environment]
allowed-tools: Bash(git:*), Bash(npm:*), Read
---

# Deploy to $1

## Pre-flight Checks

Branch: !`git branch --show-current`
Status: !`git status --short`

**Checking conditions:**

1. Branch status:
   - If main/master: Require approval
   - If feature branch: Warning about target
   - If hotfix: Fast-track process

2. Tests:
   !`npm test`
   - If tests fail: STOP - fix tests first
   - If tests pass: Continue

3. Environment:
   - If $1 = 'production': Extra validation
   - If $1 = 'staging': Standard process
   - If $1 = 'dev': Minimal checks

**Workflow decision:**
Based on above, proceeding with: [determined workflow]

[Conditional steps based on environment and status]

Ready to deploy? (yes/no)
```

## Command Composition Patterns

### Command Chaining

Commands designed to work together:

```markdown
---
description: Prepare for code review
---

# Prepare Code Review

Running preparation sequence:

1. Format code: /format-code
2. Run linter: /lint-code
3. Run tests: /test-all
4. Generate coverage: /coverage-report
5. Create review summary: /review-summary

This is a meta-command. After completing each step above,
I'll compile results and prepare comprehensive review materials.

Starting sequence...
```

**Individual commands** are simple:
- `/format-code` - Just formats
- `/lint-code` - Just lints
- `/test-all` - Just tests

**Composition command** orchestrates them.

### Pipeline Pattern

Commands that process output from previous commands:

```markdown
---
description: Analyze test failures
---

# Analyze Test Failures

## Step 1: Get test results
(Run /test-all first if not done)

Reading test output...

## Step 2: Categorize failures
- Flaky tests (random failures)
- Consistent failures
- New failures vs existing

## Step 3: Prioritize
Rank by:
- Impact (critical path vs edge case)
- Frequency (always fails vs sometimes)
- Effort (quick fix vs major work)

## Step 4: Generate fix plan
For each failure:
- Root cause hypothesis
- Suggested fix approach
- Estimated effort

Would you like me to:
1. Fix highest priority failure
2. Generate detailed fix plans for all
3. Create GitHub issues for each
```

### Parallel Execution Pattern

Commands that coordinate multiple simultaneous operations:

```markdown
---
description: Run comprehensive validation
allowed-tools: Bash(*), Read
---

# Comprehensive Validation

Running validations in parallel...

Starting:
- Code quality checks
- Security scanning
- Dependency audit
- Performance profiling

This will take 2-3 minutes. I'll monitor all processes
and report when complete.

[Poll each process and report progress]

All validations complete. Summary:
- Quality: PASS (0 issues)
- Security: WARN (2 minor issues)
- Dependencies: PASS
- Performance: PASS (baseline met)

Details:
[Collated results from all checks]
```

## Workflow State Management

### Using .local.md Files

Store workflow state in plugin-specific files:

```markdown
.claude/plugin-name-workflow.local.md:

---
workflow: deployment
stage: testing
started: 2025-01-15T10:30:00Z
environment: staging
branch: feature/new-api
commit: abc123def
tests_passed: false
build_complete: false
---

# Deployment Workflow State

Current stage: Testing
Started: 2025-01-15 10:30 UTC

Completed steps:
- ✅ Validation
- ✅ Branch check
- ⏳ Testing (in progress)

Pending steps:
- Build
- Deploy
- Smoke tests
```

**Reading state in commands:**

```markdown
---
description: Continue deployment workflow
allowed-tools: Read, Write
---

Reading workflow state from .claude/plugin-name-workflow.local.md...

Current stage: @.claude/plugin-name-workflow.local.md

[Parse YAML frontmatter to determine next step]

Next action based on state: [determined action]
```

### Workflow Recovery

Handle interrupted workflows:

```markdown
---
description: Resume deployment workflow
allowed-tools: Read
---

# Resume Deployment

Checking for interrupted workflow...

State file: @.claude/plugin-name-workflow.local.md

**Workflow found:**
- Started: [timestamp]
- Environment: [env]
- Last completed: [step]

**Recovery options:**
1. Resume from last step
2. Restart from beginning
3. Abort and clean up

Which would you like? (1/2/3)
```

## Workflow Coordination Patterns

### Cross-Command Communication

Commands that signal each other:

```markdown
---
description: Mark feature complete
allowed-tools: Write
---

# Mark Feature Complete

Writing completion marker...

Creating: .claude/feature-complete.flag

This signals other commands that feature is ready for:
- Integration testing (/integration-test will auto-detect)
- Documentation generation (/docs-generate will include)
- Release notes (/release-notes will add)

Feature marked complete.
```

**Other commands check for flag:**

```markdown
---
description: Generate release notes
allowed-tools: Read, Bash(git:*)
---

Checking for completed features...

if [ -f .claude/feature-complete.flag ]; then
  Feature ready for release notes
fi

[Include in release notes]
```

### Workflow Locking

Prevent concurrent workflow execution:

```markdown
---
description: Start deployment
allowed-tools: Read, Write, Bash
---

# Start Deployment

Checking for active deployments...

if [ -f .claude/deployment.lock ]; then
  ERROR: Deployment already in progress
  Started: [timestamp from lock file]

  Cannot start concurrent deployment.
  Wait for completion or run /deployment-abort

  Exit.
fi

Creating deployment lock...

Deployment started. Lock created.
[Proceed with deployment]
```

**Lock cleanup:**

```markdown
---
description: Complete deployment
allowed-tools: Write, Bash
---

Deployment complete.

Removing deployment lock...
rm .claude/deployment.lock

Ready for next deployment.
```

## Advanced Argument Handling

### Optional Arguments with Defaults

```markdown
---
description: Deploy with optional version
argument-hint: [environment] [version]
---

Environment: ${1:-staging}
Version: ${2:-latest}

Deploying ${2:-latest} to ${1:-staging}...

Note: Using defaults for missing arguments:
- Environment defaults to 'staging'
- Version defaults to 'latest'
```

### Argument Validation

```markdown
---
description: Deploy to validated environment
argument-hint: [environment]
---

Environment: $1

Validating environment...

valid_envs="dev staging production"
if ! echo "$valid_envs" | grep -w "$1" > /dev/null; then
  ERROR: Invalid environment '$1'
  Valid options: dev, staging, production
  Exit.
fi

Environment validated. Proceeding...
```

### Argument Transformation

```markdown
---
description: Deploy with shorthand
argument-hint: [env-shorthand]
---

Input: $1

Expanding shorthand:
- d/dev → development
- s/stg → staging
- p/prod → production

case "$1" in
  d|dev) ENV="development";;
  s|stg) ENV="staging";;
  p|prod) ENV="production";;
  *) ENV="$1";;
esac

Deploying to: $ENV
```

## Error Handling in Workflows

### Graceful Failure

```markdown
---
description: Resilient deployment workflow
---

# Deployment Workflow

Running steps with error handling...

## Step 1: Tests
!`npm test`

if [ $? -ne 0 ]; then
  ERROR: Tests failed

  Options:
  1. Fix tests and retry
  2. Skip tests (NOT recommended)
  3. Abort deployment

  What would you like to do?

  [Wait for user input before continuing]
fi

## Step 2: Build
[Continue only if Step 1 succeeded]
```

### Rollback on Failure

```markdown
---
description: Deployment with rollback
---

# Deploy with Rollback

Saving current state for rollback...
Previous version: !`current-version.sh`

Deploying new version...

!`deploy.sh`

if [ $? -ne 0 ]; then
  DEPLOYMENT FAILED

  Initiating automatic rollback...
  !`rollback.sh`

  Rolled back to previous version.
  Check logs for failure details.
fi

Deployment complete.
```

### Checkpoint Recovery

```markdown
---
description: Workflow with checkpoints
---

# Multi-Stage Deployment

## Checkpoint 1: Validation
!`validate.sh`
echo "checkpoint:validation" >> .claude/deployment-checkpoints.log

## Checkpoint 2: Build
!`build.sh`
echo "checkpoint:build" >> .claude/deployment-checkpoints.log

## Checkpoint 3: Deploy
!`deploy.sh`
echo "checkpoint:deploy" >> .claude/deployment-checkpoints.log

If any step fails, resume with:
/deployment-resume [last-successful-checkpoint]
```

## Best Practices

### Workflow Design

1. **Clear progression**: Number steps, show current position
2. **Explicit state**: Don't rely on implicit state
3. **User control**: Provide decision points
4. **Error recovery**: Handle failures gracefully
5. **Progress indication**: Show what's done, what's pending

### Command Composition

1. **Single responsibility**: Each command does one thing well
2. **Composable design**: Commands work together easily
3. **Standard interfaces**: Consistent input/output formats
4. **Loose coupling**: Commands don't depend on each other's internals

### State Management

1. **Persistent state**: Use .local.md files
2. **Atomic updates**: Write complete state files atomically
3. **State validation**: Check state file format/completeness
4. **Cleanup**: Remove stale state files
5. **Documentation**: Document state file formats

### Error Handling

1. **Fail fast**: Detect errors early
2. **Clear messages**: Explain what went wrong
3. **Recovery options**: Provide clear next steps
4. **State preservation**: Keep state for recovery
5. **Rollback capability**: Support undoing changes

## Example: Complete Deployment Workflow

### Initialize Command

```markdown
---
description: Initialize deployment
argument-hint: [environment]
allowed-tools: Write, Bash(git:*)
---

# Initialize Deployment to $1

Creating workflow state...

\`\`\`yaml
---
workflow: deployment
environment: $1
branch: !`git branch --show-current`
commit: !`git rev-parse HEAD`
stage: initialized
timestamp: !`date -u +%Y-%m-%dT%H:%M:%SZ`
---
\`\`\`

Written to .claude/deployment-state.local.md

Next: Run /deployment-validate
```

### Validation Command

```markdown
---
description: Validate deployment
allowed-tools: Read, Bash
---

Reading state: @.claude/deployment-state.local.md

Running validation...
- Branch check: PASS
- Tests: PASS
- Build: PASS

Updating state to 'validated'...

Next: Run /deployment-execute
```

### Execution Command

```markdown
---
description: Execute deployment
allowed-tools: Read, Bash, Write
---

Reading state: @.claude/deployment-state.local.md

Executing deployment to [environment]...

!`deploy.sh [environment]`

Deployment complete.
Updating state to 'completed'...

Cleanup: /deployment-cleanup
```

### Cleanup Command

```markdown
---
description: Clean up deployment
allowed-tools: Bash
---

Removing deployment state...
rm .claude/deployment-state.local.md

Deployment workflow complete.
```

This complete workflow demonstrates state management, sequential execution, error handling, and clean separation of concerns across multiple commands.
