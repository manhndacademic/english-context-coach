import { describe, expect, it, beforeEach } from "vitest";
import { DefaultJobExecutor } from "./job-executor";
import { getTextProcessor } from "@/domain/text";
import type {
  LessonRepository,
  GenerationEngine,
  SourceText,
  Lesson,
  GenerationJob,
} from "./ports";

class MockLessonRepository implements LessonRepository {
  lessons = new Map<string, any>();
  sourceTexts = new Map<string, any>();
  generationJobs = new Map<string, any>();
  milestones: any[] = [];
  thoughts: any[] = [];

  savedAnalysisLessonId: string | null = null;
  savedExercisesLessonId: string | null = null;

  async findLesson(lessonId: string, userId: string) {
    const lesson = this.lessons.get(lessonId);
    return (lesson && lesson.userId === userId
      ? lesson
      : null) as unknown as Lesson | null;
  }

  async findSourceText(sourceTextId: string, userId: string) {
    const st = this.sourceTexts.get(sourceTextId);
    return (st && st.userId === userId
      ? st
      : null) as unknown as SourceText | null;
  }

  async findLatestLesson(sourceTextId: string) {
    let latest = null;
    for (const l of this.lessons.values()) {
      if (l.sourceTextId === sourceTextId) {
        if (!latest || l.version > latest.version) latest = l;
      }
    }
    return latest as unknown as Lesson | null;
  }

  async findKeyPhrase(_keyPhraseId: string) {
    return null;
  }

  async findLessonFocus(_lessonFocusId: string) {
    return null;
  }

  async createSourceTextAndLessonAndJob(
    userId: string,
    content: string,
    title: string,
    contentHash: string
  ) {
    const st = {
      id: `st-${this.sourceTexts.size + 1}`,
      userId,
      content,
      title,
      contentHash,
    };
    this.sourceTexts.set(st.id, st);
    const lesson = {
      id: `les-${this.lessons.size + 1}`,
      sourceTextId: st.id,
      userId,
      version: 1,
      title: "Generating",
      analysisStatus: "pending",
      exerciseStatus: "pending",
    };
    this.lessons.set(lesson.id, lesson);
    const job = {
      id: `job-${this.generationJobs.size + 1}`,
      userId,
      sourceTextId: st.id,
      lessonId: lesson.id,
      status: "queued",
      stage: "analysis",
      attempts: 0,
    };
    this.generationJobs.set(job.id, job);
    return { lesson, job } as unknown as { lesson: Lesson; job: GenerationJob };
  }

  async createLessonAndJob(
    userId: string,
    sourceTextId: string,
    version: number,
    stage: "analysis" | "exercises"
  ) {
    const lesson = {
      id: `les-${this.lessons.size + 1}`,
      sourceTextId,
      userId,
      version,
      title: `Regen ${version}`,
      analysisStatus: "pending",
      exerciseStatus: "pending",
    };
    this.lessons.set(lesson.id, lesson);
    const job = {
      id: `job-${this.generationJobs.size + 1}`,
      userId,
      sourceTextId,
      lessonId: lesson.id,
      status: "queued",
      stage,
      attempts: 0,
    };
    this.generationJobs.set(job.id, job);
    return { lesson, job } as unknown as { lesson: Lesson; job: GenerationJob };
  }

  async createJob(
    userId: string,
    sourceTextId: string,
    lessonId: string,
    stage: "analysis" | "exercises"
  ) {
    const job = {
      id: `job-${this.generationJobs.size + 1}`,
      userId,
      sourceTextId,
      lessonId,
      status: "queued",
      stage,
      attempts: 0,
    };
    this.generationJobs.set(job.id, job);
    const lesson = this.lessons.get(lessonId);
    if (lesson) {
      if (stage === "analysis") {
        lesson.analysisStatus = "pending";
        lesson.exerciseStatus = "pending";
      } else {
        lesson.exerciseStatus = "pending";
      }
    }
    return job as unknown as GenerationJob;
  }

  async claimJob(_workerId: string) {
    for (const j of this.generationJobs.values()) {
      if (j.status === "queued") {
        j.status = "running";
        j.attempts += 1;
        return j as unknown as GenerationJob | null;
      }
    }
    return null;
  }

  async updateJobStatus(jobId: string, status: any, extra?: any) {
    const job = this.generationJobs.get(jobId);
    if (job) {
      job.status = status;
      if (extra) {
        Object.assign(job, extra);
      }
    }
  }

  async assertQueueCapacity(_userId: string) {
    return null;
  }

  async updateLessonStatus(
    lessonId: string,
    stage: any,
    status: any,
    extra?: any
  ) {
    const lesson = this.lessons.get(lessonId);
    if (lesson) {
      if (stage === "analysis") lesson.analysisStatus = status;
      else lesson.exerciseStatus = status;
      if (extra) Object.assign(lesson, extra);
    }
  }

