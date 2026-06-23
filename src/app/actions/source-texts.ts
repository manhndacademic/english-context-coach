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
    "diff",
    "write",
  ]),
  draftContent: z.string().trim().optional(),
});

export const createSourceTextAction = validatedAction(
  createSourceTextSchema,
  async (data, user): Promise<SourceTextActionState> => {
    const result = await getLessonGenerationEngine().queue(
      user.id,
      data.content,
      data.inputMode,
      data.draftContent
    );
    if (!result.ok) return { error: result.message };
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
      redirect(`/lessons/${result.lessonId}`);
    }
    revalidatePath("/dashboard");
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
    await getLessonGenerationEngine().deleteSourceText(
      user.id,
      data.sourceTextId
    );
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }
);

const generateExercisesSchema = z.object({
  lessonId: z
    .string()
    .uuid("ID bài học không hợp lệ (Lesson ID must be a UUID)"),
});

export const generateExercisesAction = validatedAction(
  generateExercisesSchema,
  async (data, user) => {
    const result = await getLessonGenerationEngine().queueExerciseGeneration(
      user.id,
      data.lessonId
    );
    if (result.ok) {
      revalidatePath(`/lessons/${data.lessonId}`);
    }
    return result;
  }
);

const changeLessonContextSchema = z.object({
  lessonId: z
    .string()
    .uuid("ID bài học không hợp lệ (Lesson ID must be a UUID)"),
  newDocumentType: z
    .enum([
      "email",
      "chat_message",
      "ticket",
      "code_review",
      "technical_doc",
      "meeting_notes",
      "general",
      "work_message",
      "article",
      "academic",
      "unknown",
    ])
    .optional(),
  newFormality: z.enum(["formal", "semi_formal", "casual"]).optional(),
});

export const changeLessonContextAction = validatedAction(
  changeLessonContextSchema,
  async (data, user) => {
    const result = await getLessonGenerationEngine().changeContext(
      user.id,
      data.lessonId,
      data.newDocumentType,
      data.newFormality
    );
    if (result.ok) {
      revalidatePath(`/lessons/${data.lessonId}`);
    }
    return result;
  }
);

const updateCorrectionPhraseSchema = z.object({
  lessonId: z
    .string()
    .uuid("ID bài học không hợp lệ (Lesson ID must be a UUID)"),
  correctionItemId: z
    .string()
    .uuid("ID cụm từ sửa không hợp lệ (Correction Item ID must be a UUID)"),
  newPhrase: z
    .string()
    .trim()
    .min(
      1,
      "Cụm từ sửa không được để trống (Corrected phrase cannot be empty)"
    ),
});

export const updateCorrectionPhraseAction = validatedAction(
  updateCorrectionPhraseSchema,
  async (data, user) => {
    const result = await getLessonRepository().updateCorrectionPhrase(
      user.id,
      data.lessonId,
      data.correctionItemId,
      data.newPhrase
    );
    if (!result.ok) {
      return { error: result.message || "Không thể cập nhật cụm từ sửa." };
    }
    revalidatePath(`/lessons/${data.lessonId}`);
    return { ok: true };
  }
);

const toggleCorrectionRejectSchema = z.object({
  lessonId: z
    .string()
    .uuid("ID bài học không hợp lệ (Lesson ID must be a UUID)"),
  correctionItemId: z
    .string()
    .uuid("ID cụm từ sửa không hợp lệ (Correction Item ID must be a UUID)"),
  isRejected: z.boolean(),
});

export const toggleCorrectionRejectAction = validatedAction(
  toggleCorrectionRejectSchema,
  async (data, user) => {
    const result = await getLessonRepository().toggleCorrectionReject(
      user.id,
      data.lessonId,
      data.correctionItemId,
      data.isRejected
    );
    if (!result.ok) {
      return {
        error: result.message || "Không thể cập nhật trạng thái lỗi sửa.",
      };
    }
    revalidatePath(`/lessons/${data.lessonId}`);
    return { ok: true };
  }
);
