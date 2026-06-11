import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { KeyPhrase } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { ExerciseCard } from "@/components/exercise-card";
import { GenerationProgress } from "@/components/generation-progress";
import {
  deleteSourceTextAction,
  regenerateLessonAction,
  retryExercisesAction,
  retryLessonGenerationAction,
} from "@/app/actions/source-texts";
import { getLessonProgress } from "@/lib/jobs/progress";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function isBoundary(value: string | undefined) {
  return !value || !/[\p{L}\p{N}_]/u.test(value);
}

function findHighlightRanges(source: string, phrases: KeyPhrase[]) {
  const lowerSource = source.toLowerCase();
  const ranges: Array<{ end: number; phraseId: string; start: number }> = [];
  const candidates = [...phrases].sort((a, b) => b.phrase.length - a.phrase.length);

  for (const phrase of candidates) {
    const phraseText = phrase.phrase.trim();
    if (!phraseText) continue;

    const shortSingleWord = phraseText.length < 4 && !/\s/.test(phraseText);
    const haystack = shortSingleWord ? source : lowerSource;
    const needle = shortSingleWord ? phraseText : phraseText.toLowerCase();
    let index = haystack.indexOf(needle);

    while (index !== -1) {
      const end = index + needle.length;
      const hasBoundaries = isBoundary(source[index - 1]) && isBoundary(source[end]);
      const overlaps = ranges.some((range) => index < range.end && end > range.start);

      if (hasBoundaries && !overlaps) {
        ranges.push({ start: index, end, phraseId: phrase.id });
      }

      index = haystack.indexOf(needle, index + needle.length);
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
}

function renderHighlightedSourceText(source: string, phrases: KeyPhrase[]) {
  const ranges = findHighlightRanges(source, phrases);
  if (!ranges.length) return source;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) nodes.push(source.slice(cursor, range.start));
    nodes.push(
      <a className="source-highlight" href={`#keyphrase-${range.phraseId}`} key={`${range.phraseId}-${range.start}`}>
        {source.slice(range.start, range.end)}
      </a>,
    );
    cursor = range.end;
  }

  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(and(eq(schema.lessons.id, id), eq(schema.lessons.userId, user.id)))
    .limit(1);
  if (!lesson) notFound();

  const [sourceText, phrases, lessonFocuses, exercises, attempts, progress] = await Promise.all([
    db
      .select()
      .from(schema.sourceTexts)
      .where(and(eq(schema.sourceTexts.id, lesson.sourceTextId), eq(schema.sourceTexts.userId, user.id)))
      .limit(1),
    db
      .select()
      .from(schema.keyPhrases)
      .where(eq(schema.keyPhrases.lessonId, lesson.id))
      .orderBy(asc(schema.keyPhrases.createdAt)),
    db
      .select()
      .from(schema.lessonFocuses)
      .where(eq(schema.lessonFocuses.lessonId, lesson.id))
      .orderBy(asc(schema.lessonFocuses.createdAt)),
    db
      .select()
      .from(schema.exercises)
      .where(eq(schema.exercises.lessonId, lesson.id))
      .orderBy(schema.exercises.orderIndex),
    db
      .select()
      .from(schema.attempts)
      .where(eq(schema.attempts.lessonId, lesson.id))
      .orderBy(desc(schema.attempts.createdAt)),
    getLessonProgress({ lessonId: lesson.id, userId: user.id }),
  ]);

  const attemptsByExercise = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const existing = attemptsByExercise.get(attempt.exerciseId) ?? [];
    existing.push(attempt);
    attemptsByExercise.set(attempt.exerciseId, existing);
  }
  const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]));
  const focusById = new Map(lessonFocuses.map((focus) => [focus.id, focus]));
  const sourceContent = sourceText[0]?.content;
  const exerciseSummaries = exercises.map((exercise) => {
    const latestAttempt = attemptsByExercise.get(exercise.id)?.[0];
    return {
      exercise,
      latestAttempt,
      isSolved: latestAttempt?.gradingStatus === "succeeded" && latestAttempt.isCorrect === true,
      needsRetry: latestAttempt?.gradingStatus === "succeeded" && latestAttempt.isCorrect === false,
    };
  });
  const solvedCount = exerciseSummaries.filter((summary) => summary.isSolved).length;
  const retryCount = exerciseSummaries.filter((summary) => summary.needsRetry).length;
  const notStartedCount = exerciseSummaries.filter((summary) => !summary.latestAttempt).length;
  const nextExerciseId = exerciseSummaries.find((summary) => !summary.isSolved)?.exercise.id;

  return (
    <main className="app-shell">
      <AppHeader email={user.email} />

      <section className="panel">
        <div className="lesson-header">
          <div className="cluster">
            <span className="pill">Version {lesson.version}</span>
            <span className={`status-${lesson.analysisStatus}`}>Analysis {lesson.analysisStatus}</span>
            <span className={`status-${lesson.exerciseStatus}`}>Exercises {lesson.exerciseStatus}</span>
          </div>
          <h1>{lesson.title}</h1>
          <p className="muted">
            {lesson.textType.replaceAll("_", " ")} · {lesson.detectedLevel ?? "level pending"}
          </p>
          <div className="cluster">
            <form action={regenerateLessonAction}>
              <input name="sourceTextId" type="hidden" value={lesson.sourceTextId} />
              <button className="secondary-button" type="submit">
                Regenerate as new version
              </button>
            </form>
            {lesson.analysisStatus === "succeeded" && lesson.exerciseStatus === "failed" ? (
              <form action={retryExercisesAction}>
                <input name="lessonId" type="hidden" value={lesson.id} />
                <button className="secondary-button" type="submit">
                  Retry exercises
                </button>
              </form>
            ) : null}
            {lesson.analysisStatus === "failed" ? (
              <form action={retryLessonGenerationAction}>
                <input name="lessonId" type="hidden" value={lesson.id} />
                <button className="secondary-button" type="submit">
                  Retry analysis
                </button>
              </form>
            ) : null}
            <form action={deleteSourceTextAction}>
              <input name="sourceTextId" type="hidden" value={lesson.sourceTextId} />
              <button className="danger-button" type="submit">
                Delete source
              </button>
            </form>
          </div>
          <GenerationProgress
            initialJob={
              progress?.job
                ? {
                    id: progress.job.id,
                    status: progress.job.status,
                    stage: progress.job.stage,
                    attempts: progress.job.attempts,
                  }
                : null
            }
            initialLesson={{
              analysisStatus: lesson.analysisStatus,
              exerciseStatus: lesson.exerciseStatus,
            }}
            initialMilestones={
              progress?.milestones.map((milestone) => ({
                id: milestone.id,
                code: milestone.code,
                stage: milestone.stage,
                createdAt: milestone.createdAt.toISOString(),
              })) ?? []
            }
            lessonId={lesson.id}
          />
        </div>
      </section>

      <div className="lesson-workspace">
        <div className="lesson-main-column">
          <section className="panel stack">
            {lesson.summaryVi ? (
              <>
                <h2>Vietnamese summary</h2>
                <p>{lesson.summaryVi}</p>
                <h2>Natural Vietnamese translation</h2>
                <p>{lesson.naturalTranslationVi}</p>
                <h2>Context explanation</h2>
                <p>{lesson.contextExplanationVi}</p>
                {lessonFocuses.length ? (
                  <>
                    <h2>What to notice</h2>
                    <div className="list">
                      {lessonFocuses.map((focus) => (
                        <article className="list-row" id={`lessonfocus-${focus.id}`} key={focus.id}>
                          <strong>{focus.title}</strong>
                          <span className="muted">{focus.explanationVi}</span>
                          <span className="cluster">
                            <span className="pill">{formatLabel(focus.category)}</span>
                            <span className="pill">{focus.difficulty}</span>
                          </span>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <p className="muted">Analysis will appear here when it is ready.</p>
            )}
          </section>

          {sourceContent ? (
            <section className="panel stack">
              <div className="section-heading">
                <h2>Source text</h2>
                <span className="hint">Highlighted phrases link to the list.</span>
              </div>
              <div className="source-reading-panel">{renderHighlightedSourceText(sourceContent, phrases)}</div>
            </section>
          ) : null}
        </div>

        <div className="lesson-side-column">
          <section className="panel stack">
            <h2>Key phrases</h2>
            <div className="phrase-list">
              {phrases.length ? (
                phrases.map((phrase) => (
                  <details className="phrase-row" id={`keyphrase-${phrase.id}`} key={phrase.id}>
                    <summary>
                      <span className="phrase-row-main">
                        <span className="phrase-title">{phrase.phrase}</span>
                        <span className="phrase-meta">
                          <span className="pill">{formatLabel(phrase.category)}</span>
                          <span className="pill">{phrase.difficulty}</span>
                        </span>
                        <span className="phrase-meaning">{phrase.meaningInContextVi}</span>
                      </span>
                    </summary>
                    <dl className="phrase-details">
                      <div>
                        <dt>In this text</dt>
                        <dd>{phrase.meaningInContextVi}</dd>
                      </div>
                      <div>
                        <dt>General meaning</dt>
                        <dd>{phrase.meaningVi}</dd>
                      </div>
                      {phrase.naturalTranslationVi ? (
                        <div>
                          <dt>Natural Vietnamese</dt>
                          <dd>{phrase.naturalTranslationVi}</dd>
                        </div>
                      ) : null}
                      {phrase.literalTranslationVi ? (
                        <div>
                          <dt>Literal trap</dt>
                          <dd>{phrase.literalTranslationVi}</dd>
                        </div>
                      ) : null}
                      {phrase.whyConfusingVi ? (
                        <div>
                          <dt>Why it is tricky</dt>
                          <dd>{phrase.whyConfusingVi}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>
                ))
              ) : (
                <p className="muted">Key phrases will appear after analysis succeeds.</p>
              )}
            </div>
          </section>

          <section className="panel stack">
            <div className="practice-header">
              <div>
                <h2>Practice</h2>
                {exercises.length ? (
                  <p className="hint">Focus on contextual meaning, not word-by-word translation.</p>
                ) : null}
              </div>
              {exercises.length ? (
                <div className="practice-score" aria-label={`${solvedCount} of ${exercises.length} exercises complete`}>
                  <strong>
                    {solvedCount}/{exercises.length}
                  </strong>
                  <span>complete</span>
                </div>
              ) : null}
            </div>
            {exercises.length ? (
              <div className="practice-status-grid">
                <div>
                  <strong>{notStartedCount}</strong>
                  <span>not started</span>
                </div>
                <div>
                  <strong>{retryCount}</strong>
                  <span>need retry</span>
                </div>
                <div>
                  <strong>{solvedCount}</strong>
                  <span>done</span>
                </div>
              </div>
            ) : null}
            <div className="exercise-grid">
              {exercises.length ? (
                exercises.map((exercise) => (
                  <ExerciseCard
                    attempts={attemptsByExercise.get(exercise.id) ?? []}
                    exercise={exercise}
                    isCurrent={exercise.id === nextExerciseId}
                    key={exercise.id}
                    lessonFocus={exercise.lessonFocusId ? focusById.get(exercise.lessonFocusId) : undefined}
                    keyPhrase={exercise.keyPhraseId ? phraseById.get(exercise.keyPhraseId) : undefined}
                  />
                ))
              ) : (
                <p className="muted">
                  {lesson.exerciseStatus === "failed"
                    ? "Exercise generation failed. Use retry after analysis has succeeded."
                    : "Exercises will appear after generation succeeds."}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