  async saveAnalysis(
    lessonId: string,
    _userId: string,
    analysis: any,
    _model: string
  ) {
    this.savedAnalysisLessonId = lessonId;
    const lesson = this.lessons.get(lessonId);
    if (lesson) {
      Object.assign(lesson, analysis);
      lesson.analysisStatus = "succeeded";
    }
  }

  async saveExercises(
    lessonId: string,
    _userId: string,
    _exercises: any,
    _model: string
  ) {
    this.savedExercisesLessonId = lessonId;
    const lesson = this.lessons.get(lessonId);
    if (lesson) {
      lesson.exerciseStatus = "succeeded";
    }
  }

  async buildAnalysisFromLesson(lessonId: string) {
    const lesson = this.lessons.get(lessonId);
    return {
      title: lesson?.title ?? "Mock Title",
      textType: "general",
      detectedLevel: "B2",
      summaryVi: "Tóm tắt",
      naturalTranslationVi: "Dịch tự nhiên",
      contextExplanationVi: "Ngữ cảnh",
      sentenceBreakdowns: [],
      keyPhrases: [
        {
          phrase: "take a look",
          category: "general_phrase",
          meaningVi: "xem qua",
        },
      ],
      lessonFocuses: [
        { title: "Tone Focus", category: "tone", explanationVi: "giải thích" },
      ],
    } as any;
  }

  async deleteSourceText(_userId: string, sourceTextId: string) {
    this.sourceTexts.delete(sourceTextId);
  }

  async resetStuckJob(_userId: string, lessonId: string) {
    const lesson = this.lessons.get(lessonId);
    if (lesson) {
      lesson.analysisStatus = "pending";
      lesson.exerciseStatus = "pending";
    }
    for (const job of this.generationJobs.values()) {
      if (job.lessonId === lessonId) {
        job.status = "queued";
        job.attempts = 0;
        job.lockedAt = null;
        job.lockedBy = null;
      }
    }
  }

  async recordMilestone(input: any) {
    this.milestones.push(input);
  }

  async recordThought(input: any) {
    this.thoughts.push(input);
  }

  async getLessonProgress(input: any) {
    const lesson = this.lessons.get(input.lessonId);
    if (!lesson) return null;
    return {
      lesson: {
        id: lesson.id,
        analysisStatus: lesson.analysisStatus,
        exerciseStatus: lesson.exerciseStatus,
      },
      job: null,
      milestones: this.milestones.filter((m) => m.lessonId === lesson.id),
      thoughts: this.thoughts.filter((t) => t.lessonId === lesson.id),
    };
  }

  async getLessonAggregate(_lessonId: string, _userId: string): Promise<any> {
    return null;
  }

  async getRecentLessons(_userId: string, _limit: number): Promise<any[]> {
    return [];
  }

  async getSourceTextsCount(_userId: string): Promise<number> {
    return 0;
  }
}

class MockGenerationEngine implements GenerationEngine {
  analysisResult = {
    title: "Mock Lesson",
    textType: "general",
    detectedLevel: "B2",
    summaryVi: "Tóm tắt",
    naturalTranslationVi: "Dịch tự nhiên",
    contextExplanationVi: "Giải thích",
    sentenceBreakdowns: [],
    keyPhrases: [
      {
        phrase: "take a look",
        category: "general_phrase",
        meaningVi: "xem qua",
      },
    ],
    lessonFocuses: [
      { title: "Tone Focus", category: "tone", explanationVi: "Giọng điệu" },
    ],
  };

  exercisesResult = {
    exercises: [
      {
        type: "focus_question",
        focus: "Tone Focus",
        promptVi: "Hỏi về giọng điệu?",
        rubricVi: "Phải đúng",
      },
      {
        type: "natural_translation",
        phrase: "take a look",
        promptVi: "Dịch cụm?",
        promptEn: "Please take a look.",
        rubricVi: "Nghĩa xem qua",
      },
      {
        type: "meaning_choice",
        phrase: "take a look",
        promptVi: "Nghĩa cụm?",
        choices: ["xem", "chạy", "nhìn"],
        correctAnswer: "xem",
      },
      {
        type: "cloze_phrase",
        phrase: "take a look",
        promptVi: "Điền cụm từ phù hợp.",
        promptEn: "Can you ____?",
        correctAnswer: "take a look",
        acceptableAnswers: ["take a look"],
      },
      {
        type: "trap_choice",
        phrase: "take a look",
        promptVi: "Tránh bẫy dịch cho cụm:",
        promptEn: "Take a look.",
        choices: ["Hãy xem thử", "Lấy một cái nhìn", "Nhìn lâu"],
        correctAnswer: "Hãy xem thử",
      },
    ],
  };

