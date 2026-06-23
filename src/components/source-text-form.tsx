"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import {
  createSourceTextAction,
  type SourceTextActionState,
} from "@/app/actions/source-texts";
import { generateAiTemplateAction } from "@/app/actions/ai-template";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Loader2 } from "lucide-react";
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

export function SourceTextForm() {
  const [state, action, pending] = useActionState<
    SourceTextActionState,
    FormData
  >(createSourceTextAction, {});

  const [activeTab, setActiveTab] = useState<"write" | "read">("write");

  // State for Write Tab (Mistakes flow)
  const [draftValue, setDraftValue] = useState("");

  // State for Read Tab (Standard text flow)
  const [standardValue, setStandardValue] = useState("");

  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  const handlePasteDraft = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDraftValue(text);
      }
    } catch {
      toast.error(
        "Không thể tự động đọc clipboard. Bạn vui lòng dán thủ công bằng tổ hợp phím Ctrl+V / Cmd+V."
      );
    }
  };

  const handlePasteStandard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setStandardValue(text);
      }
    } catch {
      toast.error(
        "Không thể tự động đọc clipboard. Bạn vui lòng dán thủ công bằng tổ hợp phím Ctrl+V / Cmd+V."
      );
    }
  };

  const handleGenerateTemplate = async () => {
    setIsGeneratingTemplate(true);
    try {
      const result = await generateAiTemplateAction({ type: activeTab });
      if (result && "error" in result && result.error) {
        toast.error("Không thể sinh mẫu: " + result.error);
      } else if (result && result.success && result.text) {
        if (activeTab === "write") {
          setDraftValue(result.text);
        } else {
          setStandardValue(result.text);
        }
        toast.success("Đã sinh mẫu tiếng Anh bằng AI!");
      }
    } catch (err: any) {
      toast.error("Đã xảy ra lỗi: " + err.message);
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  return (
    <form action={action} className="grid gap-5">
      {/* Hidden Fields for Server Action */}
      <input
        type="hidden"
        name="content"
        value={activeTab === "read" ? standardValue : draftValue}
      />
      <input
        type="hidden"
        name="draftContent"
        value={activeTab === "read" ? "" : draftValue}
      />
      <input
        type="hidden"
        name="inputMode"
        value={activeTab === "read" ? "understand_and_practice" : "write"}
      />

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "write" | "read")}
        className="w-full"
      >
        <div className="flex justify-center sm:justify-start mb-2">
          <TabsList>
            <TabsTrigger value="write">
              ✍️ Sửa bài viết của tôi (Luyện viết)
            </TabsTrigger>
            <TabsTrigger value="read">
              📖 Đọc hiểu tài liệu (Luyện đọc)
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Write & Improve (Learn from mistakes) */}
        <TabsContent value="write" className="grid gap-4.5 outline-none">
          <div className="grid gap-2 text-left text-sm font-semibold text-text">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span>Nhập văn bản tiếng Anh bạn tự viết (Bản nháp)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateTemplate}
                  disabled={isGeneratingTemplate}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-accent/5 hover:bg-accent/10 text-accent border border-accent/20 px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm select-none disabled:opacity-50"
                >
                  {isGeneratingTemplate ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  <span>✨ Gợi ý mẫu bằng AI</span>
                </button>
                <button
                  type="button"
                  onClick={handlePasteDraft}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-surface-strong hover:bg-border text-text border border-border px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm select-none"
                >
                  📋 Dán từ Clipboard
                </button>
              </div>
            </div>
            <RichTextEditor
              value={draftValue}
              onChange={setDraftValue}
              placeholder="Dán câu hoặc bài nháp tiếng Anh của bạn tại đây để AI chữa lỗi diễn đạt..."
            />
          </div>
        </TabsContent>

        {/* Tab 2: Read & Understand (Learn from standard text) */}
        <TabsContent value="read" className="grid gap-4.5 outline-none">
          <div className="grid gap-2 text-left text-sm font-semibold text-text">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span>
                Nhập văn bản tiếng Anh chuẩn bạn cần đọc hiểu (email, tài liệu,
                chat...)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateTemplate}
                  disabled={isGeneratingTemplate}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-accent/5 hover:bg-accent/10 text-accent border border-accent/20 px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm select-none disabled:opacity-50"
                >
                  {isGeneratingTemplate ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  <span>✨ Gợi ý mẫu bằng AI</span>
                </button>
                <button
                  type="button"
                  onClick={handlePasteStandard}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-surface-strong hover:bg-border text-text border border-border px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm select-none"
                >
                  📋 Dán từ Clipboard
                </button>
              </div>
            </div>
            <RichTextEditor
              value={standardValue}
              onChange={setStandardValue}
              placeholder="Dán email từ khách hàng, tài liệu công nghệ, tin nhắn của đồng nghiệp bản xứ..."
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Submit Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-2 border-t border-border pt-4">
        <button
          className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          disabled={
            pending ||
            isGeneratingTemplate ||
            (activeTab === "write" && draftValue.trim().length === 0) ||
            (activeTab === "read" && standardValue.trim().length === 0)
          }
          type="submit"
        >
          {pending
            ? "Đang xếp hàng xử lý..."
            : activeTab === "read"
              ? "Dịch nghĩa & giải thích ngữ cảnh"
              : "Phân tích & sửa bài viết"}
        </button>
      </div>

      {state.error ? (
        <p className="text-danger font-semibold text-sm m-0">{state.error}</p>
      ) : null}
    </form>
  );
}
