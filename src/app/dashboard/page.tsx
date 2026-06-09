import Link from "next/link";
import { and, count, desc, eq, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { SourceTextForm } from "@/components/source-text-form";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  const [recentLessons, dueCount, patternCount, sourceCount] = await Promise.all([
    db
      .select({
        id: schema.lessons.id,
        title: schema.lessons.title,
        version: schema.lessons.version,
        analysisStatus: schema.lessons.analysisStatus,
        exerciseStatus: schema.lessons.exerciseStatus,
        createdAt: schema.lessons.createdAt,
      })
      .from(schema.lessons)
      .where(eq(schema.lessons.userId, user.id))
      .orderBy(desc(schema.lessons.createdAt))
      .limit(6),
    db
      .select({ value: count() })
      .from(schema.mistakePatterns)
      .where(and(eq(schema.mistakePatterns.userId, user.id), lte(schema.mistakePatterns.dueAt, now))),
    db
      .select({ value: count() })
      .from(schema.mistakePatterns)
      .where(eq(schema.mistakePatterns.userId, user.id)),
    db.select({ value: count() }).from(schema.sourceTexts).where(eq(schema.sourceTexts.userId, user.id)),
  ]);

  const repeatedMistakes = await db
    .select()
    .from(schema.mistakePatterns)
    .where(eq(schema.mistakePatterns.userId, user.id))
    .orderBy(desc(schema.mistakePatterns.occurrenceCount), sql`${schema.mistakePatterns.dueAt} asc`)
    .limit(5);

  return (
    <main className="app-shell">
      <AppHeader email={user.email} />
      <div className="page-grid">
        <section className="panel stack">
          <div>
            <h1>Understand English in context.</h1>
            <p className="muted">
              Paste real English from work, study, docs, emails, or messages. The lesson runs in the background.
            </p>
          </div>
          <SourceTextForm />
        </section>

        <aside className="stack">
          <section className="panel stack">
            <h2>Today</h2>
            <div className="metric-grid">
              <div className="metric">
                <strong>{dueCount[0]?.value ?? 0}</strong>
                <span className="muted">due reviews</span>
              </div>
              <div className="metric">
                <strong>{patternCount[0]?.value ?? 0}</strong>
                <span className="muted">patterns</span>
              </div>
              <div className="metric">
                <strong>{sourceCount[0]?.value ?? 0}</strong>
                <span className="muted">sources</span>
              </div>
            </div>
            <Link className="primary-button" href="/review">
              Review due patterns
            </Link>
          </section>

          <section className="panel stack">
            <h2>Repeated mistake highlights</h2>
            <div className="list">
              {repeatedMistakes.length ? (
                repeatedMistakes.map((pattern) => (
                  <div className="list-row" key={pattern.id}>
                    <strong>{pattern.normalizedPhrase}</strong>
                    <span className="muted">{pattern.meaningVi}</span>
                    <span className="pill">{pattern.errorType.replaceAll("_", " ")}</span>
                  </div>
                ))
              ) : (
                <p className="muted">Mistake patterns will appear after practice attempts.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="panel stack" style={{ marginTop: 22 }}>
        <h2>Recent lessons</h2>
        <div className="list">
          {recentLessons.length ? (
            recentLessons.map((lesson) => (
              <Link className="list-row" href={`/lessons/${lesson.id}`} key={lesson.id}>
                <strong>
                  {lesson.title} <span className="muted">v{lesson.version}</span>
                </strong>
                <span className="muted">
                  Analysis: {lesson.analysisStatus} · Exercises: {lesson.exerciseStatus}
                </span>
              </Link>
            ))
          ) : (
            <p className="muted">No lessons yet. Paste a SourceText to start.</p>
          )}
        </div>
      </section>
    </main>
  );
}
