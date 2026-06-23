import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const sourceTexts = pgTable(
  "source_texts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("source_texts_user_idx").on(table.userId)]
);

export const draftTexts = pgTable(
  "draft_texts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceTextId: uuid("source_text_id")
      .notNull()
      .references(() => sourceTexts.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("draft_texts_user_idx").on(table.userId),
    index("draft_texts_source_text_idx").on(table.sourceTextId),
  ]
);

export type SourceText = typeof sourceTexts.$inferSelect;
export type DraftText = typeof draftTexts.$inferSelect;
