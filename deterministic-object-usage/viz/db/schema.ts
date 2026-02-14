/**
 * Drizzle ORM schema for deterministic-viz deployment tracking.
 * Maps to the Neon Serverless Postgres tables defined in schema.sql.
 */

import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  jsonb,
  serial,
  bigint,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── Deployment tracking ─────────────────────────────────────────────────────

export const deployments = pgTable(
  "deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prNumber: integer("pr_number"),
    gitSha: varchar("git_sha", { length: 40 }).notNull(),
    gitBranch: varchar("git_branch", { length: 255 }).notNull(),
    environment: varchar("environment", { length: 20 }).notNull(), // 'preview' | 'production'
    vercelUrl: text("vercel_url"),
    neonBranch: varchar("neon_branch", { length: 255 }),
    neonHost: text("neon_host"),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // pending|building|deployed|failed|cleaned_up
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deployedAt: timestamp("deployed_at", { withTimezone: true }),
    cleanedUpAt: timestamp("cleaned_up_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_deployments_pr").on(t.prNumber),
    index("idx_deployments_env").on(t.environment),
    index("idx_deployments_status").on(t.status),
    index("idx_deployments_branch").on(t.gitBranch),
  ]
);

// ── Schema migrations log ───────────────────────────────────────────────────

export const schemaMigrations = pgTable("schema_migrations", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 50 }).notNull().unique(),
  description: text("description"),
  diffSummary: text("diff_summary"),
  appliedAt: timestamp("applied_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  appliedBy: varchar("applied_by", { length: 100 }).default("github-actions"),
});

// ── Feature visualization cache ─────────────────────────────────────────────

export const featureVisualizations = pgTable(
  "feature_visualizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    featureName: varchar("feature_name", { length: 100 }).notNull(),
    changelogHash: varchar("changelog_hash", { length: 64 }).notNull(),
    config: jsonb("config").notNull(),
    mermaidArch: text("mermaid_arch").notNull(),
    mermaidSeq: text("mermaid_seq").notNull(),
    eraMermaids: jsonb("era_mermaids").notNull().default({}),
    asciiFrames: jsonb("ascii_frames").notNull().default([]),
    versionCount: integer("version_count").notNull().default(0),
    eraCount: integer("era_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("uq_viz_feature_hash").on(t.featureName, t.changelogHash),
    index("idx_viz_feature").on(t.featureName),
    index("idx_viz_expires").on(t.expiresAt),
  ]
);

// ── Neon branch metadata ────────────────────────────────────────────────────

export const neonBranches = pgTable(
  "neon_branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchName: varchar("branch_name", { length: 255 }).notNull().unique(),
    parentBranch: varchar("parent_branch", { length: 255 })
      .notNull()
      .default("main"),
    prNumber: integer("pr_number"),
    projectId: varchar("project_id", { length: 100 }).notNull(),
    dbHost: text("db_host"),
    status: varchar("status", { length: 20 }).notNull().default("active"), // active|deleted|error
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_neon_branches_pr").on(t.prNumber),
    index("idx_neon_branches_status").on(t.status),
  ]
);

// ── Workflow run log ────────────────────────────────────────────────────────

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowName: varchar("workflow_name", { length: 100 }).notNull(),
    runId: bigint("run_id", { mode: "number" }),
    prNumber: integer("pr_number"),
    triggerEvent: varchar("trigger_event", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("running"), // running|success|failure|cancelled
    deploymentId: uuid("deployment_id").references(() => deployments.id),
    neonBranchId: uuid("neon_branch_id").references(() => neonBranches.id),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata").default({}),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_workflow_runs_pr").on(t.prNumber),
    index("idx_workflow_runs_workflow").on(t.workflowName),
    index("idx_workflow_runs_status").on(t.status),
  ]
);
