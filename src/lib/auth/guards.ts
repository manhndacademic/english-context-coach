import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);
  if (!user) redirect("/login");

  if (user.role !== "admin" && user.status !== "approved") {
    redirect("/pending-approval");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  return user;
}

export type SessionUser = Awaited<ReturnType<typeof requireUser>>;
