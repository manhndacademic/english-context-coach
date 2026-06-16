import nodemailer from "nodemailer";
import { getLogger } from "@/lib/logger";

const log = getLogger("c.c.email.sendDigestEmail");

export interface DigestEmailItem {
  phrase: string;
  meaningVi: string;
}

export interface DigestEmailPayload {
  to: string;
  userName: string | null;
  dueCount: number;
  items: DigestEmailItem[]; // up to 5 items to preview
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml(payload: DigestEmailPayload): string {
  const { userName, dueCount, items } = payload;
  const greeting = userName
    ? `Xin chào ${escapeHtml(userName)}! 👋`
    : "Xin chào! 👋";
  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-family:Georgia,serif;font-weight:700;font-size:16px;color:#065f46;">${escapeHtml(item.phrase)}</div>
            <div style="font-size:14px;color:#6b7280;margin-top:3px;">${escapeHtml(item.meaningVi)}</div>
          </td>
        </tr>`
    )
    .join("");

  const moreText =
    dueCount > items.length
      ? `<p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">...và ${dueCount - items.length} từ/cụm khác</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ôn tập hôm nay</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#065f46);padding:32px 36px;">
              <div style="font-size:28px;margin-bottom:6px;">📚</div>
              <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;line-height:1.3;">
                Bạn có <strong>${dueCount}</strong> từ/cụm cần ôn hôm nay
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">
                ${greeting} Đây là danh sách ôn tập của bạn.
              </p>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:24px 36px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemsHtml}
              </table>
              ${moreText}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:24px 36px 32px;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/review"
                 style="display:inline-block;background:#059669;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:0.01em;">
                Ôn tập ngay →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Bạn nhận được email này vì đã bật nhắc nhở ôn tập trong
                <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/settings"
                   style="color:#059669;text-decoration:none;">Cài đặt</a>.
                Để tắt, vào Cài đặt → Thông báo → Tắt nhắc nhở ôn tập.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(payload: DigestEmailPayload): string {
  const { userName, dueCount, items } = payload;
  const greeting = userName ? `Xin chào ${userName}!` : "Xin chào!";
  const itemLines = items
    .map((item) => `• ${item.phrase} — ${item.meaningVi}`)
    .join("\n");
  const moreText =
    dueCount > items.length
      ? `\n...và ${dueCount - items.length} từ/cụm khác`
      : "";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  return `${greeting}

Bạn có ${dueCount} từ/cụm cần ôn hôm nay:

${itemLines}${moreText}

Ôn tập ngay: ${baseUrl}/review

---
Để tắt nhắc nhở, vào Cài đặt: ${baseUrl}/settings
`;
}

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!_transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      throw new Error(
        "GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required for email digest."
      );
    }

    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return _transporter;
}

export async function sendDigestEmail(
  payload: DigestEmailPayload
): Promise<void> {
  const transporter = getTransporter();

  const subject = `📚 Ôn tập hôm nay: ${payload.dueCount} từ/cụm đang chờ bạn`;

  await transporter.sendMail({
    from: `"English Context Coach" <${process.env.GMAIL_USER}>`,
    to: payload.to,
    subject,
    text: buildText(payload),
    html: buildHtml(payload),
  });

  log.info(
    `[sendDigestEmail] Sent digest to ${payload.to} (${payload.dueCount} items)`
  );
}
