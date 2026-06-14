"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
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
      Placeholder.configure({
        placeholder: placeholder || "",
      }),
      CharacterCount.configure(),
    ],
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class:
          "w-full bg-surface text-text px-4 py-3 outline-none min-h-[200px] max-h-[400px] overflow-y-auto leading-relaxed ProseMirror",
      },
    },
  });

  // Sync initial content and parent-triggered updates (like resets) safely without loops
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const currentJSONStr = JSON.stringify(editor.getJSON());

    // Handle clearing the editor when value is set to empty/reset
    if (!value) {
      if (editor.getText().length > 0) {
        editor.commands.clearContent();
      }
      return;
    }

    // Update content only if value differs from the current editor state
    if (value !== currentJSONStr) {
      try {
        const json = JSON.parse(value);
        editor.commands.setContent(json);
      } catch {
        if (value !== editor.getText()) {
          editor.commands.setContent(value);
        }
      }
    }
  }, [editor, value]);

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
