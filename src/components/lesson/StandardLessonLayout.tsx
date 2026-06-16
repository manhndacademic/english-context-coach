import { AppHeader } from "@/components/app-header";
import { ReadableSourceText } from "@/components/readable-source-text";
import { KeyPhraseList } from "@/components/key-phrase-list";
import { completionMistakePatternKey } from "@/components/completion-summary-stats";
import { LessonHeader } from "./LessonHeader";
import { DeveloperErrorView } from "./DeveloperErrorView";
import { GrammarCorrectionView } from "./GrammarCorrectionView";
import { SourceMeaningPanel } from "./SourceMeaningPanel";
import { SentenceBreakdownPanel } from "./SentenceBreakdownPanel";
import { ExercisePanel } from "./ExercisePanel";
import { MixedLanguageView } from "./MixedLanguageView";
import {
  groupAttemptsByExercise,
  indexById,
  buildStepperItems,
  indexUserErrorsByAttemptId,
  classifyInputMode,
} from "@/app/lessons/[id]/lesson-view-model";

interface StandardLessonLayoutProps {
  user: {
    email: string;
    role: string;
  };
  lessonData: {
    lesson: {
      id: string;
      sourceTextId: string;
      version: number;
      analysisStatus: string;
      exerciseStatus: string;
      title: string | null;
      textType: string | null;
      detectedLevel: string | null;
      updatedAt: Date;
      inputMode: string;
      summaryVi: string | null;
      naturalTranslationVi: string | null;
      contextExplanationVi: string | null;
    };
    sourceText: {
      content: string | null;
    } | null;
    keyPhrases: any[];
    sentenceBreakdowns: any[];
    lessonFocuses: any[];
    exercises: any[];
    attempts: any[];
    userErrors: any[];
    mistakePatterns: any[];
    progress: any;
  };
  now: number;
}

export function StandardLessonLayout({
  user,
  lessonData,
  now,
}: StandardLessonLayoutProps) {
  const {
    lesson,
    sourceText,
    keyPhrases: phrases,
    sentenceBreakdowns,
    lessonFocuses,
    exercises,
    attempts,
    userErrors,
    mistakePatterns,
    progress,
  } = lessonData;

  const attemptsByExercise = groupAttemptsByExercise(attempts);
  const phraseById = indexById(phrases);
  const focusById = indexById(lessonFocuses);
  const sourceContent = sourceText?.content;

  const stepperItems = buildStepperItems(
    exercises,
    attemptsByExercise,
    phraseById,
    focusById
  );
  const serializedUserErrors = indexUserErrorsByAttemptId(userErrors);
  const serializedMistakePatterns = Object.fromEntries(
    mistakePatterns.map((pattern) => [
      completionMistakePatternKey(pattern.conceptKey, pattern.errorType),
      {
        conceptKey: pattern.conceptKey,
        errorType: pattern.errorType,
        dueAt: pattern.dueAt.toISOString(),
        masteryState: pattern.masteryState,
      },
    ])
  );

  // Map from conceptKey → mistakePatternId for phrase-sourced review cards.
  // Used by the "Đã biết" dismiss button on each key phrase card.
  const phrasePatternMap: Record<string, string> = Object.fromEntries(
    mistakePatterns
      .filter((p) => p.source === "phrase" && p.masteryState === "active")
      .map((p) => [p.conceptKey, p.id])
  );

  const { isDeveloperError, isGrammarCorrection, isMixedLanguage } =
    classifyInputMode(lesson.inputMode);

  const hasSideColumn =
    phrases.length > 0 ||
    exercises.length > 0 ||
    lesson.exerciseStatus === "running";

  return (
    <>
      <AppHeader email={user.email} isAdmin={user.role === "admin"} />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6">
        <LessonHeader lesson={lesson} progress={progress} now={now} />

        <div
          className={`grid grid-cols-1 ${
            hasSideColumn ? "min-[860px]:grid-cols-[1fr_0.72fr]" : ""
          } gap-layout-gap items-start`}
        >
          <div className="grid gap-item-gap">
            {isDeveloperError ? (
              <DeveloperErrorView
                sourceContent={sourceContent ?? null}
                lesson={lesson}
              />
            ) : isGrammarCorrection ? (
              <GrammarCorrectionView
                lesson={lesson}
                sourceContent={sourceContent ?? null}
                phrases={phrases}
                sentenceBreakdowns={sentenceBreakdowns}
                lessonFocuses={lessonFocuses}
              />
            ) : isMixedLanguage ? (
              <MixedLanguageView
                lesson={lesson}
                sourceContent={sourceContent ?? null}
                phrases={phrases}
                sentenceBreakdowns={sentenceBreakdowns}
                lessonFocuses={lessonFocuses}
              />
            ) : (
              <>
                {sourceContent ? (
                  <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                    <div className="flex flex-col min-[860px]:flex-row min-[860px]:items-baseline gap-2">
                      <h2 className="text-2xl font-bold text-text m-0">
                        Văn bản gốc (Source)
                      </h2>
                      <span className="text-xs text-muted">
                        Nhấp vào từ/cụm từ tô màu để xem giải nghĩa bên phải.
                      </span>
                    </div>
                    <div className="border border-border rounded-md p-6 bg-surface font-serif text-[17px] md:text-lg leading-relaxed overflow-y-auto max-h-[340px] min-[860px]:max-h-[500px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.03)] text-text space-y-3 [&_h3]:text-lg [&_h3]:font-bold [&_blockquote]:border-l-3 [&_blockquote]:border-accent [&_blockquote]:pl-3.5 [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:list-disc [&_ol]:list-decimal [&_pre]:overflow-auto [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_pre]:bg-surface-strong [&_pre]:p-3 [&_pre]:whitespace-pre-wrap">
                      <ReadableSourceText
                        key={`${lesson.id}-${phrases.map((p) => p.id).join(",")}`}
                        doc={sourceContent}
                        phrases={phrases}
                      />
                    </div>
                  </section>
                ) : null}

                <SourceMeaningPanel
                  mode="standard"
                  lesson={lesson}
                  lessonFocuses={lessonFocuses}
                />

                {sentenceBreakdowns.length > 0 && (
                  <SentenceBreakdownPanel
                    sentenceBreakdowns={sentenceBreakdowns}
                    mode="standard"
                  />
                )}
              </>
            )}
          </div>

          {hasSideColumn ? (
            <div className="grid gap-4">
              {phrases.length ? (
                <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-5">
                  <h2 className="text-2xl font-bold text-text m-0">
                    Cụm từ then chốt
                  </h2>
                  <KeyPhraseList
                    phrases={phrases}
                    phrasePatternMap={phrasePatternMap}
                  />
                </section>
              ) : null}

              <ExercisePanel
                lesson={lesson}
                exercises={exercises}
                stepperItems={stepperItems}
                serializedMistakePatterns={serializedMistakePatterns}
                serializedUserErrors={serializedUserErrors}
              />
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
