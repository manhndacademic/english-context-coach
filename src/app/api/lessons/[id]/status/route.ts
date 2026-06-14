import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getLessonRepository } from "@/domain/lesson";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;
  const progress = await getLessonRepository().getLessonProgress({
    lessonId: id,
    userId: user.id,
  });

  if (!progress)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    lesson: {
      analysisStatus: progress.lesson.analysisStatus,
      exerciseStatus: progress.lesson.exerciseStatus,
    },
    job: progress.job
      ? {
          id: progress.job.id,
          status: progress.job.status,
          stage: progress.job.stage,
          attempts: progress.job.attempts,
        }
      : null,
    milestones: progress.milestones.map((milestone) => ({
      id: milestone.id,
      code: milestone.code,
      stage: milestone.stage,
      createdAt: milestone.createdAt.toISOString(),
    })),
    thoughts: progress.thoughts.map((thought) => ({
      id: thought.id,
      stage: thought.stage,
      text: thought.text,
      createdAt: thought.createdAt.toISOString(),
    })),
  });
}
