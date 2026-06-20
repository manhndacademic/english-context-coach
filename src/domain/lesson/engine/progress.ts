import type {
  GenerationProgressRepository,
  GenerationProgress,
} from "../ports";

export async function getProgress(
  lessonId: string,
  userId: string,
  deps: {
    progress: GenerationProgressRepository;
  }
): Promise<GenerationProgress | null> {
  const progress = await deps.progress.getLessonProgress({
    lessonId,
    userId,
  });
  if (!progress) {
    return null;
  }

  const latestMilestone =
    progress.milestones[progress.milestones.length - 1]?.code ?? null;
  const thoughts = progress.thoughts.map((t) => ({
    stage: t.stage as "analysis" | "exercises",
    text: t.text,
    createdAt: t.createdAt,
  }));

  return {
    lessonId,
    analysisStatus: progress.lesson.analysisStatus,
    exerciseStatus: progress.lesson.exerciseStatus,
    latestMilestone,
    thoughts,
  };
}
