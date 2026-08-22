# Interactive Command Patterns

Comprehensive guide to creating commands that gather user feedback and make decisions through the AskUserQuestion tool.

## Overview

Some commands need user input that doesn't work well with simple arguments. For example:
- Choosing between multiple complex options with trade-offs
- Selecting multiple items from a list
- Making decisions that require explanation
- Gathering preferences or configuration interactively

For these cases, use the **AskUserQuestion tool** within command execution rather than relying on command arguments.

## When to Use AskUserQuestion

### Use AskUserQuestion When:

1. **Multiple choice decisions** with explanations needed
2. **Complex options** that require context to choose
3. **Multi-select scenarios** (choosing multiple items)
4. **Preference gathering** for configuration
5. **Interactive workflows** that adapt based on answers

### Use Command Arguments When:

1. **Simple values** (file paths, numbers, names)
2. **Known inputs** user already has
3. **Scriptable workflows** that should be automatable
4. **Fast invocations** where prompting would slow down

## AskUserQuestion Basics

### Tool Parameters

```typescript
{
  questions: [
    {
      question: "Which authentication method should we use?",
      header: "Auth method",  // Short label (max 12 chars)
      multiSelect: false,     // true for multiple selection
      options: [
        {
          label: "OAuth 2.0",
          description: "Industry standard, supports multiple providers"
        },
        {
          label: "JWT",
          description: "Stateless, good for APIs"
        },
        {
          label: "Session",
          description: "Traditional, server-side state"
        }
      ]
    }
  ]
}
```

**Key points:**
- Users can always choose "Other" to provide custom input (automatic)
- `multiSelect: true` allows selecting multiple options
- Options should be 2-4 choices (not more)
- Can ask 1-4 questions per tool call

## Command Pattern for User Interaction

### Basic Interactive Command

```markdown
---
description: Interactive setup command
allowed-tools: AskUserQuestion, Write
---

# Interactive Plugin Setup

This command will guide you through configuring the plugin with a series of questions.

## Step 1: Gather Configuration

Use the AskUserQuestion tool to ask:

**Question 1 - Deployment target:**
- header: "Deploy to"
- question: "Which deployment platform will you use?"
- options:
  - AWS (Amazon Web Services with ECS/EKS)
  - GCP (Google Cloud with GKE)
  - Azure (Microsoft Azure with AKS)
  - Local (Docker on local machine)

**Question 2 - Environment strategy:**
- header: "Environments"
- question: "How many environments do you need?"
- options:
  - Single (Just production)
  - Standard (Dev, Staging, Production)
  - Complete (Dev, QA, Staging, Production)

**Question 3 - Features to enable:**
- header: "Features"
- question: "Which features do you want to enable?"
- multiSelect: true
- options:
  - Auto-scaling (Automatic resource scaling)
  - Monitoring (Health checks and metrics)
  - CI/CD (Automated deployment pipeline)
  - Backups (Automated database backups)

## Step 2: Process Answers

Based on the answers received from AskUserQuestion:

1. Parse the deployment target choice
2. Set up environment-specific configuration
3. Enable selected features
4. Generate configuration files

## Step 3: Generate Configuration

Create `.claude/plugin-name.local.md` with:

\`\`\`yaml
---
deployment_target: [answer from Q1]
environments: [answer from Q2]
features:
  auto_scaling: [true if selected in Q3]
  monitoring: [true if selected in Q3]
  ci_cd: [true if selected in Q3]
  backups: [true if selected in Q3]
---

# Plugin Configuration

Generated: [timestamp]
Target: [deployment_target]
Environments: [environments]
\`\`\`

## Step 4: Confirm and Next Steps

Confirm configuration created and guide user on next steps.
```

### Multi-Stage Interactive Workflow

