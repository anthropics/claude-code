# Neon + Vercel Branching — Entity Schema

## Entity Overview

The system has **7 core entities** that interact across 3 platforms (GitHub, Neon, Vercel).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ENTITY SCHEMA                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐    │
│  │  Developer    │────▶│  Git Branch  │────▶│  Pull Request        │    │
│  │              │     │              │     │                      │    │
│  │ • push       │     │ • name       │     │ • number             │    │
│  │ • merge      │     │ • ref        │     │ • state (open/close) │    │
│  │ • close PR   │     │ • sha        │     │ • head_branch        │    │
│  └──────────────┘     └──────┬───────┘     └──────────┬───────────┘    │
│                              │                        │                 │
│                 ┌────────────┼────────────────────────┼──────────┐      │
│                 │            ▼                        ▼          │      │
│                 │  ┌──────────────────┐    ┌──────────────────┐  │      │
│                 │  │  Neon Branch     │    │  GitHub Workflow  │  │      │
│                 │  │                  │    │                  │  │      │
│                 │  │ • branch_id      │    │ • name           │  │      │
│                 │  │ • branch_name    │    │ • trigger        │  │      │
│                 │  │ • parent_id      │    │ • jobs[]         │  │      │
│                 │  │ • project_id     │    │ • concurrency    │  │      │
│                 │  │ • db_url         │    └────────┬─────────┘  │      │
│                 │  │ • db_url_pooled  │             │            │      │
│                 │  │ • role           │             ▼            │      │
│                 │  └────────┬─────────┘   ┌──────────────────┐  │      │
│                 │           │             │  Vercel Deploy   │  │      │
│                 │           │             │                  │  │      │
│                 │           ▼             │ • url            │  │      │
│                 │  ┌──────────────────┐   │ • environment    │  │      │
│                 │  │  Database Schema │   │ • build_env{}    │  │      │
│                 │  │                  │   │ • status         │  │      │
│                 │  │ • tables[]       │   └──────────────────┘  │      │
│                 │  │ • columns[]      │                         │      │
│                 │  │ • indexes[]      │                         │      │
│                 │  │ • constraints[]  │                         │      │
│                 │  └──────────────────┘                         │      │
│                 │                                               │      │
│                 │              PLATFORM BOUNDARY                │      │
│                 └───────────────────────────────────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Entity Definitions

### 1. Developer

```
┌─────────────────────────────────────┐
│ Developer                           │
├─────────────────────────────────────┤
│ Actions:                            │
│   • git push → triggers preview     │
│   • git merge → triggers production │
│   • PR close → triggers cleanup     │
│   • /neon-branching create          │
│   • /neon-branching delete          │
│   • /neon-branching reset           │
│   • /neon-branching diff            │
│   • /neon-branching setup           │
├─────────────────────────────────────┤
│ Consumes:                           │
│   • DATABASE_URL (migrations)       │
│   • DATABASE_URL_POOLED (runtime)   │
│   • Vercel preview URL              │
│   • Schema diff PR comment          │
│   • E2E test results                │
└─────────────────────────────────────┘
```

### 2. Git Branch

```
┌─────────────────────────────────────┐
│ Git Branch                          │
├─────────────────────────────────────┤
│ Fields:                             │
│   name:    string (e.g. "feat/x")   │
│   ref:     string (refs/heads/...)  │
│   sha:     string (commit hash)     │
├─────────────────────────────────────┤
│ Maps To:                            │
│   main       → Neon default branch  │
│   feat/*     → preview/<name>       │
│   dev        → dev (Neon)           │
├─────────────────────────────────────┤
│ Triggers:                           │
│   push       → production workflow  │
│   PR open    → preview workflow     │
│   PR sync    → preview workflow     │
│   PR close   → cleanup workflow     │
└─────────────────────────────────────┘
```

### 3. Pull Request

```
┌─────────────────────────────────────┐
│ Pull Request                        │
├─────────────────────────────────────┤
│ Fields:                             │
│   number:       int (e.g. 42)       │
│   state:        open | closed       │
│   head_branch:  string              │
│   base_branch:  string (main)       │
├─────────────────────────────────────┤
│ Creates:                            │
│   Neon branch:  preview/pr-<N>      │
│   Vercel:       preview deployment  │
├─────────────────────────────────────┤
│ Lifecycle:                          │
│   opened     → create branch+deploy│
│   synchronize→ rebuild preview      │
│   reopened   → recreate branch      │
│   closed     → delete Neon branch   │
└─────────────────────────────────────┘
```

