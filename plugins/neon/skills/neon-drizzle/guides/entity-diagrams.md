# Entity Diagrams — Neon + Vercel Deploy Platform

## Schema Overview

```
 ╔══════════════════════════════════════════════════════════════════╗
 ║                    ENTITY RELATIONSHIP MAP                      ║
 ╠══════════════════════════════════════════════════════════════════╣
 ║                                                                 ║
 ║   ┌──────────┐        ┌────────────┐        ┌──────────────┐   ║
 ║   │  USERS   │───────<│  PROJECTS  │───────<│  DEPLOYMENTS │   ║
 ║   │──────────│  owns  │────────────│  has   │──────────────│   ║
 ║   │ id    PK │        │ id      PK │        │ id        PK │   ║
 ║   │ name     │        │ name       │        │ project_id FK│   ║
 ║   │ email  U │        │ slug     U │        │ neon_br_id FK│   ║
 ║   │ github_id│        │ owner_id FK│        │ trigger_id FK│   ║
 ║   │ role     │        │ neon_proj  │        │ environment  │   ║
 ║   │ avatar   │        │ vercel_proj│        │ status       │   ║
 ║   │ created  │        │ github_repo│        │ vercel_url   │   ║
 ║   │ updated  │        │ prod_branch│        │ commit_sha   │   ║
 ║   └──────────┘        │ created    │        │ pr_number    │   ║
 ║        │              │ updated    │        │ build_ms     │   ║
 ║        │              └────────────┘        │ meta (jsonb) │   ║
 ║        │                    │               │ created      │   ║
 ║        │ triggers           │ has           │ ready_at     │   ║
 ║        │                    ▼               └──────────────┘   ║
 ║        │          ┌──────────────────┐            │            ║
 ║        └─────────>│  NEON_BRANCHES   │<───────────┘            ║
 ║                   │──────────────────│     uses                ║
 ║                   │ id            PK │                         ║
 ║                   │ project_id    FK │       ┌─────────────┐   ║
 ║                   │ neon_branch_id   │       │ DEPLOY_LOGS │   ║
 ║                   │ name             │       │─────────────│   ║
 ║                   │ parent_branch_id │       │ id       PK │   ║
 ║                   │ status           │       │ deploy_id FK│   ║
 ║                   │ pr_number        │       │ level       │   ║
 ║                   │ pooled_uri       │       │ message     │   ║
 ║                   │ direct_uri       │       │ timestamp   │   ║
 ║                   │ created          │       └─────────────┘   ║
 ║                   │ deleted_at       │             ▲            ║
 ║                   └──────────────────┘             │            ║
 ║                                          DEPLOYMENTS ──< logs  ║
 ║                                                                 ║
 ╚══════════════════════════════════════════════════════════════════╝

 Legend:  PK = Primary Key   FK = Foreign Key   U = Unique
          ───< = one-to-many   ──── = reference
```

---

## Sequence Diagram 1: From the DEVELOPER (User) Perspective

_"I push a commit. What happens to my data across the system?"_

