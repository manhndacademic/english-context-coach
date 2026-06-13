"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { getLearnerMemoryEngine, getLearnerMemoryRepository } from "@/domain/memory";

export type ReviewResultState = {
  success?: boolean;
  score?: number;
  isCorrect?: boolean;
  feedbackVi?: string;
  error?: string;
};

export async function submitReviewAttemptAction(
  _prevState: ReviewResultState,
  formData: FormData
): Promise<ReviewResultState> {
  try {
    const user = await requireUser();
    const patternId = String(formData.get("patternId") ?? "");
    const answer = String(formData.get("answer") ?? "").trim();
    if (!answer) return { error: "Vui lòng nhập câu trả lời." };

    const engine = getLearnerMemoryEngine();
    const result = await engine.submitReviewAttempt({
      userId: user.id,
      patternId,
      answer,
    });

    if (!result.success) {
      return { error: result.error ?? "Đã xảy ra lỗi khi chấm điểm ôn tập." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/review");

    return {
      success: true,
      score: result.score,
      isCorrect: result.isCorrect,
      feedbackVi: result.feedbackVi,
    };
  } catch (error) {
    console.error(error);
    return { error: error instanceof Error ? error.message : "Đã xảy ra lỗi hệ thống khi chấm điểm ôn tập." };
  }
}

export async function retryReviewPromptGenerationAction(formData: FormData): Promise<void> {
  try {
    const user = await requireUser();
    const patternId = String(formData.get("patternId") ?? "");
    if (!patternId) return;

    const repo = getLearnerMemoryRepository();
    const pattern = await repo.findMistakePatternById(patternId);
    if (!pattern || pattern.userId !== user.id) return;

    await repo.updateReviewPromptJobStatus(patternId, "queued", {
      reviewPromptAttempts: 0,
      reviewPromptError: null,
    });

    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Failed to retry review prompt generation:", error);
  }
}


