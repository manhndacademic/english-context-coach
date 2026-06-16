import { describe, expect, it, beforeEach } from "vitest";
import { DefaultLessonGenerationEngine } from "./engine";
import { getTextProcessor } from "@/domain/text";
import type {
  LessonRepository,
  GenerationEngine,
  LessonGenerationEngine,
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

  async findKeyPhrases(_lessonId: string) {
    return [];
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

describe("DefaultLessonGenerationEngine Domain Orchestrator", () => {
  let repo: MockLessonRepository;
  let genEngine: MockGenerationEngine;
  let engine: LessonGenerationEngine;

  beforeEach(() => {
    repo = new MockLessonRepository();
    genEngine = new MockGenerationEngine();
    engine = new DefaultLessonGenerationEngine(
      repo,
      genEngine,
      getTextProcessor()
    );

    repo.sourceTexts.set("st-1", {
      id: "st-1",
      userId: "user-1",
      content: "Please take a look when you get a chance.",
    });

    repo.lessons.set("les-1", {
      id: "les-1",
      sourceTextId: "st-1",
      userId: "user-1",
      version: 1,
      title: "Generating",
      analysisStatus: "pending",
      exerciseStatus: "pending",
    });
  });

  describe("queue", () => {
    it("enqueues a new source text successfully", async () => {
      const result = await engine.queue(
        "user-1",
        "Hello world from english context coach."
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.lessonId).toBeDefined();
        expect(result.sourceTextId).toBeDefined();

        const milestone = repo.milestones.find(
          (m) => m.lessonId === result.lessonId
        );
        expect(milestone).toBeDefined();
        expect(milestone.code).toBe("queued");
      }
    });

    it("returns validation failure for empty input", async () => {
      const result = await engine.queue("user-1", "   ");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("retry", () => {
    it("handles regeneration for successfully completed lessons", async () => {
      repo.lessons.get("les-1").analysisStatus = "succeeded";
      repo.lessons.get("les-1").exerciseStatus = "succeeded";

      const result = await engine.retry("user-1", "les-1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.lessonId).not.toBe("les-1"); // creates a new lesson version
        const newLesson = repo.lessons.get(result.lessonId);
        expect(newLesson.version).toBe(2);
      }
    });

    it("handles retry on same lesson record for failed analysis", async () => {
      repo.lessons.get("les-1").analysisStatus = "failed";
      repo.lessons.get("les-1").exerciseStatus = "pending";

      const result = await engine.retry("user-1", "les-1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.lessonId).toBe("les-1"); // retries on same lesson ID
        expect(repo.lessons.get("les-1").analysisStatus).toBe("pending");
      }
    });

    it("handles retry on same lesson record for failed exercises", async () => {
      repo.lessons.get("les-1").analysisStatus = "succeeded";
      repo.lessons.get("les-1").exerciseStatus = "failed";

      const result = await engine.retry("user-1", "les-1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.lessonId).toBe("les-1");
        expect(repo.lessons.get("les-1").exerciseStatus).toBe("pending");
      }
    });
  });

  describe("processNext", () => {
    it("orchestrates successful lesson generation, milestones, and thoughts", async () => {
      const job = {
        id: "job-1",
        userId: "user-1",
        sourceTextId: "st-1",
        lessonId: "les-1",
        status: "queued",
        stage: "analysis",
        attempts: 0,
      };
      repo.generationJobs.set(job.id, job);

      const result = await engine.processNext("worker-1");
      expect(result.status).toBe("processed");
      if (result.status === "processed") {
        expect(result.success).toBe(true);

        const updatedLesson = repo.lessons.get("les-1");
        expect(updatedLesson.analysisStatus).toBe("succeeded");
        expect(updatedLesson.exerciseStatus).toBe("succeeded");

        expect(repo.milestones.map((m) => m.code)).toContain("completed");
        expect(repo.thoughts.map((t) => t.text)).toContain("Thought 1");
        expect(repo.thoughts.map((t) => t.text)).toContain("Thought 2");
      }
    });

    it("handles non-transient errors by marking lesson and job failed", async () => {
      const job = {
        id: "job-1",
        userId: "user-1",
        sourceTextId: "st-1",
        lessonId: "les-1",
        status: "queued",
        stage: "analysis",
        attempts: 0,
      };
      repo.generationJobs.set(job.id, job);
      genEngine.analysisError = new Error("Hard model constraint violation");

      const result = await engine.processNext("worker-1");
      expect(result.status).toBe("processed");
      if (result.status === "processed") {
        expect(result.success).toBe(false);

        const updatedLesson = repo.lessons.get("les-1");
        expect(updatedLesson.analysisStatus).toBe("failed");
        expect(repo.generationJobs.get("job-1").status).toBe("failed");
      }
    });

    it("handles transient errors by putting job back in queue", async () => {
      const job = {
        id: "job-1",
        userId: "user-1",
        sourceTextId: "st-1",
        lessonId: "les-1",
        status: "queued",
        stage: "analysis",
        attempts: 0,
      };
      repo.generationJobs.set(job.id, job);
      genEngine.analysisError = new Error("UNAVAILABLE (503 status code)");

      await expect(engine.processNext("worker-1")).rejects.toThrow(
        "UNAVAILABLE"
      );

      const updatedLesson = repo.lessons.get("les-1");
      expect(updatedLesson.analysisStatus).toBe("pending");
      expect(repo.generationJobs.get("job-1").status).toBe("queued");
    });

    it("passes userId and lessonId to the generation engine", async () => {
      const job = {
        id: "job-1",
        userId: "user-special-123",
        sourceTextId: "st-1",
        lessonId: "les-1",
        status: "queued",
        stage: "analysis",
        attempts: 0,
      };
      repo.generationJobs.set(job.id, job);
      const lesson = repo.lessons.get("les-1");
      if (lesson) {
        lesson.userId = "user-special-123";
      }
      const st = repo.sourceTexts.get("st-1");
      if (st) {
        st.userId = "user-special-123";
      }

      const result = await engine.processNext("worker-1");
      expect(result.status).toBe("processed");
      if (result.status === "processed") {
        expect(result.success).toBe(true);
      }

      expect(genEngine.lastAnalysisUserId).toBe("user-special-123");
      expect(genEngine.lastAnalysisLessonId).toBe("les-1");
      expect(genEngine.lastExercisesUserId).toBe("user-special-123");
      expect(genEngine.lastExercisesLessonId).toBe("les-1");
    });
  });

  describe("getProgress", () => {
    it("returns progress details for active lesson", async () => {
      repo.lessons.get("les-1").analysisStatus = "running";
      repo.milestones.push({ lessonId: "les-1", code: "analysis_started" });

      const progress = await engine.getProgress("les-1", "user-1");
      expect(progress).not.toBeNull();
      if (progress) {
        expect(progress.analysisStatus).toBe("running");
        expect(progress.latestMilestone).toBe("analysis_started");
      }
    });
  });
});
