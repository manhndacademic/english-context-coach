import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const emailDigestLogs = pgTable(
  "email_digest_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    digestDate: text("digest_date").notNull(),
    status: text("status").notNull(),
    dueCount: integer("due_count").notNull().default(0),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_digest_logs_user_date_unique").on(
      table.userId,
      table.digestDate
    ),
    index("email_digest_logs_date_status_idx").on(
      table.digestDate,
      table.status
    ),
  ]
);

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminUserId: uuid("admin_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  targetUserId: uuid("target_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  targetResourceType: text("target_resource_type").notNull(),
  targetResourceId: text("target_resource_id"),
  action: text("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type EmailDigestLog = typeof emailDigestLogs.$inferSelect;
export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
