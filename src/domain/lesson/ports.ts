import type {
  GenerationMilestoneCode,
  GenerationStage,
} from "@/domain/generation-progress";
import type {
  KeyPhraseCategory,
  ExerciseType,
  GenerationStatus,
  JobStatus,
  LessonFocusCategory,
  DiffType,
  UserErrorType,
} from "@/domain/types";

export interface DraftText {
  id: string;
  userId: string;
  sourceTextId: string;
  content: string;
  createdAt: Date;
}

export interface CorrectionItem {
  id: string;
  lessonId: string;
  draftPhrase: string;
  correctedPhrase: string;
  explanationVi: string;
  literalTrapVi: string | null;
  culturalNoteVi: string | null;
  exampleEn: string;
  exampleVi: string;
  category: KeyPhraseCategory;
  errorType: UserErrorType;
  orderIndex: number;
  createdAt: Date;
}

export type TextType =
  | "work_message"
  | "technical_doc"
  | "email"
  | "article"
  | "academic"
  | "general"
  | "unknown"
  | "chat_message"
  | "ticket"
  | "code_review"
  | "meeting_notes";

export type DocumentType = TextType;

export type Formality = "formal" | "semi_formal" | "casual";

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
  analysisStatus: GenerationStatus;
  exerciseStatus: GenerationStatus;
  textType: TextType | "unknown" | null;
  formality: Formality | null;
  suggestedText: string | null;
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
  examples: { exampleEn: string; exampleVi: string; ipa?: string }[];
  literalTranslationVi: string | null;
  naturalTranslationVi: string | null;
  whyConfusingVi: string | null;
  ipa?: string | null;
  category: KeyPhraseCategory;
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
  diffSpans: Array<{
    type: DiffType;
    text: string;
  }> | null;
  naturalMeaningVi: string;
  structureNotesVi: string;
  toneOrContextVi: string | null;
  ipa?: string | null;
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
  category: LessonFocusCategory;
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
  correctionItemId?: string | null;
  type: ExerciseType;
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
  status: JobStatus;
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
  draftText?: DraftText | null;
  correctionItems?: CorrectionItem[];
  progress: {
    lesson: {
      id: string;
      analysisStatus: GenerationStatus;
      exerciseStatus: GenerationStatus;
    };
    job: GenerationJob | null;
    milestones: GenerationMilestone[];
    thoughts: GenerationThought[];
  } | null;
}

