import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewSession } from "./session";
import type { MistakePatternPlain } from "@/domain/memory/mistake-pattern";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

// Mock ReviewCard
vi.mock("@/components/review-card", () => ({
  ReviewCard: ({ pattern }: { pattern: MistakePatternPlain }) => (
    <div data-testid="review-card" id={pattern.id}>
      Card: {pattern.normalizedPhrase}
    </div>
  ),
}));

const mockPatterns: MistakePatternPlain[] = [
  {
    id: "p1",
    userId: "user-1",
    conceptKey: "concept-1",
    normalizedPhrase: "concept-phrase-1",
    category: "general_phrase",
    errorType: "literal_translation",
    meaningVi: "nghĩa 1",
    occurrenceCount: 1,
    intervalDays: 1,
    easeFactor: 2.5,
    streak: 0,
    masteryState: "active",
    dueAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any,
  {
    id: "p2",
    userId: "user-1",
    conceptKey: "concept-2",
    normalizedPhrase: "concept-phrase-2",
    category: "general_phrase",
    errorType: "literal_translation",
    meaningVi: "nghĩa 2",
    occurrenceCount: 2,
    intervalDays: 2,
    easeFactor: 2.5,
    streak: 0,
    masteryState: "active",
    dueAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any,
];

describe("ReviewSession Component", () => {
  it("renders the first pattern of the session", () => {
    const html = renderToStaticMarkup(
      <ReviewSession patterns={mockPatterns} />
    );
    expect(html).toContain("concept-phrase-1");
    expect(html).not.toContain("concept-phrase-2");
    expect(html).toContain("1 / 2 cụm từ");
  });

  it("renders the completion state when patterns are empty", () => {
    const html = renderToStaticMarkup(<ReviewSession patterns={[]} />);
    expect(html).toContain("Tuyệt vời!");
    expect(html).toContain("Quay lại bảng điều khiển");
  });
});
