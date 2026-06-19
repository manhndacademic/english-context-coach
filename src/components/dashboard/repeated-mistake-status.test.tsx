import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RepeatedMistakeStatus } from "./repeated-mistake-status";

describe("RepeatedMistakeStatus Component", () => {
  const mockNow = new Date("2026-06-19T12:00:00Z").getTime();

  it("renders pending state when reviewPromptStatus is not succeeded or failed", () => {
    const html = renderToStaticMarkup(
      <RepeatedMistakeStatus patternId="123" reviewPromptStatus="pending" />
    );
    expect(html).toContain("Đang chuẩn bị...");
  });

  it("renders failed state with retry form when reviewPromptStatus is failed", () => {
    const html = renderToStaticMarkup(
      <RepeatedMistakeStatus patternId="123" reviewPromptStatus="failed" />
    );
    expect(html).toContain("Lỗi tạo câu hỏi");
    expect(html).toContain("Tạo lại");
    expect(html).toContain('name="patternId" value="123"');
  });

  it("renders 'Ôn tập' link when succeeded and due time is in the past", () => {
    const pastDue = new Date("2026-06-19T10:00:00Z").toISOString();
    const html = renderToStaticMarkup(
      <RepeatedMistakeStatus
        patternId="123"
        reviewPromptStatus="succeeded"
        dueAt={pastDue}
        now={mockNow}
      />
    );
    expect(html).toContain("Ôn tập");
    expect(html).toContain('href="/review?patternId=123"');
  });

  it("renders 'Ôn tập' link when succeeded and due time is null", () => {
    const html = renderToStaticMarkup(
      <RepeatedMistakeStatus
        patternId="123"
        reviewPromptStatus="succeeded"
        now={mockNow}
      />
    );
    expect(html).toContain("Ôn tập");
  });

  it("renders 'Hẹn ôn tập: Ngày mai' when due time is tomorrow", () => {
    const tomorrowDue = new Date("2026-06-20T11:00:00Z").toISOString();
    const html = renderToStaticMarkup(
      <RepeatedMistakeStatus
        patternId="123"
        reviewPromptStatus="succeeded"
        dueAt={tomorrowDue}
        now={mockNow}
      />
    );
    expect(html).toContain("Hẹn ôn tập: Ngày mai");
  });

  it("renders 'Chờ ôn tập: X ngày nữa' when due time is multiple days away", () => {
    const futureDue = new Date("2026-06-23T12:00:00Z").toISOString();
    const html = renderToStaticMarkup(
      <RepeatedMistakeStatus
        patternId="123"
        reviewPromptStatus="succeeded"
        dueAt={futureDue}
        now={mockNow}
      />
    );
    expect(html).toContain("Chờ ôn tập: 4 ngày nữa");
  });
});
