import { and, desc, eq, lte } from "drizzle-orm";
import { AppHeader } from "@/components/app-header";
import { submitReviewAttemptAction } from "@/app/actions/review";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/guards";

function resultLabel(result: string, gradingStatus: string) {
  if (gradingStatus === "failed" || result === "grading_failed")
    return "System checking failed";
  if (result === "correct") return "Correct";
  if (result === "partially_correct") return "Partially correct";
  return "Incorrect";
}

export default async function ReviewResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [attempt] = await db
    .select({
      attempt: schema.reviewAttempts,
      concept: schema.mistakeConcepts,
    })
    .from(schema.reviewAttempts)
    .innerJoin(
      schema.mistakeConcepts,
      eq(schema.reviewAttempts.mistakeConceptId, schema.mistakeConcepts.id),
    )
    .where(
      and(
        eq(schema.reviewAttempts.id, id),
        eq(schema.reviewAttempts.userId, user.id),
      ),
    )
    .limit(1);

  const [nextDue] = await db
    .select({ id: schema.mistakeConcepts.id })
    .from(schema.mistakeConcepts)
    .where(
      and(
        eq(schema.mistakeConcepts.userId, user.id),
        lte(schema.mistakeConcepts.dueAt, new Date()),
      ),
    )
    .orderBy(desc(schema.mistakeConcepts.dueAt))
    .limit(1);

  return (
    <main className="app-shell">
      <AppHeader email={user.email} />
      <section className="panel stack">
        {!attempt ? (
          <p className="muted">Review result not found.</p>
        ) : (
          <article className="review-card stack">
            <div className="cluster">
              <span className="pill">
                {attempt.attempt.reviewExerciseType.replaceAll("_", " ")}
              </span>
              <span className="pill">
                {attempt.attempt.previousMasteryState} →{" "}
                {attempt.attempt.nextMasteryState}
              </span>
              {attempt.attempt.score === null ? null : (
                <span className="pill">{attempt.attempt.score}/100</span>
              )}
            </div>
            <h1>
              {resultLabel(
                attempt.attempt.result,
                attempt.attempt.gradingStatus,
              )}
            </h1>
            <p>{attempt.attempt.feedbackVi}</p>
            <div className="exercise-feedback">
              <strong>Your answer</strong>
              <p>{attempt.attempt.answer}</p>
            </div>
            {attempt.attempt.gradingStatus === "succeeded" ? (
              <div className="exercise-feedback exercise-feedback-correct">
                <strong>Review memory</strong>
                <p>{attempt.concept.explanationVi}</p>
                <p className="hint">
                  Next interval: {attempt.attempt.nextIntervalDays} day(s). Next
                  review is scheduled from this result.
                </p>
              </div>
            ) : (
              <form action={submitReviewAttemptAction} className="stack">
                <input
                  name="conceptId"
                  type="hidden"
                  value={attempt.concept.id}
                />
                <input
                  name="retryAttemptId"
                  type="hidden"
                  value={attempt.attempt.id}
                />
                <button className="primary-button" type="submit">
                  Retry checking saved answer
                </button>
              </form>
            )}
            <a
              className="secondary-button"
              href={nextDue ? "/review" : "/dashboard"}
            >
              {nextDue ? "Continue reviewing" : "Back to dashboard"}
            </a>
          </article>
        )}
      </section>
    </main>
  );
}
