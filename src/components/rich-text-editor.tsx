"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { useEffect, useMemo, useRef } from "react";

export function RichTextEditor({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        bold: false,
        italic: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || "",
      }),
      CharacterCount.configure(),
    ],
    [placeholder]
  );

  const lastValueRef = useRef(value);

  const editor = useEditor({
    extensions,
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const jsonStr = JSON.stringify(editor.getJSON());
      lastValueRef.current = jsonStr;
      onChange(jsonStr);
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

    if (value === lastValueRef.current) return;

    lastValueRef.current = value;

    // Handle clearing the editor when value is set to empty/reset
    if (!value) {
      editor.commands.clearContent();
      return;
    }

    // Update content only if value differs from the current editor state
    try {
      const json = JSON.parse(value);
      editor.commands.setContent(json);
    } catch {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  return (
    <div className="flex flex-col w-full border border-border rounded-md focus-within:ring-4 focus-within:ring-accent-light focus-within:border-accent overflow-hidden mt-1">
      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
