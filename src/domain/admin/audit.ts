import { db, schema } from "@/db";

export async function recordAdminAuditLog(input: {
  adminUserId: string;
  targetUserId?: string | null;
  targetResourceType: string;
  targetResourceId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(schema.adminAuditLogs).values({
    adminUserId: input.adminUserId,
    targetUserId: input.targetUserId ?? null,
    targetResourceType: input.targetResourceType,
    targetResourceId: input.targetResourceId ?? null,
    action: input.action,
    metadata: input.metadata ?? {},
  });
}
