import { ingestSource } from "@/lib/wiki/ingest";
import { ensureWikiStructure } from "@/lib/wiki/wiki-store";
import { getSettings } from "@/lib/storage/settings-store";
import path from "path";

export async function processWikiIngest(
  projectId: string,
  filename: string,
  knowledgeDir: string
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
}
