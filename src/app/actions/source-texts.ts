"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLessonGenerationEngine, getLessonRepository } from "@/domain/lesson";
import { requireUser } from "@/lib/auth/guards";

export type SourceTextActionState = {
  error?: string;
};

export async function createSourceTextAction(
  _state: SourceTextActionState,
  formData: FormData,
): Promise<SourceTextActionState> {
  const user = await requireUser();
  const content = String(formData.get("content") ?? "");
  const result = await getLessonGenerationEngine().queue(user.id, content);
  if (!result.ok) return { error: result.message };
  revalidatePath("/dashboard");
  redirect(`/lessons/${result.lessonId}`);
}

export async function regenerateLessonAction(formData: FormData) {
  const user = await requireUser();
  const sourceTextId = String(formData.get("sourceTextId") ?? "");
  const repo = getLessonRepository();
  const latestLesson = await repo.findLatestLesson(sourceTextId);
  if (!latestLesson) {
    throw new Error("No lesson found for this source text.");
  }
  const result = await getLessonGenerationEngine().retry(user.id, latestLesson.id);
  if (result.ok) {
    redirect(`/lessons/${result.lessonId}`);
  }
  revalidatePath("/dashboard");
}

export async function retryExercisesAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  const result = await getLessonGenerationEngine().retry(user.id, lessonId);
  if (result.ok) {
    revalidatePath(`/lessons/${lessonId}`);
  }
}

export async function retryLessonGenerationAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  const result = await getLessonGenerationEngine().retry(user.id, lessonId);
  if (result.ok) {
    revalidatePath(`/lessons/${lessonId}`);
  }
}

export async function deleteSourceTextAction(formData: FormData) {
  const user = await requireUser();
  const sourceTextId = String(formData.get("sourceTextId") ?? "");
  const repo = getLessonRepository();
  await repo.deleteSourceText(user.id, sourceTextId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
