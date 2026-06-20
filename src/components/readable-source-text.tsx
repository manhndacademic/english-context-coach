"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Node as ProsemirrorNode } from "@tiptap/pm/model";
import * as HoverCard from "@radix-ui/react-hover-card";
import { Loader2 } from "lucide-react";
import type { KeyPhrase } from "@/domain/lesson";
import { findHighlightRanges } from "@/lib/rich-text";
import {
  explainPhraseAction,
  saveCustomPhraseAction,
  type CustomPhraseExplanation,
} from "@/app/actions/explain-phrase";

function getPlainTextFromNode(node: any): string {
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
      .map(getPlainTextFromNode)
      .join(isBlockContainer ? "\n" : "");
  }
  return "";
}

// Custom ProseMirror Plugin for Key Phrase highlights
function findDecorations(
  doc: ProsemirrorNode,
  phrases: KeyPhrase[]
): Decoration[] {
  const decorations: Decoration[] = [];
  if (!phrases || !phrases.length) return decorations;

  let docText = "";
  const posMap: number[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        posMap.push(pos + i);
        docText += node.text[i];
      }
    } else if (node.type.name === "hardBreak") {
      posMap.push(pos);
      docText += "\n";
    } else if (node.isBlock) {
      if (docText.length > 0 && docText[docText.length - 1] !== "\n") {
        posMap.push(pos);
        docText += "\n";
      }
    }
  });

  const ranges = findHighlightRanges(docText, phrases);

  for (const range of ranges) {
    const startPos = posMap[range.start];
    const endPos = posMap[range.end - 1] + 1;

    if (startPos !== undefined && endPos !== undefined) {
      decorations.push(
        Decoration.inline(startPos, endPos, {
          class:
            "keyphrase-anchor cursor-pointer rounded-[4px] bg-accent-light border-b-2 border-accent text-accent-strong p-[1px_4px] font-bold no-underline transition-all duration-150 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] hover:bg-accent hover:text-white",
          "data-phrase-id": range.phraseId,
        })
      );
    }
  }

  return decorations.sort((a, b) => a.from - b.from);
}

const KeyPhraseHighlight = (phrases: KeyPhrase[]) =>
  Extension.create({
    name: "keyPhraseHighlight",
    addProseMirrorPlugins() {
      const key = new PluginKey("keyPhraseHighlight");
      return [
        new Plugin({
          key,
          state: {
            init(_, { doc }) {
              return DecorationSet.create(doc, findDecorations(doc, phrases));
            },
            apply(tr, oldState) {
              if (tr.docChanged) {
                return DecorationSet.create(
                  tr.doc,
                  findDecorations(tr.doc, phrases)
                );
              }
              return oldState.map(tr.mapping, tr.doc);
            },
          },
          props: {
            decorations(state) {
              return key.getState(state);
            },
          },
        }),
      ];
    },
  });

interface ReadableSourceTextProps {
  doc: string | object | null | undefined;
  phrases: KeyPhrase[];
  lessonId: string;
}

