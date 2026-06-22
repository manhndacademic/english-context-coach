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

const TEMPLATES = [
  {
    label: "💬 Câu tiếng Anh mẫu (Hiểu nghĩa & ngữ cảnh)",
    draft:
      "Could you take a look at the PR when you get a chance? We need to push back the release date if there are any blocker bugs.",
    corrected: "",
  },
  {
    label: "📝 Bản nháp & Bản sửa mẫu (Học từ sửa lỗi)",
    draft:
      "Yesterday I go to office and my manager say we must make a plan for draw up new feature.",
    corrected:
      "Yesterday I went to the office and my manager said we must make a plan to draw up the new feature.",
  },
];

export function SourceTextForm() {
  const [state, action, pending] = useActionState<
    SourceTextActionState,
    FormData
  >(createSourceTextAction, {});

  const [draftValue, setDraftValue] = useState("");
  const [correctedValue, setCorrectedValue] = useState("");
  const [showCorrected, setShowCorrected] = useState(false);

  const showStep2 = draftValue.trim().length > 0 && showCorrected;
  const isDiffMode = showStep2 && correctedValue.trim().length > 0;

  const mainLength = getPlainTextLength(
    isDiffMode ? correctedValue : draftValue
  );

  const handlePasteDraft = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDraftValue(text);
      }
    } catch {
      alert(
        "Không thể tự động đọc clipboard. Bạn vui lòng dán thủ công bằng tổ hợp phím Ctrl+V / Cmd+V."
      );
    }
  };

  const handlePasteCorrected = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCorrectedValue(text);
      }
    } catch {
      alert(
        "Không thể tự động đọc clipboard. Bạn vui lòng dán thủ công bằng tổ hợp phím Ctrl+V / Cmd+V."
      );
    }
  };

  return (
    <form action={action} className="grid gap-5">
      {/* Hidden Fields for Server Action */}
      <input
        type="hidden"
        name="content"
        value={isDiffMode ? correctedValue : draftValue}
      />
      <input
        type="hidden"
        name="draftContent"
        value={isDiffMode ? draftValue : ""}
      />
      <input
        type="hidden"
        name="inputMode"
        value={isDiffMode ? "diff" : "write"}
      />

      {/* Step 1: Original / Draft Text */}
      <div className="grid gap-2 text-left text-sm font-semibold text-text">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span>1. Nhập văn bản tiếng Anh của bạn (Bản gốc / Bản nháp)</span>
          <button
            type="button"
            onClick={handlePasteDraft}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-surface-strong hover:bg-border text-text border border-border px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm select-none"
          >
            📋 Dán từ Clipboard
          </button>
        </div>
        <RichTextEditor
          value={draftValue}
          onChange={setDraftValue}
          placeholder="Dán câu hoặc đoạn văn bản tiếng Anh của bạn viết, hoặc đoạn văn bạn muốn hiểu nghĩa..."
        />

        {/* Quick Templates */}
        {!showStep2 && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-muted font-normal">
              Thử mẫu nhanh:
            </span>
            {TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.label}
                type="button"
                onClick={() => {
                  setDraftValue(tmpl.draft);
                  setCorrectedValue(tmpl.corrected);
                  setShowCorrected(!!tmpl.corrected);
                }}
                className="text-xs bg-surface border border-border text-text hover:bg-surface-strong px-2.5 py-1 rounded transition-all cursor-pointer shadow-sm select-none"
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        )}

        {draftValue.trim().length > 0 && (
          <div className="flex justify-start mt-3">
            <button
              type="button"
              onClick={() => setShowCorrected(!showCorrected)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover transition-all cursor-pointer select-none bg-accent/5 px-2.5 py-1.5 rounded border border-accent/20 hover:bg-accent/10"
            >
              {showCorrected
                ? "✨ Bỏ bản đã sửa (Chế độ tự động cải thiện)"
                : "✨ Tôi đã có bản sửa (Chế độ so sánh đối chiếu)"}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Optional Corrected Text */}
      {showStep2 && (
        <div className="grid gap-2 text-left text-sm font-semibold text-text border-t border-border/60 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-accent font-bold">
              ✨ Bạn có bản đã sửa (Corrected Version) của văn bản trên? (Tùy
              chọn)
            </span>
            <button
              type="button"
              onClick={handlePasteCorrected}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-surface-strong hover:bg-border text-text border border-border px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm select-none"
            >
              📋 Dán từ Clipboard
            </button>
          </div>
          <p className="text-xs text-muted font-normal -mt-1">
            Dán bản đã được sửa bởi AI (ChatGPT, Claude...) hoặc đồng nghiệp để
            học từ các điểm khác biệt. Nếu không dán, app sẽ chạy chế độ
            dịch/hiểu thông thường.
          </p>
          <RichTextEditor
            value={correctedValue}
            onChange={setCorrectedValue}
            placeholder="Dán bản tiếng Anh đã được sửa tại đây (Ví dụ: 'Yesterday I went to the office...')"
          />
        </div>
      )}

      {/* Submit Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
        <button
          className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          disabled={
            pending ||
            draftValue.trim().length === 0 ||
            mainLength > SOURCE_TEXT_MAX_LENGTH
          }
          type="submit"
        >
          {pending
            ? "Đang xếp hàng xử lý..."
            : isDiffMode
              ? "So sánh lỗi sai & bắt đầu học"
              : "Phân tích & cải thiện"}
        </button>
        <span
          className={`text-xs ${mainLength > SOURCE_TEXT_MAX_LENGTH ? "text-danger font-bold" : "text-muted"}`}
        >
          {mainLength.toLocaleString()} /{" "}
          {SOURCE_TEXT_MAX_LENGTH.toLocaleString()} ký tự
        </span>
      </div>

      {state.error ? (
        <p className="text-danger font-semibold text-sm m-0">{state.error}</p>
      ) : null}
    </form>
  );
}
