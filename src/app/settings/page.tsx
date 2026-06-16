import { requireUser } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";
import { getUsageStatsAction } from "@/app/actions/settings";
import { ApiKeyForm } from "@/components/settings/api-key-form";
import { UsageDashboard } from "@/components/settings/usage-dashboard";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { Sparkles } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function SettingsPage() {
  const user = await requireUser();
  const hasCustomKey = !!user.customGeminiApiKey;

  // Fetch initial usage stats on the server
  const initialStats = await getUsageStatsAction("7days");

  // Fetch notification preferences
  const [notifPrefs] = await db
    .select({
      emailDigestEnabled: users.emailDigestEnabled,
      emailDigestHour: users.emailDigestHour,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return (
    <>
      <AppHeader email={user.email} isAdmin={user.role === "admin"} />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-6 pb-10 flex flex-col gap-6">
        <ApiKeyForm initialHasCustomKey={hasCustomKey} />

        <NotificationSettingsForm
          initialEnabled={notifPrefs?.emailDigestEnabled ?? false}
          initialHour={notifPrefs?.emailDigestHour ?? 7}
        />

        <UsageDashboard initialStats={initialStats} />

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
