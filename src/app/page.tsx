import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingTabs } from "@/components/landing-tabs";
import { GrammarDemoSection } from "@/components/GrammarDemoSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { MistakeMemorySection } from "@/components/landing/MistakeMemorySection";
import { ProductDemoSection } from "@/components/landing/ProductDemoSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  BrainCircuit,
  History,
  ArrowRight,
  CheckCircle2,
  Cpu,
} from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-300 mx-auto px-6 pt-10 pb-20 flex flex-col gap-16 md:gap-20">
      <header className="flex flex-col sm:flex-row items-center justify-between border-b border-border pb-5 mb-10 sm:mb-16 gap-4">
        <span className="font-serif text-2xl font-extrabold tracking-tight text-accent hover:text-accent-hover transition-colors">
          English Context Coach
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            asChild
            className="h-9.5 hover:-translate-y-px"
          >
            <Link href="/login">Đăng nhập</Link>
          </Button>
          <Button
            variant="default"
            size="sm"
            asChild
            className="h-9.5 hover:-translate-y-px"
          >
            <Link href="/register">Đăng ký miễn phí</Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="text-center max-w-200 mx-auto mb-20 grid gap-6">
        <Badge
          variant="accent"
          size="sm"
          className="mx-auto flex items-center gap-1.5 font-bold px-3.5 py-1.5 border border-border-glow"
        >
          <Sparkles size={14} />
          <span>Học từ lỗi sai thực tế của bạn</span>
        </Badge>
        <h1 className="text-[32px] md:text-5xl lg:text-[56px] font-extrabold tracking-tight leading-[1.1] text-text">
          Hiểu đúng tiếng Anh trong công việc, không dịch từng chữ.
        </h1>
        <p className="text-base md:text-lg lg:text-[19px] leading-relaxed text-muted max-w-162.5 mx-auto">
          Dán email, GitHub issue, tài liệu API, Slack message hoặc bất kỳ đoạn
          tiếng Anh nào. English Context Coach giúp bạn hiểu nghĩa thật trong
          ngữ cảnh, phát hiện bẫy dịch từng chữ, tạo bài tập và ghi nhớ lỗi sai
          để bạn không lặp lại.
        </p>
        <div className="flex flex-col min-[480px]:flex-row gap-3 justify-center mt-3 w-full min-[480px]:w-auto">
          <Button
            variant="default"
            size="lg"
            asChild
            className="hover:-translate-y-px px-5"
          >
            <Link href="/register">
              Dùng thử miễn phí <ArrowRight size={16} />
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="lg"
            asChild
            className="hover:-translate-y-px px-5"
          >
            <Link href="/login">Bắt đầu bài học cũ</Link>
          </Button>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="mb-20 grid gap-8">
        <div className="text-center max-w-150 mx-auto">
          <Badge className="mb-3">Vấn đề thực tế</Badge>
          <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
            Bạn biết hết từ vựng nhưng vẫn hiểu sai câu?
          </h2>
          <p className="text-sm md:text-base text-muted leading-relaxed">
            Rất nhiều người Việt không thiếu từ vựng, mà thường xuyên mắc bẫy
            dịch từng chữ (literal translation) mà không hiểu nghĩa thực tế
            trong ngữ cảnh.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-surface border border-border rounded-lg p-6 shadow-md grid gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-accent-hover">
            <div className="flex items-center justify-between border-b border-dashed border-border pb-3">
              <span className="text-lg font-extrabold font-serif text-accent-strong">
                &quot;We need to push this back.&quot;
              </span>
              <Badge>Work scheduling</Badge>
            </div>
            <div className="grid gap-2.5">
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-danger-light border-l-[3px] border-danger text-[#7a1515] dark:text-[#ff8585]">
                <span className="font-bold">Dịch từng chữ:</span>
                <span>&quot;Chúng ta cần đẩy cái này lại phía sau.&quot;</span>
              </div>
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-success-light border-l-[3px] border-success text-[#0f5132] dark:text-[#a7f3d0]">
                <span className="font-bold">Nghĩa ngữ cảnh:</span>
                <span>
                  &quot;Chúng ta cần dời lịch / hoãn việc này lại.&quot;
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg p-6 shadow-md grid gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-accent-hover">
            <div className="flex items-center justify-between border-b border-dashed border-border pb-3">
              <span className="text-lg font-extrabold font-serif text-accent-strong">
                &quot;Could you take a look?&quot;
              </span>
              <Badge>Slack message</Badge>
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
              <span className="text-lg font-extrabold font-serif text-accent-strong">
                &quot;Let&apos;s circle back next week.&quot;
              </span>
              <Badge>Meeting</Badge>
            </div>
            <div className="grid gap-2.5">
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-danger-light border-l-[3px] border-danger text-[#7a1515] dark:text-[#ff8585]">
                <span className="font-bold">Dịch từng chữ:</span>
                <span>&quot;Hãy vòng tròn quay lại tuần sau.&quot;</span>
              </div>
              <div className="flex gap-3 items-start px-3.5 py-2.5 rounded-sm text-sm leading-relaxed bg-success-light border-l-[3px] border-success text-[#0f5132] dark:text-[#a7f3d0]">
                <span className="font-bold">Nghĩa ngữ cảnh:</span>
                <span>
                  &quot;Tuần sau chúng ta sẽ thảo luận tiếp/quay lại vấn đề
                  này.&quot;
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProductDemoSection />

      {/* Product Flow Section */}
      <section className="mb-20 grid gap-8">
        <div className="text-center max-w-150 mx-auto">
          <Badge className="mb-3">Hành trình học</Badge>
          <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
            Chu trình học tập khép kín hiệu quả
          </h2>
          <p className="text-sm md:text-base text-muted leading-relaxed">
            Không học qua các câu mẫu xa lạ. Học trực tiếp từ những gì bạn đang
            đọc và làm việc hàng ngày.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
          <div className="bg-surface border border-border rounded-md p-6 relative grid gap-3 shadow-sm">
            <span className="absolute top-4 right-4 text-[28px] font-black text-border leading-none">
              01
            </span>
            <BrainCircuit size={28} className="text-accent" />
            <h3 className="text-base font-bold m-0 text-text">
              Dán tài liệu thật
            </h3>
            <p className="text-xs text-muted leading-relaxed m-0">
              Dán email, Slack chat, docs, lỗi code bạn gặp lúc làm việc hoặc
              tài liệu học tập.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-md p-6 relative grid gap-3 shadow-sm">
            <span className="absolute top-4 right-4 text-[28px] font-black text-border leading-none">
              02
            </span>
            <Cpu size={28} className="text-accent" />
            <h3 className="text-base font-bold m-0 text-text">Hiểu ngữ cảnh</h3>
            <p className="text-xs text-muted leading-relaxed m-0">
              Xem tóm tắt tiếng Việt, bản dịch tự nhiên và các điểm ngữ cảnh cần
              đặc biệt lưu ý.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-md p-6 relative grid gap-3 shadow-sm">
            <span className="absolute top-4 right-4 text-[28px] font-black text-border leading-none">
              03
            </span>
            <CheckCircle2 size={28} className="text-accent" />
            <h3 className="text-base font-bold m-0 text-text">
              Luyện tập thực hành
            </h3>
            <p className="text-xs text-muted leading-relaxed m-0">
              Làm các bài tập trắc nghiệm và dịch tự nhiên được sinh ra trực
              tiếp từ chính đoạn text đó.
            </p>
          </div>

          <div className="bg-surface border border-border rounded-md p-6 relative grid gap-3 shadow-sm">
            <span className="absolute top-4 right-4 text-[28px] font-black text-border leading-none">
              04
            </span>
            <History size={28} className="text-accent" />
            <h3 className="text-base font-bold m-0 text-text">
              Lưu và ôn tập lỗi
            </h3>
            <p className="text-xs text-muted leading-relaxed m-0">
              Mọi lỗi dịch sai sẽ tự động lưu vào Mistake Memory để nhắc nhở và
              ôn tập lại theo chu kỳ Spaced Repetition.
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="mb-20 grid gap-8">
        <div className="text-center max-w-150 mx-auto">
          <Badge className="mb-3">Tình huống áp dụng</Badge>
          <h2 className="text-2xl md:text-3xl lg:text-[36px] font-bold mb-2 text-text">
            Được thiết kế chuyên biệt cho từng nhu cầu
          </h2>
          <p className="text-sm md:text-base text-muted leading-relaxed">
            Lựa chọn chế độ phân tích phù hợp với công việc và học tập của bạn.
          </p>
        </div>

        <LandingTabs />
      </section>

      <MistakeMemorySection />

      <ComparisonSection />

      <GrammarDemoSection />

      {/* Footer / CTA Section */}
      <footer className="flex flex-col gap-4 text-center mt-20 border-t border-border pt-10">
        <h2 className="text-[28px] font-extrabold m-0 text-text">
          Thử với một đoạn tiếng Anh bạn đang đọc hôm nay.
        </h2>
        <p className="text-sm leading-relaxed max-w-125 mx-auto m-0 text-muted">
          Email, tài liệu API, Slack message, GitHub issue, paper — đoạn nào
          cũng được.
        </p>
        <div>
          <Button
            variant="default"
            size="lg"
            asChild
            className="hover:-translate-y-px min-w-50"
          >
            <Link href="/register">Dùng thử miễn phí</Link>
          </Button>
        </div>
        <p className="text-muted text-xs mt-3">
          © 2026 English Context Coach · Vietnamese-native Learning System.
        </p>
      </footer>
    </div>
  );
}
