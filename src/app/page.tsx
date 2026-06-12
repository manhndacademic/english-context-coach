import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingTabs } from "@/components/landing-tabs";
import { Sparkles, BrainCircuit, History, ArrowRight, CheckCircle2, ShieldCheck, Cpu } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 pt-10 pb-20 flex flex-col gap-16 md:gap-20">
      <header className="flex flex-col sm:flex-row items-center justify-between border-b border-border pb-5 mb-10 sm:mb-16 gap-4">
        <span className="font-serif text-2xl font-extrabold tracking-tight text-accent hover:text-accent-hover transition-colors">
          English Context Coach
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 font-semibold text-sm transition-all shadow-sm bg-surface-strong text-text hover:bg-border hover:-translate-y-px h-[38px]"
          >
            Đăng nhập
          </Link>
          <Link 
            href="/register" 
            className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-4 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px h-[38px]"
          >
            Đăng ký miễn phí
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="text-center max-w-[800px] mx-auto mb-20 grid gap-6">
        <div className="inline-flex mx-auto items-center gap-1.5 bg-accent-light border border-border-glow text-accent px-3.5 py-1.5 rounded-full text-xs font-bold">
          <Sparkles size={14} />
          <span>Học từ lỗi sai thực tế của bạn</span>
        </div>
        <h1 className="text-[32px] md:text-5xl lg:text-[56px] font-extrabold tracking-tight leading-[1.1] text-text">
          Hiểu tiếng Anh thật trong công việc và học tập.
        </h1>
        <p className="text-base md:text-lg lg:text-[19px] leading-relaxed text-muted max-w-[650px] mx-auto">
          Dán email, tài liệu API, GitHub issues hoặc bất kỳ đoạn tiếng Anh nào. 
          Hệ thống giúp bạn hiểu đúng nghĩa ngữ cảnh, phát hiện bẫy dịch từng chữ, 
          luyện tập tức thì và ghi nhớ lỗi cá nhân để không bao giờ mắc lại.
        </p>
        <div className="flex flex-col min-[480px]:flex-row gap-3 justify-center mt-3 w-full min-[480px]:w-auto">
          <Link 
            href="/register" 
            className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-5 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)]"
          >
            Trải nghiệm ngay miễn phí <ArrowRight size={16} />
          </Link>
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-border px-5 font-semibold text-sm transition-all shadow-sm bg-surface-strong text-text hover:bg-border hover:-translate-y-px"
          >
            Bắt đầu bài học cũ
          </Link>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="mb-20 grid gap-8">
        <div className="text-center max-w-[600px] mx-auto">
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold mb-3">
            Vấn đề thực tế
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
            Bạn biết hết từ vựng nhưng vẫn hiểu sai câu?
          </h2>
          <p className="text-sm md:text-base text-muted leading-relaxed">
            Rất nhiều người Việt không thiếu từ vựng, mà thường xuyên mắc bẫy dịch từng chữ (literal translation) mà không hiểu nghĩa thực tế trong ngữ cảnh.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-surface border border-border rounded-lg p-6 shadow-md grid gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-accent-hover">
            <div className="flex items-center justify-between border-b border-dashed border-border pb-3">
              <span className="text-lg font-extrabold font-serif text-accent-strong">&quot;We need to push this back.&quot;</span>
              <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold">
                Work scheduling
              </span>
            </div>
            <div className="grid gap-2.5">
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-danger-light border-l-[3px] border-danger text-[#7a1515] dark:text-[#ff8585]">
                <span className="font-bold">Dịch từng chữ:</span>
                <span>&quot;Chúng ta cần đẩy cái này lại phía sau.&quot;</span>
              </div>
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-success-light border-l-[3px] border-success text-[#0f5132] dark:text-[#a7f3d0]">
                <span className="font-bold">Nghĩa ngữ cảnh:</span>
                <span>&quot;Chúng ta cần dời lịch / hoãn việc này lại.&quot;</span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6 shadow-md grid gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-accent-hover">
            <div className="flex items-center justify-between border-b border-dashed border-border pb-3">
              <span className="text-lg font-extrabold font-serif text-accent-strong">&quot;Could you take a look?&quot;</span>
              <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold">
                Slack message
              </span>
            </div>
            <div className="grid gap-2.5">
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-danger-light border-l-[3px] border-danger text-[#7a1515] dark:text-[#ff8585]">
                <span className="font-bold">Dịch từng chữ:</span>
                <span>&quot;Bạn có thể lấy một cái nhìn?&quot;</span>
              </div>
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-success-light border-l-[3px] border-success text-[#0f5132] dark:text-[#a7f3d0]">
                <span className="font-bold">Nghĩa ngữ cảnh:</span>
                <span>&quot;Bạn xem giúp / kiểm tra giúp mình với.&quot;</span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6 shadow-md grid gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-accent-hover">
            <div className="flex items-center justify-between border-b border-dashed border-border pb-3">
              <span className="text-lg font-extrabold font-serif text-accent-strong">&quot;Let&apos;s circle back next week.&quot;</span>
              <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold">
                Meeting
              </span>
            </div>
            <div className="grid gap-2.5">
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-danger-light border-l-[3px] border-danger text-[#7a1515] dark:text-[#ff8585]">
                <span className="font-bold">Dịch từng chữ:</span>
                <span>&quot;Hãy vòng tròn quay lại tuần sau.&quot;</span>
              </div>
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-success-light border-l-[3px] border-success text-[#0f5132] dark:text-[#a7f3d0]">
                <span className="font-bold">Nghĩa ngữ cảnh:</span>
                <span>&quot;Tuần sau chúng ta sẽ thảo luận tiếp/quay lại vấn đề này.&quot;</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Flow Section */}
      <section className="mb-20 grid gap-8">
        <div className="text-center max-w-[600px] mx-auto">
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold mb-3">
            Hành trình học
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
            Chu trình học tập khép kín hiệu quả
          </h2>
          <p className="text-sm md:text-base text-muted leading-relaxed">
            Không học qua các câu mẫu xa lạ. Học trực tiếp từ những gì bạn đang đọc và làm việc hàng ngày.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
          <div className="bg-surface border border-border rounded-md p-6 relative grid gap-3 shadow-sm">
            <span className="absolute top-4 right-4 text-[28px] font-black text-border leading-none">01</span>
            <BrainCircuit size={28} className="text-accent" />
            <h3 className="text-base font-bold m-0 text-text">Dán tài liệu thật</h3>
            <p className="text-xs text-muted leading-relaxed m-0">
              Dán email, Slack chat, docs, lỗi code bạn gặp lúc làm việc hoặc tài liệu học tập.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-md p-6 relative grid gap-3 shadow-sm">
            <span className="absolute top-4 right-4 text-[28px] font-black text-border leading-none">02</span>
            <Cpu size={28} className="text-accent" />
            <h3 className="text-base font-bold m-0 text-text">Hiểu ngữ cảnh</h3>
            <p className="text-xs text-muted leading-relaxed m-0">
              Xem tóm tắt tiếng Việt, bản dịch tự nhiên và các điểm ngữ cảnh cần đặc biệt lưu ý.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-md p-6 relative grid gap-3 shadow-sm">
            <span className="absolute top-4 right-4 text-[28px] font-black text-border leading-none">03</span>
            <CheckCircle2 size={28} className="text-accent" />
            <h3 className="text-base font-bold m-0 text-text">Luyện tập thực hành</h3>
            <p className="text-xs text-muted leading-relaxed m-0">
              Làm các bài tập trắc nghiệm và dịch tự nhiên được sinh ra trực tiếp từ chính đoạn text đó.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-md p-6 relative grid gap-3 shadow-sm">
            <span className="absolute top-4 right-4 text-[28px] font-black text-border leading-none">04</span>
            <History size={28} className="text-accent" />
            <h3 className="text-base font-bold m-0 text-text">Lưu và ôn tập lỗi</h3>
            <p className="text-xs text-muted leading-relaxed m-0">
              Mọi lỗi dịch sai sẽ tự động lưu vào Mistake Memory để nhắc nhở và ôn tập lại theo chu kỳ Spaced Repetition.
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="mb-20 grid gap-8">
        <div className="text-center max-w-[600px] mx-auto">
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold mb-3">
            Tình huống áp dụng
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
            Được thiết kế chuyên biệt cho từng nhu cầu
          </h2>
          <p className="text-sm md:text-base text-muted leading-relaxed">
            Lựa chọn chế độ phân tích phù hợp với công việc và học tập của bạn.
          </p>
        </div>

        <LandingTabs />
      </section>

      {/* Differentiation Area */}
      <section className="p-4 min-[860px]:p-10 rounded-lg bg-surface border border-border shadow-md grid gap-8">
        <div className="text-center max-w-[600px] mx-auto">
          <span className="inline-flex w-fit rounded-full bg-surface-strong border border-border px-2.5 py-1 text-muted text-xs font-extrabold mb-3">
            Sự khác biệt
          </span>
          <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
            Khác biệt gì với ChatGPT / Claude?
          </h2>
          <p className="text-sm md:text-base text-muted leading-relaxed">
            Các mô hình AI giải thích rất tốt, nhưng không giúp bạn nhớ và tiến bộ lâu dài.
          </p>
        </div>

        <div className="w-full overflow-x-auto [touch-action:manipulation] -webkit-overflow-scrolling-touch mt-4 rounded-md border border-border">
          <table className="w-full border-collapse text-sm min-w-[600px]">
            <thead>
              <tr>
                <th className="bg-surface-strong font-bold text-text text-left p-3 px-4 border-b border-border" style={{ width: "30%" }}>Tính năng</th>
                <th className="bg-surface-strong font-bold text-text text-left p-3 px-4 border-b border-border" style={{ width: "35%" }}>ChatGPT / Dịch thuật thông thường</th>
                <th className="bg-surface-strong text-accent font-extrabold text-left p-3 px-4 border-b border-border" style={{ width: "35%" }}>English Context Coach</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left font-semibold">Phân tích ngữ cảnh chuyên biệt</td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left">Dịch thô hoặc giải thích dài dòng bằng tiếng Anh</td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left text-accent font-semibold">Chỉ ra bẫy dịch từng chữ, giải thích ngắn gọn bằng tiếng Việt</td>
              </tr>
              <tr>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left font-semibold">Học đi đôi với hành</td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left">Chỉ đọc lời giải, không có bài tập kiểm tra lại</td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left text-accent font-semibold">Biến tài liệu vừa dán thành bài tập thực hành ngay lập tức</td>
              </tr>
              <tr>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left font-semibold">Ghi nhớ lỗi sai cá nhân</td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left">Hỏi xong trôi đi, không lưu giữ lịch sử điểm yếu</td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left text-accent font-semibold">Tự động nhận diện mẫu lỗi lặp lại và lưu vào bộ nhớ lỗi</td>
              </tr>
              <tr>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left font-semibold">Chu kỳ ôn tập (Spaced Repetition)</td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left">Không có cơ chế nhắc nhở ôn tập chủ động</td>
                <td className="leading-relaxed p-3 px-4 border-b border-border text-left text-accent font-semibold">Tự động tạo câu hỏi ôn tập mới dựa trên lỗi cũ theo chu kỳ thông minh</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer / CTA Section */}
      <footer className="flex flex-col gap-4 text-center mt-20 border-t border-border pt-10">
        <h2 className="text-[28px] font-extrabold m-0 text-text">Bắt đầu làm chủ tiếng Anh công việc của bạn</h2>
        <p className="text-sm leading-relaxed max-w-[500px] mx-auto m-0 text-muted">
          Đừng để email, tài liệu kỹ thuật hay tin nhắn của đồng nghiệp quốc tế làm bạn hiểu nhầm.
        </p>
        <div>
          <Link 
            href="/register" 
            className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-8 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] min-w-[200px]"
          >
            Đăng ký tài khoản miễn phí
          </Link>
        </div>
        <p className="text-muted text-xs mt-3">
          © 2026 English Context Coach · Vietnamese-native Learning System.
        </p>
      </footer>
    </div>
  );
}
