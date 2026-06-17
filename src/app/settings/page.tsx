import { requireUser } from "@/lib/auth/guards";
import { getUsageStatsAction } from "@/app/actions/settings";
import { ApiKeyForm } from "@/components/settings/api-key-form";
import { UsageDashboard } from "@/components/settings/usage-dashboard";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { Sparkles } from "lucide-react";
import { db } from "@/db";
import { userAiApiKeys, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageLayout } from "@/components/ui/page-layout";
import { SectionCard } from "@/components/ui/section-card";

export default async function SettingsPage() {
  const user = await requireUser();
  const legacyHasCustomKey = !!user.customGeminiApiKey;

  // Fetch initial usage stats on the server
  const initialStats = await getUsageStatsAction("7days");

  const apiKeys = await db
    .select({
      id: userAiApiKeys.id,
      name: userAiApiKeys.name,
      provider: userAiApiKeys.provider,
      status: userAiApiKeys.status,
      errorMessage: userAiApiKeys.errorMessage,
      lastUsedAt: userAiApiKeys.lastUsedAt,
      createdAt: userAiApiKeys.createdAt,
    })
    .from(userAiApiKeys)
    .where(eq(userAiApiKeys.userId, user.id));

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
    <PageLayout user={user}>
      <ApiKeyForm keys={apiKeys} legacyHasCustomKey={legacyHasCustomKey} />

      <NotificationSettingsForm
        initialEnabled={notifPrefs?.emailDigestEnabled ?? false}
        initialHour={notifPrefs?.emailDigestHour ?? 7}
      />

      <UsageDashboard initialStats={initialStats} />

      <SectionCard className="gap-4">
        <SectionCard.Header
          title="Tại sao nên dùng API Key cá nhân?"
          icon={<Sparkles size={18} className="text-accent" />}
          className="border-none pb-0 mb-0"
        />
        <SectionCard.Body>
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
        </SectionCard.Body>
      </SectionCard>
    </PageLayout>
  );
}
