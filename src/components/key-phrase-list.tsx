"use client";

import { useState } from "react";
import { ChevronDown, AlertCircle, HelpCircle, BookOpen } from "lucide-react";
import { renderRichText } from "@/lib/rich-text";

import type { KeyPhrase } from "@/domain/lesson";

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function KeyPhraseList({ phrases }: { phrases: KeyPhrase[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!phrases.length) {
    return <p className="muted">Cụm từ then chốt sẽ xuất hiện sau khi phân tích thành công.</p>;
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="phrase-list">
      {phrases.map((phrase) => {
        const isExpanded = expandedId === phrase.id;
        const confText = [phrase.literalTranslationVi, phrase.whyConfusingVi].filter(Boolean).join(" ");

        return (
          <div
            className={`phrase-row-new ${isExpanded ? "phrase-row-new-expanded" : ""}`}
            id={`keyphrase-${phrase.id}`}
            key={phrase.id}
          >
            <button
              className="phrase-row-new-trigger"
              onClick={() => toggleExpand(phrase.id)}
              aria-expanded={isExpanded}
            >
              <div className="phrase-row-new-main">
                <span className="phrase-title">{phrase.phrase}</span>
                <span className="phrase-meta">
                  <span className="pill">{formatLabel(phrase.category)}</span>
                  <span className="pill">{phrase.difficulty}</span>
                </span>
                <span className="phrase-meaning-new">
                  <strong>Nghĩa trong câu:</strong> {phrase.meaningInContextVi || phrase.meaningVi}
                </span>
              </div>
              <ChevronDown
                size={18}
                className={`phrase-row-new-chevron ${isExpanded ? "rotated" : ""}`}
              />
            </button>

            <div className={`phrase-row-new-content ${isExpanded ? "expanded" : ""}`}>
              <div className="phrase-row-new-inner">
                <div className="phrase-detail-item">
                  <div className="phrase-detail-label">
                    <BookOpen size={14} />
                    <span>Nghĩa cơ bản</span>
                  </div>
                  <div className="phrase-detail-value">
                    {renderRichText(phrase.meaningVi)}
                  </div>
                </div>

                {phrase.exampleEn || phrase.exampleVi ? (
                  <div className="phrase-detail-item">
                    <div className="phrase-detail-label">
                      <HelpCircle size={14} />
                      <span>Ví dụ thực tế</span>
                    </div>
                    <div className="phrase-detail-value">
                      {phrase.exampleEn && <span className="example-en-new">{phrase.exampleEn}</span>}
                      {phrase.exampleVi && <span className="example-vi-new">{phrase.exampleVi}</span>}
                    </div>
                  </div>
                ) : null}

                {phrase.naturalTranslationVi && (
                  <div className="phrase-detail-item success-item">
                    <div className="phrase-detail-label">
                      <span className="success-badge-new">Dịch tự nhiên</span>
                    </div>
                    <div className="phrase-detail-value natural-translation-value">
                      {renderRichText(phrase.naturalTranslationVi)}
                    </div>
                  </div>
                )}

                {confText.trim().length > 0 && (
                  <div className="phrase-detail-item danger-item">
                    <div className="phrase-detail-label">
                      <AlertCircle size={14} />
                      <span>Bẫy dịch từ & Độ nhầm lẫn</span>
                    </div>
                    <div className="phrase-detail-value confusing-trap-value">
                      {renderRichText(confText)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
