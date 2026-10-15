import {
  formatTelegramReply,
  extractCodeFilesForTelegram,
} from "@/lib/utils/telegram-format";

const TELEGRAM_TEXT_LIMIT = 4096;

/**
 * Sends a native file document to Telegram chat using FormData.
 */
export async function sendTelegramDocument(
  botToken: string,
  chatId: number | string,
  fileContent: string,
  filename: string,
  caption?: string,
  replyToMessageId?: number
): Promise<void> {
  const formData = new FormData();
  formData.append("chat_id", String(chatId));
  const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
  formData.append("document", blob, filename);
  if (caption) {
    formData.append("caption", caption.slice(0, 1024));
  }
  if (typeof replyToMessageId === "number") {
    formData.append("reply_to_message_id", String(replyToMessageId));
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; description?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    console.error(
      `Telegram sendDocument failed (${response.status}): ${payload?.description ?? "unknown error"}`
    );
  }
}

/**
 * Sends a formatted text message to Telegram with fallback to plain text on HTML parse errors.
 */
export async function sendTelegramTextMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyToMessageId?: number
): Promise<void> {
  const value = text.trim();
  if (!value) {
    return;
  }

  const html = formatTelegramReply(value);
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: html || (value.length <= TELEGRAM_TEXT_LIMIT ? value : `${value.slice(0, TELEGRAM_TEXT_LIMIT - 1)}…`),
  };
  if (html) {
    body.parse_mode = "HTML";
  }
  if (typeof replyToMessageId === "number") {
    body.reply_to_message_id = replyToMessageId;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; description?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    const errMsg = `Telegram sendMessage failed (${response.status})${payload?.description ? `: ${payload.description}` : ""}`;
    if (payload?.description?.includes("can't parse entities")) {
      console.warn("Telegram HTML parse error, retrying as plain text:", payload.description);
      const plainText = value.length <= TELEGRAM_TEXT_LIMIT ? value : `${value.slice(0, TELEGRAM_TEXT_LIMIT - 1)}…`;
      const fallbackBody: Record<string, unknown> = {
        chat_id: chatId,
        text: plainText,
      };
      if (typeof replyToMessageId === "number") {
        fallbackBody.reply_to_message_id = replyToMessageId;
      }
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fallbackBody),
      });
      return;
    }
    throw new Error(errMsg);
  }
}

/**
 * Sends agent response to Telegram:
 * 1. Automatically extracts large code blocks into ready-to-run files.
 * 2. Delivers code as native attached files so nothing is cut off or truncated.
 * 3. Delivers accompanying formatted message with explanations.
 */
export async function sendTelegramReplyWithFiles(
  botToken: string,
  chatId: number | string,
  text: string,
  replyToMessageId?: number
): Promise<void> {
  const { files, cleanedMarkdown } = extractCodeFilesForTelegram(text);

  // Send main formatted message
  await sendTelegramTextMessage(botToken, chatId, cleanedMarkdown || text, replyToMessageId);

  // Send attached ready-to-use files
  for (const file of files) {
    try {
      await sendTelegramDocument(
        botToken,
        chatId,
        file.content,
        file.filename,
        `📄 ${file.filename}`,
        replyToMessageId
      );
    } catch (docError) {
      console.error(`Failed to send Telegram file ${file.filename}:`, docError);
    }
  }
}
