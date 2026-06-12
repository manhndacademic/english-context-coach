import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { KeyPhrase } from "@/domain/lesson";
import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { ExerciseCard } from "@/components/exercise-card";
import { GenerationProgress } from "@/components/generation-progress";
import { KeyPhraseList } from "@/components/key-phrase-list";
import {
  deleteSourceTextAction,
  regenerateLessonAction,
  retryExercisesAction,
  retryLessonGenerationAction,
} from "@/app/actions/source-texts";
import { getLessonRepository } from "@/domain/lesson";
import { renderRichText } from "@/lib/rich-text";

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

function renderHighlightedText(source: string, phrases: KeyPhrase[]) {
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

type SourceBlock =
  | { text: string; type: "paragraph" | "heading" | "quote" | "code" }
  | { items: string[]; ordered: boolean; type: "list" };

function parseReadableSourceBlocks(source: string): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { items: string[]; ordered: boolean } | null = null;
  let quote: string[] = [];
  let code: string[] = [];
  let inCode = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join("\n").trim() });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    blocks.push({ type: "quote", text: quote.join("\n").trim() });
    quote = [];
  };
  const flushCode = () => {
    if (!code.length) return;
    blocks.push({ type: "code", text: code.join("\n") });
    code = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
    flushCode();
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushParagraph();
      flushList();
      flushQuote();
      if (inCode) flushCode();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!trimmed) {
      flushAll();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      blocks.push({ type: "heading", text: headingMatch[2] });
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      flushQuote();
      const ordered = Boolean(orderedMatch);
      if (!list || list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((orderedMatch?.[1] ?? unorderedMatch?.[1] ?? "").trim());
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quote.push(quoteMatch[1]);
      continue;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  }

  flushAll();
  return blocks.length ? blocks : [{ type: "paragraph", text: source }];
}

