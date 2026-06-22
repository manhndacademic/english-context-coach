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
  draftTexts = new Map<string, any>();
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
    contentHash: string,
    requestedMode?: string,
    draftContent?: string
  ) {
    const st = {
      id: `st-${this.sourceTexts.size + 1}`,
      userId,
      content,
      title,
      contentHash,
    };
    this.sourceTexts.set(st.id, st);
    if (draftContent) {
      const dt = {
        id: `dt-${this.draftTexts.size + 1}`,
        userId,
        sourceTextId: st.id,
        content: draftContent,
      };
      this.draftTexts.set(dt.id, dt);
    }
    const lesson = {
      id: `les-${this.lessons.size + 1}`,
      sourceTextId: st.id,
      userId,
      version: 1,
      title: "Generating",
      analysisStatus: "pending",
      exerciseStatus: "idle",
      inputMode: requestedMode || "understand_and_practice",
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
      exerciseStatus: "idle",
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
    exercises: any,
    _model: string
  ) {
    this.savedExercisesLessonId = lessonId;
    const lesson = this.lessons.get(lessonId);
    if (lesson) {
      lesson.exerciseStatus = "succeeded";
      lesson.exercises = exercises.exercises;
    }
  }

  async buildAnalysisFromLesson(lessonId: string) {
    const lesson = this.lessons.get(lessonId);
    if (lesson?.inputMode === "diff") {
      return {
        title: lesson.title ?? "Mock Title",
        textType: "general",
        inputMode: "diff",
        detectedLevel: "B2",
        summaryVi: "Tóm tắt",
        naturalTranslationVi: "",
        contextExplanationVi: "",
        sentenceBreakdowns: [],
        keyPhrases: [],
        lessonFocuses: [],
        correctionItems: lesson.correctionItems ?? [],
      } as any;
    }
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

  async getLessonAggregate(lessonId: string, userId: string): Promise<any> {
    const lesson = this.lessons.get(lessonId);
    if (!lesson || lesson.userId !== userId) return null;

    const sourceText = this.sourceTexts.get(lesson.sourceTextId);
    let draftText = null;
    for (const dt of this.draftTexts.values()) {
      if (dt.sourceTextId === lesson.sourceTextId && dt.userId === userId) {
        draftText = dt;
        break;
      }
    }

    return {
      lesson,
      sourceText,
      draftText,
      keyPhrases: [],
      sentenceBreakdowns: [],
      lessonFocuses: [],
      exercises: [],
    };
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
  lastActiveMistakePatterns?: Array<{ conceptKey: string; category: string }>;

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

  async generateDiffAnalysis(
    _draftText: string,
    _sourceText: string,
    onThought?: any,
    userId?: string,
    lessonId?: string
  ): Promise<any> {
    this.lastAnalysisUserId = userId;
    this.lastAnalysisLessonId = lessonId;
    if (this.analysisError) throw this.analysisError;
    if (onThought) {
      await onThought("Thought 1");
    }
    return {
      title: "Mock Diff Lesson",
      textType: "general",
      inputMode: "diff",
      detectedLevel: "B1",
      summaryVi: "Mock diff summary",
      naturalTranslationVi: "",
      contextExplanationVi: "",
      keyPhrases: [],
      sentenceBreakdowns: [],
      lessonFocuses: [],
      correctionItems: [
        {
          draftPhrase: "very like",
          correctedPhrase: "really like",
          explanationVi: "Giới từ và trạng từ",
          literalTrapVi: "Rất thích",
          exampleEn: "I really like this project.",
          exampleVi: "Tôi thực sự thích dự án này.",
          category: "general_phrase",
          errorType: "literal_translation",
        },
      ],
    };
  }

  async generateWritingCoachAnalysis(
    _draftText: string,
    onThought?: any,
    userId?: string,
    lessonId?: string
  ): Promise<any> {
    this.lastAnalysisUserId = userId;
    this.lastAnalysisLessonId = lessonId;
    if (this.analysisError) throw this.analysisError;
    if (onThought) {
      await onThought("Thought Writing Coach");
    }
    return {
      title: "Mock Writing Coach Lesson",
      textType: "email",
      formality: "semi_formal",
      suggestedText: "I am writing to check the status.",
      inputMode: "write",
      detectedLevel: "B1",
      summaryVi: "Mock writing coach summary",
      naturalTranslationVi: "Tôi viết để kiểm tra trạng thái.",
      contextExplanationVi: "Giọng điệu phù hợp.",
      keyPhrases: [],
      sentenceBreakdowns: [],
      lessonFocuses: [],
      correctionItems: [
        {
          draftPhrase: "check state",
          correctedPhrase: "check the status",
          explanationVi: "Dùng từ phù hợp hơn",
          literalTrapVi: null,
          culturalNoteVi:
            "Trong email công việc, 'check the status' tự nhiên hơn.",
          exampleEn: "Can you check the status of the ticket?",
          exampleVi: "Bạn có thể kiểm tra trạng thái của ticket không?",
          category: "general_phrase",
          errorType: "collocation_error",
        },
      ],
    };
  }

  async generateExercises(
    analysis: any,
    onThought?: any,
    userId?: string,
    lessonId?: string,
    activeMistakePatterns?: Array<{ conceptKey: string; category: string }>
  ) {
    this.lastExercisesUserId = userId;
    this.lastExercisesLessonId = lessonId;
    this.lastActiveMistakePatterns = activeMistakePatterns;
    if (this.exercisesError) throw this.exercisesError;
    if (onThought) {
      await onThought("Thought 2");
    }
    if (analysis && analysis.inputMode === "diff") {
      const exercises: any[] = [];
      const corrections = analysis.correctionItems ?? [];
      const normalize = (phrase: string): string => {
        return phrase
          .toLowerCase()
          .replace(/[“”"'`]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      };

      for (const item of corrections) {
        const normDraft = normalize(item.draftPhrase);
        const normCorrected = normalize(item.correctedPhrase);
        const isRepeated =
          activeMistakePatterns?.some((pattern) => {
            const normKey = normalize(pattern.conceptKey.replace(/_/g, " "));
            return normDraft === normKey || normCorrected === normKey;
          }) ?? false;

        if (!isRepeated) {
          exercises.push({
            type: "meaning_choice",
            phrase: item.correctedPhrase,
            promptVi: `Cụm ${item.correctedPhrase} nghĩa là gì?`,
            choices: ["xem", "chạy", "thích"],
            correctAnswer: "thích",
          });
        }
        exercises.push({
          type: "cloze_phrase",
          phrase: item.correctedPhrase,
          promptVi: "Điền vào chỗ trống.",
          promptEn: "I ____ this.",
          correctAnswer: item.correctedPhrase,
          acceptableAnswers: [item.correctedPhrase],
        });
        exercises.push({
          type: "phrase_production",
          phrase: item.correctedPhrase,
          promptVi: `Viết một câu diễn đạt: ${item.exampleVi}`,
          correctAnswer: item.exampleEn,
          rubricVi: "Phải đúng",
        });
      }
      return { exercises };
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
      repo,
      repo,
      repo,
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
      exerciseStatus: "idle",
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

    it("enqueues both source text and draft text successfully in diff mode", async () => {
      const result = await engine.queue(
        "user-1",
        "This is the corrected version.",
        "diff",
        "This is the draft version."
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.lessonId).toBeDefined();
        expect(result.sourceTextId).toBeDefined();

        // Verify draft text is persisted in the repository map
        const draftTextsList = Array.from(repo.draftTexts.values());
        const draftText = draftTextsList.find(
          (dt) => dt.sourceTextId === result.sourceTextId
        );
        expect(draftText).toBeDefined();
        expect(draftText.content).toBe("This is the draft version.");
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

      // 1. Process Analysis
      const result = await engine.processNext("worker-1");
      expect(result.status).toBe("processed");
      if (result.status === "processed") {
        expect(result.success).toBe(true);

        const updatedLesson = repo.lessons.get("les-1");
        expect(updatedLesson.analysisStatus).toBe("succeeded");
        expect(updatedLesson.exerciseStatus).toBe("idle");
        expect(repo.milestones.map((m) => m.code)).toContain("completed");
        expect(repo.thoughts.map((t) => t.text)).toContain("Thought 1");
      }

      // 2. Queue Exercises
      const queueRes = await engine.queueExerciseGeneration("user-1", "les-1");
      expect(queueRes.ok).toBe(true);

      // 3. Process Exercises
      const result2 = await engine.processNext("worker-1");
      expect(result2.status).toBe("processed");
      if (result2.status === "processed") {
        expect(result2.success).toBe(true);

        const updatedLesson = repo.lessons.get("les-1");
        expect(updatedLesson.analysisStatus).toBe("succeeded");
        expect(updatedLesson.exerciseStatus).toBe("succeeded");
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
        lesson.exerciseStatus = "idle";
      }
      const st = repo.sourceTexts.get("st-1");
      if (st) {
        st.userId = "user-special-123";
      }

      // 1. Process Analysis
      const result = await engine.processNext("worker-1");
      expect(result.status).toBe("processed");
      if (result.status === "processed") {
        expect(result.success).toBe(true);
      }

      expect(genEngine.lastAnalysisUserId).toBe("user-special-123");
      expect(genEngine.lastAnalysisLessonId).toBe("les-1");

      // 2. Queue Exercises
      await engine.queueExerciseGeneration("user-special-123", "les-1");

      // 3. Process Exercises
      const result2 = await engine.processNext("worker-1");
      expect(result2.status).toBe("processed");
      if (result2.status === "processed") {
        expect(result2.success).toBe(true);
      }

      expect(genEngine.lastExercisesUserId).toBe("user-special-123");
      expect(genEngine.lastExercisesLessonId).toBe("les-1");
    });

    it("deduplicates key phrases before saving analysis", async () => {
      const job = {
        id: "job-dedup",
        userId: "user-1",
        sourceTextId: "st-1",
        lessonId: "les-1",
        status: "queued",
        stage: "analysis",
        attempts: 0,
      };
      repo.generationJobs.set(job.id, job);

      genEngine.analysisResult = {
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
            conceptKey: "take_a_look",
            conceptPhrase: "take a look",
            conceptMeaningVi: "xem qua",
            meaningVi: "xem qua",
            meaningInContextVi: "xem qua",
            category: "general_phrase",
            difficulty: "B2",
            examples: [],
          },
          {
            phrase: "take a look when you get a chance",
            conceptKey: "take_a_look",
            conceptPhrase: "take a look",
            conceptMeaningVi: "xem qua",
            meaningVi: "xem qua",
            meaningInContextVi: "xem qua cơ hội",
            category: "general_phrase",
            difficulty: "B2",
            examples: [],
          },
        ],
        lessonFocuses: [],
      } as any;

      const result = await engine.processNext("worker-1");
      expect(result.status).toBe("processed");
      if (result.status === "processed") {
        expect(result.success).toBe(true);
      }

      const savedLesson = repo.lessons.get("les-1");
      expect(savedLesson.keyPhrases).toHaveLength(1);
      expect(savedLesson.keyPhrases[0].phrase).toBe(
        "take a look when you get a chance"
      );
    });

    it("queries active mistake patterns and passes them to generateExercises", async () => {
      let calledUserId = "";
      const activePatterns = [
        { conceptKey: "passive_voice", category: "grammar_pattern" },
      ];

      const customCollaborators = {
        notifyJobQueued: async () => {},
        bulkCreateSrsCardsFromKeyPhrases: async () => ({
          inserted: 0,
          skipped: 0,
        }),
        scrubSensitiveContentForSourceText: async () => {},
        getActiveMistakePatterns: async (userId: string) => {
          calledUserId = userId;
          return activePatterns;
        },
      };

      const testEngine = new DefaultLessonGenerationEngine(
        repo,
        repo,
        repo,
        repo,
        repo,
        genEngine,
        getTextProcessor(),
        customCollaborators as any
      );

      const job = {
        id: "job-exercises-targeted",
        userId: "user-targeted-123",
        sourceTextId: "st-1",
        lessonId: "les-1",
        status: "queued",
        stage: "exercises",
        attempts: 0,
      };
      repo.generationJobs.set(job.id, job);

      const lesson = repo.lessons.get("les-1");
      if (lesson) {
        lesson.userId = "user-targeted-123";
      }
      const st = repo.sourceTexts.get("st-1");
      if (st) {
        st.userId = "user-targeted-123";
      }

      genEngine.lastExercisesUserId = undefined;
      genEngine.lastExercisesLessonId = undefined;
      genEngine.lastActiveMistakePatterns = undefined;

      const result = await testEngine.processNext("worker-1");
      expect(result.status).toBe("processed");
      if (result.status === "processed") {
        expect(result.success).toBe(true);
      }

      expect(calledUserId).toBe("user-targeted-123");
      expect(genEngine.lastActiveMistakePatterns).toEqual(activePatterns);
    });

    it("runs diff analysis and saves CorrectionItems in diff mode", async () => {
      const queueRes = await engine.queue(
        "user-diff-test",
        "This is corrected text.",
        "diff",
        "This is draft text."
      );
      expect(queueRes.ok).toBe(true);
      if (queueRes.ok) {
        const result = await engine.processNext("worker-diff-test");
        expect(result.status).toBe("processed");
        if (result.status === "processed") {
          expect(result.success).toBe(true);
        }

        const savedLesson = repo.lessons.get(queueRes.lessonId);
        expect(savedLesson).toBeDefined();
        expect(savedLesson.inputMode).toBe("diff");
        expect(savedLesson.correctionItems).toHaveLength(1);
        expect(savedLesson.correctionItems[0].draftPhrase).toBe("very like");
        expect(savedLesson.correctionItems[0].correctedPhrase).toBe(
          "really like"
        );
      }
    });

    it("runs writing coach analysis and saves columns in write mode", async () => {
      const queueRes = await engine.queue(
        "user-write-test",
        "This is draft text.",
        "write"
      );
      expect(queueRes.ok).toBe(true);
      if (queueRes.ok) {
        const result = await engine.processNext("worker-write-test");
        expect(result.status).toBe("processed");
        if (result.status === "processed") {
          expect(result.success).toBe(true);
        }

        const savedLesson = repo.lessons.get(queueRes.lessonId);
        expect(savedLesson).toBeDefined();
        expect(savedLesson.inputMode).toBe("write");
        expect(savedLesson.formality).toBe("semi_formal");
        expect(savedLesson.suggestedText).toBe(
          "I am writing to check the status."
        );
        expect(savedLesson.correctionItems).toHaveLength(1);
        expect(savedLesson.correctionItems[0].draftPhrase).toBe("check state");
        expect(savedLesson.correctionItems[0].correctedPhrase).toBe(
          "check the status"
        );
        expect(savedLesson.correctionItems[0].culturalNoteVi).toBe(
          "Trong email công việc, 'check the status' tự nhiên hơn."
        );
      }
    });

    it("generates scaffolded exercises in diff mode", async () => {
      const queueRes = await engine.queue(
        "user-diff-test",
        "This is corrected text.",
        "diff",
        "This is draft text."
      );
      expect(queueRes.ok).toBe(true);
      if (queueRes.ok) {
        const lessonId = queueRes.lessonId;

        // 1. Process analysis stage
        await engine.processNext("worker-diff-test");

        // 2. Queue exercise generation
        const queueExRes = await engine.queueExerciseGeneration(
          "user-diff-test",
          lessonId
        );
        expect(queueExRes.ok).toBe(true);

        // 3. Process exercises stage
        const procExRes = await engine.processNext("worker-diff-test");
        expect(procExRes.status).toBe("processed");
        if (procExRes.status === "processed") {
          expect(procExRes.success).toBe(true);
        }

        const savedLesson = repo.lessons.get(lessonId);
        expect(savedLesson.exerciseStatus).toBe("succeeded");
        expect(savedLesson.exercises).toBeDefined();
        // Since it's a standard mistake (not in active mistake patterns), it should generate 3 exercises per correction item:
        // meaning_choice, cloze_phrase, phrase_production
        expect(savedLesson.exercises).toHaveLength(3);
        expect(savedLesson.exercises[0].type).toBe("meaning_choice");
        expect(savedLesson.exercises[1].type).toBe("cloze_phrase");
        expect(savedLesson.exercises[2].type).toBe("phrase_production");
      }
    });

    it("skips recognition step for repeated mistakes in diff mode", async () => {
      // Set up active patterns
      const activePatterns = [
        { conceptKey: "really_like", category: "general_phrase" },
      ];
      const localEngine = new DefaultLessonGenerationEngine(
        repo,
        repo,
        repo,
        repo,
        repo,
        genEngine,
        getTextProcessor(),
        {
          notifyJobQueued: async () => {},
          bulkCreateSrsCardsFromKeyPhrases: async () => ({
            inserted: 0,
            skipped: 0,
          }),
          scrubSensitiveContentForSourceText: async () => {},
          getActiveMistakePatterns: async () => activePatterns,
        }
      );

      const queueRes = await localEngine.queue(
        "user-diff-test",
        "This is corrected text.",
        "diff",
        "This is draft text."
      );
      expect(queueRes.ok).toBe(true);
      if (queueRes.ok) {
        const lessonId = queueRes.lessonId;

        // 1. Process analysis stage
        await localEngine.processNext("worker-diff-test");

        // 2. Queue exercise generation
        await localEngine.queueExerciseGeneration("user-diff-test", lessonId);

        // 3. Process exercises stage
        await localEngine.processNext("worker-diff-test");

        const savedLesson = repo.lessons.get(lessonId);
        expect(savedLesson.exerciseStatus).toBe("succeeded");
        expect(savedLesson.exercises).toBeDefined();
        // Since "really_like" is in active patterns, it matches correctedPhrase "really like",
        // so meaning_choice is skipped, leaving only cloze_phrase and phrase_production (2 exercises total).
        expect(savedLesson.exercises).toHaveLength(2);
        expect(savedLesson.exercises[0].type).toBe("cloze_phrase");
        expect(savedLesson.exercises[1].type).toBe("phrase_production");
      }
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
