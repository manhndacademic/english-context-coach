import type { LearnerMemoryRepository } from "../ports";
import type { JobDispatcher } from "../ports";

export class QueueJobDispatcherAdapter implements JobDispatcher {
  constructor(private repoResolver: () => LearnerMemoryRepository) {}

  async triggerReviewPromptGeneration(mistakePatternId: string): Promise<void> {
    await this.repoResolver().updateReviewPromptJobStatus(mistakePatternId, "queued", {
      reviewPromptAttempts: 0,
      reviewPromptError: null,
    });
  }
}
