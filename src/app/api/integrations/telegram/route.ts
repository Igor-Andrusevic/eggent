import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import {
  ExternalMessageError,
  handleExternalMessage,
} from "@/lib/external/handle-external-message";
import {
  createDefaultTelegramSessionId,
  createFreshTelegramSessionId,
  getTelegramChatSessionId,
  setTelegramChatSessionId,
} from "@/lib/storage/telegram-session-store";
import {
  claimTelegramUpdate,
  releaseTelegramUpdate,
} from "@/lib/storage/telegram-update-store";
import {
  consumeTelegramAccessCode,
  getTelegramIntegrationRuntimeConfig,
  normalizeTelegramUserId,
} from "@/lib/storage/telegram-integration-store";
import { importKnowledgeFile } from "@/lib/memory/knowledge";
import { getSettings } from "@/lib/storage/settings-store";
import { saveChatFile } from "@/lib/storage/chat-files-store";
import { createChat, getChat } from "@/lib/storage/chat-store";
import {
  contextKey,
  type ExternalSession,
  getOrCreateExternalSession,
  saveExternalSession,
} from "@/lib/storage/external-session-store";
import { getAllProjects } from "@/lib/storage/project-store";
import {
  canUserAccessProject,
  getAccessibleProjects,
  getFirstAccessibleProject,
  ensureUserHasProjectAccess,
} from "@/lib/storage/project-access-store";
import {
  getUserPreferences,
  getOrCreateUserPreferences,
  saveUserPreferences,
  updateUserTimezone,
  updateUserLocale,
  markTimezoneAsked,
  type UserPreferences,
} from "@/lib/storage/user-preferences-store";
import {
  guessTimezoneFromLanguage,
  isValidTimezone,
  POPULAR_TIMEZONES,
} from "@/lib/utils/language-timezone-map";

const TELEGRAM_TEXT_LIMIT = 4096;
const TELEGRAM_FILE_MAX_BYTES = 30 * 1024 * 1024;
const RESERVED_COMMANDS = new Set(["/start", "/help", "/new", "/timezone", "/code"]);

const PROJECT_ALIASES: Record<string, string> = {
  "/family": "Семья",
  "/work": "Работа",
  "/monitoring": "Сервер - Мониторинг",
};

interface TelegramUpdate {
  update_id?: unknown;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramCallbackQuery {
  id?: unknown;
  from?: {
    id?: unknown;
    language_code?: unknown;
  };
  message?: {
    message_id?: unknown;
    chat?: {
      id?: unknown;
    };
  };
  data?: unknown;
}

interface TelegramMessage {
  message_id?: unknown;
  text?: unknown;
  caption?: unknown;
  from?: {
    id?: unknown;
    language_code?: unknown;
  };
  chat?: {
    id?: unknown;
    type?: unknown;
  };
  document?: {
    file_id?: unknown;
    file_name?: unknown;
    mime_type?: unknown;
  };
  photo?: Array<{
    file_id?: unknown;
    width?: unknown;
    height?: unknown;
  }>;
  audio?: {
    file_id?: unknown;
    file_name?: unknown;
    mime_type?: unknown;
  };
  video?: {
    file_id?: unknown;
    file_name?: unknown;
    mime_type?: unknown;
  };
  voice?: {
    file_id?: unknown;
    mime_type?: unknown;
  };
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  result?: Record<string, unknown>;
}

interface TelegramIncomingFile {
  fileId: string;
  fileName: string;
}

interface TelegramExternalChatContext {
  chatId: string;
  projectId?: string;
  currentPath: string;
}

function normalizeTelegramCurrentPath(rawPath: string | undefined): string {
  const value = (rawPath ?? "").trim();
  if (!value || value === "/telegram") {
    return "";
  }
  return value;
}

interface TelegramResolvedProjectContext {
  session: ExternalSession;
  resolvedProjectId?: string;
  projectName?: string;
}

function parseTelegramError(status: number, payload: TelegramApiResponse | null): string {
  const description = payload?.description?.trim();
  return description
    ? `Telegram API error (${status}): ${description}`
    : `Telegram API error (${status})`;
}

async function callTelegramApi(
  botToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramApiResponse> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as
    | TelegramApiResponse
    | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(parseTelegramError(response.status, payload));
  }
  return payload;
}

async function sendTelegramMessageWithInlineButtons(
  botToken: string,
  chatId: number,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>,
  replyToMessageId?: number
): Promise<void> {
  await callTelegramApi(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_to_message_id: replyToMessageId,
    reply_markup: {
      inline_keyboard: buttons,
    },
  });
}

async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await callTelegramApi(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text || "",
  });
}

