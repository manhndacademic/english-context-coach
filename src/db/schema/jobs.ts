import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  serial,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { lessons } from "./lessons";
import { sourceTexts } from "./source-texts";
import { jobStatusEnum, generationMilestoneCodeEnum } from "./enums";

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceTextId: uuid("source_text_id")
      .notNull()
      .references(() => sourceTexts.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").notNull().default("queued"),
    stage: text("stage").notNull().default("analysis"),
    attempts: integer("attempts").notNull().default(0),
    errorMessage: text("error_message"),
    lockedAt: timestamp("locked_at", { mode: "date" }),
    lockedBy: text("locked_by"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("generation_jobs_user_status_idx").on(table.userId, table.status),
    index("generation_jobs_status_idx").on(table.status, table.createdAt),
  ]
);

export const generationMilestones = pgTable(
  "generation_milestones",
  {
    id: serial("id").primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    generationJobId: uuid("generation_job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),
    code: generationMilestoneCodeEnum("code").notNull(),
    stage: text("stage"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("generation_milestones_lesson_job_idx").on(
      table.lessonId,
      table.generationJobId,
      table.id
    ),
    uniqueIndex("generation_milestones_job_code_stage_unique").on(
      table.generationJobId,
      table.code,
      table.stage
    ),
  ]
);

export const generationThoughts = pgTable(
  "generation_thoughts",
  {
    id: serial("id").primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    generationJobId: uuid("generation_job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),
    stage: text("stage"),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("generation_thoughts_lesson_job_idx").on(
      table.lessonId,
      table.generationJobId,
      table.id
    ),
  ]
);

export type GenerationJob = typeof generationJobs.$inferSelect;
export type GenerationMilestone = typeof generationMilestones.$inferSelect;
export type GenerationThought = typeof generationThoughts.$inferSelect;
