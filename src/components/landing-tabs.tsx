"use client";

import { useState } from "react";

type TabKey = "dev" | "business" | "academic";

export function LandingTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>("dev");

  const tabs = {
    dev: {
      label: "Developer English",
      title: "English for Software Developers",
      copy: "Đọc hiểu tài liệu API, GitHub issues, PR comments, error messages và blog công nghệ một cách chính xác. Tự tin giao tiếp và làm việc trong dự án toàn cầu.",
      bullets: [
        "Tránh bẫy dịch từng từ của các thuật ngữ chuyên ngành (như deprecated, breaking change, payload).",
        "Hiểu đúng lỗi hệ thống (error messages) và tìm ra giải pháp nhanh hơn thay vì dịch thô.",
        "Học từ chính các tài liệu thực tế bạn đang làm việc hàng ngày.",
      ],
      example:
        "This endpoint is deprecated and will be removed in a future release.",
      trap: "deprecated",
      trapWrong: "Bị phản đối / Bị chê",
      trapCorrect:
        "Không khuyến khích dùng nữa, sắp bị gỡ bỏ (hạn chế dùng cho code mới)",
    },
    business: {
      label: "Business English",
      title: "Business & Workplace English",
      copy: "Nắm bắt chính xác nội dung email, tin nhắn Slack và các yêu cầu từ quản lý hoặc đối tác. Hiểu rõ sắc thái lịch sự hoặc từ chối mềm dẻo.",
      bullets: [
        "Hiểu đúng các phrasal verbs công sở phổ biến (như push back, follow up, circle back).",
        "Nắm bắt đúng tone giọng (polite request, escalation, gentle reminder) để ứng xử phù hợp.",
        "Viết phản hồi ngắn gọn, tự nhiên, chuẩn phong cách chuyên nghiệp.",
      ],
      example: "Could you take a look at the proposal when you get a chance?",
      trap: "take a look",
      trapWrong: "Lấy một cái nhìn",
      trapCorrect: "Xem giúp / kiểm tra giúp (yêu cầu công việc lịch sự)",
    },
    academic: {
      label: "Academic English",
      title: "Academic & General Reading",
      copy: "Gỡ rối các câu dài phức tạp trong tài liệu nghiên cứu, giáo trình và bài viết chuyên sâu. Nắm vững cấu trúc câu và các từ nối quan trọng.",
      bullets: [
        "Làm chủ các từ nối tương phản hoặc logic phức tạp (như whereas, albeit, despite, nevertheless).",
        "Phân tích cấu trúc câu dài nhiều mệnh đề để hiểu đúng ý chính.",
        "Tiết kiệm thời gian đọc tài liệu học thuật mà không bị lạc lối trong từ vựng.",
      ],
      example:
        "The test coverage was improved, albeit at the cost of execution speed.",
      trap: "albeit",
      trapWrong: "Tất cả mặc dù / Dù cho",
      trapCorrect: "Mặc dù / Dù là (dùng để giảm nhẹ hoặc bổ sung ý ngược lại)",
    },
  };

  const current = tabs[activeTab];

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-md">
      <div className="flex border-b border-border bg-surface-strong overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
        {(Object.keys(tabs) as TabKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 min-w-[120px] text-center p-4 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === key
                ? "text-accent border-accent bg-surface"
                : "text-muted border-transparent bg-transparent hover:text-text hover:bg-[rgba(0,0,0,0.02)]"
            }`}
            type="button"
          >
            {tabs[key].label}
          </button>
        ))}
      </div>
      <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 items-center">
        <div className="grid gap-4">
          <h3 className="text-xl md:text-2xl font-extrabold m-0 text-text">
            {current.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted m-0">
            {current.copy}
          </p>
          <ul className="pl-5 m-0 grid gap-2 list-disc text-text">
            {current.bullets.map((bullet, i) => (
              <li key={i} className="text-sm">
                {bullet}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 w-full">
          <div className="bg-surface-strong border border-border rounded-md p-5 font-serif text-sm md:text-base leading-relaxed shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
            <strong className="block text-[12px] text-muted uppercase mb-2 tracking-wider">
              Ví dụ thực tế
            </strong>
            <p className="m-0 mb-4 italic text-base text-accent-strong">
              &quot;{current.example}&quot;
            </p>

            <div className="w-full overflow-x-auto mt-4 rounded border border-border">
              <table className="w-full border-collapse text-sm min-w-[500px]">
                <thead>
                  <tr>
                    <th className="bg-surface-strong font-bold text-text text-left p-2.5 border-b border-border w-[30%]">
                      Cụm từ
                    </th>
                    <th className="bg-surface-strong font-bold text-danger text-left p-2.5 border-b border-border w-[35%]">
                      Dịch từng chữ
                    </th>
                    <th className="bg-surface-strong font-bold text-success text-left p-2.5 border-b border-border w-[35%]">
                      Nghĩa ngữ cảnh
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2.5 border-b border-border text-left font-bold">
                      {current.trap}
                    </td>
                    <td className="p-2.5 border-b border-border text-left text-danger line-through">
                      {current.trapWrong}
                    </td>
                    <td className="p-2.5 border-b border-border text-left font-semibold text-success">
                      {current.trapCorrect}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
