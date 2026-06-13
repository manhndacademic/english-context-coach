"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { useEffect } from "react";
import { Bold, List, Highlighter } from "lucide-react";

export function RichTextEditor({
  onChange,
  placeholder,
  value,
  maxLength,
}: {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
  maxLength?: number;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Highlight.configure({
        multicolor: false,
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "w-full bg-surface text-text px-4 py-3 outline-none min-h-[200px] max-h-[400px] overflow-y-auto leading-relaxed ProseMirror",
      },
    },
  });

  // Sync initial content once when editor is ready
  useEffect(() => {
    if (editor && !editor.isDestroyed && value && editor.getText().length === 0) {
      try {
        const json = JSON.parse(value);
        editor.commands.setContent(json);
      } catch {
        editor.commands.setContent(value);
      }
    }
  }, [editor, value]);

  // Set initial placeholder attr
  useEffect(() => {
    if (editor && !editor.isDestroyed && placeholder) {
      editor.setOptions({
        editorProps: {
          attributes: {
            class: "w-full bg-surface text-text px-4 py-3 outline-none min-h-[200px] max-h-[400px] overflow-y-auto leading-relaxed ProseMirror",
            "data-placeholder": placeholder,
          },
        },
      });
    }
  }, [editor, placeholder]);

  return (
    <div className="flex flex-col w-full border border-border rounded-md focus-within:ring-4 focus-within:ring-accent-light focus-within:border-accent overflow-hidden mt-1">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 p-2 bg-surface-strong border-b border-border">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHighlight().run()}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-semibold border transition-all cursor-pointer ${
            editor?.isActive("highlight")
              ? "bg-accent border-accent text-white"
              : "bg-surface border-border text-muted hover:bg-surface-strong hover:text-text"
          }`}
          title="Đánh dấu cụm từ cần phân tích (Highlight)"
        >
          <Highlighter size={13} />
          <span>Đánh dấu từ khó</span>
        </button>
        <div className="w-[1px] h-5 bg-border mx-1" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`flex items-center gap-1 p-1.5 rounded-sm border transition-all cursor-pointer ${
            editor?.isActive("bold")
              ? "bg-accent border-accent text-white"
              : "bg-surface border-border text-muted hover:bg-surface-strong hover:text-text"
          }`}
          title="In đậm (Bold)"
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`flex items-center gap-1 p-1.5 rounded-sm border transition-all cursor-pointer ${
            editor?.isActive("bulletList")
              ? "bg-accent border-accent text-white"
              : "bg-surface border-border text-muted hover:bg-surface-strong hover:text-text"
          }`}
          title="Danh sách (Bullet List)"
        >
          <List size={13} />
        </button>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
