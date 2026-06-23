import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createSourceTextAction,
  changeLessonContextAction,
  updateCorrectionPhraseAction,
  toggleCorrectionRejectAction,
} from "./source-texts";
import {
  getLessonGenerationEngine,
  getLessonRepository,
} from "@/domain/lesson";
import { requireUser } from "@/lib/auth/guards";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    const error = new Error(`REDIRECT:${href}`);
    (error as any).digest = `NEXT_REDIRECT;307;${href};`;
    throw error;
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth guards
vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn(),
}));

// Mock domain engine
const mockRepo = {
  updateCorrectionPhrase: vi.fn(),
  toggleCorrectionReject: vi.fn(),
};
vi.mock("@/domain/lesson", () => {
  const mockEngine = {
    queue: vi.fn(),
    retry: vi.fn(),
    deleteSourceText: vi.fn(),
    queueExerciseGeneration: vi.fn(),
    changeContext: vi.fn(),
  };
  return {
    getLessonGenerationEngine: () => mockEngine,
    getLessonRepository: () => mockRepo,
  };
});

describe("Source Texts Actions", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue(mockUser as any);
  });

  describe("createSourceTextAction", () => {
    it("successfully creates a source text in write mode", async () => {
      const mockEngine = getLessonGenerationEngine();
      vi.mocked(mockEngine.queue).mockResolvedValue({
        ok: true,
        lessonId: "lesson-abc",
        sourceTextId: "st-abc",
      });

      const formData = new FormData();
      formData.append("content", "I has a pencil.");
      formData.append("inputMode", "write");

      await expect(createSourceTextAction(null, formData)).rejects.toThrow(
        "REDIRECT:/lessons/lesson-abc"
      );

      expect(mockEngine.queue).toHaveBeenCalledWith(
        mockUser.id,
        "I has a pencil.",
        "write",
        undefined
      );
    });

    it("successfully creates a source text in diff mode", async () => {
      const mockEngine = getLessonGenerationEngine();
      vi.mocked(mockEngine.queue).mockResolvedValue({
        ok: true,
        lessonId: "lesson-diff",
        sourceTextId: "st-diff",
      });

      const formData = new FormData();
      formData.append("content", "I have a pencil.");
      formData.append("draftContent", "I has a pencil.");
      formData.append("inputMode", "diff");

      await expect(createSourceTextAction(null, formData)).rejects.toThrow(
        "REDIRECT:/lessons/lesson-diff"
      );

      expect(mockEngine.queue).toHaveBeenCalledWith(
        mockUser.id,
        "I have a pencil.",
        "diff",
        "I has a pencil."
      );
    });

    it("fails validation when inputMode is invalid", async () => {
      const formData = new FormData();
      formData.append("content", "Hello");
      formData.append("inputMode", "invalid_mode");

      const result = await createSourceTextAction(null, formData);
      expect(result.error).toBeDefined();
      expect(getLessonGenerationEngine().queue).not.toHaveBeenCalled();
    });
  });

  describe("changeLessonContextAction", () => {
    it("successfully calls engine changeContext and revalidates path", async () => {
      const mockEngine = getLessonGenerationEngine();
      vi.mocked(mockEngine.changeContext).mockResolvedValue({
        ok: true,
        lessonId: "lesson-xyz",
        sourceTextId: "st-xyz",
      });

      const result = await changeLessonContextAction(null, {
        lessonId: "12345678-1234-1234-1234-1234567890ab",
        newDocumentType: "chat_message",
        newFormality: "casual",
      });

      expect(result).toEqual({
        ok: true,
        lessonId: "lesson-xyz",
        sourceTextId: "st-xyz",
      });

      expect(mockEngine.changeContext).toHaveBeenCalledWith(
        mockUser.id,
        "12345678-1234-1234-1234-1234567890ab",
        "chat_message",
        "casual"
      );
    });

    it("fails validation when lessonId is not a valid UUID", async () => {
      const result = await changeLessonContextAction(null, {
        lessonId: "invalid-uuid",
        newDocumentType: "email",
      });

      expect((result as any).error).toBeDefined();
      expect(getLessonGenerationEngine().changeContext).not.toHaveBeenCalled();
    });
  });

  describe("updateCorrectionPhraseAction", () => {
    it("successfully calls repository updateCorrectionPhrase and revalidates path", async () => {
      const repository = getLessonRepository();
      vi.mocked(repository.updateCorrectionPhrase).mockResolvedValue({
        ok: true,
      });

      const result = await updateCorrectionPhraseAction(null, {
        lessonId: "12345678-1234-1234-1234-1234567890ab",
        correctionItemId: "87654321-4321-4321-4321-210987654321",
        newPhrase: "improved phrase",
      });

      expect(result).toEqual({ ok: true });
      expect(repository.updateCorrectionPhrase).toHaveBeenCalledWith(
        mockUser.id,
        "12345678-1234-1234-1234-1234567890ab",
        "87654321-4321-4321-4321-210987654321",
        "improved phrase"
      );
    });

    it("fails validation when parameters are invalid", async () => {
      const result = await updateCorrectionPhraseAction(null, {
        lessonId: "invalid-uuid",
        correctionItemId: "87654321-4321-4321-4321-210987654321",
        newPhrase: "",
      });

      expect((result as any).error).toBeDefined();
      expect(
        getLessonRepository().updateCorrectionPhrase
      ).not.toHaveBeenCalled();
    });
  });

  describe("toggleCorrectionRejectAction", () => {
    it("successfully calls repository toggleCorrectionReject and revalidates path", async () => {
      const repository = getLessonRepository();
      vi.mocked(repository.toggleCorrectionReject).mockResolvedValue({
        ok: true,
      });

      const result = await toggleCorrectionRejectAction(null, {
        lessonId: "12345678-1234-1234-1234-1234567890ab",
        correctionItemId: "87654321-4321-4321-4321-210987654321",
        isRejected: true,
      });

      expect(result).toEqual({ ok: true });
      expect(repository.toggleCorrectionReject).toHaveBeenCalledWith(
        mockUser.id,
        "12345678-1234-1234-1234-1234567890ab",
        "87654321-4321-4321-4321-210987654321",
        true
      );
    });

    it("fails validation when parameters are invalid", async () => {
      const result = await toggleCorrectionRejectAction(null, {
        lessonId: "invalid-uuid",
        correctionItemId: "87654321-4321-4321-4321-210987654321",
        isRejected: true,
      });

      expect((result as any).error).toBeDefined();
      expect(
        getLessonRepository().toggleCorrectionReject
      ).not.toHaveBeenCalled();
    });
  });
});
