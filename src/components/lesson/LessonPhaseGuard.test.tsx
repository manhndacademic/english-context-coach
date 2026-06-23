import { describe, expect, it, vi } from "vitest";
import { LessonPhaseGuard } from "./LessonPhaseGuard";
import { renderToStaticMarkup } from "react-dom/server";

describe("LessonPhaseGuard", () => {
  it("renders children without overlay when currentPhase is practice", () => {
    const onUnlock = vi.fn();
    const html = renderToStaticMarkup(
      <LessonPhaseGuard
        exerciseStatus="succeeded"
        currentPhase="practice"
        onUnlock={onUnlock}
      >
        <div id="exercise-panel">Exercise Content</div>
      </LessonPhaseGuard>
    );

    expect(html).toContain("Exercise Content");
    expect(html).not.toContain("Bài tập thực hành đang khóa");
  });

  it("renders overlay when currentPhase is understand and exercises succeeded", () => {
    const onUnlock = vi.fn();
    const html = renderToStaticMarkup(
      <LessonPhaseGuard
        exerciseStatus="succeeded"
        currentPhase="understand"
        onUnlock={onUnlock}
        lockDescription="Custom lock description text"
      >
        <div id="exercise-panel">Exercise Content</div>
      </LessonPhaseGuard>
    );

    expect(html).toContain("Exercise Content");
    expect(html).toContain("Bài tập thực hành đang khóa");
    expect(html).toContain("Custom lock description text");
    expect(html).toContain("Nhấn để bắt đầu luyện tập");
  });

  it("does not render overlay when exercises are idle", () => {
    const onUnlock = vi.fn();
    const html = renderToStaticMarkup(
      <LessonPhaseGuard
        exerciseStatus="idle"
        currentPhase="understand"
        onUnlock={onUnlock}
      >
        <div id="exercise-panel">Exercise Content</div>
      </LessonPhaseGuard>
    );

    expect(html).toContain("Exercise Content");
    expect(html).not.toContain("Bài tập thực hành đang khóa");
  });
});
