import {
  describe,
  expect,
  it,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
vi.unmock("@/db");
import { db, schema } from "@/db";
import { recordAdminAuditLog, getAdminAuditLogs } from "./audit";
import { eq } from "drizzle-orm";

describe("Admin Audit Logs Querying", () => {
  let adminUser: any;
  let targetUser: any;

  beforeAll(async () => {
    // Clean up
    await db
      .delete(schema.users)
      .where(eq(schema.users.email, "admin-audit-test-admin@example.com"));
    await db
      .delete(schema.users)
      .where(eq(schema.users.email, "admin-audit-test-target@example.com"));

    // Insert admin
    [adminUser] = await db
      .insert(schema.users)
      .values({
        email: "admin-audit-test-admin@example.com",
        name: "Admin Tester",
        role: "admin",
      })
      .returning();

    // Insert target user
    [targetUser] = await db
      .insert(schema.users)
      .values({
        email: "admin-audit-test-target@example.com",
        name: "Target Tester",
        role: "user",
      })
      .returning();
  });

  afterAll(async () => {
    await db
      .delete(schema.adminAuditLogs)
      .where(eq(schema.adminAuditLogs.adminUserId, adminUser.id));
    await db.delete(schema.users).where(eq(schema.users.id, adminUser.id));
    await db.delete(schema.users).where(eq(schema.users.id, targetUser.id));
  });

  beforeEach(async () => {
    await db
      .delete(schema.adminAuditLogs)
      .where(eq(schema.adminAuditLogs.adminUserId, adminUser.id));
  });

  it("returns recorded audit logs with admin and target user emails", async () => {
    await recordAdminAuditLog({
      adminUserId: adminUser.id,
      targetUserId: targetUser.id,
      targetResourceType: "user",
      targetResourceId: targetUser.id,
      action: "approve_user",
      metadata: { note: "test approval" },
    });

    const logs = await getAdminAuditLogs({ limit: 1 });
    const log = logs.find(
      (l) => l.action === "approve_user" && l.adminEmail === adminUser.email
    );

    expect(log).toBeDefined();
    expect(log?.adminName).toBe(adminUser.name);
    expect(log?.targetEmail).toBe(targetUser.email);
    expect(log?.targetName).toBe(targetUser.name);
    expect(log?.metadata).toEqual({ note: "test approval" });
  });

  it("filters logs by action", async () => {
    await recordAdminAuditLog({
      adminUserId: adminUser.id,
      targetResourceType: "system_api_key",
      action: "add_system_api_key",
    });

    await recordAdminAuditLog({
      adminUserId: adminUser.id,
      targetResourceType: "system_api_key",
      action: "delete_system_api_key",
    });

    const logs = await getAdminAuditLogs({ action: "add_system_api_key" });
    const actions = logs.map((l) => l.action);

    expect(actions).toContain("add_system_api_key");
    expect(actions).not.toContain("delete_system_api_key");
  });
});
