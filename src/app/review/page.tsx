import { and, asc, eq, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { submitReviewAttemptAction } from "@/app/actions/review";
import { buildReviewPromptSnapshot } from "@/domain/review";

export default async function ReviewPage() {
  const user = await requireUser();
  const concepts = await db
    .select()
    .from(schema.mistakeConcepts)
    .where(and(eq(schema.mistakeConcepts.userId, user.id), lte(schema.mistakeConcepts.dueAt, new Date())))
    .orderBy(asc(schema.mistakeConcepts.dueAt))
    .limit(20);

  return (
    <main className="app-shell">
      <AppHeader email={user.email} />
      <section className="panel stack">
        <div>
          <h1>Review active recall</h1>
          <p className="muted">Answer before feedback. Review uses safe concept prompts, not original source sentences.</p>
        </div>
        <div className="exercise-grid">
          {concepts.length ? (
            concepts.map((concept) => {
              const prompt = buildReviewPromptSnapshot({
                conceptTitleVi: concept.titleVi,
                safeReviewSeed: concept.safeReviewSeed,
                fallbackMeaningVi: concept.explanationVi,
              });
              const isObjective = prompt.type === "meaning_choice" || prompt.type === "cloze_phrase";
              return (
              <article className="review-card stack" key={concept.id}>
                <div className="cluster">
                  <span className="pill">{concept.category.replaceAll("_", " ")}</span>
                  <span className="pill">{concept.errorType.replaceAll("_", " ")}</span>
                  <span className="pill">{concept.masteryState}</span>
                </div>
                <h2>{concept.titleVi}</h2>
                <p>{concept.explanationVi}</p>
                <form action={submitReviewAttemptAction} className="stack">
                  <input name="conceptId" type="hidden" value={concept.id} />
                  <label>
                    {prompt.promptVi}
                    {prompt.promptEn ? <span className="hint">{prompt.promptEn}</span> : null}
                    {prompt.choices?.length ? (
                      <span className="choice-list">
                        {prompt.choices.map((choice) => (
                          <span className="choice-option" key={choice}>
                            <input name="answer" required type="radio" value={choice} />
                            <span>{choice}</span>
                          </span>
                        ))}
                      </span>
                    ) : isObjective ? (
                      <input name="answer" required placeholder="Type the phrase..." />
                    ) : (
                      <textarea name="answer" required placeholder="Viết câu trả lời của bạn..." />
                    )}
                  </label>
                  <button className="primary-button" type="submit">
                    Submit review answer
                  </button>
                </form>
              </article>
              );
            })
          ) : (
            <p className="muted">No due concepts right now.</p>
          )}
        </div>
      </section>
    </main>
  );
}