  analysisError: Error | null = null;
  exercisesError: Error | null = null;
  lastAnalysisUserId?: string;
  lastAnalysisLessonId?: string;
  lastExercisesUserId?: string;
  lastExercisesLessonId?: string;

  async generateAnalysis(
    _sourceText: string,
    onThought?: any,
    _requestedMode?: string,
    _userHighlights?: string[],
    userId?: string,
    lessonId?: string
  ) {
    this.lastAnalysisUserId = userId;
    this.lastAnalysisLessonId = lessonId;
    if (this.analysisError) throw this.analysisError;
    if (onThought) {
      await onThought("Thought 1");
    }
    return this.analysisResult as any;
  }

  async generateExercises(
    _analysis: any,
    onThought?: any,
    userId?: string,
    lessonId?: string
  ) {
    this.lastExercisesUserId = userId;
    this.lastExercisesLessonId = lessonId;
    if (this.exercisesError) throw this.exercisesError;
    if (onThought) {
      await onThought("Thought 2");
    }
    return this.exercisesResult as any;
  }
}

describe("DefaultJobExecutor", () => {
  let repo: MockLessonRepository;
  let genEngine: MockGenerationEngine;
  let executor: DefaultJobExecutor;

  beforeEach(() => {
    repo = new MockLessonRepository();
    genEngine = new MockGenerationEngine();
    executor = new DefaultJobExecutor(repo, genEngine, getTextProcessor());
  });

  it("orchestrates successful lesson generation end-to-end", async () => {
    const res = await repo.createSourceTextAndLessonAndJob(
      "user-1",
      "Please take a look at this document.",
      "Title",
      "hash-1"
    );

    const job = res.job;
    const result = await executor.execute(job, "worker-1");

    expect(result.status).toBe("processed");
    if (result.status === "processed") {
      expect(result.success).toBe(true);
    }

    const lesson = repo.lessons.get(res.lesson.id);
    expect(lesson.analysisStatus).toBe("succeeded");
    expect(lesson.exerciseStatus).toBe("succeeded");

    expect(repo.milestones.map((m) => m.code)).toContain("claimed");
    expect(repo.milestones.map((m) => m.code)).toContain("analysis_started");
    expect(repo.milestones.map((m) => m.code)).toContain("analysis_saved");
    expect(repo.milestones.map((m) => m.code)).toContain("exercises_started");
    expect(repo.milestones.map((m) => m.code)).toContain("exercises_saved");
    expect(repo.milestones.map((m) => m.code)).toContain("completed");

    expect(repo.thoughts.map((t) => t.text)).toContain("Thought 1");
    expect(repo.thoughts.map((t) => t.text)).toContain("Thought 2");
  });

  it("handles non-transient errors by marking lesson and job failed", async () => {
    const res = await repo.createSourceTextAndLessonAndJob(
      "user-1",
      "Please take a look at this document.",
      "Title",
      "hash-1"
    );

    genEngine.analysisError = new Error("Hard constraint violation");

    const result = await executor.execute(res.job, "worker-1");

    expect(result.status).toBe("processed");
    if (result.status === "processed") {
      expect(result.success).toBe(false);
    }

    const lesson = repo.lessons.get(res.lesson.id);
    expect(lesson.analysisStatus).toBe("failed");
    expect(repo.generationJobs.get(res.job.id).status).toBe("failed");
    expect(repo.milestones.map((m) => m.code)).toContain("failed");
  });

  it("handles transient errors by throwing and resetting job to queued", async () => {
    const res = await repo.createSourceTextAndLessonAndJob(
      "user-1",
      "Please take a look at this document.",
      "Title",
      "hash-1"
    );

    genEngine.analysisError = new Error("RESOURCE_EXHAUSTED (429 status code)");

    await expect(executor.execute(res.job, "worker-1")).rejects.toThrow(
      "RESOURCE_EXHAUSTED"
    );

    const lesson = repo.lessons.get(res.lesson.id);
    expect(lesson.analysisStatus).toBe("pending");
    expect(repo.generationJobs.get(res.job.id).status).toBe("queued");
  });

  it("passes userId and lessonId to the generation engine", async () => {
    const res = await repo.createSourceTextAndLessonAndJob(
      "user-special-123",
      "Please take a look at this document.",
      "Title",
      "hash-1"
    );

    const result = await executor.execute(res.job, "worker-1");
    expect(result.status).toBe("processed");
    if (result.status === "processed") {
      expect(result.success).toBe(true);
    }

    expect(genEngine.lastAnalysisUserId).toBe("user-special-123");
    expect(genEngine.lastAnalysisLessonId).toBe(res.lesson.id);
    expect(genEngine.lastExercisesUserId).toBe("user-special-123");
    expect(genEngine.lastExercisesLessonId).toBe(res.lesson.id);
  });
});
