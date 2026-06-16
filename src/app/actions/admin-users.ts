"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { recordAdminAuditLog } from "@/domain/admin/audit";

export async function approveUserAction(userId: string) {
  const admin = await requireAdmin();

  await db
    .update(schema.users)
    .set({ status: "approved" })
    .where(eq(schema.users.id, userId));
  await recordAdminAuditLog({
    adminUserId: admin.id,
    targetUserId: userId,
    targetResourceType: "user",
    targetResourceId: userId,
    action: "approve_user",
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function rejectUserAction(userId: string) {
  const admin = await requireAdmin();

  await db
    .update(schema.users)
    .set({ status: "rejected" })
    .where(eq(schema.users.id, userId));
  await recordAdminAuditLog({
    adminUserId: admin.id,
    targetUserId: userId,
    targetResourceType: "user",
    targetResourceId: userId,
    action: "reject_user",
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function revokeUserAction(userId: string) {
  const admin = await requireAdmin();

  await db
    .update(schema.users)
    .set({ status: "pending" })
    .where(eq(schema.users.id, userId));
  await recordAdminAuditLog({
    adminUserId: admin.id,
    targetUserId: userId,
    targetResourceType: "user",
    targetResourceId: userId,
    action: "revoke_user",
  });

  revalidatePath("/admin/users");
  return { success: true };
}