```markdown
---
description: Multi-stage interactive workflow
allowed-tools: AskUserQuestion, Read, Write, Bash
---

# Multi-Stage Deployment Setup

This command walks through deployment setup in stages, adapting based on your answers.

## Stage 1: Basic Configuration

Use AskUserQuestion to ask about deployment basics.

Based on answers, determine which additional questions to ask.

## Stage 2: Advanced Options (Conditional)

If user selected "Advanced" deployment in Stage 1:

Use AskUserQuestion to ask about:
- Load balancing strategy
- Caching configuration
- Security hardening options

If user selected "Simple" deployment:
- Skip advanced questions
- Use sensible defaults

## Stage 3: Confirmation

Show summary of all selections.

Use AskUserQuestion for final confirmation:
- header: "Confirm"
- question: "Does this configuration look correct?"
- options:
  - Yes (Proceed with setup)
  - No (Start over)
  - Modify (Let me adjust specific settings)

If "Modify", ask which specific setting to change.

## Stage 4: Execute Setup

Based on confirmed configuration, execute setup steps.
```

## Interactive Question Design

### Question Structure

**Good questions:**
```markdown
Question: "Which database should we use for this project?"
Header: "Database"
Options:
  - PostgreSQL (Relational, ACID compliant, best for complex queries)
  - MongoDB (Document store, flexible schema, best for rapid iteration)
  - Redis (In-memory, fast, best for caching and sessions)
```

**Poor questions:**
```markdown
Question: "Database?"  // Too vague
Header: "DB"  // Unclear abbreviation
Options:
  - Option 1  // Not descriptive
  - Option 2
```

### Option Design Best Practices

**Clear labels:**
- Use 1-5 words
- Specific and descriptive
- No jargon without context

**Helpful descriptions:**
- Explain what the option means
- Mention key benefits or trade-offs
- Help user make informed decision
- Keep to 1-2 sentences

**Appropriate number:**
- 2-4 options per question
- Don't overwhelm with too many choices
- Group related options
- "Other" automatically provided

### Multi-Select Questions

**When to use multiSelect:**

```markdown
Use AskUserQuestion for enabling features:

Question: "Which features do you want to enable?"
Header: "Features"
multiSelect: true  // Allow selecting multiple
Options:
  - Logging (Detailed operation logs)
  - Metrics (Performance monitoring)
  - Alerts (Error notifications)
  - Backups (Automatic backups)
```

User can select any combination: none, some, or all.

**When NOT to use multiSelect:**

```markdown
Question: "Which authentication method?"
multiSelect: false  // Only one auth method makes sense
```

Mutually exclusive choices should not use multiSelect.

## Command Patterns with AskUserQuestion

### Pattern 1: Simple Yes/No Decision

```markdown
---
description: Command with confirmation
allowed-tools: AskUserQuestion, Bash
---

# Destructive Operation

This operation will delete all cached data.

Use AskUserQuestion to confirm:

Question: "This will delete all cached data. Are you sure?"
Header: "Confirm"
Options:
  - Yes (Proceed with deletion)
  - No (Cancel operation)

If user selects "Yes":
  Execute deletion
  Report completion

If user selects "No":
  Cancel operation
  Exit without changes
```

### Pattern 2: Multiple Configuration Questions

```markdown
---
description: Multi-question configuration
allowed-tools: AskUserQuestion, Write
---

# Project Configuration Setup

Gather configuration through multiple questions.

Use AskUserQuestion with multiple questions in one call:

**Question 1:**
- question: "Which programming language?"
- header: "Language"
- options: Python, TypeScript, Go, Rust

**Question 2:**
- question: "Which test framework?"
- header: "Testing"
- options: Jest, PyTest, Go Test, Cargo Test
  (Adapt based on language from Q1)

**Question 3:**
- question: "Which CI/CD platform?"
- header: "CI/CD"
- options: GitHub Actions, GitLab CI, CircleCI

**Question 4:**
- question: "Which features do you need?"
- header: "Features"
- multiSelect: true
- options: Linting, Type checking, Code coverage, Security scanning

Process all answers together to generate cohesive configuration.
```

### Pattern 3: Conditional Question Flow

