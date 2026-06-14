import type { Attempt, UserError } from "@/domain/memory/types";
import type { MistakePattern } from "@/domain/memory/mistake-pattern";
import type {
  GenerationMilestoneCode,
  GenerationStage,
} from "@/domain/generation-progress";

export type TextType =
  | "work_message"
  | "technical_doc"
  | "email"
  | "article"
  | "academic"
  | "general"
  | "unknown";
export type DetectedLevel = "A2" | "B1" | "B2" | "C1";

export interface SourceText {
  id: string;
  userId: string;
  content: string;
  title: string;
  contentHash: string;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface Lesson {
  id: string;
  sourceTextId: string;
  userId: string;
  version: number;
  title: string;
  analysisStatus: "pending" | "running" | "succeeded" | "failed";
  exerciseStatus: "pending" | "running" | "succeeded" | "failed";
  textType: TextType | "unknown" | null;
  inputMode: string;
  detectedLevel: DetectedLevel | null;
  summaryVi: string | null;
  naturalTranslationVi: string | null;
  contextExplanationVi: string | null;
  exerciseModel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KeyPhrase {
  id: string;
  lessonId: string;
  userId: string;
  phrase: string;
  conceptKey: string;
  conceptPhrase: string;
  conceptMeaningVi: string;
  normalizedPhrase: string;
  senseKey: string;
  meaningVi: string;
  meaningInContextVi: string | null;
  exampleEn: string | null;
  exampleVi: string | null;
  examples: { exampleEn: string; exampleVi: string }[];
  literalTranslationVi: string | null;
  naturalTranslationVi: string | null;
  whyConfusingVi: string | null;
  category:
    | "idiom"
    | "phrasal_verb"
    | "technical_term"
    | "collocation"
    | "grammar_pattern"
    | "business_phrase"
    | "general_phrase";
  difficulty: DetectedLevel;
  isSensitive: boolean;
  createdAt: Date;
}

export interface SentenceBreakdown {
  id: string;
  lessonId: string;
  userId: string;
  sentence: string;
  correctedSentenceEn: string | null;
  naturalMeaningVi: string;
  structureNotesVi: string;
  toneOrContextVi: string | null;
  orderIndex: number;
  createdAt: Date;
}

export interface LessonFocus {
  id: string;
  lessonId: string;
  userId: string;
  title: string;
  conceptKey: string;
  conceptPhrase: string;
  conceptMeaningVi: string;
  category: "tone" | "structure" | "purpose" | "context";
  explanationVi: string;
  difficulty: DetectedLevel;
  createdAt: Date;
}

export interface Exercise {
  id: string;
  lessonId: string;
  userId: string;
  keyPhraseId: string | null;
  lessonFocusId: string | null;
  type:
    | "meaning_choice"
    | "cloze_phrase"
    | "natural_translation"
    | "focus_question"
    | "trap_choice"
    | "phrase_production"
    | "dialogue_completion"
    | "register_shift"
    | "trap_detect";
  promptVi: string;
  promptEn: string | null;
  choices: string[] | null;
  correctAnswer: string | null;
  acceptableAnswers: string[] | null;
  rubricVi: string | null;
  orderIndex: number;
  createdAt: Date;
}

export interface GenerationJob {
  id: string;
  userId: string;
  sourceTextId: string;
  lessonId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  attempts: number;
  errorMessage: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationMilestone {
  id: number;
  lessonId: string;
  generationJobId: string;
  code: GenerationMilestoneCode;
  stage: string | null;
  createdAt: Date;
}

export interface GenerationThought {
  id: number;
  lessonId: string;
  generationJobId: string;
  stage: string | null;
  text: string;
  createdAt: Date;
}

export interface LessonAggregate {
  lesson: Lesson;
  sourceText: SourceText | null;
  keyPhrases: KeyPhrase[];
  sentenceBreakdowns: SentenceBreakdown[];
  lessonFocuses: LessonFocus[];
  exercises: Exercise[];
  attempts: Attempt[];
  userErrors: UserError[];
  mistakePatterns: MistakePattern[];
  progress: {
    lesson: {
      id: string;
      analysisStatus: "pending" | "running" | "succeeded" | "failed";
      exerciseStatus: "pending" | "running" | "succeeded" | "failed";
    };
    job: GenerationJob | null;
    milestones: GenerationMilestone[];
    thoughts: GenerationThought[];
  } | null;
}

export interface SaveAnalysisInput {
  title: string;
  textType: TextType;
  inputMode: string;
  detectedLevel: DetectedLevel;
  summaryVi: string;
  naturalTranslationVi: string;
  contextExplanationVi: string;
  keyPhrases: Array<{
    phrase: string;
    conceptKey: string;
    conceptPhrase: string;
    conceptMeaningVi: string;
    meaningVi: string;
    meaningInContextVi: string;
    exampleEn: string;
    exampleVi: string;
    examples?: { exampleEn: string; exampleVi: string }[];
    literalTranslationVi?: string;
    naturalTranslationVi?: string;
    whyConfusingVi?: string;
    category:
      | "idiom"
      | "phrasal_verb"
      | "technical_term"
      | "collocation"
      | "grammar_pattern"
      | "business_phrase"
      | "general_phrase";
    difficulty: DetectedLevel;
  }>;
  sentenceBreakdowns: Array<{
    sentence: string;
    correctedSentenceEn?: string;
    naturalMeaningVi: string;
    structureNotesVi: string;
    toneOrContextVi?: string;
  }>;
  lessonFocuses: Array<{
    title: string;
    conceptKey: string;
    conceptPhrase: string;
    conceptMeaningVi: string;
    category: "tone" | "structure" | "purpose" | "context";
    explanationVi: string;
    difficulty: DetectedLevel;
  }>;
}

export interface SaveExercisesInput {
  exercises: Array<{
    phrase?: string;
    focus?: string;
    type:
      | "meaning_choice"
      | "cloze_phrase"
      | "natural_translation"
      | "focus_question"
      | "trap_choice"
      | "phrase_production"
      | "dialogue_completion"
      | "register_shift"
      | "trap_detect";
    promptVi: string;
    promptEn?: string;
    choices?: string[];
    correctAnswer?: string;
    acceptableAnswers?: string[];
    rubricVi?: string;
  }>;
}

export interface LessonRepository {
  // SourceText methods
  findSourceText(
    sourceTextId: string,
    userId: string
  ): Promise<SourceText | null>;
  deleteSourceText(userId: string, sourceTextId: string): Promise<void>;
  getSourceTextsCount(userId: string): Promise<number>;

  // Lesson methods
  findLesson(lessonId: string, userId: string): Promise<Lesson | null>;
  findLatestLesson(sourceTextId: string): Promise<Lesson | null>;
  findKeyPhrase(keyPhraseId: string): Promise<KeyPhrase | null>;
  findLessonFocus(lessonFocusId: string): Promise<LessonFocus | null>;

  updateLessonStatus(
    lessonId: string,
    stage: "analysis" | "exercise",
    status: "pending" | "running" | "succeeded" | "failed",
    extra?: Partial<Lesson>
  ): Promise<void>;

  saveAnalysis(
    lessonId: string,
    userId: string,
    analysis: SaveAnalysisInput,
    model: string
  ): Promise<void>;

  saveExercises(
    lessonId: string,
    userId: string,
    exercises: SaveExercisesInput,
    model: string
  ): Promise<void>;

  buildAnalysisFromLesson(lessonId: string): Promise<SaveAnalysisInput>;

  getLessonAggregate(
    lessonId: string,
    userId: string
  ): Promise<LessonAggregate | null>;
  getRecentLessons(
    userId: string,
    limit: number
  ): Promise<
    Array<{
      id: string;
      title: string | null;
      version: number;
      analysisStatus: "pending" | "running" | "succeeded" | "failed";
      exerciseStatus: "pending" | "running" | "succeeded" | "failed";
      textType: TextType | "unknown";
      inputMode: string;
      detectedLevel: DetectedLevel | null;
      createdAt: Date;
    }>
  >;

  // GenerationJob methods
  claimJob(workerId: string): Promise<GenerationJob | null>;
  updateJobStatus(
    jobId: string,
    status: "queued" | "running" | "succeeded" | "failed",
    extra?: Partial<GenerationJob>
  ): Promise<void>;
  assertQueueCapacity(userId: string): Promise<string | null>;
  resetStuckJob(userId: string, lessonId: string): Promise<void>;

  // GenerationProgress methods
  recordMilestone(input: {
    lessonId: string;
    generationJobId: string;
    code: GenerationMilestoneCode;
    stage: GenerationStage;
  }): Promise<void>;

  recordThought(input: {
    lessonId: string;
    generationJobId: string;
    stage: GenerationStage;
    text: string;
  }): Promise<void>;

  getLessonProgress(input: {
    lessonId: string;
    userId: string;
    afterMilestoneId?: number;
    afterThoughtId?: number;
  }): Promise<{
    lesson: {
      id: string;
      analysisStatus: "pending" | "running" | "succeeded" | "failed";
      exerciseStatus: "pending" | "running" | "succeeded" | "failed";
    };
    job: GenerationJob | null;
    milestones: GenerationMilestone[];
    thoughts: GenerationThought[];
  } | null>;

  // Transaction coordination methods
  createSourceTextAndLessonAndJob(
    userId: string,
    content: string,
    title: string,
    contentHash: string,
    requestedMode?: string
  ): Promise<{ lesson: Lesson; job: GenerationJob }>;

  createLessonAndJob(
    userId: string,
    sourceTextId: string,
    version: number,
    stage: "analysis" | "exercises"
  ): Promise<{ lesson: Lesson; job: GenerationJob }>;

  createJob(
    userId: string,
    sourceTextId: string,
    lessonId: string,
    stage: "analysis" | "exercises"
  ): Promise<GenerationJob>;
}

export interface GenerationEngine {
  generateAnalysis(
    sourceText: string,
    onThought?: (text: string) => Promise<void>,
    requestedMode?: string,
    userHighlights?: string[]
  ): Promise<SaveAnalysisInput>;

  generateExercises(
    analysis: SaveAnalysisInput,
    onThought?: (text: string) => Promise<void>
  ): Promise<SaveExercisesInput>;
}

export type LessonGenerationResult =
  | { ok: true; lessonId: string; sourceTextId: string }
  | {
      ok: false;
      error:
        | "VALIDATION_FAILED"
        | "CAPACITY_EXCEEDED"
        | "NOT_FOUND"
        | "INVALID_STATE";
      message: string;
    };

export type JobProcessResult =
  | { status: "processed"; jobId: string; lessonId: string; success: boolean }
  | { status: "idle" }
  | { status: "failed"; error: string };

export interface GenerationProgress {
  lessonId: string;
  analysisStatus: "pending" | "running" | "succeeded" | "failed";
  exerciseStatus: "pending" | "running" | "succeeded" | "failed";
  latestMilestone: string | null;
  thoughts: Array<{
    stage: "analysis" | "exercises";
    text: string;
    createdAt: Date;
  }>;
}

export interface LessonGenerationEngine {
  queue(
    userId: string,
    content: string,
    requestedMode?: string
  ): Promise<LessonGenerationResult>;
  retry(userId: string, lessonId: string): Promise<LessonGenerationResult>;
  processNext(workerId: string): Promise<JobProcessResult>;
  getProgress(
    lessonId: string,
    userId: string
  ): Promise<GenerationProgress | null>;
}