async function sendTimezoneConfirmationMessage(
  botToken: string,
  chatId: number,
  timezoneGuess: { timezone: string; displayName: string; utcOffset: string }
): Promise<void> {
  const now = new Date();
  const localTime = now.toLocaleString("ru", {
    timeZone: timezoneGuess.timezone,
    dateStyle: "full",
    timeStyle: "short",
  });

  const text = `🌍 <b>Определение часового пояса</b>\n\n` +
    `По вашему языку предполагаю часовой пояс: <b>${timezoneGuess.displayName}</b> (${timezoneGuess.utcOffset})\n\n` +
    `Сейчас там: <b>${localTime}</b>\n\n` +
    `Это правильный часовой пояс?`;

  const buttons = [
    [
      { text: "✅ Да, верно", callback_data: `tz_confirm:${timezoneGuess.timezone}` },
    ],
    [
      { text: "🔄 Выбрать другой", callback_data: "tz_select_other" },
    ],
  ];

  await sendTelegramMessageWithInlineButtons(botToken, chatId, text, buttons);
}

async function sendTimezoneSelectionMessage(
  botToken: string,
  chatId: number
): Promise<void> {
  const text = `🌍 <b>Выберите часовой пояс:</b>\n\n` +
    `Или введите команду /timezone <часовой_пояс>\n` +
    `Например: /timezone Europe/Rome`;

  const buttons = POPULAR_TIMEZONES.slice(0, 12).map((tz) => [
    { text: `${tz.name} (${tz.offset})`, callback_data: `tz_select:${tz.id}` },
  ]);

  await sendTelegramMessageWithInlineButtons(botToken, chatId, text, buttons);
}

function safeTokenMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(actualBytes, expectedBytes);
}

function getBotId(botToken: string): string {
  const [rawBotId] = botToken.trim().split(":", 1);
  const botId = rawBotId?.trim() || "default";
  return botId.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 128) || "default";
}

function chatBelongsToProject(
  chatProjectId: string | undefined,
  projectId: string | undefined
): boolean {
  const left = chatProjectId ?? null;
  const right = projectId ?? null;
  return left === right;
}

async function ensureTelegramExternalChatContext(params: {
  sessionId: string;
  userId: string;
  defaultProjectId?: string;
}): Promise<TelegramExternalChatContext> {
  const { session, resolvedProjectId } = await resolveTelegramProjectContext({
    sessionId: params.sessionId,
    userId: params.userId,
    defaultProjectId: params.defaultProjectId,
  });
  const projectKey = contextKey(resolvedProjectId);
  let resolvedChatId = session.activeChats[projectKey];
  if (resolvedChatId) {
    const existing = await getChat(resolvedChatId);
    if (!existing || !chatBelongsToProject(existing.projectId, resolvedProjectId)) {
      resolvedChatId = "";
    }
  }

  if (!resolvedChatId) {
    resolvedChatId = crypto.randomUUID();
    await createChat(
      resolvedChatId,
      `External session ${session.id}`,
      resolvedProjectId
    );
  }

  session.activeChats[projectKey] = resolvedChatId;
  session.currentPaths[projectKey] = normalizeTelegramCurrentPath(
    session.currentPaths[projectKey]
  );
  session.updatedAt = new Date().toISOString();
  await saveExternalSession(session);

  return {
    chatId: resolvedChatId,
    projectId: resolvedProjectId,
    currentPath: session.currentPaths[projectKey] ?? "",
  };
}

async function resolveTelegramProjectContext(params: {
  sessionId: string;
  userId: string;
  defaultProjectId?: string;
}): Promise<TelegramResolvedProjectContext> {
  const session = await getOrCreateExternalSession(params.sessionId);
  const allProjects = await getAllProjects();
  const accessibleProjects = await getAccessibleProjects(allProjects, params.userId);
  const projectById = new Map(accessibleProjects.map((project) => [project.id, project]));

  let resolvedProjectId: string | undefined;
  const explicitProjectId = params.defaultProjectId?.trim() || "";

  if (explicitProjectId) {
    // Check if user has access to the explicitly requested project
    const hasAccess = await canUserAccessProject(params.userId, explicitProjectId);
    if (!hasAccess) {
      const firstAccessible = await getFirstAccessibleProject(allProjects, params.userId);
      if (!firstAccessible) {
        throw new Error("Нет доступных проектов");
      }
      resolvedProjectId = firstAccessible.id;
      session.activeProjectId = firstAccessible.id;
    } else {
      resolvedProjectId = explicitProjectId;
      session.activeProjectId = explicitProjectId;
    }
  } else if (session.activeProjectId) {
    // Check if user still has access to the active project
    const hasAccess = await canUserAccessProject(params.userId, session.activeProjectId);
    if (hasAccess && projectById.has(session.activeProjectId)) {
      resolvedProjectId = session.activeProjectId;
    } else if (accessibleProjects.length > 0) {
      // Active project not accessible, switch to first accessible
      resolvedProjectId = accessibleProjects[0].id;
      session.activeProjectId = accessibleProjects[0].id;
    } else {
      session.activeProjectId = null;
    }
  } else if (accessibleProjects.length > 0) {
    resolvedProjectId = accessibleProjects[0].id;
    session.activeProjectId = accessibleProjects[0].id;
  } else {
    session.activeProjectId = null;
  }

  return {
    session,
    resolvedProjectId,
    projectName: resolvedProjectId ? projectById.get(resolvedProjectId)?.name : undefined,
  };
}

function extensionFromMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes("pdf")) return ".pdf";
  if (lower.includes("png")) return ".png";
  if (lower.includes("jpeg") || lower.includes("jpg")) return ".jpg";
  if (lower.includes("webp")) return ".webp";
  if (lower.includes("gif")) return ".gif";
  if (lower.includes("mp4")) return ".mp4";
  if (lower.includes("mpeg") || lower.includes("mp3")) return ".mp3";
  if (lower.includes("ogg")) return ".ogg";
  if (lower.includes("wav")) return ".wav";
  if (lower.includes("plain")) return ".txt";
  return "";
}

function buildIncomingFileName(params: {
  base: string;
  messageId?: number;
  mimeType?: string;
}): string {
  const suffix = params.messageId ?? Date.now();
  const ext = params.mimeType ? extensionFromMime(params.mimeType) : "";
  return `${params.base}-${suffix}${ext}`;
}

function sanitizeFileName(value: string): string {
  const base = value.trim().replace(/[\\/]+/g, "_");
  return base || `file-${Date.now()}`;
}

function withMessageIdPrefix(fileName: string, messageId?: number): string {
  if (typeof messageId !== "number") return fileName;
  return `${messageId}-${fileName}`;
}

function extractIncomingFile(
  message: TelegramMessage,
  messageId?: number
): TelegramIncomingFile | null {
  const documentFileId =
    typeof message.document?.file_id === "string"
      ? message.document.file_id.trim()
      : "";
  if (documentFileId) {
    const docNameRaw =
      typeof message.document?.file_name === "string"
        ? message.document.file_name
        : "";
    const fallback = buildIncomingFileName({
      base: "document",
      messageId,
      mimeType:
        typeof message.document?.mime_type === "string"
          ? message.document.mime_type
          : undefined,
    });
    return {
      fileId: documentFileId,
      fileName: withMessageIdPrefix(sanitizeFileName(docNameRaw || fallback), messageId),
    };
  }

  const photos: Array<{ file_id?: unknown }> = Array.isArray(message.photo)
    ? message.photo
    : [];
  for (let i = photos.length - 1; i >= 0; i -= 1) {
    const photo = photos[i];
    const fileId = typeof photo?.file_id === "string" ? photo.file_id.trim() : "";
    if (fileId) {
      return {
        fileId,
        fileName: sanitizeFileName(
          buildIncomingFileName({ base: "photo", messageId, mimeType: "image/jpeg" })
        ),
      };
    }
  }

  const audioFileId =
    typeof message.audio?.file_id === "string" ? message.audio.file_id.trim() : "";
  if (audioFileId) {
    const audioNameRaw =
      typeof message.audio?.file_name === "string" ? message.audio.file_name : "";
    const fallback = buildIncomingFileName({
      base: "audio",
      messageId,
      mimeType:
        typeof message.audio?.mime_type === "string"
          ? message.audio.mime_type
          : undefined,
    });
    return {
      fileId: audioFileId,
      fileName: withMessageIdPrefix(sanitizeFileName(audioNameRaw || fallback), messageId),
    };
  }

  const videoFileId =
    typeof message.video?.file_id === "string" ? message.video.file_id.trim() : "";
  if (videoFileId) {
    const videoNameRaw =
      typeof message.video?.file_name === "string" ? message.video.file_name : "";
    const fallback = buildIncomingFileName({
      base: "video",
      messageId,
      mimeType:
        typeof message.video?.mime_type === "string"
          ? message.video.mime_type
          : undefined,
    });
    return {
      fileId: videoFileId,
      fileName: withMessageIdPrefix(sanitizeFileName(videoNameRaw || fallback), messageId),
    };
  }

  const voiceFileId =
    typeof message.voice?.file_id === "string" ? message.voice.file_id.trim() : "";
  if (voiceFileId) {
    return {
      fileId: voiceFileId,
      fileName: sanitizeFileName(
        buildIncomingFileName({
          base: "voice",
          messageId,
          mimeType:
            typeof message.voice?.mime_type === "string"
              ? message.voice.mime_type
              : undefined,
        })
      ),
    };
  }

  return null;
}