export interface SaveAnalysisInput {
  title: string;
  textType: TextType;
  formality?: Formality | null;
  suggestedText?: string | null;
  inputMode: string;
  detectedLevel: DetectedLevel;
  summaryVi: string;
  naturalTranslationVi: string;
  contextExplanationVi: string;
  correctionItems?: Array<{
    draftPhrase: string;
    correctedPhrase: string;
    explanationVi: string;
    literalTrapVi?: string | null;
    culturalNoteVi?: string | null;
    exampleEn: string;
    exampleVi: string;
    category: KeyPhraseCategory;
    errorType: UserErrorType;
  }>;
  keyPhrases: Array<{
    phrase: string;
    conceptKey: string;
    conceptPhrase: string;
    conceptMeaningVi: string;
    meaningVi: string;
    meaningInContextVi: string;
    examples: { exampleEn: string; exampleVi: string; ipa?: string }[];
    literalTranslationVi?: string;
    naturalTranslationVi?: string;
    whyConfusingVi?: string;
    ipa?: string;
    category: KeyPhraseCategory;
    difficulty: DetectedLevel;
  }>;
  sentenceBreakdowns: Array<{
    sentence: string;
    correctedSentenceEn?: string;
    diffSpans?: Array<{ type: DiffType; text: string }>;
    naturalMeaningVi: string;
    structureNotesVi: string;
    toneOrContextVi?: string;
    ipa?: string;
  }>;
  lessonFocuses: Array<{
    title: string;
    conceptKey: string;
    conceptPhrase: string;
    conceptMeaningVi: string;
    category: LessonFocusCategory;
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

// ---------------------------------------------------------------------------
// Focused repository interfaces (split from the original monolithic interface)
// ---------------------------------------------------------------------------

/** Manages SourceText lifecycle: creation, lookup, deletion, and hashing. */
export interface SourceTextRepository {
  findSourceText(
    sourceTextId: string,
    userId: string
  ): Promise<SourceText | null>;
  deleteSourceText(userId: string, sourceTextId: string): Promise<void>;
  getSourceTextsCount(userId: string): Promise<number>;
  getRecentLessons(
    userId: string,
    limit: number
  ): Promise<
    Array<{
      id: string;
      title: string | null;
      version: number;
      analysisStatus: GenerationStatus;
      exerciseStatus: GenerationStatus;
      textType: TextType | "unknown";
      inputMode: string;
      detectedLevel: DetectedLevel | null;
      createdAt: Date;
    }>
  >;
}

/** Manages Lesson entity lifecycle: CRUD, status updates, analysis/exercise saving. */
export interface LessonContentRepository {
  findLesson(lessonId: string, userId: string): Promise<Lesson | null>;
  findLatestLesson(sourceTextId: string): Promise<Lesson | null>;
  findKeyPhrase(keyPhraseId: string): Promise<KeyPhrase | null>;
  findKeyPhrases(lessonId: string): Promise<KeyPhrase[]>;

  findLessonFocus(lessonFocusId: string): Promise<LessonFocus | null>;

  updateLessonStatus(
    lessonId: string,
    stage: "analysis" | "exercise",
    status: GenerationStatus,
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
}

/** Manages GenerationJob queue: claiming, status updates, capacity checks. */
export interface GenerationJobRepository {
  claimJob(workerId: string): Promise<GenerationJob | null>;
  updateJobStatus(
    jobId: string,
    status: JobStatus,
    extra?: Partial<GenerationJob>
  ): Promise<void>;
  assertQueueCapacity(userId: string): Promise<string | null>;
  resetStuckJob(userId: string, lessonId: string): Promise<void>;
}

/** Records and queries durable generation progress: milestones and thoughts. */
export interface GenerationProgressRepository {
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
      analysisStatus: GenerationStatus;
      exerciseStatus: GenerationStatus;
    };
    job: GenerationJob | null;
    milestones: GenerationMilestone[];
    thoughts: GenerationThought[];
  } | null>;
}

/** Transaction coordination: atomically creates source texts, lessons, and jobs together. */
export interface LessonTransactionRepository {
  createSourceTextAndLessonAndJob(
    userId: string,
    content: string,
    title: string,
    contentHash: string,
    requestedMode?: string,
    draftContent?: string
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

  changeLessonContext(
    userId: string,
    lessonId: string,
    documentType?: string,
    formality?: string
  ): Promise<{ lesson: Lesson; job: GenerationJob }>;
}

/**
 * Combined repository interface for the lesson bounded context.
 * Composes all four focused sub-repositories.
 * Existing consumers can continue to use this single type.
 */
export interface LessonRepository
  extends
    SourceTextRepository,
    LessonContentRepository,
    GenerationJobRepository,
    GenerationProgressRepository,
    LessonTransactionRepository {}

// ---------------------------------------------------------------------------
// Engine ports
// ---------------------------------------------------------------------------

export interface GenerationEngine {
  generateAnalysis(
    sourceText: string,
    onThought?: (text: string) => Promise<void>,
    requestedMode?: string,
    userHighlights?: string[],
    userId?: string,
    lessonId?: string
  ): Promise<SaveAnalysisInput>;

  generateDiffAnalysis?(
    draftText: string,
    sourceText: string,
    onThought?: (text: string) => Promise<void>,
    userId?: string,
    lessonId?: string
  ): Promise<SaveAnalysisInput>;

  generateWritingCoachAnalysis?(
    draftText: string,
    onThought?: (text: string) => Promise<void>,
    userId?: string,
    lessonId?: string
  ): Promise<SaveAnalysisInput>;

  generateExercises(
    analysis: SaveAnalysisInput,
    onThought?: (text: string) => Promise<void>,
    userId?: string,
    lessonId?: string,
    activeMistakePatterns?: Array<{ conceptKey: string; category: string }>
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
  analysisStatus: GenerationStatus;
  exerciseStatus: GenerationStatus;
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
    requestedMode?: string,
    draftContent?: string
  ): Promise<LessonGenerationResult>;
  retry(userId: string, lessonId: string): Promise<LessonGenerationResult>;
  queueExerciseGeneration(
    userId: string,
    lessonId: string
  ): Promise<LessonGenerationResult>;
  deleteSourceText(userId: string, sourceTextId: string): Promise<void>;
  processNext(workerId: string): Promise<JobProcessResult>;
  getProgress(
    lessonId: string,
    userId: string
  ): Promise<GenerationProgress | null>;
  changeContext(
    userId: string,
    lessonId: string,
    documentType?: string,
    formality?: string
  ): Promise<LessonGenerationResult>;
}
