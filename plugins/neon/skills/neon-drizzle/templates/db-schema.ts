/**
 * Database schema definition — Drizzle ORM + Neon Serverless Postgres
 *
 * Tables: users, projects, deployments, neon_branches, deploy_logs
 *
 * Entity relationships:
 *   users ──< projects ──< deployments
 *                │              │
 *                └──< neon_branches
 *                               │
 *                deployments ──< deploy_logs
 */

import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  varchar,
  uuid,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ────────────────────────────────────────────────────

export const deploymentStatusEnum = pgEnum('deployment_status', [
  'pending',
  'building',
  'deploying',
  'ready',
  'error',
  'canceled',
]);

export const branchStatusEnum = pgEnum('branch_status', [
  'creating',
  'active',
  'resetting',
  'deleting',
  'deleted',
]);

export const environmentEnum = pgEnum('environment', [
  'preview',
  'staging',
  'production',
]);

// ── Users ────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  avatarUrl: text('avatar_url'),
  githubId: varchar('github_id', { length: 64 }).unique(),
  role: varchar('role', { length: 32 }).default('member').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Projects ─────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  neonProjectId: varchar('neon_project_id', { length: 64 }),
  vercelProjectId: varchar('vercel_project_id', { length: 64 }),
  githubRepo: varchar('github_repo', { length: 256 }),
  productionBranch: varchar('production_branch', { length: 128 }).default('main'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Neon Branches ────────────────────────────────────────────

export const neonBranches = pgTable('neon_branches', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  neonBranchId: varchar('neon_branch_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  parentBranchId: varchar('parent_branch_id', { length: 64 }),
  status: branchStatusEnum('status').default('creating').notNull(),
  prNumber: integer('pr_number'),
  pooledConnectionUri: text('pooled_connection_uri'),
  directConnectionUri: text('direct_connection_uri'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => [
  index('neon_branches_project_idx').on(table.projectId),
  index('neon_branches_pr_idx').on(table.prNumber),
]);

// ── Deployments ──────────────────────────────────────────────

export const deployments = pgTable('deployments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  neonBranchId: integer('neon_branch_id').references(() => neonBranches.id),
  triggeredById: integer('triggered_by_id').references(() => users.id),
  environment: environmentEnum('environment').notNull(),
  status: deploymentStatusEnum('status').default('pending').notNull(),
  vercelDeploymentId: varchar('vercel_deployment_id', { length: 128 }),
  vercelUrl: text('vercel_url'),
  commitSha: varchar('commit_sha', { length: 40 }),
  commitMessage: text('commit_message'),
  prNumber: integer('pr_number'),
  buildDurationMs: integer('build_duration_ms'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  readyAt: timestamp('ready_at'),
}, (table) => [
  index('deployments_project_idx').on(table.projectId),
  index('deployments_status_idx').on(table.status),
]);

// ── Deploy Logs ──────────────────────────────────────────────

export const deployLogs = pgTable('deploy_logs', {
  id: serial('id').primaryKey(),
  deploymentId: integer('deployment_id').references(() => deployments.id).notNull(),
  level: varchar('level', { length: 16 }).default('info').notNull(),
  message: text('message').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => [
  index('deploy_logs_deployment_idx').on(table.deploymentId),
]);

// ── Relations ────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  deployments: many(deployments),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  neonBranches: many(neonBranches),
  deployments: many(deployments),
}));

export const neonBranchesRelations = relations(neonBranches, ({ one, many }) => ({
  project: one(projects, { fields: [neonBranches.projectId], references: [projects.id] }),
  deployments: many(deployments),
}));

export const deploymentsRelations = relations(deployments, ({ one, many }) => ({
  project: one(projects, { fields: [deployments.projectId], references: [projects.id] }),
  neonBranch: one(neonBranches, { fields: [deployments.neonBranchId], references: [neonBranches.id] }),
  triggeredBy: one(users, { fields: [deployments.triggeredById], references: [users.id] }),
  logs: many(deployLogs),
}));

export const deployLogsRelations = relations(deployLogs, ({ one }) => ({
  deployment: one(deployments, { fields: [deployLogs.deploymentId], references: [deployments.id] }),
}));