```
 ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐
 │ Developer│  │  GitHub   │  │  Actions  │  │   Neon   │  │ Vercel  │  │ Database │
 │ (User)   │  │   Repo    │  │  Runner   │  │   API    │  │  CLI    │  │  Tables  │
 └────┬─────┘  └────┬─────┘  └────┬──────┘  └────┬─────┘  └────┬────┘  └────┬─────┘
      │              │             │              │             │             │
      │  git push    │             │              │             │             │
      │─────────────>│             │              │             │             │
      │              │             │              │             │             │
      │              │  PR opened  │              │             │             │
      │              │────────────>│              │             │             │
      │              │             │              │             │             │
      │              │             │ create-branch│             │             │
      │              │             │─────────────>│             │             │
      │              │             │              │             │             │
      │              │             │   branch_id  │             │             │
      │              │             │   db_url     │             │             │
      │              │             │<─────────────│             │             │
      │              │             │              │             │             │
      │              │             │              │  INSERT     │             │
      │              │             │              │  neon_branches             │
      │              │             │              │────────────────────────── >│
      │              │             │              │             │             │
      │              │             │  vercel build│             │             │
      │              │             │─────────────────────────── >│             │
      │              │             │              │             │             │
      │              │             │    deploy    │             │             │
      │              │             │    --prebuilt│             │             │
      │              │             │─────────────────────────── >│             │
      │              │             │              │             │             │
      │              │             │  deploy_url  │             │             │
      │              │             │<────────────────────────── │             │
      │              │             │              │             │             │
      │              │             │              │  INSERT     │             │
      │              │             │              │  deployments│             │
      │              │             │              │────────────────────────── >│
      │              │             │              │             │             │
      │              │  PR comment │              │             │             │
      │              │  (URLs)     │              │             │             │
      │              │<────────────│              │             │             │
      │              │             │              │             │             │
      │  Preview URL │             │              │             │             │
      │<─────────────│             │              │             │             │
      │              │             │              │             │             │
 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  PR MERGED  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
      │              │             │              │             │             │
      │  merge PR    │             │              │             │             │
      │─────────────>│             │              │             │             │
      │              │  PR closed  │              │             │             │
      │              │────────────>│              │             │             │
      │              │             │ delete-branch│             │             │
      │              │             │─────────────>│             │             │
      │              │             │              │  UPDATE     │             │
      │              │             │              │  neon_branches             │
      │              │             │              │  status=deleted            │
      │              │             │              │────────────────────────── >│
      │              │             │              │             │             │
      │              │  push main  │              │             │             │
      │              │────────────>│              │             │             │
      │              │             │  vercel build│             │             │
      │              │             │  --prod      │             │             │
      │              │             │─────────────────────────── >│             │
      │              │             │              │             │             │
      │              │             │ deploy --prod│             │             │
      │              │             │─────────────────────────── >│             │
      │              │             │              │             │             │
      │  Production  │             │  INSERT      │             │             │
      │  live!       │             │  deployments │             │             │
      │              │             │  env=production             │             │
      │              │             │──────────────────────────────────────── >│
      │              │             │              │             │             │
 ┌────┴─────┐  ┌────┴─────┐  ┌────┴──────┐  ┌────┴─────┐  ┌────┴────┐  ┌────┴─────┐
 │ Developer│  │  GitHub   │  │  Actions  │  │   Neon   │  │ Vercel  │  │ Database │
 └──────────┘  └──────────┘  └───────────┘  └──────────┘  └─────────┘  └──────────┘
```

---

## Sequence Diagram 2: From the NEON BRANCH Perspective

_"I am a Neon branch. What is my lifecycle?"_

