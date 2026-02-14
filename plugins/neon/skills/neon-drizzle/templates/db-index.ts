/**
 * Database connection module — Neon + Drizzle ORM
 *
 * Uses the Neon serverless HTTP driver for edge-compatible,
 * single-shot query execution. For WebSocket/persistent
 * connections, swap `neon` for `Pool` import.
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
