"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export async function approveUserAction(userId: string) {
  await requireAdmin();

  await db
    .update(schema.users)
    .set({ status: "approved" })
    .where(eq(schema.users.id, userId));

  revalidatePath("/admin/users");
  return { success: true };
}

export async function rejectUserAction(userId: string) {
  await requireAdmin();

  await db
    .update(schema.users)
    .set({ status: "rejected" })
    .where(eq(schema.users.id, userId));

  revalidatePath("/admin/users");
  return { success: true };
}

export async function revokeUserAction(userId: string) {
  await requireAdmin();

  await db
    .update(schema.users)
    .set({ status: "pending" })
    .where(eq(schema.users.id, userId));

  revalidatePath("/admin/users");
  return { success: true };
}
