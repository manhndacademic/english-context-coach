import type { MistakePatternRepository } from "../ports";
import type { JobDispatcher } from "../ports";

export class QueueJobDispatcherAdapter implements JobDispatcher {
  constructor(private repoResolver: () => MistakePatternRepository) {}

  async triggerReviewPromptGeneration(mistakePatternId: string): Promise<void> {
    const repo = this.repoResolver();
    const pattern = await repo.findMistakePatternById(mistakePatternId);
    if (pattern) {
      pattern.setJobStatus("queued", {
        reviewPromptAttempts: 0,
        reviewPromptError: null,
      });
      await repo.saveMistakePattern(pattern);
    }
  }
}
