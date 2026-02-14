-- ============================================================================
-- Neon Serverless Postgres Schema
-- deterministic-viz: Deployment tracking + feature visualization persistence
-- ============================================================================

-- ── Deployment tracking ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deployments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_number       INTEGER,
    git_sha         VARCHAR(40) NOT NULL,
    git_branch      VARCHAR(255) NOT NULL,
    environment     VARCHAR(20) NOT NULL CHECK (environment IN ('preview', 'production')),
    vercel_url      TEXT,
    neon_branch     VARCHAR(255),
    neon_host       TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'building', 'deployed', 'failed', 'cleaned_up')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deployed_at     TIMESTAMPTZ,
    cleaned_up_at   TIMESTAMPTZ
);

CREATE INDEX idx_deployments_pr ON deployments (pr_number);
CREATE INDEX idx_deployments_env ON deployments (environment);
CREATE INDEX idx_deployments_status ON deployments (status);
CREATE INDEX idx_deployments_branch ON deployments (git_branch);

-- ── Schema migrations log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
    id              SERIAL PRIMARY KEY,
    version         VARCHAR(50) NOT NULL UNIQUE,
    description     TEXT,
    diff_summary    TEXT,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_by      VARCHAR(100) DEFAULT 'github-actions'
);

-- ── Feature visualization cache ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_visualizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name    VARCHAR(100) NOT NULL,
    changelog_hash  VARCHAR(64) NOT NULL,
    config          JSONB NOT NULL,
    mermaid_arch    TEXT NOT NULL,
    mermaid_seq     TEXT NOT NULL,
    era_mermaids    JSONB NOT NULL DEFAULT '{}',
    ascii_frames    JSONB NOT NULL DEFAULT '[]',
    version_count   INTEGER NOT NULL DEFAULT 0,
    era_count       INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    UNIQUE (feature_name, changelog_hash)
);

CREATE INDEX idx_viz_feature ON feature_visualizations (feature_name);
CREATE INDEX idx_viz_expires ON feature_visualizations (expires_at);

-- ── Neon branch metadata ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS neon_branches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_name     VARCHAR(255) NOT NULL UNIQUE,
    parent_branch   VARCHAR(255) NOT NULL DEFAULT 'main',
    pr_number       INTEGER,
    project_id      VARCHAR(100) NOT NULL,
    db_host         TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'deleted', 'error')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_neon_branches_pr ON neon_branches (pr_number);
CREATE INDEX idx_neon_branches_status ON neon_branches (status);

-- ── Workflow run log ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflow_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name   VARCHAR(100) NOT NULL,
    run_id          BIGINT,
    pr_number       INTEGER,
    trigger_event   VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'success', 'failure', 'cancelled')),
    deployment_id   UUID REFERENCES deployments(id),
    neon_branch_id  UUID REFERENCES neon_branches(id),
    duration_ms     INTEGER,
    metadata        JSONB DEFAULT '{}',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_workflow_runs_pr ON workflow_runs (pr_number);
CREATE INDEX idx_workflow_runs_workflow ON workflow_runs (workflow_name);
CREATE INDEX idx_workflow_runs_status ON workflow_runs (status);

-- ============================================================================
-- Entity Relationships (Mermaid ER source)
-- ============================================================================
--
-- erDiagram
--     deployments ||--o{ workflow_runs : "tracks"
--     neon_branches ||--o{ workflow_runs : "references"
--     deployments }o--|| neon_branches : "uses"
--     feature_visualizations ||--o| deployments : "cached_for"
--     schema_migrations ||--o| neon_branches : "applied_on"
--
-- ============================================================================
