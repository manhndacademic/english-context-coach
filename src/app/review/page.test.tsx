import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReviewPage from "./page";

// Mock auth guard
vi.mock("@/lib/auth/guards", () => ({
  requireUser: vi.fn(async () => ({
    id: "user-1",
    email: "test@example.com",
    role: "user",
    image: null,
  })),
}));

// Mock repositories and dependencies
const mockFindDueMistakePatterns = vi.fn();
const mockFindMistakePattern = vi.fn();
const mockGetLessonsForPatterns = vi.fn(() => Promise.resolve({}));
const mockFindDuePhrasePractices = vi.fn();
const mockFindPhrasePractice = vi.fn();

vi.mock("@/domain/memory", () => ({
  getMistakePatternRepository: vi.fn(() => ({
    findDueMistakePatterns: mockFindDueMistakePatterns,
    findMistakePattern: mockFindMistakePattern,
    getLessonsForPatterns: mockGetLessonsForPatterns,
  })),
  getPhrasePracticeRepository: vi.fn(() => ({
    findDuePhrasePractices: mockFindDuePhrasePractices,
    findPhrasePractice: mockFindPhrasePractice,
  })),
}));

// Mock child components
vi.mock("@/components/app-header", () => ({
  AppHeader: () => <div data-testid="app-header" />,
}));

vi.mock("./session", () => ({
  ReviewSession: ({ patterns }: { patterns: any[] }) => (
    <div data-testid="review-session">
      {patterns.map((p) => (
        <span key={p.id}>{p.id}</span>
      ))}
    </div>
  ),
}));

describe("ReviewPage Server Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindDuePhrasePractices.mockResolvedValue([]);
    mockFindPhrasePractice.mockResolvedValue(null);
  });

  it("fetches all due mistake patterns by default when patternId is not provided", async () => {
    mockFindDueMistakePatterns.mockResolvedValue([
      { id: "p-due-1", toPlainObject: () => ({ id: "p-due-1" }) },
      { id: "p-due-2", toPlainObject: () => ({ id: "p-due-2" }) },
    ]);

    const html = renderToStaticMarkup(
      await ReviewPage({ searchParams: Promise.resolve({}) })
    );

    expect(mockFindDueMistakePatterns).toHaveBeenCalledWith(
      "user-1",
      expect.any(Date),
      20
    );
    expect(mockFindMistakePattern).not.toHaveBeenCalled();
    expect(html).toContain("p-due-1");
    expect(html).toContain("p-due-2");
  });

  it("fetches and renders only the specific pattern if patternId is provided and succeeded", async () => {
    mockFindMistakePattern.mockResolvedValue({
      id: "p-specific",
      reviewPromptStatus: "succeeded",
      toPlainObject: () => ({ id: "p-specific" }),
    });

    const html = renderToStaticMarkup(
      await ReviewPage({
        searchParams: Promise.resolve({ patternId: "p-specific" }),
      })
    );

    expect(mockFindMistakePattern).toHaveBeenCalledWith("p-specific", "user-1");
    expect(mockFindDueMistakePatterns).not.toHaveBeenCalled();
    expect(html).toContain("p-specific");
    expect(html).not.toContain("p-due-1");
  });

  it("falls back to due patterns if the specified patternId does not exist", async () => {
    mockFindMistakePattern.mockResolvedValue(null);
    mockFindDueMistakePatterns.mockResolvedValue([
      { id: "p-due-1", toPlainObject: () => ({ id: "p-due-1" }) },
    ]);

    const html = renderToStaticMarkup(
      await ReviewPage({
        searchParams: Promise.resolve({ patternId: "non-existent" }),
      })
    );

    expect(mockFindMistakePattern).toHaveBeenCalledWith(
      "non-existent",
      "user-1"
    );
    expect(mockFindDueMistakePatterns).toHaveBeenCalled();
    expect(html).toContain("p-due-1");
  });

  it("falls back to due patterns if the specified pattern is not yet succeeded (e.g. pending/failed)", async () => {
    mockFindMistakePattern.mockResolvedValue({
      id: "p-specific",
      reviewPromptStatus: "pending",
      toPlainObject: () => ({ id: "p-specific" }),
    });
    mockFindDueMistakePatterns.mockResolvedValue([
      { id: "p-due-1", toPlainObject: () => ({ id: "p-due-1" }) },
    ]);

    const html = renderToStaticMarkup(
      await ReviewPage({
        searchParams: Promise.resolve({ patternId: "p-specific" }),
      })
    );

    expect(mockFindMistakePattern).toHaveBeenCalledWith("p-specific", "user-1");
    expect(mockFindDueMistakePatterns).toHaveBeenCalled();
    expect(html).toContain("p-due-1");
    expect(html).not.toContain("p-specific");
  });
});