function renderReadableSourceText(source: string, phrases: KeyPhrase[]) {
  return parseReadableSourceBlocks(source).map((block, index) => {
    if (block.type === "heading") {
      return <h3 key={index}>{renderHighlightedText(block.text, phrases)}</h3>;
    }
    if (block.type === "quote") {
      return <blockquote key={index}>{renderHighlightedText(block.text, phrases)}</blockquote>;
    }
    if (block.type === "code") {
      return <pre key={index}>{block.text}</pre>;
    }
    if (block.type === "list") {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>{renderHighlightedText(item, phrases)}</li>
          ))}
        </ListTag>
      );
    }
    return <p key={index}>{renderHighlightedText(block.text, phrases)}</p>;
  });
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const lessonData = await getLessonRepository().getLessonAggregate(id, user.id);
  if (!lessonData) notFound();

  const {
    lesson,
    sourceText,
    keyPhrases: phrases,
    sentenceBreakdowns,
    lessonFocuses,
    exercises,
    attempts,
    userErrors,
    progress,
  } = lessonData;

  const userErrorsByAttemptId = new Map(
    userErrors
      .filter((err) => err.attemptId !== null)
      .map((err) => [err.attemptId!, err])
  );

  const attemptsByExercise = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const existing = attemptsByExercise.get(attempt.exerciseId) ?? [];
    existing.push(attempt);
    attemptsByExercise.set(attempt.exerciseId, existing);
  }
  const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]));
  const focusById = new Map(lessonFocuses.map((focus) => [focus.id, focus]));
  const sourceContent = sourceText?.content;
  const exerciseSummaries = exercises.map((exercise) => {
    const latestAttempt = attemptsByExercise.get(exercise.id)?.[0];
    return {
      exercise,
      latestAttempt,
      isSolved: Boolean(latestAttempt?.isCorrect),
      needsRetry: Boolean(latestAttempt && !latestAttempt.isCorrect),
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
            <span className="pill">Phiên bản {lesson.version}</span>
            <span className={`status-${lesson.analysisStatus}`}>
              Phân tích: {lesson.analysisStatus === "succeeded" ? "Hoàn thành" : lesson.analysisStatus === "running" ? "Đang chạy" : lesson.analysisStatus === "failed" ? "Thất bại" : "Đang chờ"}
            </span>
            <span className={`status-${lesson.exerciseStatus}`}>
              Bài tập: {lesson.exerciseStatus === "succeeded" ? "Hoàn thành" : lesson.exerciseStatus === "running" ? "Đang chạy" : lesson.exerciseStatus === "failed" ? "Thất bại" : "Đang chờ"}
            </span>
          </div>
          <h1 style={{ marginTop: "12px", marginBottom: "8px" }}>{lesson.title || "Bài học không tên"}</h1>
          <p className="muted" style={{ fontSize: "14px" }}>
            Thể loại: {lesson.textType?.replaceAll("_", " ") ?? "general"} · Trình độ: {lesson.detectedLevel ?? "Đang xác định"}
          </p>
          <div className="cluster" style={{ marginTop: "16px" }}>
            <form action={regenerateLessonAction}>
              <input name="sourceTextId" type="hidden" value={lesson.sourceTextId} />
              <button className="secondary-button" type="submit">
                Tạo bản mới (Regenerate)
              </button>
            </form>
            {lesson.analysisStatus === "succeeded" && lesson.exerciseStatus === "failed" ? (
              <form action={retryExercisesAction}>
                <input name="lessonId" type="hidden" value={lesson.id} />
                <button className="secondary-button" type="submit">
                  Thử lại tạo bài tập
                </button>
              </form>
            ) : null}
            {lesson.analysisStatus === "failed" ? (
              <form action={retryLessonGenerationAction}>
                <input name="lessonId" type="hidden" value={lesson.id} />
                <button className="secondary-button" type="submit">
                  Thử lại phân tích
                </button>
              </form>
            ) : null}
            <form action={deleteSourceTextAction}>
              <input name="sourceTextId" type="hidden" value={lesson.sourceTextId} />
              <button className="danger-button" type="submit">
                Xoá nguồn
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
            initialThoughts={
              progress?.thoughts.map((thought) => ({
                id: thought.id,
                stage: thought.stage,
                text: thought.text,
                createdAt: thought.createdAt.toISOString(),
              })) ?? []
            }
            lessonId={lesson.id}
          />
        </div>
      </section>

      <div className="lesson-workspace">
        <div className="lesson-main-column">
          {sourceContent ? (
            <section className="panel stack">
              <div className="section-heading">
                <h2>Văn bản gốc (Source)</h2>
                <span className="hint">Nhấp vào từ/cụm từ tô màu để xem giải nghĩa bên phải.</span>
              </div>
              <div className="source-reading-panel" style={{ fontFamily: "var(--font-serif)", fontSize: "17px", lineHeight: "1.7" }}>
                {renderReadableSourceText(sourceContent, phrases)}
              </div>
            </section>
          ) : null}

          <section className="panel stack">
            {lesson.summaryVi ? (
              <>
                <h2>Tóm tắt nội dung</h2>
                <p style={{ lineHeight: "1.6" }}>{renderRichText(lesson.summaryVi)}</p>
                <h2>Bản dịch tự nhiên</h2>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "16px", fontStyle: "italic", lineHeight: "1.6", background: "var(--surface-strong)", padding: "16px", borderRadius: "var(--radius-md)" }}>
                  {renderRichText(lesson.naturalTranslationVi)}
                </p>
                <h2>Giải thích ngữ cảnh</h2>
                <p style={{ lineHeight: "1.6" }}>{renderRichText(lesson.contextExplanationVi)}</p>
                {lessonFocuses.length ? (
                  <>
                    <h2>Lưu ý quan trọng</h2>
                    <div className="list">
                      {lessonFocuses.map((focus) => (
                        <article className="list-row" id={`lessonfocus-${focus.id}`} key={focus.id}>
                          <strong style={{ fontSize: "16px" }}>{focus.title}</strong>
                          <span className="muted" style={{ fontSize: "14px", lineHeight: "1.5" }}>{renderRichText(focus.explanationVi)}</span>
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
              <p className="muted">Bài học đang được phân tích, vui lòng đợi giây lát...</p>
            )}
          </section>

          {sentenceBreakdowns.length ? (
            <section className="panel stack">
              <h2>Phân tích cấu trúc câu</h2>
              <div className="sentence-breakdown-list">
                {sentenceBreakdowns.map((breakdown) => (
                  <article className="sentence-breakdown-row" key={breakdown.id} style={{ borderRadius: "var(--radius-md)" }}>
                    <p className="sentence-source" style={{ fontFamily: "var(--font-serif)", fontSize: "16px", color: "var(--accent-strong)" }}>{breakdown.sentence}</p>
                    <dl>
                      <div>
                        <dt style={{ fontSize: "11px", letterSpacing: "0.05em" }}>Dịch tự nhiên</dt>
                        <dd style={{ fontSize: "15px", fontWeight: "600" }}>{renderRichText(breakdown.naturalMeaningVi)}</dd>
                      </div>
                      <div>
                        <dt style={{ fontSize: "11px", letterSpacing: "0.05em" }}>Phân tích cấu trúc</dt>
                        <dd style={{ fontSize: "14px", color: "var(--muted)" }}>{renderRichText(breakdown.structureNotesVi)}</dd>
                      </div>
                      {breakdown.toneOrContextVi ? (
                        <div>
                          <dt style={{ fontSize: "11px", letterSpacing: "0.05em" }}>Sắc thái & Ngữ cảnh</dt>
                          <dd style={{ fontSize: "14px", color: "var(--muted)" }}>{renderRichText(breakdown.toneOrContextVi)}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="lesson-side-column">
          <section className="panel stack">
            <h2>Cụm từ then chốt</h2>
            <KeyPhraseList phrases={phrases} />
          </section>

          <section className="panel stack">
            <div className="practice-header">
              <div>
                <h2>Luyện tập thực hành</h2>
                {exercises.length ? (
                  <p className="hint">Tập trung dịch sát nghĩa tự nhiên theo ngữ cảnh, tránh bẫy dịch từng từ.</p>
                ) : null}
              </div>
              {exercises.length ? (
                <div className="practice-score" aria-label={`${solvedCount} trên ${exercises.length} bài tập đã hoàn thành`}>
                  <strong>
                    {solvedCount}/{exercises.length}
                  </strong>
                  <span>đã xong</span>
                </div>
              ) : null}
            </div>
            {exercises.length ? (
              <div className="practice-status-grid">
                <div>
                  <strong>{notStartedCount}</strong>
                  <span>chưa làm</span>
                </div>
                <div>
                  <strong>{retryCount}</strong>
                  <span>cần thử lại</span>
                </div>
                <div>
                  <strong>{solvedCount}</strong>
                  <span>hoàn thành</span>
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
                    userErrorsByAttemptId={userErrorsByAttemptId}
                  />
                ))
              ) : (
                <p className="muted">
                  {lesson.exerciseStatus === "failed"
                    ? "Tạo bài tập thất bại. Hãy chọn thử lại sau khi phân tích hoàn tất."
                    : "Bài tập thực hành đang được tạo tự động..."}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