async function downloadTelegramFile(botToken: string, fileId: string): Promise<Buffer> {
  const payload = await callTelegramApi(botToken, "getFile", {
    file_id: fileId,
  });
  const result = payload.result ?? {};
  const filePath = typeof result.file_path === "string" ? result.file_path : "";
  if (!filePath) {
    throw new Error("Telegram getFile returned empty file_path");
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Telegram file (${response.status})`);
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > TELEGRAM_FILE_MAX_BYTES) {
    throw new Error(
      `Telegram file is too large (${bytes.byteLength} bytes). Max supported size is ${TELEGRAM_FILE_MAX_BYTES} bytes.`
    );
  }
  return Buffer.from(bytes);
}

function extractCommand(text: string): string | null {
  const first = text.trim().split(/\s+/, 1)[0];
  if (!first || !first.startsWith("/")) return null;
  return first.split("@", 1)[0].toLowerCase();
}

function extractAccessCodeCandidate(text: string): string | null {
  const value = text.trim();
  if (!value) return null;

  const fromCommand = value.match(
    /^\/(?:code|start)(?:@[a-zA-Z0-9_]+)?\s+([A-Za-z0-9_-]{6,64})$/i
  );
  if (fromCommand?.[1]) {
    return fromCommand[1];
  }

  if (/^[A-Za-z0-9_-]{6,64}$/.test(value)) {
    return value;
  }
  return null;
}

function normalizeOutgoingText(text: string): string {
  const value = text.trim();
  if (!value) return "Пустой ответ от агента.";
  if (value.length <= TELEGRAM_TEXT_LIMIT) return value;
  return `${value.slice(0, TELEGRAM_TEXT_LIMIT - 1)}…`;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  replyToMessageId?: number
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: normalizeOutgoingText(text),
      ...(typeof replyToMessageId === "number" ? { reply_to_message_id: replyToMessageId } : {}),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; description?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(
      `Telegram sendMessage failed (${response.status})${payload?.description ? `: ${payload.description}` : ""}`
    );
  }
}

async function sendTelegramChatAction(
  botToken: string,
  chatId: number | string,
  action: "typing" | "upload_photo" | "record_video" | "upload_video" | "record_audio" | "upload_audio" | "upload_document" = "typing"
): Promise<void> {
  try {
    await callTelegramApi(botToken, "sendChatAction", {
      chat_id: chatId,
      action: action,
    });
  } catch (error) {
    // Silently ignore chat action errors - they're not critical
    console.debug("Failed to send chat action:", error);
  }
}

function helpText(activeProject?: { id?: string; name?: string }, userTimezone?: string): string {
  const activeProjectLine = activeProject?.id
    ? `Active project: ${activeProject.name ? `${activeProject.name} (${activeProject.id})` : activeProject.id}`
    : "Active project: not selected";
  const timezoneLine = userTimezone 
    ? `Your timezone: ${userTimezone}`
    : "Your timezone: not set (server time will be used)";
  return [
    "Telegram connection is active.",
    activeProjectLine,
    timezoneLine,
    "",
    "Commands:",
    "/start - show this help",
    "/help - show this help",
    "/code <access_code> - activate access for your Telegram user",
    "/timezone <timezone> - set your timezone (e.g., /timezone Europe/Riga)",
    "/new - start a new conversation (reset context)",
    "/family - switch to project: Семья",
    "/work - switch to project: Работа",
    "/monitoring - switch to project: Сервер - Мониторинг",
    "",
    "Text messages are sent to the agent.",
    "File uploads are saved into chat files.",
    "You can also ask the agent to send a local file back to Telegram.",
  ].join("\n");
}

export const maxDuration = 300;

export async function GET() {
  return Response.json({
    status: "ok",
    integration: "telegram",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const runtime = await getTelegramIntegrationRuntimeConfig();
  const botToken = runtime.botToken.trim();
  const webhookSecret = runtime.webhookSecret.trim();
  const defaultProjectId = runtime.defaultProjectId || undefined;
  const allowedUserIds = new Set(runtime.allowedUserIds);

  if (!botToken || !webhookSecret) {
    return Response.json(
      {
        error:
          "Telegram integration is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET.",
      },
      { status: 503 }
    );
  }

  const providedSecret = req.headers.get("x-telegram-bot-api-secret-token")?.trim();
  if (!providedSecret || !safeTokenMatch(providedSecret, webhookSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let botIdForRollback: string | null = null;
  let updateIdForRollback: number | null = null;

  try {
    const body = (await req.json()) as TelegramUpdate;
    const updateId =
      typeof body.update_id === "number" && Number.isInteger(body.update_id)
        ? body.update_id
        : null;
    if (updateId === null) {
      return Response.json({ error: "Invalid update_id" }, { status: 400 });
    }

    const botId = getBotId(botToken);
    botIdForRollback = botId;
    updateIdForRollback = updateId;
    const isNewUpdate = await claimTelegramUpdate(botId, updateId);
    if (!isNewUpdate) {
      return Response.json({ ok: true, duplicate: true });
    }

    // Handle callback_query (inline button clicks)
    const callbackQuery = body.callback_query;
    if (callbackQuery) {
      const callbackQueryId = typeof callbackQuery.id === "string" ? callbackQuery.id : String(callbackQuery.id ?? "");
      const callbackData = typeof callbackQuery.data === "string" ? callbackQuery.data : "";
      const callbackChatId = typeof callbackQuery.message?.chat?.id === "number" 
        ? callbackQuery.message.chat.id 
        : null;
      const callbackUserId = normalizeTelegramUserId(callbackQuery?.from?.id);

      if (!callbackUserId || !callbackChatId) {
        await answerCallbackQuery(botToken, callbackQueryId, "Error: invalid user or chat");
        return Response.json({ ok: true, callback: true, error: "invalid_callback" });
      }

      try {
        if (callbackData.startsWith("tz_confirm:")) {
          const timezone = callbackData.slice("tz_confirm:".length);
          if (isValidTimezone(timezone)) {
            await updateUserTimezone(callbackUserId, timezone, "confirmed");
            
            const sessionId = await getTelegramChatSessionId(botId, callbackChatId);
            if (sessionId) {
              const session = await getOrCreateExternalSession(sessionId);
              session.userTimezone = timezone;
              session.userId = callbackUserId;
              await saveExternalSession(session);
            }

            const now = new Date();
            const localTime = now.toLocaleString("ru", {
              timeZone: timezone,
              dateStyle: "full",
              timeStyle: "short",
            });

            await answerCallbackQuery(botToken, callbackQueryId, "✅ Часовой пояс сохранён!");
            await sendTelegramMessage(
              botToken,
              callbackChatId,
              `✅ <b>Часовой пояс установлен: ${timezone}</b>\n\nВаше местное время: ${localTime}`
            );
            return Response.json({ ok: true, callback: true, action: "tz_confirmed" });
          } else {
            await answerCallbackQuery(botToken, callbackQueryId, "❌ Неверный часовой пояс");
            return Response.json({ ok: true, callback: true, error: "invalid_timezone" });
          }
        }

        if (callbackData === "tz_select_other") {
          await answerCallbackQuery(botToken, callbackQueryId);
          await sendTimezoneSelectionMessage(botToken, callbackChatId);
          return Response.json({ ok: true, callback: true, action: "tz_select_other" });
        }

        if (callbackData.startsWith("tz_select:")) {
          const timezone = callbackData.slice("tz_select:".length);
          if (isValidTimezone(timezone)) {
            await updateUserTimezone(callbackUserId, timezone, "confirmed");
            
            const sessionId = await getTelegramChatSessionId(botId, callbackChatId);
            if (sessionId) {
              const session = await getOrCreateExternalSession(sessionId);
              session.userTimezone = timezone;
              session.userId = callbackUserId;
              await saveExternalSession(session);
            }

            const now = new Date();
            const localTime = now.toLocaleString("ru", {
              timeZone: timezone,
              dateStyle: "full",
              timeStyle: "short",
            });

            await answerCallbackQuery(botToken, callbackQueryId, "✅ Часовой пояс сохранён!");
            await sendTelegramMessage(
              botToken,
              callbackChatId,
              `✅ <b>Часовой пояс установлен: ${timezone}</b>\n\nВаше местное время: ${localTime}`
            );
            return Response.json({ ok: true, callback: true, action: "tz_selected" });
          }
        }

        await answerCallbackQuery(botToken, callbackQueryId, "Неизвестное действие");
        return Response.json({ ok: true, callback: true, error: "unknown_callback" });
      } catch (error) {
        console.error("Callback query handling error:", error);
        await answerCallbackQuery(botToken, callbackQueryId, "Произошла ошибка");
        return Response.json({ ok: true, callback: true, error: "callback_error" });
      }
    }

    const message = body.message;
    const chatId =
      typeof message?.chat?.id === "number" || typeof message?.chat?.id === "string"
        ? message.chat.id
        : null;
    const chatType = typeof message?.chat?.type === "string" ? message.chat.type : "";
    const messageId =
      typeof message?.message_id === "number" ? message.message_id : undefined;

    if (chatId === null || !chatType) {
      return Response.json({ ok: true, ignored: true, reason: "unsupported_update" });
    }

    if (chatType !== "private") {
      return Response.json({ ok: true, ignored: true, reason: "private_only" });
    }

    const text = typeof message?.text === "string" ? message.text.trim() : "";
    const caption =
      typeof message?.caption === "string" ? message.caption.trim() : "";
    const incomingText = text || caption;
    const fromUserId = normalizeTelegramUserId(message?.from?.id);
    const userLanguageCode = typeof message?.from?.language_code === "string" 
      ? message.from.language_code 
      : undefined;

    if (!fromUserId) {
      return Response.json({
        ok: true,
        ignored: true,
        reason: "missing_user_id",
      });
    }

    if (!allowedUserIds.has(fromUserId)) {
      const accessCode = extractAccessCodeCandidate(text);
      const granted =
        accessCode &&
        (await consumeTelegramAccessCode({
          code: accessCode,
          userId: fromUserId,
        }));

      if (granted) {
        await sendTelegramMessage(
          botToken,
          chatId,
          "Доступ выдан. Теперь можно отправлять сообщения агенту.",
          messageId
        );
        return Response.json({
          ok: true,
          accessGranted: true,
          userId: fromUserId,
        });
      }

      await sendTelegramMessage(
        botToken,
        chatId,
        [
          "Доступ запрещён: ваш user_id не в списке разрешённых.",
          "Отправьте код активации командой /code <код> или /start <код>.",
          `Ваш user_id: ${fromUserId}`,
        ].join("\n"),
        messageId
      );
      return Response.json({
        ok: true,
        ignored: true,
        reason: "user_not_allowed",
        userId: fromUserId,
      });
    }

    // Ensure user has access to at least one project (auto-add to "Семья" if needed)
    const allProjects = await getAllProjects();
    await ensureUserHasProjectAccess(allProjects, fromUserId);

    let sessionId = await getTelegramChatSessionId(botId, chatId);
    if (!sessionId) {
      sessionId = createDefaultTelegramSessionId(botId, chatId);
      await setTelegramChatSessionId(botId, chatId, sessionId);
    }

    // Get or create user preferences and session
    const userPrefs = await getOrCreateUserPreferences(fromUserId);
    let session = await getOrCreateExternalSession(sessionId);
    
    // Link session to user
    if (session.userId !== fromUserId) {
      session.userId = fromUserId;
      session.updatedAt = new Date().toISOString();
      await saveExternalSession(session);
    }

    // Update locale from Telegram message
    if (userLanguageCode && userPrefs.userLocale !== userLanguageCode) {
      await updateUserLocale(fromUserId, userLanguageCode);
    }
    if (userLanguageCode && session.userLocale !== userLanguageCode) {
      session.userLocale = userLanguageCode;
      session.updatedAt = new Date().toISOString();
      await saveExternalSession(session);
    }

    // Copy timezone from user preferences to session if not set
    if (!session.userTimezone && userPrefs.userTimezone) {
      session.userTimezone = userPrefs.userTimezone;
      session.updatedAt = new Date().toISOString();
      await saveExternalSession(session);
    }

    // Check if we need to ask about timezone
    let shouldAskTimezone = false;
    if (
      !userPrefs.userTimezone &&
      userPrefs.timezoneDetected !== "confirmed" &&
      userPrefs.timezoneDetected !== "pending" &&
      userLanguageCode
    ) {
      const tzGuess = guessTimezoneFromLanguage(userLanguageCode);
      if (tzGuess && tzGuess.confidence === "high") {
        shouldAskTimezone = true;
      }
    }

    const command = extractCommand(text);
    if (command === "/start" || command === "/help") {
      const resolvedProject = await resolveTelegramProjectContext({
        sessionId,
        userId: fromUserId,
        defaultProjectId,
      });
      await saveExternalSession({
        ...resolvedProject.session,
        updatedAt: new Date().toISOString(),
      });
      await sendTelegramMessage(
        botToken,
        chatId,
        helpText(
          {
            id: resolvedProject.resolvedProjectId,
            name: resolvedProject.projectName,
          },
          resolvedProject.session.userTimezone
        ),
        messageId
      );
      return Response.json({ ok: true, command });
    }

    if (command === "/new") {
      const freshSessionId = createFreshTelegramSessionId(botId, chatId);
      await setTelegramChatSessionId(botId, chatId, freshSessionId);
      
      // Copy user preferences to new session
      const freshSession = await getOrCreateExternalSession(freshSessionId);
      freshSession.userId = fromUserId;
      if (userPrefs.userTimezone) {
        freshSession.userTimezone = userPrefs.userTimezone;
      }
      if (userPrefs.userLocale || userLanguageCode) {
        freshSession.userLocale = userPrefs.userLocale || userLanguageCode;
      }
      freshSession.updatedAt = new Date().toISOString();
      await saveExternalSession(freshSession);
      
      await sendTelegramMessage(
        botToken,
        chatId,
        "Начал новый диалог. Контекст очищен для следующего сообщения.",
        messageId
      );
      return Response.json({ ok: true, command });
    }

    if (command === "/timezone") {
      const timezoneArg = text.slice("/timezone".length).trim();
      if (!timezoneArg) {
        const currentSession = await getOrCreateExternalSession(sessionId);
        const prefs = await getUserPreferences(fromUserId);
        const effectiveTimezone = currentSession.userTimezone || prefs?.userTimezone || "not set (server time used)";
        await sendTelegramMessage(
          botToken,
          chatId,
          `Current timezone: ${effectiveTimezone}\n\nUsage: /timezone <timezone>\nExample: /timezone Europe/Riga\n\nCommon timezones:\n- Europe/Riga (Latvia)\n- Europe/Moscow (Moscow)\n- Europe/Rome (Italy)\n- Europe/London (London)\n- America/New_York (New York)\n- Asia/Tokyo (Tokyo)`,
          messageId
        );
        return Response.json({ ok: true, command });
      }
      
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezoneArg });
        
        // Save to both session and user preferences
        const currentSession = await getOrCreateExternalSession(sessionId);
        currentSession.userTimezone = timezoneArg;
        currentSession.updatedAt = new Date().toISOString();
        await saveExternalSession(currentSession);
        
        await updateUserTimezone(fromUserId, timezoneArg, "confirmed");
        
        const now = new Date();
        const localTime = now.toLocaleString("ru", { 
          timeZone: timezoneArg,
          dateStyle: "full",
          timeStyle: "short"
        });
        
        await sendTelegramMessage(
          botToken,
          chatId,
          `✅ Часовой пояс установлен: ${timezoneArg}\n\nВаше местное время: ${localTime}`,
          messageId
        );
        return Response.json({ ok: true, command, timezone: timezoneArg });
      } catch {
        await sendTelegramMessage(
          botToken,
          chatId,
          `❌ Неверный часовой пояс: "${timezoneArg}"\n\nИспользуйте формат IANA.\nПример: /timezone Europe/Riga`,
          messageId
        );
        return Response.json({ ok: true, command, error: "invalid_timezone" });
      }
    }

    // Handle /<project_name> for quick project switching
    if (command && !RESERVED_COMMANDS.has(command)) {
      const aliasTarget = PROJECT_ALIASES[command];
      const projectNameArg = aliasTarget || text.slice(command.length).trim() || command.slice(1);
      if (projectNameArg) {
        const allProjects = await getAllProjects();
        const accessibleProjects = await getAccessibleProjects(allProjects, fromUserId);
        const nameQuery = projectNameArg.toLowerCase();

        let target = accessibleProjects.find(
          (p) => p.name.trim().toLowerCase() === nameQuery || p.id.trim().toLowerCase() === nameQuery
        );

        if (!target) {
          const partialMatches = accessibleProjects.filter(
            (p) => p.name.toLowerCase().includes(nameQuery) || p.id.toLowerCase().includes(nameQuery)
          );
          if (partialMatches.length === 1) {
            target = partialMatches[0];
          } else if (partialMatches.length > 1) {
            await sendTelegramMessage(
              botToken,
              chatId,
              `❌ Найдено несколько проектов:\n${partialMatches.map((p) => `• ${p.name} (${p.id})`).join("\n")}\n\nУточните имя.`,
              messageId
            );
            return Response.json({ ok: true, command, error: "ambiguous_project" });
          }
        }

        if (target) {
          const session = await getOrCreateExternalSession(sessionId);
          session.activeProjectId = target.id;
          session.updatedAt = new Date().toISOString();
          await saveExternalSession(session);

          await sendTelegramMessage(
            botToken,
            chatId,
            `✅ Переключился на проект: ${target.name} (${target.id})`,
            messageId
          );
          return Response.json({ ok: true, command, projectId: target.id });
        }

        if (accessibleProjects.length > 0) {
          await sendTelegramMessage(
            botToken,
            chatId,
            `❌ Проект "${projectNameArg}" не найден.\n\nДоступные проекты:\n${accessibleProjects.map((p) => `• ${p.name} (${p.id})`).join("\n")}`,
            messageId
          );
        } else {
          await sendTelegramMessage(
            botToken,
            chatId,
            `❌ Проект "${projectNameArg}" не найден. У вас нет доступных проектов.`,
            messageId
          );
        }
        return Response.json({ ok: true, command, error: "project_not_found" });
      }
    }

    // Ask about timezone if needed (only for non-command messages)
    if (shouldAskTimezone && !command && userLanguageCode) {
      const tzGuess = guessTimezoneFromLanguage(userLanguageCode);
      if (tzGuess) {
        await markTimezoneAsked(fromUserId);
        await sendTimezoneConfirmationMessage(botToken, chatId, tzGuess);
        // Continue processing the message, don't return
      }
    }

    let incomingSavedFile:
      | {
          name: string;
          path: string;
          size: number;
        }
      | null = null;

    const incomingFile = message ? extractIncomingFile(message, messageId) : null;
    let externalContext: TelegramExternalChatContext | null = null;
    if (incomingFile) {
      externalContext = await ensureTelegramExternalChatContext({
        sessionId,
        userId: fromUserId,
        defaultProjectId,
      });
      const fileBuffer = await downloadTelegramFile(botToken, incomingFile.fileId);
      const saved = await saveChatFile(
        externalContext.chatId,
        fileBuffer,
        incomingFile.fileName
      );

      // Automatically import file to project knowledge base
      try {
        const chat = await getChat(externalContext.chatId);
        if (chat && chat.projectId) {
          const projectDir = path.join(process.cwd(), "data", "projects", chat.projectId);
          const knowledgeDir = path.join(projectDir, ".meta", "knowledge");

          // Ensure knowledge directory exists
          await fs.mkdir(knowledgeDir, { recursive: true });

          // Copy file to knowledge directory
          const knowledgeFilePath = path.join(knowledgeDir, incomingFile.fileName);
          await fs.writeFile(knowledgeFilePath, fileBuffer);

          // Import into vector DB for semantic search
          const settings = await getSettings();
          const result = await importKnowledgeFile(knowledgeDir, chat.projectId, settings, incomingFile.fileName);

          console.log(`Telegram file ${incomingFile.fileName} imported to knowledge base:`, {
            imported: result.imported,
            skipped: result.skipped,
            errors: result.errors.length
          });
        }
      } catch (error) {
        console.error("Error importing Telegram file to knowledge base:", error);
        // Continue even if knowledge import fails - file is still saved
      }

      incomingSavedFile = {
        name: saved.name,
        path: saved.path,
        size: saved.size,
      };
    }

    // For voice messages, detect and let the agent handle it with knowledge_query
    const isVoiceMessage = incomingSavedFile?.name?.startsWith('voice-') && incomingSavedFile?.name?.endsWith('.ogg');

    if (!incomingText && !isVoiceMessage) {
      if (incomingSavedFile) {
        await sendTelegramMessage(
          botToken,
          chatId,
          `✅ Файл "${incomingSavedFile.name}" сохранён и импортирован в базу знаний!\n\nТеперь вы можете задавать вопросы по содержимому файла. Я буду искать релевантную информацию и отвечать на основе содержимого.`,
          messageId
        );
        return Response.json({
          ok: true,
          fileSaved: true,
          file: incomingSavedFile,
        });
      }

      await sendTelegramMessage(
        botToken,
        chatId,
        "Only text messages and file uploads are supported right now.",
        messageId
      );
      return Response.json({ ok: true, ignored: true, reason: "non_text" });
    }

    console.log(`[Telegram] About to process message, incomingText: "${incomingText}", isVoiceMessage: ${incomingSavedFile?.name?.startsWith('voice-')}, externalContext: ${!!externalContext}`);

    try {
      // Resolve project context for text messages if not already done for file upload
      let finalExternalContext = externalContext;
      if (!finalExternalContext) {
        console.log(`[Telegram] No externalContext, resolving project...`);
        const resolvedProject = await resolveTelegramProjectContext({
          sessionId,
          userId: fromUserId,
          defaultProjectId,
        });

        if (!resolvedProject.resolvedProjectId) {
          await sendTelegramMessage(
            botToken,
            chatId,
            "Нет доступных проектов. Обратитесь к администратору.",
            messageId
          );
          return Response.json({
            ok: true,
            ignored: true,
            reason: "no_accessible_projects",
          });
        }

        finalExternalContext = await ensureTelegramExternalChatContext({
          sessionId,
          userId: fromUserId,
          defaultProjectId,
        });
        console.log(`[Telegram] Resolved externalContext, projectId: ${finalExternalContext.projectId}`);
      }

      console.log(`[Telegram] finalExternalContext set, projectId: ${finalExternalContext.projectId}`);

      // Send initial "typing" status and set up periodic refresh
      await sendTelegramChatAction(botToken, chatId, "typing");
      console.log(`[Telegram] Sent typing action, about to call handleExternalMessage`);

      const typingInterval = setInterval(async () => {
        await sendTelegramChatAction(botToken, chatId, "typing");
      }, 4000); // Refresh every 4 seconds (Telegram typing indicator lasts ~5 seconds)

      try {
        // For voice messages, add special marker so agent knows to use knowledge_query
        const isVoiceMessage = incomingSavedFile?.name?.startsWith('voice-') && incomingSavedFile?.name?.endsWith('.ogg');
        let messageToSend = incomingText;
        if (incomingSavedFile) {
          if (isVoiceMessage) {
            messageToSend = `🎙️ ГОЛОСОВОЕ СООБЩЕНИЕ: ${incomingSavedFile.name}\n\n${incomingText}`.trim();
          } else {
            messageToSend = `${incomingText}\n\nAttached file: ${incomingSavedFile.name}`;
          }
        }

        // Get user's timezone and locale from session (with user preferences fallback)
        const currentSession = await getOrCreateExternalSession(sessionId);
        const currentUserPrefs = await getUserPreferences(fromUserId);
        const userTimezone = currentSession.userTimezone || currentUserPrefs?.userTimezone;
        const userLocale = currentSession.userLocale || currentUserPrefs?.userLocale || userLanguageCode;

        const result = await handleExternalMessage({
          sessionId,
          message: messageToSend,
          projectId: finalExternalContext.projectId,
          chatId: finalExternalContext.chatId,
          currentPath: normalizeTelegramCurrentPath(finalExternalContext.currentPath),
          runtimeData: {
            telegram: {
              botToken,
              chatId,
              replyToMessageId: messageId ?? null,
            },
            userTimezone,
            userLocale,
          },
        });

        clearInterval(typingInterval);
        // Don't reply to old message - just send the response
        await sendTelegramMessage(botToken, chatId, result.reply);
        return Response.json({ ok: true });
      } catch (error) {
        clearInterval(typingInterval);
        throw error;
      }
    } catch (error) {
      if (error instanceof ExternalMessageError) {
        const errorMessage =
          typeof error.payload.error === "string"
            ? error.payload.error
            : "Не удалось обработать сообщение.";
        await sendTelegramMessage(botToken, chatId, `Ошибка: ${errorMessage}`, messageId);
        return Response.json({ ok: true, handledError: true, status: error.status });
      }
      throw error;
    }
  } catch (error) {
    if (
      botIdForRollback &&
      typeof updateIdForRollback === "number" &&
      Number.isInteger(updateIdForRollback)
    ) {
      try {
        await releaseTelegramUpdate(botIdForRollback, updateIdForRollback);
      } catch (releaseError) {
        console.error("Telegram rollback error:", releaseError);
      }
    }

    console.error("Telegram webhook error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
