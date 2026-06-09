"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteSourceTextWithPrivacy,
  createSourceTextAndQueueLesson,
  queueExerciseRetry,
  queueFailedLessonRetry,
  queueLessonRegeneration,
} from "@/lib/jobs/generation";
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
  const result = await createSourceTextAndQueueLesson({ userId: user.id, content });
  if (!result.ok) return { error: result.error };
  revalidatePath("/dashboard");
  redirect(`/lessons/${result.lessonId}`);
}

export async function regenerateLessonAction(formData: FormData) {
  const user = await requireUser();
  const sourceTextId = String(formData.get("sourceTextId") ?? "");
  const result = await queueLessonRegeneration({ userId: user.id, sourceTextId });
  if (result.ok) redirect(`/lessons/${result.lessonId}`);
  revalidatePath("/dashboard");
}

export async function retryExercisesAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  const result = await queueExerciseRetry({ userId: user.id, lessonId });
  if (result.ok) {
    revalidatePath(`/lessons/${lessonId}`);
  }
}

export async function retryLessonGenerationAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  const result = await queueFailedLessonRetry({ userId: user.id, lessonId });
  if (result.ok) {
    revalidatePath(`/lessons/${lessonId}`);
  }
}

export async function deleteSourceTextAction(formData: FormData) {
  const user = await requireUser();
  const sourceTextId = String(formData.get("sourceTextId") ?? "");
  await deleteSourceTextWithPrivacy({ userId: user.id, sourceTextId });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