### 4. Neon Branch

```
┌─────────────────────────────────────┐
│ Neon Branch                         │
├─────────────────────────────────────┤
│ Fields:                             │
│   branch_id:     string (uuid)      │
│   branch_name:   string             │
│   parent_id:     string (→ default) │
│   project_id:    string             │
│   db_url:        connection string  │
│   db_url_pooled: pooled conn string │
│   role:          owner | readonly   │
├─────────────────────────────────────┤
│ Branch Types:                       │
│   default   → production (main)     │
│   preview/* → ephemeral (per PR)    │
│   dev       → persistent (resets)   │
├─────────────────────────────────────┤
│ Operations:                         │
│   create    → copy-on-write fork    │
│   delete    → destroy branch + data │
│   reset     → recreate from parent  │
│   diff      → compare schemas       │
└─────────────────────────────────────┘
```

### 5. GitHub Workflow

```
┌─────────────────────────────────────┐
│ GitHub Workflow                     │
├─────────────────────────────────────┤
│ Instances:                          │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ neon-vercel-preview.yml         │ │
│ │ trigger: PR open/sync/reopen   │ │
│ │ jobs: neon-branch,             │ │
│ │       schema-diff,             │ │
│ │       vercel-preview           │ │
│ │ concurrency: preview-<PR#>     │ │
│ │ cancel-in-progress: true       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ neon-vercel-cleanup.yml         │ │
│ │ trigger: PR closed             │ │
│ │ jobs: delete-neon-branch       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ neon-vercel-production.yml      │ │
│ │ trigger: push to main          │ │
│ │ jobs: neon-reset,              │ │
│ │       vercel-production        │ │
│ │ concurrency: production        │ │
│ │ cancel-in-progress: false      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ neon-vercel-e2e.yml             │ │
│ │ trigger: repository_dispatch   │ │
│ │ event: vercel.deployment.success│ │
│ │ jobs: e2e (Playwright)         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 6. Vercel Deploy

```
┌─────────────────────────────────────┐
│ Vercel Deploy                       │
├─────────────────────────────────────┤
│ Fields:                             │
│   url:          string (deploy URL) │
│   environment:  preview | production│
│   status:       building | ready    │
├─────────────────────────────────────┤
│ Build Environment:                  │
│   DATABASE_URL:        direct conn  │
│   DATABASE_URL_POOLED: pooled conn  │
│   NEON_BRANCH_ID:      branch uuid  │
│   NEON_BRANCH_NAME:    branch name  │
├─────────────────────────────────────┤
│ Events Emitted:                     │
│   vercel.deployment.success →       │
│     triggers E2E workflow           │
└─────────────────────────────────────┘
```

### 7. Database Schema

```
┌─────────────────────────────────────┐
│ Database Schema                     │
├─────────────────────────────────────┤
│ Fields:                             │
│   tables[]:     table definitions   │
│   columns[]:    column definitions  │
│   indexes[]:    index definitions   │
│   constraints[]:FK, unique, check   │
├─────────────────────────────────────┤
│ Operations:                         │
│   migrate   → apply DDL changes     │
│   diff      → compare two branches  │
│   describe  → list table structure  │
│   query     → run SQL (via MCP)     │
├─────────────────────────────────────┤
│ Connections:                        │
│   Direct:   DATABASE_URL            │
│             → migrations, admin     │
│   Pooled:   DATABASE_URL_POOLED     │
│             → runtime queries       │
│             → serverless functions  │
└─────────────────────────────────────┘
```

## Relationship Table

| From | To | Relationship | Cardinality |
|------|----|-------------|-------------|
| Developer | Git Branch | creates/pushes | 1 → many |
| Developer | Pull Request | opens/closes | 1 → many |
| Git Branch | Pull Request | is head of | 1 → 0..1 |
| Pull Request | Neon Branch | triggers creation | 1 → 1 |
| Pull Request | GitHub Workflow | triggers run | 1 → many |
| GitHub Workflow | Neon Branch | creates/deletes/resets | 1 → 1 |
| GitHub Workflow | Vercel Deploy | builds/deploys | 1 → 1 |
| Neon Branch | Database Schema | contains | 1 → 1 |
| Neon Branch | Vercel Deploy | provides DATABASE_URL | 1 → 1 |
| Vercel Deploy | GitHub Workflow | dispatches E2E | 1 → 0..1 |
