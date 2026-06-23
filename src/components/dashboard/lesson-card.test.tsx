import { describe, expect, it } from "vitest";
import { LessonCard } from "./lesson-card";
import { renderToStaticMarkup } from "react-dom/server";

describe("LessonCard", () => {
  const mockLesson = {
    id: "lesson-123",
    title: "How to push back a meeting in English",
    textType: "work_message",
    detectedLevel: "B2",
    version: 2,
    analysisStatus: "succeeded",
    exerciseStatus: "pending",
  };

  it("renders lesson title and tooltip attribute", () => {
    const html = renderToStaticMarkup(<LessonCard lesson={mockLesson} />);
    expect(html).toContain("How to push back a meeting in English");
    // Tiêu đề nên có thuộc tính title làm tooltip
    expect(html).toContain('title="How to push back a meeting in English"');
  });

  it("renders default title if lesson title is null", () => {
    const lessonWithNullTitle = { ...mockLesson, title: null };
    const html = renderToStaticMarkup(
      <LessonCard lesson={lessonWithNullTitle} />
    );
    expect(html).toContain("Bài học không tên");
    expect(html).toContain('title="Bài học không tên"');
  });

  it("renders document type icon and metadata info", () => {
    const html = renderToStaticMarkup(<LessonCard lesson={mockLesson} />);
    // Thể loại: work message
    expect(html).toContain("work message");
    // Trình độ: B2
    expect(html).toContain("B2");
    // Bản 2
    expect(html).toContain("Bản 2");
  });

  it("renders analysis status badge and exercise status badge", () => {
    const html = renderToStaticMarkup(<LessonCard lesson={mockLesson} />);
    // Phân tích: Sẵn sàng (succeeded -> Sẵn sàng)
    expect(html).toContain("Phân tích: Sẵn sàng");
    // Bài tập: Đang chờ (pending -> Đang chờ)
    expect(html).toContain("Bài tập: Đang chờ");
  });
});