```markdown
---
description: Conditional interactive workflow
allowed-tools: AskUserQuestion, Read, Write
---

# Adaptive Configuration

## Question 1: Deployment Complexity

Use AskUserQuestion:

Question: "How complex is your deployment?"
Header: "Complexity"
Options:
  - Simple (Single server, straightforward)
  - Standard (Multiple servers, load balancing)
  - Complex (Microservices, orchestration)

## Conditional Questions Based on Answer

If answer is "Simple":
  - No additional questions
  - Use minimal configuration

If answer is "Standard":
  - Ask about load balancing strategy
  - Ask about scaling policy

If answer is "Complex":
  - Ask about orchestration platform (Kubernetes, Docker Swarm)
  - Ask about service mesh (Istio, Linkerd, None)
  - Ask about monitoring (Prometheus, Datadog, CloudWatch)
  - Ask about logging aggregation

## Process Conditional Answers

Generate configuration appropriate for selected complexity level.
```

### Pattern 4: Iterative Collection

```markdown
---
description: Collect multiple items iteratively
allowed-tools: AskUserQuestion, Write
---

# Collect Team Members

We'll collect team member information for the project.

## Question: How many team members?

Use AskUserQuestion:

Question: "How many team members should we set up?"
Header: "Team size"
Options:
  - 2 people
  - 3 people
  - 4 people
  - 6 people

## Iterate Through Team Members

For each team member (1 to N based on answer):

Use AskUserQuestion for member details:

Question: "What role for team member [number]?"
Header: "Role"
Options:
  - Frontend Developer
  - Backend Developer
  - DevOps Engineer
  - QA Engineer
  - Designer

Store each member's information.

## Generate Team Configuration

After collecting all N members, create team configuration file with all members and their roles.
```

### Pattern 5: Dependency Selection

```markdown
---
description: Select dependencies with multi-select
allowed-tools: AskUserQuestion
---

# Configure Project Dependencies

## Question: Required Libraries

Use AskUserQuestion with multiSelect:

Question: "Which libraries does your project need?"
Header: "Dependencies"
multiSelect: true
Options:
  - React (UI framework)
  - Express (Web server)
  - TypeORM (Database ORM)
  - Jest (Testing framework)
  - Axios (HTTP client)

User can select any combination.

## Process Selections

For each selected library:
- Add to package.json dependencies
- Generate sample configuration
- Create usage examples
- Update documentation
```

## Best Practices for Interactive Commands

### Question Design

1. **Clear and specific**: Question should be unambiguous
2. **Concise header**: Max 12 characters for clean display
3. **Helpful options**: Labels are clear, descriptions explain trade-offs
4. **Appropriate count**: 2-4 options per question, 1-4 questions per call
5. **Logical order**: Questions flow naturally

### Error Handling

```markdown
# Handle AskUserQuestion Responses

After calling AskUserQuestion, verify answers received:

If answers are empty or invalid:
  Something went wrong gathering responses.

  Please try again or provide configuration manually:
  [Show alternative approach]

  Exit.

If answers look correct:
  Process as expected
```

### Progressive Disclosure

```markdown
# Start Simple, Get Detailed as Needed

## Question 1: Setup Type

Use AskUserQuestion:

Question: "How would you like to set up?"
Header: "Setup type"
Options:
  - Quick (Use recommended defaults)
  - Custom (Configure all options)
  - Guided (Step-by-step with explanations)

If "Quick":
  Apply defaults, minimal questions

If "Custom":
  Ask all available configuration questions

If "Guided":
  Ask questions with extra explanation
  Provide recommendations along the way
```

### Multi-Select Guidelines

**Good multi-select use:**
```markdown
Question: "Which features do you want to enable?"
multiSelect: true
Options:
  - Logging
  - Metrics
  - Alerts
  - Backups

Reason: User might want any combination
```

**Bad multi-select use:**
```markdown
Question: "Which database engine?"
multiSelect: true  // ❌ Should be single-select

Reason: Can only use one database engine
```

## Advanced Patterns

### Validation Loop

