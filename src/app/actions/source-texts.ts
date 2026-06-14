"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLessonGenerationEngine, getLessonRepository, getGenerationJobRepository, getSourceTextRepository } from "@/domain/lesson";
import { getLearnerMemoryEngine } from "@/domain/memory";
import { requireUser } from "@/lib/auth/guards";

function triggerWorkerBackgroundTick() {
  const workerId = `web-trigger-${Date.now()}`;
  getLessonGenerationEngine().processNext(workerId).catch((err) => {
    console.error(`[WebTrigger] Lesson generation error:`, err);
  });
  getLearnerMemoryEngine().processNextReviewPromptJob(workerId).catch((err) => {
    console.error(`[WebTrigger] Memory review prompt error:`, err);
  });
}

export type SourceTextActionState = {
  error?: string;
};

export async function createSourceTextAction(
  _state: SourceTextActionState,
  formData: FormData,
): Promise<SourceTextActionState> {
  const user = await requireUser();
  const content = String(formData.get("content") ?? "");
  const inputMode = String(formData.get("inputMode") ?? "auto");
  const result = await getLessonGenerationEngine().queue(user.id, content, inputMode);
  if (!result.ok) return { error: result.message };
  triggerWorkerBackgroundTick();
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
    triggerWorkerBackgroundTick();
    redirect(`/lessons/${result.lessonId}`);
  }
  revalidatePath("/dashboard");
}

export async function retryExercisesAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  const result = await getLessonGenerationEngine().retry(user.id, lessonId);
  if (result.ok) {
    triggerWorkerBackgroundTick();
    revalidatePath(`/lessons/${lessonId}`);
  }
}

export async function retryLessonGenerationAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  const result = await getLessonGenerationEngine().retry(user.id, lessonId);
  if (result.ok) {
    triggerWorkerBackgroundTick();
    revalidatePath(`/lessons/${lessonId}`);
  }
}

export async function forceRetryLessonAction(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  const repo = getGenerationJobRepository();
  
  await repo.resetStuckJob(user.id, lessonId);
  triggerWorkerBackgroundTick();
  
  revalidatePath(`/lessons/${lessonId}`);
}

export async function deleteSourceTextAction(formData: FormData) {
  const user = await requireUser();
  const sourceTextId = String(formData.get("sourceTextId") ?? "");
  const repo = getSourceTextRepository();
  await repo.deleteSourceText(user.id, sourceTextId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
