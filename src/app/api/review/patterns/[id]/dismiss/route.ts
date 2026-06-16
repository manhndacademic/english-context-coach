import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { mistakePatterns } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * PATCH /api/review/patterns/[id]/dismiss
 *
 * Marks a review card (MistakePattern) as "mastered" immediately,
 * removing it from the active review queue.
 *
 * Intended for key-phrase cards where the user indicates they
 * already know the word/phrase and don't need to practice it.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  // Verify the pattern belongs to this user before updating
  const [existing] = await db
    .select({ id: mistakePatterns.id })
    .from(mistakePatterns)
    .where(and(eq(mistakePatterns.id, id), eq(mistakePatterns.userId, userId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(mistakePatterns)
    .set({
      masteryState: "mastered",
      updatedAt: new Date(),
    })
    .where(and(eq(mistakePatterns.id, id), eq(mistakePatterns.userId, userId)));

  return NextResponse.json({ ok: true });
}
