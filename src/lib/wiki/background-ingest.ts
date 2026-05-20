import { ingestSource } from "@/lib/wiki/ingest";
import { ensureWikiStructure } from "@/lib/wiki/wiki-store";
import { getSettings } from "@/lib/storage/settings-store";
import path from "path";

export async function processWikiIngest(
  projectId: string,
  filename: string,
  knowledgeDir: string,
  chatId?: string
): Promise<void> {
  const settings = await getSettings();
  await ensureWikiStructure(projectId);

  const filePath = path.join(knowledgeDir, filename);

  console.log(`[Wiki] Starting background ingest for ${filename} in project ${projectId}`);

  const result = await ingestSource(projectId, filePath, filename, settings);

  console.log(`[Wiki] Background ingest complete for ${filename}:`, {
    created: result.createdPages.length,
    updated: result.updatedPages.length,
    errors: result.errors.length,
  });

  if (result.errors.length > 0) {
    console.error(`[Wiki] Ingest errors for ${filename}:`, result.errors);
  }

  if (chatId && (result.createdPages.length > 0 || result.updatedPages.length > 0)) {
    notifyChatAsync(chatId, filename, result.createdPages, result.updatedPages);
  }
}

async function notifyChatAsync(
  chatId: string,
  filename: string,
  created: string[],
  updated: string[]
): Promise<void> {
  try {
    const { getChat, saveChat } = await import("@/lib/storage/chat-store");
    const chat = await getChat(chatId);
    if (!chat) return;

    const systemMessage = {
      id: crypto.randomUUID(),
      role: "system" as const,
      content: `[Wiki] Processed **${filename}**: created ${created.length} page(s) (${created.join(", ") || "none"}), updated ${updated.length} page(s) (${updated.join(", ") || "none"}). Use smart_search to query.`,
      createdAt: new Date().toISOString(),
    };

    chat.messages.push(systemMessage);
    await saveChat(chat);
  } catch {
    // notification is non-critical
  }
}
