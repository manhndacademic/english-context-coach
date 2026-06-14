import { z } from "zod";
import { requireUser, requireAdmin } from "@/lib/auth/guards";
import { isRedirectError } from "next/dist/client/components/redirect-error";

interface ActionOptions {
  role?: "user" | "admin";
}

export function validatedAction<T extends z.ZodTypeAny, R>(
  schema: T,
  handler: (data: z.infer<T>, user: any) => Promise<R>,
  options: ActionOptions = { role: "user" }
) {
  return async (...args: any[]): Promise<R> => {
    try {
      // 1. Authenticate / Authorize
      const user =
        options.role === "admin" ? await requireAdmin() : await requireUser();

      // 2. Extract FormData
      const formData = args.find((arg) => arg instanceof FormData);
      if (!formData) {
        return {
          error: "Không tìm thấy dữ liệu form (Form data is required).",
        } as any;
      }

      // 3. Parse input
      const rawData = Object.fromEntries(formData.entries());
      const parsed = schema.safeParse(rawData);

      if (!parsed.success) {
        // Return first Zod error message
        return { error: parsed.error.errors[0].message } as any;
      }

      // 4. Run handler
      return await handler(parsed.data, user);
    } catch (error: any) {
      // Check for Next.js internal redirect or notFound errors and let them bubble up
      const isNextRedirect =
        isRedirectError(error) ||
        (error &&
          typeof error === "object" &&
          typeof error.digest === "string" &&
          error.digest.startsWith("NEXT_REDIRECT"));

      const isNextNotFound =
        error && typeof error === "object" && error.digest === "NEXT_NOT_FOUND";

      if (isNextRedirect || isNextNotFound) {
        throw error;
      }

      console.error("Action error:", error);
      return {
        error:
          error instanceof Error ? error.message : "Đã xảy ra lỗi hệ thống.",
      } as any;
    }
  };
}
