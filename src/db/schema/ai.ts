import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { lessons } from "./lessons";
import { aiPurposeEnum } from "./enums";

export const userAiApiKeys = pgTable(
  "user_ai_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("gemini"),
    name: text("name").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    keyFingerprint: text("key_fingerprint").notNull(),
    status: text("status").notNull().default("active"),
    errorMessage: text("error_message"),
    rateLimitedAt: timestamp("rate_limited_at", { mode: "date" }),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    {
      userStatusIdx: index("user_ai_api_keys_user_status_idx").on(
        table.userId,
        table.status
      ),
      userFingerprintUnique: uniqueIndex(
        "user_ai_api_keys_user_fingerprint_unique"
      ).on(table.userId, table.keyFingerprint),
    },
  ]
);

export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lessonId: uuid("lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    purpose: aiPurposeEnum("purpose").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costMicros: integer("cost_micros"),
    errorClass: text("error_class"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("ai_requests_user_idx").on(table.userId),
    lessonIdx: index("ai_requests_lesson_idx").on(table.lessonId),
  })
);

export const aiApiKeys = pgTable(
  "ai_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    provider: text("provider").notNull().default("gemini"),
    encryptedKey: text("encrypted_key").notNull(),
    status: text("status").notNull().default("active"), // 'active' | 'rate_limited' | 'invalid'
    errorMessage: text("error_message"),
    rateLimitedAt: timestamp("rate_limited_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("ai_api_keys_status_idx").on(table.status),
  })
);

export type UserAiApiKey = typeof userAiApiKeys.$inferSelect;
export type AiApiKey = typeof aiApiKeys.$inferSelect;
