import { and, asc, eq, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { markMistakePatternReviewAction } from "@/app/actions/review";

export default async function ReviewPage() {
  const user = await requireUser();
  const patterns = await db
    .select()
    .from(schema.mistakePatterns)
    .where(and(eq(schema.mistakePatterns.userId, user.id), lte(schema.mistakePatterns.dueAt, new Date())))
    .orderBy(asc(schema.mistakePatterns.dueAt))
    .limit(20);

  return (
    <main className="app-shell">
      <AppHeader email={user.email} />
      <section className="panel stack">
        <div>
          <h1>Review mistake patterns</h1>
          <p className="muted">Review uses safe phrase and sense data only, not original source sentences.</p>
        </div>
        <div className="exercise-grid">
          {patterns.length ? (
            patterns.map((pattern) => (
              <article className="review-card stack" key={pattern.id}>
                <div className="cluster">
                  <span className="pill">{pattern.category.replaceAll("_", " ")}</span>
                  <span className="pill">{pattern.errorType.replaceAll("_", " ")}</span>
                  <span className="muted">{pattern.occurrenceCount} occurrence(s)</span>
                </div>
                <h2>{pattern.normalizedPhrase}</h2>
                <p>{pattern.meaningVi}</p>
                <p className="muted">{pattern.safeReviewPromptVi}</p>
                <form action={markMistakePatternReviewAction} className="cluster">
                  <input name="patternId" type="hidden" value={pattern.id} />
                  <button className="primary-button" name="result" type="submit" value="success">
                    I remembered
                  </button>
                  <button className="secondary-button" name="result" type="submit" value="failure">
                    Review again soon
                  </button>
                </form>
              </article>
            ))
          ) : (
            <p className="muted">No due mistake patterns right now.</p>
          )}
        </div>
      </section>
    </main>
  );
}
