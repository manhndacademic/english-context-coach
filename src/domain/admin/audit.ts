import { db, schema } from "@/db";
import { desc, eq, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

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

export async function getAdminAuditLogs(options?: {
  action?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const adminUsers = alias(schema.users, "admin_users");
  const targetUsers = alias(schema.users, "target_users");

  const conditions = [];
  if (options?.action && options.action !== "all") {
    conditions.push(eq(schema.adminAuditLogs.action, options.action));
  }

  const query = db
    .select({
      id: schema.adminAuditLogs.id,
      action: schema.adminAuditLogs.action,
      targetResourceType: schema.adminAuditLogs.targetResourceType,
      targetResourceId: schema.adminAuditLogs.targetResourceId,
      metadata: schema.adminAuditLogs.metadata,
      createdAt: schema.adminAuditLogs.createdAt,
      adminEmail: adminUsers.email,
      adminName: adminUsers.name,
      targetEmail: targetUsers.email,
      targetName: targetUsers.name,
    })
    .from(schema.adminAuditLogs)
    .leftJoin(adminUsers, eq(schema.adminAuditLogs.adminUserId, adminUsers.id))
    .leftJoin(
      targetUsers,
      eq(schema.adminAuditLogs.targetUserId, targetUsers.id)
    );

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  return query
    .orderBy(desc(schema.adminAuditLogs.createdAt))
    .limit(limit)
    .offset(offset);
}
