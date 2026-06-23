interface ToneAnalysisBannerProps {
  contextExplanationVi: string | null;
}

export function ToneAnalysisBanner({
  contextExplanationVi,
}: ToneAnalysisBannerProps) {
  if (!contextExplanationVi) return null;

  return (
    <section className="bg-accent-light border border-accent/20 rounded-lg p-5 shadow-sm flex items-start gap-3">
      <span className="text-xl shrink-0">📢</span>
      <div>
        <h4 className="font-bold text-accent text-sm m-0 mb-1">
          Đánh giá giọng điệu (Tone Analysis)
        </h4>
        <p className="text-sm text-text leading-relaxed m-0 whitespace-pre-wrap">
          {contextExplanationVi}
        </p>
      </div>
    </section>
  );
}
