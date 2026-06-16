import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  emailDigestEnabled: z.boolean().optional(),
  emailDigestHour: z.number().int().min(6).max(9).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      emailDigestEnabled: users.emailDigestEnabled,
      emailDigestHour: users.emailDigestHour,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { emailDigestEnabled, emailDigestHour } = parsed.data;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (emailDigestEnabled !== undefined)
    update.emailDigestEnabled = emailDigestEnabled;
  if (emailDigestHour !== undefined) update.emailDigestHour = emailDigestHour;

  await db.update(users).set(update).where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}
