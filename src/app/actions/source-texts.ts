"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getLessonGenerationEngine,
  getLessonRepository,
} from "@/domain/lesson";
import { notifyJobQueued } from "@/lib/jobs/trigger";
import { validatedAction } from "@/lib/action-builder";
import { z } from "zod";

export type SourceTextActionState = {
  error?: string;
};

const createSourceTextSchema = z.object({
  content: z
    .string()
    .trim()
    .min(
      1,
      "Nội dung bài học không được để trống (Source text content is required)"
    ),
  inputMode: z.enum([
    "auto",
    "understand_and_practice",
    "fix_and_understand",
    "naturalize_english",
    "mixed_language_support",
    "not_english",
    "developer_error_explanation",
    "unsupported",
  ]),
});

export const createSourceTextAction = validatedAction(
  createSourceTextSchema,
  async (data, user): Promise<SourceTextActionState> => {
    const result = await getLessonGenerationEngine().queue(
      user.id,
      data.content,
      data.inputMode
    );
    if (!result.ok) return { error: result.message };
    await notifyJobQueued();
    revalidatePath("/dashboard");
    redirect(`/lessons/${result.lessonId}`);
  }
);

const regenerateLessonSchema = z.object({
  sourceTextId: z
    .string()
    .uuid("ID văn bản gốc không hợp lệ (Source Text ID must be a UUID)"),
});

export const regenerateLessonAction = validatedAction(
  regenerateLessonSchema,
  async (data, user) => {
    const repo = getLessonRepository();
    const latestLesson = await repo.findLatestLesson(data.sourceTextId);
    if (!latestLesson) {
      throw new Error(
        "Không tìm thấy bài học cho văn bản gốc này (No lesson found for this source text)."
      );
    }
    const result = await getLessonGenerationEngine().retry(
      user.id,
      latestLesson.id
    );
    if (result.ok) {
      await notifyJobQueued();
      redirect(`/lessons/${result.lessonId}`);
    }
    revalidatePath("/dashboard");
  }
);

const retryExercisesSchema = z.object({
  lessonId: z
    .string()
    .uuid("ID bài học không hợp lệ (Lesson ID must be a UUID)"),
});

export const retryExercisesAction = validatedAction(
  retryExercisesSchema,
  async (data, user) => {
    const result = await getLessonGenerationEngine().retry(
      user.id,
      data.lessonId
    );
    if (result.ok) {
      await notifyJobQueued();
      revalidatePath(`/lessons/${data.lessonId}`);
    }
  }
);

const retryLessonGenerationSchema = z.object({
  lessonId: z
    .string()
    .uuid("ID bài học không hợp lệ (Lesson ID must be a UUID)"),
});

export const retryLessonGenerationAction = validatedAction(
  retryLessonGenerationSchema,
  async (data, user) => {
    const result = await getLessonGenerationEngine().retry(
      user.id,
      data.lessonId
    );
    if (result.ok) {
      await notifyJobQueued();
      revalidatePath(`/lessons/${data.lessonId}`);
    }
  }
);

const forceRetryLessonSchema = z.object({
  lessonId: z
    .string()
    .uuid("ID bài học không hợp lệ (Lesson ID must be a UUID)"),
});

export const forceRetryLessonAction = validatedAction(
  forceRetryLessonSchema,
  async (data, user) => {
    const repo = getLessonRepository();
    await repo.resetStuckJob(user.id, data.lessonId);
    await notifyJobQueued();
    revalidatePath(`/lessons/${data.lessonId}`);
  }
);

const deleteSourceTextSchema = z.object({
  sourceTextId: z
    .string()
    .uuid("ID văn bản gốc không hợp lệ (Source Text ID must be a UUID)"),
});

export const deleteSourceTextAction = validatedAction(
  deleteSourceTextSchema,
  async (data, user) => {
    const repo = getLessonRepository();
    await repo.deleteSourceText(user.id, data.sourceTextId);
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }
);
