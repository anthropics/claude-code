-- Neon Branch Tracking Schema
--
-- Tracks the lifecycle of Neon database branches, their relationship to
-- Git branches, Vercel deployments, and PR state. This schema runs on
-- the production Neon branch and is forked into every preview branch.
--
-- Entity relationships:
--   git_branches 1──N neon_branches
--   neon_branches 1──1 vercel_deployments
--   neon_branches 1──N schema_diffs
--   pull_requests 1──1 neon_branches (preview)
--   pull_requests 1──N workflow_runs

-- ─── Git Branches ──────────────────────────────────────────────────────────
-- Source of truth for Git branch state. Populated by branch-neon-sync.yml.

CREATE TABLE IF NOT EXISTS git_branches (
    id              SERIAL PRIMARY KEY,
    branch_name     TEXT NOT NULL UNIQUE,        -- e.g. 'claude/agent-teams-abc123'
    branch_type     TEXT NOT NULL DEFAULT 'feature'
                    CHECK (branch_type IN ('feature', 'deploy', 'hotfix', 'release')),
    base_branch     TEXT NOT NULL DEFAULT 'main',
    created_by      TEXT,                        -- GitHub username
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_git_branches_active ON git_branches (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_git_branches_type ON git_branches (branch_type);

-- ─── Neon Branches ─────────────────────────────────────────────────────────
-- Tracks Neon database branches. One Git branch may have multiple Neon
-- branches (the branch itself + a preview/pr-N branch for the PR).

CREATE TABLE IF NOT EXISTS neon_branches (
    id              SERIAL PRIMARY KEY,
    neon_branch_id  TEXT NOT NULL UNIQUE,         -- Neon API branch ID
    branch_name     TEXT NOT NULL,                -- e.g. 'claude/agent-teams-abc123' or 'preview/pr-42'
    neon_project_id TEXT NOT NULL,
    git_branch_id   INTEGER REFERENCES git_branches(id) ON DELETE SET NULL,
    parent_branch   TEXT NOT NULL DEFAULT 'main', -- Neon parent branch name
    branch_purpose  TEXT NOT NULL DEFAULT 'development'
                    CHECK (branch_purpose IN ('development', 'preview', 'staging', 'migration_test')),
    db_url_pooled   TEXT,                        -- Pooled connection string (masked in logs)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT unique_active_neon_branch
        UNIQUE (branch_name, neon_project_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_neon_branches_active ON neon_branches (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_neon_branches_git ON neon_branches (git_branch_id);
CREATE INDEX idx_neon_branches_purpose ON neon_branches (branch_purpose);

-- ─── Vercel Deployments ────────────────────────────────────────────────────
-- Tracks Vercel preview/production deployments linked to Neon branches.

CREATE TABLE IF NOT EXISTS vercel_deployments (
    id                  SERIAL PRIMARY KEY,
    deployment_id       TEXT NOT NULL UNIQUE,       -- Vercel deployment ID
    preview_url         TEXT NOT NULL,              -- e.g. 'https://project-abc123.vercel.app'
    environment         TEXT NOT NULL DEFAULT 'preview'
                        CHECK (environment IN ('preview', 'staging', 'production')),
    neon_branch_id      INTEGER REFERENCES neon_branches(id) ON DELETE SET NULL,
    pr_number           INTEGER,
    git_commit_sha      TEXT NOT NULL,
    git_commit_message  TEXT,
    git_commit_ref      TEXT,                      -- Branch name at deploy time
    vercel_project_id   TEXT NOT NULL,
    build_status        TEXT NOT NULL DEFAULT 'pending'
                        CHECK (build_status IN ('pending', 'building', 'ready', 'error', 'canceled')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ready_at            TIMESTAMPTZ,

    CONSTRAINT fk_neon_branch
        FOREIGN KEY (neon_branch_id) REFERENCES neon_branches(id)
);

CREATE INDEX idx_vercel_deployments_pr ON vercel_deployments (pr_number);
CREATE INDEX idx_vercel_deployments_env ON vercel_deployments (environment);
CREATE INDEX idx_vercel_deployments_status ON vercel_deployments (build_status);
CREATE INDEX idx_vercel_deployments_neon ON vercel_deployments (neon_branch_id);

-- ─── Pull Requests ─────────────────────────────────────────────────────────
-- Tracks PR state and links to Neon preview branch + Vercel deployment.

CREATE TABLE IF NOT EXISTS pull_requests (
    id                  SERIAL PRIMARY KEY,
    pr_number           INTEGER NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    state               TEXT NOT NULL DEFAULT 'open'
                        CHECK (state IN ('open', 'closed', 'merged')),
    head_branch         TEXT NOT NULL,              -- Git branch name
    base_branch         TEXT NOT NULL DEFAULT 'main',
    neon_preview_id     INTEGER REFERENCES neon_branches(id) ON DELETE SET NULL,
    vercel_deployment_id INTEGER REFERENCES vercel_deployments(id) ON DELETE SET NULL,
    author              TEXT,
    template_used       TEXT                        -- 'feature-branch', 'deploy-package', 'deterministic-object-usage'
                        CHECK (template_used IN ('feature-branch', 'deploy-package', 'deterministic-object-usage')),
    schema_diff_posted  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    merged_at           TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ
);

CREATE INDEX idx_pull_requests_state ON pull_requests (state);
CREATE INDEX idx_pull_requests_head ON pull_requests (head_branch);

-- ─── Schema Diffs ──────────────────────────────────────────────────────────
-- Records schema comparison results between Neon branches.

CREATE TABLE IF NOT EXISTS schema_diffs (
    id                  SERIAL PRIMARY KEY,
    pr_number           INTEGER REFERENCES pull_requests(pr_number) ON DELETE CASCADE,
    compare_branch      TEXT NOT NULL,              -- Neon branch name (head)
    base_branch         TEXT NOT NULL DEFAULT 'main',
    diff_summary        TEXT,                       -- Human-readable diff summary
    has_changes         BOOLEAN NOT NULL DEFAULT FALSE,
    tables_added        TEXT[] DEFAULT '{}',
    tables_removed      TEXT[] DEFAULT '{}',
    columns_added       TEXT[] DEFAULT '{}',
    columns_removed     TEXT[] DEFAULT '{}',
    indexes_changed     TEXT[] DEFAULT '{}',
    diff_posted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_diff_per_pr
        UNIQUE (pr_number, compare_branch, diff_posted_at)
);

CREATE INDEX idx_schema_diffs_pr ON schema_diffs (pr_number);
CREATE INDEX idx_schema_diffs_changes ON schema_diffs (has_changes) WHERE has_changes = TRUE;

-- ─── Workflow Runs ─────────────────────────────────────────────────────────
-- Tracks GitHub Actions workflow execution for audit trail.

CREATE TABLE IF NOT EXISTS workflow_runs (
    id                  SERIAL PRIMARY KEY,
    run_id              BIGINT NOT NULL UNIQUE,     -- GitHub Actions run ID
    workflow_name       TEXT NOT NULL,              -- e.g. 'Preview Deploy (Neon + Vercel)'
    workflow_file       TEXT NOT NULL,              -- e.g. 'preview-deploy.yml'
    trigger_event       TEXT NOT NULL,              -- e.g. 'pull_request', 'create', 'workflow_dispatch'
    status              TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
    conclusion          TEXT
                        CHECK (conclusion IN ('success', 'failure', 'cancelled', 'skipped', NULL)),
    pr_number           INTEGER REFERENCES pull_requests(pr_number) ON DELETE SET NULL,
    git_branch          TEXT,
    neon_branch_id      INTEGER REFERENCES neon_branches(id) ON DELETE SET NULL,
    vercel_deployment_id INTEGER REFERENCES vercel_deployments(id) ON DELETE SET NULL,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    duration_seconds    INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER
    ) STORED
);

CREATE INDEX idx_workflow_runs_workflow ON workflow_runs (workflow_file);
CREATE INDEX idx_workflow_runs_status ON workflow_runs (status);
CREATE INDEX idx_workflow_runs_pr ON workflow_runs (pr_number);

-- ─── Views ─────────────────────────────────────────────────────────────────

-- Active preview environments: join Neon branch + Vercel deployment + PR
CREATE OR REPLACE VIEW active_previews AS
SELECT
    pr.pr_number,
    pr.title AS pr_title,
    pr.head_branch,
    pr.author,
    nb.branch_name AS neon_branch,
    nb.neon_branch_id AS neon_id,
    vd.preview_url,
    vd.build_status,
    vd.created_at AS deployed_at,
    sd.has_changes AS has_schema_changes
FROM pull_requests pr
LEFT JOIN neon_branches nb ON pr.neon_preview_id = nb.id
LEFT JOIN vercel_deployments vd ON pr.vercel_deployment_id = vd.id
LEFT JOIN LATERAL (
    SELECT has_changes
    FROM schema_diffs
    WHERE pr_number = pr.pr_number
    ORDER BY diff_posted_at DESC
    LIMIT 1
) sd ON TRUE
WHERE pr.state = 'open'
  AND nb.is_active = TRUE;

-- Branch lifecycle audit: full history of a Git branch
CREATE OR REPLACE VIEW branch_lifecycle AS
SELECT
    gb.branch_name AS git_branch,
    gb.branch_type,
    gb.created_at AS branch_created,
    gb.closed_at AS branch_closed,
    nb.branch_name AS neon_branch,
    nb.branch_purpose,
    nb.created_at AS neon_created,
    nb.deleted_at AS neon_deleted,
    vd.preview_url,
    vd.environment,
    vd.build_status,
    wr.workflow_name AS last_workflow,
    wr.status AS workflow_status
FROM git_branches gb
LEFT JOIN neon_branches nb ON gb.id = nb.git_branch_id
LEFT JOIN vercel_deployments vd ON nb.id = vd.neon_branch_id
LEFT JOIN LATERAL (
    SELECT workflow_name, status
    FROM workflow_runs
    WHERE neon_branch_id = nb.id
    ORDER BY started_at DESC
    LIMIT 1
) wr ON TRUE
ORDER BY gb.created_at DESC;
