"use server";

import { revalidatePath } from "next/cache";
import {
  getLearnerMemoryEngine,
  getMistakePatternRepository,
  getPhrasePracticeRepository,
} from "@/domain/memory";
import { validatedAction } from "@/lib/action-builder";
import { z } from "zod";
import { notifyJobQueued } from "@/lib/jobs/trigger";

export type ReviewResultState = {
  success?: boolean;
  score?: number;
  isCorrect?: boolean;
  feedbackVi?: string;
  masteryState?: "active" | "mastered";
  nextReviewAt?: string;
  naturalAnswer?: string;
  feedbackDetails?: {
    whatWasWrong: string;
    whyItWasWrong: string;
    correctUnderstanding: string;
    mistakeType: string;
    nextPracticeItem?: string | null;
    detailedExplanation: string;
  } | null;
  error?: string;
};

const submitReviewAttemptSchema = z.object({
  patternId: z
    .string()
    .uuid("ID mẫu lỗi không hợp lệ (Pattern ID must be a UUID)"),
  answer: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập câu trả lời (Answer is required)"),
});

export const submitReviewAttemptAction = validatedAction(
  submitReviewAttemptSchema,
  async (data, user): Promise<ReviewResultState> => {
    const engine = getLearnerMemoryEngine();
    const result = await engine.submitReviewAttempt({
      userId: user.id,
      patternId: data.patternId,
      answer: data.answer,
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
      masteryState: result.masteryState,
      nextReviewAt: result.nextReviewAt?.toISOString(),
      naturalAnswer: result.naturalAnswer,
      feedbackDetails: result.feedbackDetails,
    };
  }
);

const retryReviewPromptGenerationSchema = z.object({
  patternId: z
    .string()
    .uuid("ID mẫu lỗi không hợp lệ (Pattern ID must be a UUID)"),
});

export const retryReviewPromptGenerationAction = validatedAction(
  retryReviewPromptGenerationSchema,
  async (data, user): Promise<void> => {
    const repo = getMistakePatternRepository();
    const pattern = await repo.findMistakePatternById(data.patternId);
    if (!pattern || pattern.userId !== user.id) {
      throw new Error("Không tìm thấy mẫu lỗi hoặc bạn không có quyền.");
    }

    pattern.setJobStatus("queued", {
      reviewPromptAttempts: 0,
      reviewPromptError: null,
    });
    await repo.saveMistakePattern(pattern);
    await notifyJobQueued();

    revalidatePath("/dashboard");
  }
);

export async function getMistakePatternLessonsMap(
  userId: string
): Promise<Record<string, Array<{ id: string; title: string | null }>>> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return {};
  }

  return getMistakePatternRepository().getLessonsForPatterns(userId);
}

const submitPhrasePracticeSchema = z.object({
  practiceId: z
    .string()
    .uuid("ID cụm từ không hợp lệ (Practice ID must be a UUID)"),
  answer: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập câu trả lời (Answer is required)"),
});

export const submitPhrasePracticeAction = validatedAction(
  submitPhrasePracticeSchema,
  async (data, user): Promise<ReviewResultState> => {
    const engine = getLearnerMemoryEngine();
    const result = await engine.submitPhrasePractice({
      userId: user.id,
      practiceId: data.practiceId,
      answer: data.answer,
    });

    if (!result.success) {
      return { error: result.error ?? "Đã xảy ra lỗi khi chấm điểm ôn tập." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/phrase-practice");

    return {
      success: true,
      score: result.score,
      isCorrect: result.isCorrect,
      feedbackVi: result.feedbackVi,
      masteryState: result.masteryState,
      nextReviewAt: result.nextReviewAt?.toISOString(),
      naturalAnswer: result.naturalAnswer,
      feedbackDetails: result.feedbackDetails,
    };
  }
);

const retryPhrasePracticePromptGenerationSchema = z.object({
  practiceId: z
    .string()
    .uuid("ID cụm từ không hợp lệ (Practice ID must be a UUID)"),
});

export const retryPhrasePracticePromptGenerationAction = validatedAction(
  retryPhrasePracticePromptGenerationSchema,
  async (data, user): Promise<void> => {
    const repo = getPhrasePracticeRepository();
    const practice = await repo.findPhrasePracticeById(data.practiceId);
    if (!practice || practice.userId !== user.id) {
      throw new Error("Không tìm thấy cụm từ hoặc bạn không có quyền.");
    }

    practice.setJobStatus("queued", {
      reviewPromptAttempts: 0,
      reviewPromptError: null,
    });
    await repo.savePhrasePractice(practice);
    await notifyJobQueued();

    revalidatePath("/dashboard");
    revalidatePath("/phrase-practice");
  }
);
