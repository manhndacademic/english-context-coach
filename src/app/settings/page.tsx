import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { saveUserApiKeyAction } from "@/app/actions/settings";
import { KeyRound, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";

export default async function SettingsPage() {
  const user = await requireUser();
  const hasCustomKey = !!user.customGeminiApiKey;

  return (
    <>
      <AppHeader email={user.email} isAdmin={user.role === "admin"} />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6">
        <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-md grid gap-6">
          <div className="flex items-start gap-4 flex-col sm:flex-row border-b border-border pb-5">
            <div className="bg-accent-light text-accent p-3 rounded-md shrink-0">
              <KeyRound size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif mb-1.5 text-text m-0">
                Cấu hình API Key cá nhân
              </h1>
              <p className="text-muted text-sm leading-relaxed m-0">
                Nhập API Key của riêng bạn từ Google AI Studio để tránh giới hạn
                lượt dùng chung của hệ thống.
              </p>
            </div>
          </div>

          <form action={saveUserApiKeyAction} className="grid gap-5">
            <div className="grid gap-2">
              <label
                htmlFor="apiKey"
                className="text-sm font-semibold text-text"
              >
                Google Gemini API Key
              </label>
              <input
                type="password"
                id="apiKey"
                name="apiKey"
                placeholder={
                  hasCustomKey
                    ? "••••••••••••••••••••••••••••••••"
                    : "Nhập API Key của bạn (AIzaSy...)"
                }
                className="w-full min-h-11 px-3.5 rounded-md border border-border bg-background text-text text-sm transition-all focus:border-accent focus:outline-none"
              />
              {hasCustomKey ? (
                <span className="text-success text-xs flex items-center gap-1.5 font-medium mt-1">
                  <ShieldCheck size={14} /> Bạn đã cấu hình API Key cá nhân.
                  Nhập key mới để thay đổi hoặc bỏ trống và lưu để xóa key.
                </span>
              ) : (
                <span className="text-muted text-xs flex items-center gap-1.5 mt-1">
                  <AlertCircle size={14} /> Bạn có thể lấy API Key miễn phí từ{" "}
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline font-semibold"
                  >
                    Google AI Studio
                  </a>
                  .
                </span>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-transparent px-6 font-semibold text-sm transition-all shadow-sm bg-accent text-white hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(5,150,105,0.15)] cursor-pointer"
              >
                Lưu cấu hình
              </button>
            </div>
          </form>
        </section>

        <section className="bg-surface border border-border rounded-lg p-5 sm:p-8 shadow-sm grid gap-4">
          <h2 className="text-lg font-bold text-text flex items-center gap-2 m-0">
            <Sparkles size={18} className="text-accent" /> Tại sao nên dùng API
            Key cá nhân?
          </h2>
          <ul className="text-muted text-sm leading-relaxed grid gap-2 m-0 pl-5">
            <li>
              <strong>Không lo quá tải</strong>: API Key chung của hệ thống có
              giới hạn số lượng request mỗi phút (Rate Limit). Dùng key riêng
              giúp bạn chạy mượt mà bất cứ lúc nào.
            </li>
            <li>
              <strong>Bảo mật tối đa</strong>: API Key của bạn sẽ được mã hóa an
              toàn bằng thuật toán đối xứng <code>AES-256-GCM</code> trước khi
              lưu vào cơ sở dữ liệu và chỉ được giải mã tạm thời khi gửi request
              đến Google.
            </li>
            <li>
              <strong>Hoàn toàn miễn phí</strong>: Google AI Studio cung cấp gói
              Free Tier với giới hạn khá lớn cho việc học tập cá nhân.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
