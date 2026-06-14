"use client";

import { useActionState, useState } from "react";
import { SOURCE_TEXT_MAX_LENGTH } from "@/domain/constants";
import {
  createSourceTextAction,
  type SourceTextActionState,
} from "@/app/actions/source-texts";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(
  () => import("./rich-text-editor").then((mod) => mod.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="w-full min-h-[246px] bg-surface-strong/30 border border-border rounded-md animate-pulse mt-1" />
    ),
  }
);

function getPlainTextFromJSONClient(node: any): string {
  if (!node) return "";
  if (node.type === "text") {
    return node.text || "";
  }
  if (node.content && Array.isArray(node.content)) {
    const isBlockContainer =
      node.type === "doc" ||
      node.type === "bulletList" ||
      node.type === "orderedList";
    return node.content
      .map(getPlainTextFromJSONClient)
      .join(isBlockContainer ? "\n" : "");
  }
  return "";
}

function getPlainTextLength(value: string): number {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return getPlainTextFromJSONClient(parsed).trim().length;
    }
  } catch {
    // Ignore JSON parse error, treat content as plain text
  }
  return value.trim().length;
}

export function SourceTextForm() {
  const [state, action, pending] = useActionState<
    SourceTextActionState,
    FormData
  >(createSourceTextAction, {});
  const [value, setValue] = useState("");

  const plainTextLength = getPlainTextLength(value);

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-2 text-left text-sm font-semibold text-text">
        Dán tài liệu tiếng Anh cần phân tích
        <input type="hidden" name="content" value={value} />
        <RichTextEditor
          value={value}
          onChange={setValue}
          placeholder="Dán tin nhắn Slack, email, GitHub issue, PR comment, tài liệu API hoặc đoạn văn bản tiếng Anh bất kỳ. Bôi đen từ/cụm từ khó để AI phân tích chi tiết..."
        />
        <p className="text-xs text-muted font-normal mt-1">
          💡 <strong>Mẹo:</strong> Bạn có thể bôi đen bất kỳ cụm từ nào trong
          văn bản và nhấn <strong>Đánh dấu từ khó</strong> để yêu cầu AI ưu tiên
          giải thích cụm từ đó.
        </p>
      </div>
      <label className="grid gap-2 text-left text-sm font-semibold text-text mt-2">
        Chế độ dịch / học (Coaching Mode)
        <div className="relative mt-1">
          <select
            name="inputMode"
            className="w-full appearance-none border border-border rounded-md bg-surface text-text pl-4 pr-10 py-3 outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent-light cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
              backgroundPosition: "right 0.75rem center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "1.25rem",
            }}
          >
            <option value="auto">Tự động nhận diện (Khuyến nghị)</option>
            <option value="understand_and_practice">
              Hiểu &amp; Luyện tập (Văn bản chuẩn)
            </option>
            <option value="fix_and_understand">
              Sửa lỗi &amp; Giải thích ngữ pháp (Vietlish)
            </option>
            <option value="naturalize_english">
              Viết lại tự nhiên hơn (Văn bản chưa tự nhiên)
            </option>
            <option value="mixed_language_support">
              Anh-Việt hỗn hợp (Mixed)
            </option>
            <option value="developer_error_explanation">
              Giải nghĩa lỗi code lập trình (Stacktrace/Error)
            </option>
          </select>
        </div>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          disabled={
            pending ||
            plainTextLength === 0 ||
            plainTextLength > SOURCE_TEXT_MAX_LENGTH
          }
          type="submit"
        >
          {pending
            ? "Đang xếp hàng xử lý..."
            : "Bắt đầu phân tích & tạo bài học"}
        </button>
        <span
          className={`text-xs ${plainTextLength > SOURCE_TEXT_MAX_LENGTH ? "text-danger font-bold" : "text-muted"}`}
        >
          {plainTextLength.toLocaleString()} /{" "}
          {SOURCE_TEXT_MAX_LENGTH.toLocaleString()} ký tự
        </span>
      </div>
      {state.error ? (
        <p className="text-danger font-semibold text-sm m-0">{state.error}</p>
      ) : null}
    </form>
  );
}