```
 ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
 │ Neon Branch  │  │  Neon    │  │  GitHub  │  │ Vercel   │  │ Database │
 │ preview/pr-N │  │  API     │  │  Actions │  │ Preview  │  │  Tables  │
 └──────┬───────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
        │               │             │              │             │
   ─ ─ BIRTH ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
        │               │             │              │             │
        │  create me    │             │              │             │
        │  (CoW from    │             │              │             │
        │   main)       │             │              │             │
        │<──────────────│<────────────│              │             │
        │               │             │              │             │
        │ status:       │  branch_id  │              │             │
        │ creating      │────────────>│              │             │
        │ ─ ─ ─ ─>      │             │              │             │
        │ active        │             │  INSERT      │             │
        │               │             │  neon_branches│            │
        │               │             │  status=active             │
        │               │             │─────────────────────────── >│
        │               │             │              │             │
   ─ ─ USED ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
        │               │             │              │             │
        │  db_url       │             │              │             │
        │──────────────────────────────────────────>│             │
        │               │             │              │             │
        │  queries via  │             │              │             │
        │  pooler       │             │  build uses  │             │
        │<──────────────────────────── │  my db_url  │             │
        │               │             │              │             │
        │  migrations   │             │              │             │
        │  via direct   │             │              │             │
        │<──────────────│<────────────│              │             │
        │               │             │              │             │
   ─ ─ SCHEMA DIFF ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
        │               │             │              │             │
        │  compare me   │             │              │             │
        │  vs main      │             │              │             │
        │<──────────────│<────────────│              │             │
        │               │             │              │             │
        │  diff result  │             │              │             │
        │──────────────>│────────────>│              │             │
        │               │  post on PR │              │             │
        │               │             │              │             │
   ─ ─ RESET (optional) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
        │               │             │              │             │
        │  reset to     │             │              │             │
        │  parent       │             │              │             │
        │<──────────────│<────────────│              │             │
        │               │             │              │             │
        │ status:       │             │  UPDATE      │             │
        │ resetting     │             │  neon_branches│            │
        │ ─ ─ ─ ─>      │             │  status=active             │
        │ active        │             │─────────────────────────── >│
        │               │             │              │             │
   ─ ─ DEATH ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
        │               │             │              │             │
        │  delete me    │             │              │             │
        │<──────────────│<────────────│              │             │
        │               │             │              │             │
        │ status:       │             │  UPDATE      │             │
        │ deleting      │             │  neon_branches│            │
        │ ─ ─ ─ ─>      │             │  status=deleted            │
        │ deleted       │             │  deleted_at=now()          │
        ╳               │             │─────────────────────────── >│
                        │             │              │             │
 ┌──────────────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐
 │   (gone)     │  │  Neon    │  │  GitHub  │  │ Vercel   │  │ Database │
 └──────────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## Sequence Diagram 3: From the VERCEL DEPLOYMENT Perspective

_"I am a deployment. How do I come to life?"_

```
 ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
 │Deployment │  │ Vercel   │  │  GitHub  │  │   Neon   │  │ Database │  │   User   │
 │ (me)      │  │  CLI     │  │  Actions │  │  Branch  │  │  Tables  │  │ Browser  │
 └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │              │             │              │             │             │
  ─ ─ PREVIEW DEPLOYMENT ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
       │              │             │              │             │             │
       │              │  PR event   │              │             │             │
       │              │<────────────│              │             │             │
       │              │             │              │             │             │
       │              │             │  get db_url  │             │             │
       │              │             │─────────────>│             │             │
       │              │             │<─────────────│             │             │
       │              │             │              │             │             │
       │              │  vercel pull│              │             │             │
       │  status:     │<────────────│              │             │             │
       │  pending     │             │              │             │             │
       │              │             │              │  INSERT     │             │
       │              │             │              │  deployments│             │
       │              │             │              │  status=pending           │
       │              │             │              │────────────>│             │
       │              │             │              │             │             │
       │              │  vercel     │              │             │             │
       │  status:     │  build      │              │             │             │
       │  building    │<────────────│              │             │             │
       │              │  (with      │              │             │             │
       │              │  DATABASE_URL              │             │             │
       │              │  from neon) │              │             │             │
       │              │────────────>│              │  UPDATE     │             │
       │              │  build OK   │              │  status=    │             │
       │              │             │              │  building   │             │
       │              │             │              │────────────>│             │
       │              │             │              │             │             │
       │              │  vercel     │              │             │             │
       │  status:     │  deploy     │              │             │             │
       │  deploying   │  --prebuilt │              │  UPDATE     │             │
       │              │<────────────│              │  status=    │             │
       │              │             │              │  deploying  │             │
       │              │             │              │────────────>│             │
       │              │             │              │             │             │
       │  deploy_url  │             │              │             │             │
       │──────────────>│────────────>│              │             │             │
       │              │             │              │             │             │
       │  status:     │             │              │  UPDATE     │             │
       │  ready       │             │              │  status=ready             │
       │              │             │              │  vercel_url=              │
       │              │             │              │  ready_at=now()           │
       │              │             │              │────────────>│             │
       │              │             │              │             │             │
       │              │             │  PR comment  │             │             │
       │              │             │──────────────────────────────────────── >│
       │              │             │  (preview URL)             │             │
       │              │             │              │             │             │
       │              │             │              │             │  click URL  │
       │<──────────────────────────────────────────────────────── ────────────│
       │              │             │              │             │             │
       │  serve app   │             │              │             │             │
       │──────────────────────────── ──────────────────────────── ───────────>│
       │              │             │              │             │             │
  ─ ─ PRODUCTION DEPLOYMENT ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
       │              │             │              │             │             │
       │              │  push main  │   uses main  │             │             │
       │  status:     │<────────────│   Neon branch│             │             │
       │  pending     │             │   (prod DB)  │             │             │
       │              │  build+deploy              │             │             │
       │  status:     │  --prod     │              │  INSERT     │             │
       │  ready       │             │              │  deployments│             │
       │              │────────────>│              │  env=production           │
       │              │             │              │────────────>│             │
       │              │             │              │             │             │
 ┌─────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐
 │Deployment │  │ Vercel   │  │  GitHub  │  │   Neon   │  │ Database │  │   User   │
 └───────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## Sequence Diagram 4: From the PROJECT Perspective

_"I am a project. How do all my children relate?"_

