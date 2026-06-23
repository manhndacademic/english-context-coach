import { useState } from "react";

export const DOCUMENT_TYPES = [
  { value: "email", label: "Email", icon: "📧" },
  { value: "chat_message", label: "Chat", icon: "💬" },
  { value: "ticket", label: "Ticket", icon: "🎫" },
  { value: "code_review", label: "Code Review", icon: "👀" },
  { value: "technical_doc", label: "Technical Doc", icon: "📄" },
  { value: "meeting_notes", label: "Meeting Notes", icon: "📝" },
  { value: "general", label: "General", icon: "🌐" },
  // legacy
  { value: "work_message", label: "Work Message", icon: "💼" },
  { value: "article", label: "Article", icon: "📰" },
  { value: "academic", label: "Academic", icon: "🎓" },
  { value: "unknown", label: "Unknown", icon: "❓" },
];

export const FORMALITY_LEVELS = [
  { value: "formal", label: "Formal" },
  { value: "semi_formal", label: "Semi-formal" },
  { value: "casual", label: "Casual" },
];

function getDocTypeIcon(type: string | null): string {
  const found = DOCUMENT_TYPES.find((d) => d.value === type);
  return found ? found.icon : "🌐";
}

function getDocTypeLabel(type: string | null): string {
  const found = DOCUMENT_TYPES.find((d) => d.value === type);
  return found ? found.label : "General";
}

function getFormalityLabel(form: string | null): string {
  const found = FORMALITY_LEVELS.find((f) => f.value === form);
  return found ? found.label : "Auto";
}

interface ContextOverrideBadgesProps {
  lesson: {
    textType: string | null;
    formality?: string | null;
  };
  onUpdateDocType: (newType: string) => void;
  onUpdateFormality: (newFormality: string) => void;
}

export function ContextOverrideBadges({
  lesson,
  onUpdateDocType,
  onUpdateFormality,
}: ContextOverrideBadgesProps) {
  const [showDocTypeChips, setShowDocTypeChips] = useState(false);
  const [showFormalityChips, setShowFormalityChips] = useState(false);

  return (
    <section className="bg-surface border border-border rounded-lg p-4 shadow-sm flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted font-bold uppercase tracking-wider">
          Bối cảnh giao tiếp:
        </span>

        {/* DocumentType Badge */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowDocTypeChips(!showDocTypeChips);
              setShowFormalityChips(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-light border border-accent/25 rounded-full text-sm font-bold text-accent hover:bg-accent/15 cursor-pointer transition-all"
          >
            <span>{getDocTypeIcon(lesson.textType)}</span>
            <span>{getDocTypeLabel(lesson.textType)}</span>
            <span className="text-xs opacity-65">▼</span>
          </button>
        </div>

        {/* Formality Badge */}
        {lesson.formality && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowFormalityChips(!showFormalityChips);
                setShowDocTypeChips(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-light border border-accent/25 rounded-full text-sm font-bold text-accent hover:bg-accent/15 cursor-pointer transition-all"
            >
              <span>⚖️</span>
              <span>{getFormalityLabel(lesson.formality)}</span>
              <span className="text-xs opacity-65">▼</span>
            </button>
          </div>
        )}

        {!lesson.formality && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/10 border border-muted/20 rounded-full text-sm font-bold text-muted select-none">
            <span>⚖️</span>
            <span>Auto</span>
          </div>
        )}
      </div>

      {/* DocumentType chip list */}
      {showDocTypeChips && (
        <div className="border border-border/85 rounded-md p-3 bg-surface-strong/30 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {DOCUMENT_TYPES.map((type) => {
            const active = lesson.textType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => {
                  onUpdateDocType(type.value);
                  setShowDocTypeChips(false);
                }}
                disabled={active}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                  active
                    ? "bg-accent text-white border-accent cursor-default"
                    : "bg-surface text-text border-border hover:bg-surface-strong"
                }`}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Formality chip list */}
      {showFormalityChips && (
        <div className="border border-border/85 rounded-md p-3 bg-surface-strong/30 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {FORMALITY_LEVELS.map((form) => {
            const active = lesson.formality === form.value;
            return (
              <button
                key={form.value}
                type="button"
                onClick={() => {
                  onUpdateFormality(form.value);
                  setShowFormalityChips(false);
                }}
                disabled={active}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                  active
                    ? "bg-accent text-white border-accent cursor-default"
                    : "bg-surface text-text border-border hover:bg-surface-strong"
                }`}
              >
                <span>{form.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