```markdown
---
description: Interactive with validation
allowed-tools: AskUserQuestion, Bash
---

# Setup with Validation

## Gather Configuration

Use AskUserQuestion to collect settings.

## Validate Configuration

Check if configuration is valid:
- Required dependencies available?
- Settings compatible with each other?
- No conflicts detected?

If validation fails:
  Show validation errors

  Use AskUserQuestion to ask:

  Question: "Configuration has issues. What would you like to do?"
  Header: "Next step"
  Options:
    - Fix (Adjust settings to resolve issues)
    - Override (Proceed despite warnings)
    - Cancel (Abort setup)

  Based on answer, retry or proceed or exit.
```

### Build Configuration Incrementally

```markdown
---
description: Incremental configuration builder
allowed-tools: AskUserQuestion, Write, Read
---

# Incremental Setup

## Phase 1: Core Settings

Use AskUserQuestion for core settings.

Save to `.claude/config-partial.yml`

## Phase 2: Review Core Settings

Show user the core settings:

Based on these core settings, you need to configure:
- [Setting A] (because you chose [X])
- [Setting B] (because you chose [Y])

Ready to continue?

## Phase 3: Detailed Settings

Use AskUserQuestion for settings based on Phase 1 answers.

Merge with core settings.

## Phase 4: Final Review

Present complete configuration.

Use AskUserQuestion for confirmation:

Question: "Is this configuration correct?"
Options:
  - Yes (Save and apply)
  - No (Start over)
  - Modify (Edit specific settings)
```

### Dynamic Options Based on Context

```markdown
---
description: Context-aware questions
allowed-tools: AskUserQuestion, Bash, Read
---

# Context-Aware Setup

## Detect Current State

Check existing configuration:
- Current language: !`detect-language.sh`
- Existing frameworks: !`detect-frameworks.sh`
- Available tools: !`check-tools.sh`

## Ask Context-Appropriate Questions

Based on detected language, ask relevant questions.

If language is TypeScript:

  Use AskUserQuestion:

  Question: "Which TypeScript features should we enable?"
  Options:
    - Strict Mode (Maximum type safety)
    - Decorators (Experimental decorator support)
    - Path Mapping (Module path aliases)

If language is Python:

  Use AskUserQuestion:

  Question: "Which Python tools should we configure?"
  Options:
    - Type Hints (mypy for type checking)
    - Black (Code formatting)
    - Pylint (Linting and style)

Questions adapt to project context.
```

## Real-World Example: Multi-Agent Swarm Launch

**From multi-agent-swarm plugin:**

```markdown
---
description: Launch multi-agent swarm
allowed-tools: AskUserQuestion, Read, Write, Bash
---

# Launch Multi-Agent Swarm

## Interactive Mode (No Task List Provided)

If user didn't provide task list file, help create one interactively.

### Question 1: Agent Count

Use AskUserQuestion:

Question: "How many agents should we launch?"
Header: "Agent count"
Options:
  - 2 agents (Best for simple projects)
  - 3 agents (Good for medium projects)
  - 4 agents (Standard team size)
  - 6 agents (Large projects)
  - 8 agents (Complex multi-component projects)

### Question 2: Task Definition Approach

Use AskUserQuestion:

Question: "How would you like to define tasks?"
Header: "Task setup"
Options:
  - File (I have a task list file ready)
  - Guided (Help me create tasks interactively)
  - Custom (Other approach)

If "File":
  Ask for file path
  Validate file exists and has correct format

If "Guided":
  Enter iterative task creation mode (see below)

### Question 3: Coordination Mode

Use AskUserQuestion:

Question: "How should agents coordinate?"
Header: "Coordination"
Options:
  - Team Leader (One agent coordinates others)
  - Collaborative (Agents coordinate as peers)
  - Autonomous (Independent work, minimal coordination)

### Iterative Task Creation (If "Guided" Selected)

For each agent (1 to N from Question 1):

**Question A: Agent Name**
Question: "What should we call agent [number]?"
Header: "Agent name"
Options:
  - auth-agent
  - api-agent
  - ui-agent
  - db-agent
  (Provide relevant suggestions based on common patterns)

**Question B: Task Type**
Question: "What task for [agent-name]?"
Header: "Task type"
Options:
  - Authentication (User auth, JWT, OAuth)
  - API Endpoints (REST/GraphQL APIs)
  - UI Components (Frontend components)
  - Database (Schema, migrations, queries)
  - Testing (Test suites and coverage)
  - Documentation (Docs, README, guides)

**Question C: Dependencies**
Question: "What does [agent-name] depend on?"
Header: "Dependencies"
multiSelect: true
Options:
  - [List of previously defined agents]
  - No dependencies

**Question D: Base Branch**
Question: "Which base branch for PR?"
Header: "PR base"
Options:
  - main
  - staging
  - develop

Store all task information for each agent.

### Generate Task List File

After collecting all agent task details:

1. Ask for project name
2. Generate task list in proper format
3. Save to `.daisy/swarm/tasks.md`
4. Show user the file path
5. Proceed with launch using generated task list
```

