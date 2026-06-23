import type { TextProcessor } from "@/domain/text";
import type {
  LessonGenerationResult,
  SourceTextRepository,
  LessonContentRepository,
  GenerationJobRepository,
  GenerationProgressRepository,
  LessonTransactionRepository,
  KeyPhrase,
} from "../ports";

interface LessonEngineCollaborators {
  notifyJobQueued(): Promise<void>;
  bulkCreateSrsCardsFromKeyPhrases(
    userId: string,
    keyPhrases: KeyPhrase[]
  ): Promise<{ inserted: number; skipped: number }>;
  scrubSensitiveContentForSourceText(
    userId: string,
    sourceTextId: string
  ): Promise<void>;
  getActiveMistakePatterns?(
    userId: string
  ): Promise<Array<{ conceptKey: string; category: string }>>;
}

export async function queue(
  input: {
    userId: string;
    content: string;
    requestedMode?: string;
    draftContent?: string;
  },
  deps: {
    sourceTexts: SourceTextRepository;
    jobs: GenerationJobRepository;
    progress: GenerationProgressRepository;
    tx: LessonTransactionRepository;
    textProcessor: TextProcessor;
    collaborators: LessonEngineCollaborators;
  }
): Promise<LessonGenerationResult> {
  const { normalized, hash: contentHash } = deps.textProcessor.processSource(
    input.content
  );
  if (!normalized) {
    return {
      ok: false,
      error: "VALIDATION_FAILED",
      message: "Paste some English text first.",
    };
  }

  const capacityError = await deps.jobs.assertQueueCapacity(input.userId);
  if (capacityError) {
    return {
      ok: false,
      error: "CAPACITY_EXCEEDED",
      message: capacityError,
    };
  }

  const draftContent =
    input.requestedMode === "write" ? input.content : input.draftContent;

  const result = await deps.tx.createSourceTextAndLessonAndJob(
    input.userId,
    input.content,
    "Untitled source",
    contentHash,
    input.requestedMode,
    draftContent
  );

  await Promise.all([
    deps.progress.recordMilestone({
      lessonId: result.lesson.id,
      generationJobId: result.job.id,
      code: "queued",
      stage: null,
    }),
    deps.collaborators.notifyJobQueued(),
  ]);

  return {
    ok: true,
    lessonId: result.lesson.id,
    sourceTextId: result.lesson.sourceTextId,
  };
}

export async function retry(
  input: {
    userId: string;
    lessonId: string;
  },
  deps: {
    lessonContent: LessonContentRepository;
    jobs: GenerationJobRepository;
    progress: GenerationProgressRepository;
    tx: LessonTransactionRepository;
    collaborators: LessonEngineCollaborators;
  }
): Promise<LessonGenerationResult> {
  const lesson = await deps.lessonContent.findLesson(
    input.lessonId,
    input.userId
  );
  if (!lesson) {
    return {
      ok: false,
      error: "NOT_FOUND",
      message: "Lesson not found.",
    };
  }

  if (
    lesson.analysisStatus === "running" ||
    lesson.exerciseStatus === "running"
  ) {
    return {
      ok: false,
      error: "INVALID_STATE",
      message: "Lesson is already generating.",
    };
  }

  const capacityError = await deps.jobs.assertQueueCapacity(input.userId);
  if (capacityError) {
    return {
      ok: false,
      error: "CAPACITY_EXCEEDED",
      message: capacityError,
    };
  }

  if (
    lesson.analysisStatus === "succeeded" &&
    lesson.exerciseStatus === "succeeded"
  ) {
    const nextVersion = lesson.version + 1;
    const result = await deps.tx.createLessonAndJob(
      input.userId,
      lesson.sourceTextId,
      nextVersion,
      "analysis"
    );

    await Promise.all([
      deps.progress.recordMilestone({
        lessonId: result.lesson.id,
        generationJobId: result.job.id,
        code: "queued",
        stage: null,
      }),
      deps.collaborators.notifyJobQueued(),
    ]);

    return {
      ok: true,
      lessonId: result.lesson.id,
      sourceTextId: lesson.sourceTextId,
    };
  }

  const stage =
    lesson.analysisStatus === "failed"
      ? "analysis"
      : lesson.exerciseStatus === "failed"
        ? "exercises"
        : null;
  if (!stage) {
    return {
      ok: false,
      error: "INVALID_STATE",
      message: "Lesson does not have a failed generation stage.",
    };
  }

  const job = await deps.tx.createJob(
    input.userId,
    lesson.sourceTextId,
    lesson.id,
    stage
  );

  await Promise.all([
    deps.progress.recordMilestone({
      lessonId: lesson.id,
      generationJobId: job.id,
      code: "queued",
      stage: null,
    }),
    deps.collaborators.notifyJobQueued(),
  ]);

  return {
    ok: true,
    lessonId: lesson.id,
    sourceTextId: lesson.sourceTextId,
  };
}

export async function queueExerciseGeneration(
  input: {
    userId: string;
    lessonId: string;
  },
  deps: {
    lessonContent: LessonContentRepository;
    jobs: GenerationJobRepository;
    progress: GenerationProgressRepository;
    tx: LessonTransactionRepository;
    collaborators: LessonEngineCollaborators;
  }
): Promise<LessonGenerationResult> {
  const lesson = await deps.lessonContent.findLesson(
    input.lessonId,
    input.userId
  );
  if (!lesson) {
    return {
      ok: false,
      error: "NOT_FOUND",
      message: "Lesson not found.",
    };
  }

  if (lesson.exerciseStatus !== "idle" && lesson.exerciseStatus !== "failed") {
    return {
      ok: false,
      error: "INVALID_STATE",
      message: "Exercises are already generating or completed.",
    };
  }

  const capacityError = await deps.jobs.assertQueueCapacity(input.userId);
  if (capacityError) {
    return {
      ok: false,
      error: "CAPACITY_EXCEEDED",
      message: capacityError,
    };
  }

  const job = await deps.tx.createJob(
    input.userId,
    lesson.sourceTextId,
    lesson.id,
    "exercises"
  );

  await Promise.all([
    deps.lessonContent.updateLessonStatus(lesson.id, "exercise", "pending"),
    deps.progress.recordMilestone({
      lessonId: lesson.id,
      generationJobId: job.id,
      code: "queued",
      stage: "exercises",
    }),
    deps.collaborators.notifyJobQueued(),
  ]);

  return {
    ok: true,
    lessonId: lesson.id,
    sourceTextId: lesson.sourceTextId,
  };
}

export async function deleteSourceText(
  input: {
    userId: string;
    sourceTextId: string;
  },
  deps: {
    sourceTexts: SourceTextRepository;
    collaborators: LessonEngineCollaborators;
  }
): Promise<void> {
  await deps.sourceTexts.deleteSourceText(input.userId, input.sourceTextId);
  await deps.collaborators.scrubSensitiveContentForSourceText(
    input.userId,
    input.sourceTextId
  );
}
