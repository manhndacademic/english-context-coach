import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => {
  return {
    default: vi.fn(() => ({
      handlers: {},
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    })),
  };
});

vi.mock("@auth/drizzle-adapter", () => ({
  DrizzleAdapter: vi.fn(() => ({})),
}));

import { authConfig } from "./auth";
import { db } from "@/db";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
  schema: {
    users: {
      id: "users.id",
      role: "users.role",
      email: "users.email",
      status: "users.status",
    },
  },
}));

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    set: vi.fn().mockImplementation(() => chain),
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("Auth Callback Session", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it("should upgrade user to admin role and approved status if email matches ADMIN_EMAIL", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    const mockUser = {
      id: "admin-uuid",
      role: "user",
      email: "admin@example.com",
      status: "pending",
    };

    const updateChain = mockChain([]);
    vi.mocked(db.select).mockReturnValue(mockChain([mockUser]));
    vi.mocked(db.update).mockReturnValue(updateChain);

    const sessionParam = {
      session: { user: {} },
      token: { sub: "admin-uuid" },
    } as any;

    const session = await authConfig.callbacks.session(sessionParam);

    // Verify database update call
    expect(db.update).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith({
      role: "admin",
      status: "approved",
    });
    expect(session.user.role).toBe("admin");
  });

  it("should set status to approved for an existing admin if their status is not approved", async () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    const mockUser = {
      id: "admin-uuid",
      role: "admin",
      email: "admin@example.com",
      status: "pending",
    };

    const updateChain = mockChain([]);
    vi.mocked(db.select).mockReturnValue(mockChain([mockUser]));
    vi.mocked(db.update).mockReturnValue(updateChain);

    const sessionParam = {
      session: { user: {} },
      token: { sub: "admin-uuid" },
    } as any;

    const session = await authConfig.callbacks.session(sessionParam);

    expect(db.update).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith({
      status: "approved",
    });
    expect(session.user.role).toBe("admin");
  });
});
