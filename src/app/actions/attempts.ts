"use server";

import { revalidatePath } from "next/cache";
import { getLearnerMemoryEngine } from "@/domain/memory";
import { validatedAction } from "@/lib/action-builder";
import { z } from "zod";

const submitAttemptSchema = z.object({
  exerciseId: z
    .string()
    .uuid("ID bài tập không hợp lệ (Exercise ID must be a UUID)"),
  lessonId: z
    .string()
    .uuid("ID bài học không hợp lệ (Lesson ID must be a UUID)"),
  answer: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập câu trả lời (Answer is required)"),
});

export const submitAttemptAction = validatedAction(
  submitAttemptSchema,
  async (data, user) => {
    const engine = getLearnerMemoryEngine();
    await engine.submitAttempt({
      userId: user.id,
      exerciseId: data.exerciseId,
      lessonId: data.lessonId,
      answer: data.answer,
    });

    revalidatePath(`/lessons/${data.lessonId}`);
    revalidatePath("/dashboard");
  }
);
