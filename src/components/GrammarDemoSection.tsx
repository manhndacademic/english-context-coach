"use client";

import { useEffect, useRef, useState } from "react";

// Static diff data for the demo
const DEMO_ORIGINAL =
  "I'm waiting for my wife take a shower before going to bed.";

// Pre-computed diff spans for the demo
const DEMO_SPANS = [
  { type: "equal" as const, text: "I'm waiting for my wife " },
  { type: "delete" as const, text: "take" },
  { type: "insert" as const, text: "to take" },
  { type: "equal" as const, text: " a shower before going to bed." },
];

type AnimStep = -1 | 0 | 1 | 2 | 3;

export function GrammarDemoSection() {
  const [step, setStep] = useState<AnimStep>(-1);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Auto-play when scrolled into view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && step === -1) {
          setStep(0);
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [step]);

  // Infinite Sequential timeline loop
  // Step transition delays: 0->1 (0.9s), 1->2 (1.5s), 2->3 (1.6s), 3->0 (6.0s)
  useEffect(() => {
    if (step === -1) return;

    if (step === 0) {
      const t = setTimeout(() => setStep(1), 900);
      return () => clearTimeout(t);
    } else if (step === 1) {
      const t = setTimeout(() => setStep(2), 1500);
      return () => clearTimeout(t);
    } else if (step === 2) {
      const t = setTimeout(() => setStep(3), 1600);
      return () => clearTimeout(t);
    } else if (step === 3) {
      const t = setTimeout(() => setStep(0), 6000);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <section
      ref={sectionRef}
      className="mb-20 grid gap-8"
      aria-label="Demo so sánh sửa lỗi"
    >
      <div className="text-center max-w-[600px] mx-auto">
        <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold mb-3">
          Tính năng phụ
        </span>
        <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
          Khi lỗi là grammar, app chỉ rõ điểm cần sửa
        </h2>
        <p className="text-sm md:text-base text-muted leading-relaxed">
          Grammar không phải trọng tâm duy nhất, nhưng khi câu sai cấu trúc, app
          vẫn chỉ ra đúng chỗ cần sửa thay vì gạch cả câu.
        </p>
      </div>

      {/* Demo card */}
      <div className="max-w-[780px] mx-auto w-full">
        <div className="bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Window chrome bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-surface-strong border-b border-border">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-xs text-muted font-mono">
              English Context Coach — So sánh sửa lỗi
            </span>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1.5 px-5 pt-4">
            {([0, 1, 2, 3] as AnimStep[]).map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  step >= s ? "bg-accent" : "bg-border"
                }`}
              />
            ))}
          </div>

          <div className="p-5 sm:p-6">
            {/* Step 0 & 1 & 2: show original sentence or unified diff */}
            <div
              className={`transition-all duration-500 ${
                step >= 0 ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="text-[11px] font-bold uppercase text-muted tracking-wider mb-2">
                {step < 2
                  ? "Câu tiếng Anh gốc"
                  : "Sửa lỗi trực tiếp (Unified Diff)"}
              </div>
              <div
                className={`font-serif text-base sm:text-lg leading-relaxed text-text p-4 rounded-lg border transition-all duration-500 ${
                  step === 1
                    ? "border-warning bg-warning-light animate-[shake_0.45s_ease-in-out]"
                    : step >= 2
                      ? "border-accent/30 bg-surface-strong shadow-inner"
                      : "border-border bg-surface-strong"
                }`}
              >
                {step < 2 ? (
                  <span>&quot;{DEMO_ORIGINAL}&quot;</span>
                ) : (
                  // Show unified diff
                  <span>
                    &quot;
                    {DEMO_SPANS.map((span) => {
                      const key = `${span.type}-${span.text}`;
                      if (span.type === "equal")
                        return <span key={key}>{span.text}</span>;
                      if (span.type === "delete")
                        return (
                          <span
                            key={key}
                            className="bg-danger-light dark:bg-[rgba(244,63,94,0.18)] text-danger dark:text-[#ff8585] line-through rounded-[3px] px-px transition-all duration-300"
                          >
                            {span.text}
                          </span>
                        );
                      if (span.type === "insert")
                        return (
                          <span
                            key={key}
                            className="bg-success-light dark:bg-[rgba(16,185,129,0.18)] text-success dark:text-[#a7f3d0] font-bold rounded-[3px] px-px transition-all duration-300"
                          >
                            {span.text}
                          </span>
                        );
                      return null;
                    })}
                    &quot;
                  </span>
                )}
              </div>

              {/* Warning badge at step 1 */}
              <div
                className={`flex items-center gap-2 mt-2.5 transition-all duration-400 ${
                  step === 1
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-1 pointer-events-none"
                }`}
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-warning text-white dark:text-background border border-transparent px-2.5 py-1 rounded-full">
                  ⚠️ Lỗi ngữ pháp phát hiện
                </span>
              </div>
            </div>

            {/* Step 3: explanation card */}
            <div
              className={`mt-4 transition-all duration-500 ${
                step >= 3
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-3 pointer-events-none"
              }`}
            >
              <div className="p-4 bg-surface border border-border rounded-lg grid gap-2">
                <strong className="text-[11px] font-bold uppercase text-muted tracking-wider">
                  Giải thích chi tiết:
                </strong>
                <p className="text-sm leading-relaxed text-text m-0">
                  Lỗi ở chỗ{" "}
                  <code className="text-xs bg-surface-strong border border-border rounded px-1.5 py-0.5 font-mono text-danger">
                    wife take
                  </code>
                  . Sau{" "}
                  <code className="text-xs bg-surface-strong border border-border rounded px-1.5 py-0.5 font-mono">
                    wait for [object]
                  </code>
                  , cần dùng{" "}
                  <code className="text-xs bg-success-light border border-success/20 rounded px-1.5 py-0.5 font-mono text-success">
                    to + verb
                  </code>{" "}
                  (to take). Đây là cấu trúc{" "}
                  <strong>wait for someone to do something</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-danger-light border border-danger/20" />
            Phần bị xóa (strikethrough)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-success-light border border-success/20" />
            Phần được thêm / sửa
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-surface-strong border border-border" />
            Không thay đổi
          </span>
        </div>
      </div>
    </section>
  );
}