```
 ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐
 │ Project  │  │  Owner   │  │ Neon Branch  │  │  Deployment  │  │  Deploy  │
 │ (me)     │  │ (User)   │  │  (child)     │  │   (child)    │  │  Log     │
 └────┬─────┘  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘
      │              │               │                 │               │
 ─ ─ CREATION ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
      │              │               │                 │               │
      │  created by  │               │                 │               │
      │<─────────────│               │                 │               │
      │  owner_id=   │               │                 │               │
      │  user.id     │               │                 │               │
      │              │               │                 │               │
      │  configured with:            │                 │               │
      │  neon_project_id             │                 │               │
      │  vercel_project_id           │                 │               │
      │  github_repo                 │                 │               │
      │              │               │                 │               │
 ─ ─ PR #42 OPENED ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
      │              │               │                 │               │
      │  spawn branch│               │                 │               │
      │─────────────────────────────>│                 │               │
      │              │  preview/     │                 │               │
      │              │  pr-42        │                 │               │
      │              │               │                 │               │
      │  spawn deployment            │                 │               │
      │──────────────────────────────────────────────>│               │
      │              │               │  uses branch   │               │
      │              │               │<───────────────│               │
      │              │               │                 │               │
      │              │               │                 │  log: build   │
      │              │               │                 │──────────────>│
      │              │               │                 │  log: deploy  │
      │              │               │                 │──────────────>│
      │              │               │                 │  log: ready   │
      │              │               │                 │──────────────>│
      │              │               │                 │               │
 ─ ─ PR #42 UPDATED (new push) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
      │              │               │                 │               │
      │  reuse branch│               │                 │               │
      │─────────────────────────────>│                 │               │
      │              │               │                 │               │
      │  new deployment              │                 │               │
      │──────────────────────────────────────────────>│               │
      │              │               │                 │  log: build   │
      │              │               │                 │──────────────>│
      │              │               │                 │               │
 ─ ─ PR #42 MERGED ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
      │              │               │                 │               │
      │  delete branch               │                 │               │
      │─────────────────────────────>╳                 │               │
      │              │  (deleted)    │                 │               │
      │              │               │                 │               │
      │  production deployment       │                 │               │
      │──────────────────────────────────────────────>│               │
      │              │               │  uses main     │               │
      │              │               │  Neon (no FK)  │               │
      │              │               │                 │  log: prod    │
      │              │               │                 │──────────────>│
      │              │               │                 │               │
 ─ ─ CURRENT STATE ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
      │              │               │                 │               │
      │  My children:│               │                 │               │
      │  0 active branches           │                 │               │
      │  3 deployments (2 preview, 1 prod)             │               │
      │  7 deploy logs               │                 │  7 log rows   │
      │              │               │                 │               │
 ┌────┴─────┐  ┌────┴─────┐  ┌──────┴───────┐  ┌──────┴───────┐  ┌────┴─────┐
 │ Project  │  │  Owner   │  │ Neon Branch  │  │  Deployment  │  │  Deploy  │
 └──────────┘  └──────────┘  └──────────────┘  └──────────────┘  └──────────┘
```

---

## Sequence Diagram 5: From the DEPLOY LOG Perspective

_"I am a deploy log entry. What is my context?"_

```
 ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐
 │Deploy Log│  │  Deployment  │  │  Project  │  │ Neon Branch  │  │   User   │
 │ (me)     │  │  (parent)    │  │ (grandpa) │  │  (uncle)     │  │(trigger) │
 └────┬─────┘  └──────┬───────┘  └────┬──────┘  └──────┬───────┘  └────┬─────┘
      │               │               │                │               │
      │  I belong to  │               │                │               │
      │  deployment   │               │                │               │
      │  #deploy_id   │               │                │               │
      │──────────────>│               │                │               │
      │               │               │                │               │
      │               │  which is     │                │               │
      │               │  owned by     │                │               │
      │               │  project      │                │               │
      │               │──────────────>│                │               │
      │               │               │                │               │
      │               │  and uses     │                │               │
      │               │  neon branch  │                │               │
      │               │──────────────────────────────>│               │
      │               │               │                │               │
      │               │  triggered by │                │               │
      │               │  a user       │                │               │
      │               │──────────────────────────────────────────────>│
      │               │               │                │               │
      │  My record:   │               │                │               │
      │ ┌───────────────────────────────────────────────────────────┐ │
      │ │  deploy_logs                                              │ │
      │ │ ─────────────────────────────────────────────────────── │ │
      │ │  id:            42                                       │ │
      │ │  deployment_id: 7         ──> deployments.id             │ │
      │ │  level:         "info"                                   │ │
      │ │  message:       "Build completed in 12.4s"               │ │
      │ │  timestamp:     2026-02-14T10:30:00Z                     │ │
      │ └───────────────────────────────────────────────────────────┘ │
      │               │               │                │               │
      │  I can trace  │               │                │               │
      │  my full      │               │                │               │
      │  lineage:     │               │                │               │
      │               │               │                │               │
      │  log.deployment.project.owner.name = "Alice"   │               │
      │  log.deployment.neonBranch.name = "preview/pr-42"             │
      │  log.deployment.environment = "preview"        │               │
      │  log.deployment.vercelUrl = "my-app-pr-42.vercel.app"        │
      │               │               │                │               │
 ┌────┴─────┐  ┌──────┴───────┐  ┌────┴──────┐  ┌──────┴───────┐  ┌────┴─────┐
 │Deploy Log│  │  Deployment  │  │  Project  │  │ Neon Branch  │  │   User   │
 └──────────┘  └──────────────┘  └──────────┘  └──────────────┘  └──────────┘
```

