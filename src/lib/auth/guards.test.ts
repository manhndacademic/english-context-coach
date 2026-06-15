import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireUser, requireAdmin } from "./guards";
import { auth } from "@/auth";
import { db } from "@/db";
import { redirect } from "next/navigation";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path) => {
    const err = new Error(`Redirect to ${path}`);
    (err as any).digest = `NEXT_REDIRECT;307;${path};`;
    throw err;
  }),
}));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
  schema: {
    users: {
      id: "users.id",
    },
  },
}));

function mockChain(result: any) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled),
  };
  return chain;
}

describe("Authentication Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireUser", () => {
    it("should redirect to /login if there is no session", async () => {
      vi.mocked(auth).mockResolvedValue(null as any);

      await expect(requireUser()).rejects.toThrow("Redirect to /login");
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("should redirect to /login if user is not found in database", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-id" } } as any);
      vi.mocked(db.select).mockReturnValue(mockChain([]));

      await expect(requireUser()).rejects.toThrow("Redirect to /login");
      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("should redirect to /pending-approval if user status is pending and role is user", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-id" } } as any);
      vi.mocked(db.select).mockReturnValue(
        mockChain([{ id: "user-id", role: "user", status: "pending" }])
      );

      await expect(requireUser()).rejects.toThrow(
        "Redirect to /pending-approval"
      );
      expect(redirect).toHaveBeenCalledWith("/pending-approval");
    });

    it("should redirect to /pending-approval if user status is rejected and role is user", async () => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-id" } } as any);
      vi.mocked(db.select).mockReturnValue(
        mockChain([{ id: "user-id", role: "user", status: "rejected" }])
      );

      await expect(requireUser()).rejects.toThrow(
        "Redirect to /pending-approval"
      );
      expect(redirect).toHaveBeenCalledWith("/pending-approval");
    });

    it("should return the user if status is approved and role is user", async () => {
      const mockUser = { id: "user-id", role: "user", status: "approved" };
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-id" } } as any);
      vi.mocked(db.select).mockReturnValue(mockChain([mockUser]));

      const result = await requireUser();
      expect(result).toEqual(mockUser);
      expect(redirect).not.toHaveBeenCalled();
    });

    it("should return the user if user is admin, even if status is pending", async () => {
      const mockAdmin = { id: "admin-id", role: "admin", status: "pending" };
      vi.mocked(auth).mockResolvedValue({ user: { id: "admin-id" } } as any);
      vi.mocked(db.select).mockReturnValue(mockChain([mockAdmin]));

      const result = await requireUser();
      expect(result).toEqual(mockAdmin);
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin", () => {
    it("should redirect to /dashboard if user role is user", async () => {
      const mockUser = { id: "user-id", role: "user", status: "approved" };
      vi.mocked(auth).mockResolvedValue({ user: { id: "user-id" } } as any);
      vi.mocked(db.select).mockReturnValue(mockChain([mockUser]));

      await expect(requireAdmin()).rejects.toThrow("Redirect to /dashboard");
      expect(redirect).toHaveBeenCalledWith("/dashboard");
    });

    it("should return the user if user role is admin", async () => {
      const mockAdmin = { id: "admin-id", role: "admin", status: "approved" };
      vi.mocked(auth).mockResolvedValue({ user: { id: "admin-id" } } as any);
      vi.mocked(db.select).mockReturnValue(mockChain([mockAdmin]));

      const result = await requireAdmin();
      expect(result).toEqual(mockAdmin);
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});
