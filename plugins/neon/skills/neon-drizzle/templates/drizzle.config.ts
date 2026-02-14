/**
 * Drizzle Kit configuration — Neon Postgres
 *
 * Uses DIRECT_DATABASE_URL (non-pooled) for migrations and
 * schema introspection. The pooled connection should only be
 * used for application queries.
 */

import { defineConfig } from 'drizzle-kit';

if (!process.env.DIRECT_DATABASE_URL) {
  throw new Error('DIRECT_DATABASE_URL environment variable is not set');
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL,
  },
});
