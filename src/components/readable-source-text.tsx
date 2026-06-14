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
import type { KeyPhrase } from "@/domain/lesson";
import { findHighlightRanges } from "@/lib/rich-text";

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
}

export function ReadableSourceText({ doc, phrases }: ReadableSourceTextProps) {
  const [activePhrase, setActivePhrase] = useState<KeyPhrase | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const editor = useEditor({
    extensions: [
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

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onMouseOver={handleMouseOver}
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
    </div>
  );
}
