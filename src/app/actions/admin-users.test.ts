import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from "vitest";
vi.unmock("@/db");
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import {
  approveUserAction,
  rejectUserAction,
  revokeUserAction,
} from "./admin-users";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock requireAdmin guard
vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: vi.fn(),
  requireUser: vi.fn(),
}));

describe("Admin User Actions", () => {
  let adminUser: any;
  let targetUser: any;

  beforeAll(async () => {
    // Clean up if exist
    await db
      .delete(schema.users)
      .where(eq(schema.users.email, "admin-action-test@example.com"));
    await db
      .delete(schema.users)
      .where(eq(schema.users.email, "target-action-test@example.com"));

    // Insert admin
    [adminUser] = await db
      .insert(schema.users)
      .values({
        email: "admin-action-test@example.com",
        name: "Admin Tester",
        role: "admin",
        status: "approved",
      })
      .returning();

    // Insert target user
    [targetUser] = await db
      .insert(schema.users)
      .values({
        email: "target-action-test@example.com",
        name: "Target Tester",
        role: "user",
        status: "pending",
      })
      .returning();
  });

  afterAll(async () => {
    if (adminUser) {
      await db.delete(schema.users).where(eq(schema.users.id, adminUser.id));
    }
    if (targetUser) {
      await db.delete(schema.users).where(eq(schema.users.id, targetUser.id));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({
      id: adminUser.id,
      email: adminUser.email,
      role: "admin",
    } as any);
  });

  it("approveUserAction - approves the target user status", async () => {
    const result = await approveUserAction(targetUser.id);
    expect(result).toEqual({ success: true });

    const [updated] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetUser.id));
    expect(updated.status).toBe("approved");
  });

  it("rejectUserAction - rejects the target user status", async () => {
    const result = await rejectUserAction(targetUser.id);
    expect(result).toEqual({ success: true });

    const [updated] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetUser.id));
    expect(updated.status).toBe("rejected");
  });

  it("revokeUserAction - revokes the target user status to pending", async () => {
    const result = await revokeUserAction(targetUser.id);
    expect(result).toEqual({ success: true });

    const [updated] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetUser.id));
    expect(updated.status).toBe("pending");
  });
});
