import { requireUser } from "@/lib/auth/guards";
import { getLessonRepository } from "@/domain/lesson";
import { isTerminalLessonStatus } from "@/domain/generation-progress";

const encoder = new TextEncoder();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type ProgressSnapshot = NonNullable<
  Awaited<
    ReturnType<ReturnType<typeof getLessonRepository>["getLessonProgress"]>
  >
>;
type ProgressMilestone = ProgressSnapshot["milestones"][number];
type ProgressThought = ProgressSnapshot["thoughts"][number];

function parseLastEventId(request: Request) {
  const value = request.headers.get("last-event-id");
  if (!value) return { milestoneId: 0, thoughtId: 0 };

  const legacyMilestoneId = Number(value);
  if (Number.isInteger(legacyMilestoneId) && legacyMilestoneId > 0) {
    return { milestoneId: legacyMilestoneId, thoughtId: 0 };
  }

  const match = value.match(/^m:(\d+);t:(\d+)$/);
  if (!match) return { milestoneId: 0, thoughtId: 0 };
  return {
    milestoneId: Number(match[1]),
    thoughtId: Number(match[2]),
  };
}

function formatCursor(cursor: { milestoneId: number; thoughtId: number }) {
  return `m:${cursor.milestoneId};t:${cursor.thoughtId}`;
}

function snapshotBody(snapshot: ProgressSnapshot) {
  return {
    lesson: {
      analysisStatus: snapshot.lesson.analysisStatus,
      exerciseStatus: snapshot.lesson.exerciseStatus,
    },
    job: snapshot.job
      ? {
          id: snapshot.job.id,
          status: snapshot.job.status,
          stage: snapshot.job.stage,
          attempts: snapshot.job.attempts,
          errorMessage: snapshot.job.errorMessage,
        }
      : null,
  };
}

function writeMilestoneEvent(
  payload: ProgressMilestone,
  snapshot: ProgressSnapshot,
  cursor: { milestoneId: number; thoughtId: number }
) {
  const body = {
    ...snapshotBody(snapshot),
    milestone: {
      id: payload.id,
      code: payload.code,
      stage: payload.stage,
      createdAt: payload.createdAt.toISOString(),
    },
  };

  return encoder.encode(
    `id: ${formatCursor(cursor)}\nevent: milestone\ndata: ${JSON.stringify(body)}\n\n`
  );
}

function writeThoughtEvent(
  payload: ProgressThought,
  snapshot: ProgressSnapshot,
  cursor: { milestoneId: number; thoughtId: number }
) {
  const body = {
    ...snapshotBody(snapshot),
    thought: {
      id: payload.id,
      stage: payload.stage,
      text: payload.text,
      createdAt: payload.createdAt.toISOString(),
    },
  };

  return encoder.encode(
    `id: ${formatCursor(cursor)}\nevent: thought\ndata: ${JSON.stringify(body)}\n\n`
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const cursor = parseLastEventId(request);
  const repo = getLessonRepository();

  const initial = await repo.getLessonProgress({
    lessonId: id,
    userId: user.id,
    afterMilestoneId: cursor.milestoneId,
    afterThoughtId: cursor.thoughtId,
  });
  if (!initial) {
    return new Response("Not found", { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      while (!request.signal.aborted) {
        const snapshot = await repo.getLessonProgress({
          lessonId: id,
          userId: user.id,
          afterMilestoneId: cursor.milestoneId,
          afterThoughtId: cursor.thoughtId,
        });
        if (!snapshot) {
          controller.close();
          return;
        }

        for (const milestone of snapshot.milestones) {
          cursor.milestoneId = milestone.id;
          controller.enqueue(writeMilestoneEvent(milestone, snapshot, cursor));
        }

        for (const thought of snapshot.thoughts) {
          cursor.thoughtId = thought.id;
          controller.enqueue(writeThoughtEvent(thought, snapshot, cursor));
        }

        if (isTerminalLessonStatus(snapshot.lesson)) {
          controller.close();
          return;
        }

        await delay(1_000);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
