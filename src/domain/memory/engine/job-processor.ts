import { getLogger, parseDbDate } from "@/lib/logger";
import type { ReviewPromptJobState } from "@/domain/types";
import type {
  MistakePatternRepository,
  PhrasePracticeRepository,
  ReviewPromptGenerator,
} from "../ports";

const log = getLogger("d.m.engine.JobProcessor");

export async function processNextReviewPromptJob(
  workerId: string,
  deps: {
    mistakePatternRepo: MistakePatternRepository;
    phrasePracticeRepo: PhrasePracticeRepository;
    reviewGenerator: ReviewPromptGenerator;
  }
): Promise<ReviewPromptJobState> {
  try {
    const pattern =
      await deps.mistakePatternRepo.claimReviewPromptJob(workerId);
    if (pattern) {
      const parsedLockedVal = parseDbDate(pattern.reviewPromptLockedAt);
      const queueLatency = parsedLockedVal
        ? Date.now() - parsedLockedVal.getTime()
        : 0;
      log.info(
        `Claimed review prompt job ${pattern.id} for pattern. Queue latency: ${queueLatency}ms.`,
        workerId
      );
      const startTime = Date.now();

      try {
        const generated = await deps.reviewGenerator.generate({
          userId: pattern.userId,
          conceptPhrase: pattern.normalizedPhrase,
          conceptMeaningVi: pattern.meaningVi,
          category: pattern.category,
          errorType: pattern.errorType,
        });

        pattern.updateReviewPrompt(generated);
        await deps.mistakePatternRepo.saveMistakePattern(pattern);

        log.info(
          `Review prompt job ${pattern.id} succeeded in ${Date.now() - startTime}ms.`,
          workerId
        );

        return {
          status: "processed",
          patternId: pattern.id,
          success: true,
        };
      } catch (genError) {
        const message =
          genError instanceof Error ? genError.message : String(genError);
        const attempts = pattern.reviewPromptAttempts ?? 0;

        log.warn(
          `Review prompt job ${pattern.id} failed (attempt ${attempts}): ${message}`,
          workerId
        );

        if (attempts < 3) {
          pattern.setJobStatus("queued", {
            reviewPromptError: message,
            reviewPromptLockedAt: null,
            reviewPromptLockedBy: null,
          });
        } else {
          pattern.setJobStatus("failed", {
            reviewPromptError: message,
            reviewPromptLockedAt: null,
            reviewPromptLockedBy: null,
          });
        }
        await deps.mistakePatternRepo.saveMistakePattern(pattern);

        return {
          status: "processed",
          patternId: pattern.id,
          success: false,
        };
      }
    }

    const practice =
      await deps.phrasePracticeRepo.claimReviewPromptJob(workerId);
    if (practice) {
      const parsedLockedVal = parseDbDate(practice.reviewPromptLockedAt);
      const queueLatency = parsedLockedVal
        ? Date.now() - parsedLockedVal.getTime()
        : 0;
      log.info(
        `Claimed review prompt job ${practice.id} for phrase practice. Queue latency: ${queueLatency}ms.`,
        workerId
      );
      const startTime = Date.now();

      try {
        const generated = await deps.reviewGenerator.generate({
          userId: practice.userId,
          conceptPhrase: practice.normalizedPhrase,
          conceptMeaningVi: practice.meaningVi,
          category: practice.category,
          errorType: "phrase_misunderstanding",
        });

        practice.updateReviewPrompt(generated);
        await deps.phrasePracticeRepo.savePhrasePractice(practice);

        log.info(
          `Review prompt job ${practice.id} succeeded in ${Date.now() - startTime}ms.`,
          workerId
        );

        return {
          status: "processed",
          patternId: practice.id,
          success: true,
        };
      } catch (genError) {
        const message =
          genError instanceof Error ? genError.message : String(genError);
        const attempts = practice.reviewPromptAttempts ?? 0;

        log.warn(
          `Review prompt job ${practice.id} failed (attempt ${attempts}): ${message}`,
          workerId
        );

        if (attempts < 3) {
          practice.setJobStatus("queued", {
            reviewPromptError: message,
            reviewPromptLockedAt: null,
            reviewPromptLockedBy: null,
          });
        } else {
          practice.setJobStatus("failed", {
            reviewPromptError: message,
            reviewPromptLockedAt: null,
            reviewPromptLockedBy: null,
          });
        }
        await deps.phrasePracticeRepo.savePhrasePractice(practice);

        return {
          status: "processed",
          patternId: practice.id,
          success: false,
        };
      }
    }

    return { status: "idle" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`processNextReviewPromptJob failed`, error, workerId);
    return {
      status: "failed",
      error: message,
    };
  }
}
