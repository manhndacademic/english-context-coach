import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { validatedAction } from "./action-builder";

// Mock guards
vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
}));

// Mock redirect-error
vi.mock("next/dist/client/components/redirect-error", () => ({
  isRedirectError: vi.fn((err: any) => err?.isRedirect === true),
}));

import { requireUser, requireAdmin } from "@/lib/auth/guards";

describe("validatedAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const schema = z.object({
    id: z.string().uuid("ID không hợp lệ"),
    name: z.string().min(1, "Tên không được để trống"),
  });

  it("should fail if FormData is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "user-1",
      role: "user",
    } as any);

    const handler = vi.fn();
    const action = validatedAction(schema, handler);

    // Call without FormData
    const result = await action(null);
    expect(result).toEqual({
      error: "Không tìm thấy dữ liệu đầu vào (No input data found).",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("should enforce requireUser by default", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "user-1",
      role: "user",
    } as any);

    const handler = vi.fn().mockResolvedValue("success-val");
    const action = validatedAction(schema, handler);

    const formData = new FormData();
    formData.append("id", "123e4567-e89b-12d3-a456-426614174000");
    formData.append("name", "Test Name");

    const result = await action(null, formData);

    expect(requireUser).toHaveBeenCalled();
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(
      { id: "123e4567-e89b-12d3-a456-426614174000", name: "Test Name" },
      { id: "user-1", role: "user" }
    );
    expect(result).toBe("success-val");
  });

  it("should enforce requireAdmin when requested", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      id: "admin-1",
      role: "admin",
    } as any);

    const handler = vi.fn().mockResolvedValue("admin-success");
    const action = validatedAction(schema, handler, { role: "admin" });

    const formData = new FormData();
    formData.append("id", "123e4567-e89b-12d3-a456-426614174000");
    formData.append("name", "Admin Action");

    const result = await action(null, formData);

    expect(requireAdmin).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(
      { id: "123e4567-e89b-12d3-a456-426614174000", name: "Admin Action" },
      { id: "admin-1", role: "admin" }
    );
    expect(result).toBe("admin-success");
  });

  it("should return validation error if Zod parsing fails", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as any);

    const handler = vi.fn();
    const action = validatedAction(schema, handler);

    const formData = new FormData();
    formData.append("id", "invalid-uuid");
    formData.append("name", "");

    const result = await action(null, formData);

    // Should return first error message (from id or name depending on Zod order)
    expect(result).toHaveProperty("error");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should bubble up redirect errors", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as any);

    const redirectErr = new Error("Redirecting...");
    (redirectErr as any).digest = "NEXT_REDIRECT;replace;/dashboard;307";

    const handler = vi.fn().mockRejectedValue(redirectErr);
    const action = validatedAction(schema, handler);

    const formData = new FormData();
    formData.append("id", "123e4567-e89b-12d3-a456-426614174000");
    formData.append("name", "Redirect Test");

    await expect(action(null, formData)).rejects.toThrow("Redirecting...");
  });

  it("should return custom error object for general exceptions", async () => {
    vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as any);

    const dbError = new Error("Database crash!");
    const handler = vi.fn().mockRejectedValue(dbError);
    const action = validatedAction(schema, handler);

    const formData = new FormData();
    formData.append("id", "123e4567-e89b-12d3-a456-426614174000");
    formData.append("name", "Crash Test");

    const result = await action(null, formData);
    expect(result).toEqual({ error: "Database crash!" });
  });
});