export function ReadableSourceText({
  doc,
  phrases,
  lessonId,
}: ReadableSourceTextProps) {
  const [activePhrase, setActivePhrase] = useState<KeyPhrase | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // States for text selection lookup
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lookupState, setLookupState] = useState<{
    phrase: string;
    sentenceContext: string;
    position: { left: number; top: number };
    explanation: CustomPhraseExplanation | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const parsedContent = useMemo(() => {
    if (!doc) return { type: "doc", content: [] };
    if (typeof doc === "object") return doc;
    try {
      return JSON.parse(doc);
    } catch {
      return {
        type: "doc",
        content: doc.split("\n").map((line) => ({
          type: "paragraph",
          content: line ? [{ type: "text", text: line }] : [],
        })),
      };
    }
  }, [doc]);

  const findSentenceContaining = (phrase: string): string => {
    let plainText = "";
    if (!doc) return "";
    if (typeof doc === "object") {
      plainText = getPlainTextFromNode(doc);
    } else {
      try {
        plainText = getPlainTextFromNode(JSON.parse(doc));
      } catch {
        plainText = doc;
      }
    }

    const sentences = plainText.split(/[.!?\n]+/);
    const found = sentences.find((s) =>
      s.toLowerCase().includes(phrase.toLowerCase())
    );
    return found ? found.trim() : phrase;
  };

  const extensions = useMemo(
    () => [
      StarterKit,
      Highlight.configure({ multicolor: false }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-accent hover:underline",
        },
      }),
      KeyPhraseHighlight(phrases),
    ],
    [phrases]
  );

  const editor = useEditor({
    extensions,
    content: parsedContent,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "w-full outline-none ProseMirror font-serif text-base md:text-lg leading-relaxed text-text space-y-4",
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setContent(parsedContent);
  }, [parsedContent, editor]);

  const handleMouseOver = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest(".keyphrase-anchor");
    if (anchor) {
      const phraseId = anchor.getAttribute("data-phrase-id");
      const phrase = phrases.find((p) => p.id === phraseId);
      if (phrase) {
        const rect = anchor.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          const relativeRect = {
            left: rect.left - containerRect.left,
            top: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height,
          } as DOMRect;
          setActivePhrase(phrase);
          setAnchorRect(relativeRect);
          setIsOpen(true);
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't close or update selection if clicked inside the lookup popover itself
    if (target.closest(".lookup-popover-container")) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();

    if (text.length > 0 && text.length < 80) {
      const sentenceContext = findSentenceContaining(text);
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setLookupState({
            phrase: text,
            sentenceContext,
            position: {
              left: rect.left - containerRect.left + rect.width / 2,
              top: rect.top - containerRect.top - 10,
            },
            explanation: null,
            loading: false,
            error: null,
          });
          setIsLookupOpen(true);
        }
      } catch (err) {
        // Range selection error (common when selecting across elements)
      }
    } else {
      setIsLookupOpen(false);
    }
  };

  const handleExplainClick = async () => {
    if (!lookupState) return;
    setLookupState((prev) =>
      prev ? { ...prev, loading: true, error: null } : null
    );
    try {
      const res = await explainPhraseAction({
        lessonId,
        phrase: lookupState.phrase,
        sentenceContext: lookupState.sentenceContext,
      });

      if (!res || "error" in res || !res.success || !res.data) {
        throw new Error(
          (res && "error" in res ? res.error : null) ||
            "Không thể dịch nghĩa cụm từ này."
        );
      }

      setLookupState((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              explanation: res.data ?? null,
            }
          : null
      );
    } catch (err) {
      setLookupState((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error:
                err instanceof Error
                  ? err.message
                  : "Đã xảy ra lỗi khi kết nối máy chủ giải nghĩa.",
            }
          : null
      );
    }
  };

  const handleSaveClick = async () => {
    if (!lookupState || !lookupState.explanation) return;
    setIsSaving(true);
    try {
      const res = await saveCustomPhraseAction({
        lessonId,
        explanation: lookupState.explanation,
      });

      if (!res.success) {
        throw new Error(res.error || "Không thể lưu từ vựng.");
      }

      setIsLookupOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onMouseOver={handleMouseOver}
      onMouseUp={handleMouseUp}
    >
      <EditorContent editor={editor} />

      {anchorRect && activePhrase && (
        <HoverCard.Root
          open={isOpen}
          onOpenChange={setIsOpen}
          openDelay={150}
          closeDelay={200}
        >
          <HoverCard.Trigger asChild>
            <div
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                left: anchorRect.left,
                top: anchorRect.top,
                width: anchorRect.width,
                height: anchorRect.height,
                zIndex: 10,
              }}
            />
          </HoverCard.Trigger>
          <HoverCard.Portal>
            <HoverCard.Content
              className="w-80 bg-surface border border-border rounded-lg shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
              sideOffset={5}
              onMouseLeave={() => setIsOpen(false)}
            >
              <div className="flex flex-col gap-2">
                <div>
                  <h4 className="font-bold text-accent-strong text-base">
                    {activePhrase.phrase}
                  </h4>
                  <p className="text-sm text-text font-medium mt-1">
                    {activePhrase.meaningVi}
                  </p>
                </div>

                {activePhrase.meaningInContextVi && (
                  <div className="text-xs text-muted border-l-2 border-border pl-2 my-1">
                    <span className="font-semibold">Nghĩa trong ngữ cảnh:</span>{" "}
                    {activePhrase.meaningInContextVi}
                  </div>
                )}

                {activePhrase.whyConfusingVi && (
                  <p className="text-xs text-muted leading-relaxed mt-1">
                    <span className="font-semibold text-warning">Lưu ý:</span>{" "}
                    {activePhrase.whyConfusingVi}
                  </p>
                )}

                <div className="flex items-center justify-end mt-2 pt-2 border-t border-border">
                  <a
                    href={`#keyphrase-${activePhrase.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setIsOpen(false);
                      const el = document.getElementById(
                        `keyphrase-${activePhrase.id}`
                      );
                      if (el) {
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        el.classList.add(
                          "ring-2",
                          "ring-accent",
                          "ring-offset-2"
                        );
                        setTimeout(() => {
                          el.classList.remove(
                            "ring-2",
                            "ring-accent",
                            "ring-offset-2"
                          );
                        }, 2000);
                      }
                    }}
                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Xem chi tiết &amp; Ví dụ &rarr;
                  </a>
                </div>
              </div>
            </HoverCard.Content>
          </HoverCard.Portal>
        </HoverCard.Root>
      )}

      {/* Floating Selection Tooltip Popover */}
      {isLookupOpen && lookupState && (
        <div
          className="lookup-popover-container absolute z-50 bg-surface border border-border rounded-lg shadow-xl p-4 w-80 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2.5 text-left"
          style={{
            left: `${lookupState.position.left}px`,
            top: `${lookupState.position.top}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setIsLookupOpen(false)}
            className="absolute top-2 right-2.5 text-muted hover:text-text cursor-pointer text-sm font-semibold select-none bg-surface-strong/50 w-5 h-5 rounded-full flex items-center justify-center hover:bg-border transition-all"
          >
            ✕
          </button>

          {!lookupState.explanation ? (
            <div className="grid gap-2">
              <p className="text-[10px] text-muted font-extrabold uppercase tracking-wider m-0">
                Đã chọn:
              </p>
              <strong className="text-base text-accent-strong m-0 select-all font-serif">
                &quot;{lookupState.phrase}&quot;
              </strong>
              {lookupState.error && (
                <p className="text-xs text-danger font-semibold m-0 leading-relaxed">
                  {lookupState.error}
                </p>
              )}
              <button
                onClick={handleExplainClick}
                disabled={lookupState.loading}
                className="w-full inline-flex items-center justify-center gap-1.5 min-h-9 rounded-md bg-accent text-white hover:bg-accent-hover text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 mt-1 select-none"
              >
                {lookupState.loading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Đang dịch
                    nghĩa...
                  </>
                ) : (
                  "🔍 Giải nghĩa từ này"
                )}
              </button>
            </div>
          ) : (
            <div className="grid gap-3 select-none text-text">
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h4 className="font-bold text-accent-strong text-base m-0 font-serif">
                    {lookupState.explanation.phrase}
                  </h4>
                  <span className="font-sans text-xs text-muted italic font-medium">
                    /{lookupState.explanation.ipa}/
                  </span>
                </div>
                <div className="inline-flex rounded bg-surface-strong border border-border px-1.5 py-0.5 text-[9px] text-muted font-black uppercase mt-1.5 leading-none">
                  {lookupState.explanation.category.replace("_", " ")}
                </div>
              </div>

              <div className="grid gap-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-muted">
                  Nghĩa chung:
                </span>
                <p className="text-sm font-semibold m-0 leading-relaxed text-text">
                  {lookupState.explanation.meaningVi}
                </p>
              </div>

              <div className="grid gap-1 border-l-2 border-accent pl-2.5 py-0.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-accent-strong">
                  Nghĩa trong ngữ cảnh:
                </span>
                <p className="text-xs font-medium m-0 leading-relaxed text-text">
                  {lookupState.explanation.meaningInContextVi}
                </p>
              </div>

              {lookupState.explanation.whyConfusingVi && (
                <div className="grid gap-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-warning">
                    Lưu ý bẫy dịch:
                  </span>
                  <p className="text-[11px] text-muted leading-relaxed m-0">
                    {lookupState.explanation.whyConfusingVi}
                  </p>
                </div>
              )}

              <div className="grid gap-1.5 bg-surface-strong border border-border rounded p-2.5 text-xs">
                <span className="text-[9px] font-black uppercase tracking-wider text-muted">
                  Ví dụ tương tự:
                </span>
                <p className="italic font-serif text-text m-0 leading-normal select-all">
                  &quot;{lookupState.explanation.exampleEn}&quot;
                </p>
                <p className="text-muted m-0 text-[11px] leading-normal">
                  {lookupState.explanation.exampleVi}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-2.5 mt-1 gap-2">
                <span className="text-[10px] text-muted font-bold">
                  Cấp độ: {lookupState.explanation.difficulty}
                </span>
                <button
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-white bg-accent hover:bg-accent-hover transition-all text-xs cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={10} className="animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    "💾 Lưu ôn tập (SRS)"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
