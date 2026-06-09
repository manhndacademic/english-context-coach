import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.user.id)).limit(1);
  if (!user) redirect("/login");

  return user;
}
