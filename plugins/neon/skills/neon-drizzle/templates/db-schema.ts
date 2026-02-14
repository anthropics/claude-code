/**
 * Database schema definition — Drizzle ORM
 *
 * Define all tables here. Export each table so it can be
 * used in queries via `db.select().from(tableName)`.
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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Users ────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Example relations ────────────────────────────────────────

// Uncomment and modify as needed:
//
// export const posts = pgTable('posts', {
//   id: serial('id').primaryKey(),
//   title: text('title').notNull(),
//   content: text('content'),
//   authorId: integer('author_id').references(() => users.id),
//   published: boolean('published').default(false),
//   createdAt: timestamp('created_at').defaultNow().notNull(),
// });
//
// export const usersRelations = relations(users, ({ many }) => ({
//   posts: many(posts),
// }));
//
// export const postsRelations = relations(posts, ({ one }) => ({
//   author: one(users, { fields: [posts.authorId], references: [users.id] }),
// }));
