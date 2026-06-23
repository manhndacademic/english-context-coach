import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";

const rows = [
  {
    need: "Dịch đoạn tiếng Anh",
    generic: "Có",
    coach: "Có, nhưng giải thích theo ngữ cảnh người Việt",
  },
  {
    need: "Phát hiện bẫy dịch từng chữ",
    generic: "Không ổn định",
    coach: "Có trọng tâm",
  },
  {
    need: "Tạo bài tập từ đoạn vừa đọc",
    generic: "Phải tự prompt",
    coach: "Tự động tạo bài tập từ đoạn vừa đọc",
  },
  {
    need: "Ghi nhớ và ôn lại lỗi cá nhân",
    generic: "Rời rạc, không chủ động",
    coach: "Có Mistake Memory và ôn lại lỗi cũ",
  },
];

export function ComparisonSection() {
  return (
    <SectionCard className="p-4 min-[860px]:p-10 gap-8">
      <div className="text-center max-w-[700px] mx-auto">
        <Badge variant="default" size="sm" className="mb-3">
          Sự khác biệt
        </Badge>
        <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
          ChatGPT giúp bạn hiểu một lần. English Context Coach giúp bạn không
          sai lại lần sau.
        </h2>
        <p className="text-sm md:text-base text-muted leading-relaxed">
          ChatGPT và công cụ dịch rất hữu ích, nhưng bạn phải tự nhớ prompt, tự
          tạo bài tập và tự theo dõi lỗi. App này biến phần đó thành workflow
          học tập có chủ đích.
        </p>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <article
            key={row.need}
            className="rounded-md border border-border bg-surface-strong p-4 grid gap-3"
          >
            <div>
              <span className="block text-[11px] font-bold uppercase text-muted">
                Nhu cầu
              </span>
              <strong className="text-sm text-text">{row.need}</strong>
            </div>
            <div className="grid gap-2">
              <div className="rounded-sm border border-border bg-surface px-3 py-2">
                <span className="block text-[11px] font-bold uppercase text-muted">
                  ChatGPT / Google Translate
                </span>
                <span className="text-sm text-text">{row.generic}</span>
              </div>
              <div className="rounded-sm border border-border-glow bg-accent-light px-3 py-2">
                <span className="block text-[11px] font-bold uppercase text-accent">
                  English Context Coach
                </span>
                <span className="text-sm font-semibold text-accent">
                  {row.coach}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block mt-4 rounded-md border border-border overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="bg-surface-strong font-bold text-text text-left p-3 px-4 border-b border-border w-[30%]">
                Nhu cầu
              </th>
              <th className="bg-surface-strong font-bold text-text text-left p-3 px-4 border-b border-border w-[35%]">
                ChatGPT / Google Translate
              </th>
              <th className="bg-surface-strong text-accent font-extrabold text-left p-3 px-4 border-b border-border w-[35%]">
                English Context Coach
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.need}>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left font-semibold">
                  {row.need}
                </td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left">
                  {row.generic}
                </td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left text-accent font-semibold">
                  {row.coach}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
