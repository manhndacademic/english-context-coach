"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { getLearnerMemoryEngine } from "@/domain/memory";

export async function submitAttemptAction(formData: FormData) {
  const user = await requireUser();
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer || !lessonId || !exerciseId) return;

  const engine = getLearnerMemoryEngine();
  await engine.submitAttempt({
    userId: user.id,
    exerciseId,
    lessonId,
    answer,
  });

  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/dashboard");
}