---

## Table Schema Quick Reference

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                         TABLE SCHEMAS                               │
 ├─────────────────────────────────────────────────────────────────────┤
 │                                                                     │
 │  users                        projects                              │
 │  ┌─────────────┬──────────┐   ┌──────────────────┬──────────────┐  │
 │  │ id          │ serial PK│   │ id               │ serial PK    │  │
 │  │ name        │ text     │   │ name             │ varchar(128) │  │
 │  │ email       │ varchar U│   │ slug             │ varchar U    │  │
 │  │ avatar_url  │ text?    │   │ owner_id         │ int FK→users │  │
 │  │ github_id   │ varchar U│   │ neon_project_id  │ varchar?     │  │
 │  │ role        │ varchar  │   │ vercel_project_id│ varchar?     │  │
 │  │ created_at  │ timestamp│   │ github_repo      │ varchar?     │  │
 │  │ updated_at  │ timestamp│   │ production_branch│ varchar      │  │
 │  └─────────────┴──────────┘   │ created_at       │ timestamp    │  │
 │                                │ updated_at       │ timestamp    │  │
 │                                └──────────────────┴──────────────┘  │
 │                                                                     │
 │  neon_branches                 deployments                          │
 │  ┌───────────────────┬──────┐  ┌──────────────────┬──────────────┐ │
 │  │ id                │ser PK│  │ id               │ serial PK    │ │
 │  │ project_id        │FK→prj│  │ project_id       │ FK→projects  │ │
 │  │ neon_branch_id    │ vchar│  │ neon_branch_id   │ FK→neon_br?  │ │
 │  │ name              │ vchar│  │ triggered_by_id  │ FK→users?    │ │
 │  │ parent_branch_id  │ vch? │  │ environment      │ enum         │ │
 │  │ status            │ enum │  │ status           │ enum         │ │
 │  │ pr_number         │ int? │  │ vercel_deploy_id │ varchar?     │ │
 │  │ pooled_conn_uri   │ text?│  │ vercel_url       │ text?        │ │
 │  │ direct_conn_uri   │ text?│  │ commit_sha       │ varchar(40)? │ │
 │  │ created_at        │ ts   │  │ commit_message   │ text?        │ │
 │  │ deleted_at        │ ts?  │  │ pr_number        │ int?         │ │
 │  └───────────────────┴──────┘  │ build_duration_ms│ int?         │ │
 │                                 │ meta             │ jsonb?       │ │
 │  deploy_logs                    │ created_at       │ timestamp    │ │
 │  ┌───────────────┬──────────┐  │ ready_at         │ timestamp?   │ │
 │  │ id            │ serial PK│  └──────────────────┴──────────────┘ │
 │  │ deployment_id │ FK→deplY │                                      │
 │  │ level         │ varchar  │   Enums:                              │
 │  │ message       │ text     │   deployment_status: pending |        │
 │  │ timestamp     │ timestamp│     building | deploying | ready |    │
 │  └───────────────┴──────────┘     error | canceled                  │
 │                                 branch_status: creating | active |  │
 │  Indexes:                         resetting | deleting | deleted    │
 │   neon_branches_project_idx     environment: preview | staging |    │
 │   neon_branches_pr_idx            production                        │
 │   deployments_project_idx                                           │
 │   deployments_status_idx                                            │
 │   deploy_logs_deployment_idx                                        │
 │                                                                     │
 └─────────────────────────────────────────────────────────────────────┘
```
