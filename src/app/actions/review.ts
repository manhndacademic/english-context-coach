"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { nextDueDate, nextReviewAfterSuccess, resetDueAfterFailure } from "@/domain/review";
import { requireUser } from "@/lib/auth/guards";

export async function markMistakePatternReviewAction(formData: FormData) {
  const user = await requireUser();
  const patternId = String(formData.get("patternId") ?? "");
  const result = String(formData.get("result") ?? "");
  const [pattern] = await db
    .select()
    .from(schema.mistakePatterns)
    .where(and(eq(schema.mistakePatterns.id, patternId), eq(schema.mistakePatterns.userId, user.id)))
    .limit(1);
  if (!pattern) return;

  const intervalDays =
    result === "success" ? nextReviewAfterSuccess(pattern.intervalDays) : 0;
  await db
    .update(schema.mistakePatterns)
    .set({
      intervalDays,
      dueAt: result === "success" ? nextDueDate(intervalDays) : resetDueAfterFailure(),
      lastReviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.mistakePatterns.id, pattern.id));

  revalidatePath("/dashboard");
  revalidatePath("/review");
}
