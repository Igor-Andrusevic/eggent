import { getTelegramIntegrationRuntimeConfig } from "@/lib/storage/telegram-integration-store";

/**
 * Throttle admin alerts: minimum interval between messages to avoid spamming
 * when errors happen in quick succession.
 */
const THROTTLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastAlertTimestamp = 0;

/**
 * Send an alert message to the administrator Telegram chat.
 * Uses TELEGRAM_UPDATE_NOTIFICATIONS (or TELEGRAM_ADMIN_CHAT_ID) as the destination.
 * Non-blocking, fails gracefully without throwing.
 */
export async function notifyAdmin(message: string, options?: { force?: boolean }): Promise<void> {
  const now = Date.now();
  if (!options?.force && now - lastAlertTimestamp < THROTTLE_INTERVAL_MS) {
    return;
  }

  const adminChatId =
    process.env.TELEGRAM_UPDATE_NOTIFICATIONS ||
    process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!adminChatId || !adminChatId.trim()) {
    return;
  }

  try {
    const config = await getTelegramIntegrationRuntimeConfig();
    const botToken = config.botToken;
    if (!botToken) {
      return;
    }

    const timestamp = new Date().toISOString().replace("T", " ").replace(/\..+/, "");
    const formattedText = `⚠️ <b>[Eggent Alert]</b> <code>${timestamp}</code>\n\n${escapeHtml(message)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminChatId.trim(),
        text: formattedText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      lastAlertTimestamp = now;
    } else {
      console.warn(`[AdminNotify] Telegram API returned status ${res.status}`);
    }
  } catch (error) {
    console.warn("[AdminNotify] Failed to send admin alert:", error);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
