import type { LearnerMemoryEngine } from "../types";
import type { JobDispatcher } from "../ports";

export class QueueJobDispatcherAdapter implements JobDispatcher {
  constructor(private engineResolver: () => LearnerMemoryEngine) {}

  async triggerReviewPromptGeneration(mistakePatternId: string): Promise<void> {
    await this.engineResolver().generateReviewPrompt(mistakePatternId);
  }
}