## Best Practices

### Question Writing

1. **Be specific**: "Which database?" not "Choose option?"
2. **Explain trade-offs**: Describe pros/cons in option descriptions
3. **Provide context**: Question text should stand alone
4. **Guide decisions**: Help user make informed choice
5. **Keep concise**: Header max 12 chars, descriptions 1-2 sentences

### Option Design

1. **Meaningful labels**: Specific, clear names
2. **Informative descriptions**: Explain what each option does
3. **Show trade-offs**: Help user understand implications
4. **Consistent detail**: All options equally explained
5. **2-4 options**: Not too few, not too many

### Flow Design

1. **Logical order**: Questions flow naturally
2. **Build on previous**: Later questions use earlier answers
3. **Minimize questions**: Ask only what's needed
4. **Group related**: Ask related questions together
5. **Show progress**: Indicate where in flow

### User Experience

1. **Set expectations**: Tell user what to expect
2. **Explain why**: Help user understand purpose
3. **Provide defaults**: Suggest recommended options
4. **Allow escape**: Let user cancel or restart
5. **Confirm actions**: Summarize before executing

## Common Patterns

### Pattern: Feature Selection

```markdown
Use AskUserQuestion:

Question: "Which features do you need?"
Header: "Features"
multiSelect: true
Options:
  - Authentication
  - Authorization
  - Rate Limiting
  - Caching
```

### Pattern: Environment Configuration

```markdown
Use AskUserQuestion:

Question: "Which environment is this?"
Header: "Environment"
Options:
  - Development (Local development)
  - Staging (Pre-production testing)
  - Production (Live environment)
```

### Pattern: Priority Selection

```markdown
Use AskUserQuestion:

Question: "What's the priority for this task?"
Header: "Priority"
Options:
  - Critical (Must be done immediately)
  - High (Important, do soon)
  - Medium (Standard priority)
  - Low (Nice to have)
```

### Pattern: Scope Selection

```markdown
Use AskUserQuestion:

Question: "What scope should we analyze?"
Header: "Scope"
Options:
  - Current file (Just this file)
  - Current directory (All files in directory)
  - Entire project (Full codebase scan)
```

## Combining Arguments and Questions

### Use Both Appropriately

**Arguments for known values:**
```markdown
---
argument-hint: [project-name]
allowed-tools: AskUserQuestion, Write
---

Setup for project: $1

Now gather additional configuration...

Use AskUserQuestion for options that require explanation.
```

**Questions for complex choices:**
```markdown
Project name from argument: $1

Now use AskUserQuestion to choose:
- Architecture pattern
- Technology stack
- Deployment strategy

These require explanation, so questions work better than arguments.
```

## Troubleshooting

**Questions not appearing:**
- Verify AskUserQuestion in allowed-tools
- Check question format is correct
- Ensure options array has 2-4 items

**User can't make selection:**
- Check option labels are clear
- Verify descriptions are helpful
- Consider if too many options
- Ensure multiSelect setting is correct

**Flow feels confusing:**
- Reduce number of questions
- Group related questions
- Add explanation between stages
- Show progress through workflow

With AskUserQuestion, commands become interactive wizards that guide users through complex decisions while maintaining the clarity that simple arguments provide for straightforward inputs.
