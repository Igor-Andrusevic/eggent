import fs from "fs/promises";
import path from "path";
import { insertMemory, searchMemory, deleteMemoryByMetadata, searchMemoryByFilename } from "@/lib/memory/memory";
import type { AppSettings } from "@/lib/types";
import { loadDocument } from "@/lib/memory/loaders";
import { RecursiveCharacterTextSplitter } from "@/lib/memory/text-splitter";
import { transcribeAudio, isAudioFile } from "@/lib/memory/audio-transcription";

/**
 * Supported file extensions (including audio for transcription)
 */
const SUPPORTED_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".csv", ".html",
  ".py", ".js", ".ts", ".xml", ".yaml", ".yml", ".log",
  ".pdf",
  ".docx", ".xlsx", ".xls",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
  // Audio files (will be transcribed)
  ".ogg", ".mp3", ".wav", ".m4a", ".mp4", ".mpeg", ".mpga",
  ".webm", ".amr", ".flac", ".wma"
]);

function createSplitterOptions(settings: AppSettings) {
  const rawChunkSize = Number(settings.memory.chunkSize);
  const chunkSize =
    Number.isFinite(rawChunkSize) && rawChunkSize > 0
      ? Math.round(rawChunkSize)
      : 400;

  return {
    chunkSize,
    // Keep overlap proportional to chunk size to preserve local context.
    chunkOverlap: Math.max(20, Math.floor(chunkSize * 0.2)),
    separators: ["\n\n", "\n", " ", ""] as string[],
  };
}

/**
 * Import a single knowledge file: remove its existing chunks, then load and insert new ones.
 * Use this on upload so we don't duplicate chunks when other files are added/removed.
 */
export async function importKnowledgeFile(
  knowledgeDir: string,
  memorySubdir: string,
  settings: AppSettings,
  filename: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const result = { imported: 0, skipped: 0, errors: [] as string[] };
  const ext = path.extname(filename).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    result.skipped++;
    return result;
  }

  try {
    await deleteMemoryByMetadata("filename", filename, memorySubdir);
  } catch {
    // ignore
  }

  const splitter = new RecursiveCharacterTextSplitter(createSplitterOptions(settings));
  const filePath = path.join(knowledgeDir, filename);

  try {
    let docText: string | null = null;
    let metadata: Record<string, unknown> = { filename };

    // Handle audio files - transcribe them first
    if (isAudioFile(filename)) {
      try {
        console.log(`[Knowledge] Transcribing audio file: ${filename}`);
        docText = await transcribeAudio(filePath, settings);
        metadata.audioTranscribed = true;
        metadata.originalFormat = ext;
        console.log(`[Knowledge] Transcription complete for ${filename}: ${docText.length} chars`);
        console.log(`[Knowledge] Transcription preview: "${docText.substring(0, 100)}..."`);
      } catch (transcribeError) {
        const errorMsg = transcribeError instanceof Error ? transcribeError.message : String(transcribeError);
        result.errors.push(
          `Failed to transcribe audio file ${filename}: ${errorMsg}`
        );
        // Try to treat as regular document as fallback
        const doc = await loadDocument(filePath);
        docText = doc?.text || null;
      }
    } else {
      // Regular document loading
      const doc = await loadDocument(filePath);
      docText = doc?.text || null;
    }

    if (!docText || !docText.trim()) {
      result.skipped++;
      return result;
    }

    const chunks = await splitter.splitText(docText);
    for (const chunk of chunks) {
      // Skip empty chunks to prevent embedding errors
      if (!chunk || !chunk.trim()) {
        console.log(`[Knowledge] Skipping empty chunk for ${filename}`);
        continue;
      }
      await insertMemory(
        chunk,
        "knowledge",
        memorySubdir,
        settings,
        metadata
      );
      result.imported++;
    }
  } catch (error) {
    result.errors.push(
      `Error processing ${filename}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

/**
 * Import all knowledge files from a directory into the vector DB.
 * For each file, existing chunks are removed first, then new chunks are inserted (no duplicates).
 */
export async function importKnowledge(
  knowledgeDir: string,
  memorySubdir: string,
  settings: AppSettings
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const result = { imported: 0, skipped: 0, errors: [] as string[] };
  const splitter = new RecursiveCharacterTextSplitter(createSplitterOptions(settings));

  try {
    try {
      await fs.access(knowledgeDir);
    } catch {
      return result;
    }

    const entries = await fs.readdir(knowledgeDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        result.skipped++;
        continue;
      }

      try {
        await deleteMemoryByMetadata("filename", entry.name, memorySubdir);
      } catch {
        // ignore
      }

      const filePath = path.join(knowledgeDir, entry.name);
      try {
        let docText: string | null = null;
        let metadata: Record<string, unknown> = { filename: entry.name };

        // Handle audio files - transcribe them first
        if (isAudioFile(entry.name)) {
          try {
            console.log(`[Knowledge] Transcribing audio file: ${entry.name}`);
            docText = await transcribeAudio(filePath, settings);
            metadata.audioTranscribed = true;
            metadata.originalFormat = ext;
            console.log(`[Knowledge] Transcription complete for ${entry.name}: ${docText.length} chars`);
            console.log(`[Knowledge] Transcription preview: "${docText.substring(0, 100)}..."`);
          } catch (transcribeError) {
            const errorMsg = transcribeError instanceof Error ? transcribeError.message : String(transcribeError);
            result.errors.push(
              `Failed to transcribe audio file ${entry.name}: ${errorMsg}`
            );
            // Try to treat as regular document as fallback
            const doc = await loadDocument(filePath);
            docText = doc?.text || null;
          }
        } else {
          // Regular document loading
          const doc = await loadDocument(filePath);
          docText = doc?.text || null;
        }

        if (!docText || !docText.trim()) {
          result.skipped++;
          continue;
        }

        const chunks = await splitter.splitText(docText);
        for (const chunk of chunks) {
          // Skip empty chunks to prevent embedding errors
          if (!chunk || !chunk.trim()) {
            console.log(`[Knowledge] Skipping empty chunk for ${entry.name}`);
            continue;
          }
          await insertMemory(
            chunk,
            "knowledge",
            memorySubdir,
            settings,
            metadata
          );
          result.imported++;
        }
      } catch (error) {
        result.errors.push(
          `Error processing ${entry.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Error reading directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

const VOICE_FILE_PATTERN = /^voice-\d+\.ogg$/i;

const VOICE_FILE_RETRIES = 3;
const VOICE_FILE_RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Query the knowledge base
 */
export async function queryKnowledge(
  query: string,
  limit: number,
  knowledgeSubdirs: string[],
  settings: AppSettings
): Promise<string> {
  console.log(`[Knowledge] Querying subdirs: ${knowledgeSubdirs.join(", ")}, query: "${query}", limit: ${limit}`);

  const trimmedQuery = query.trim();
  const isVoiceFileQuery = VOICE_FILE_PATTERN.test(trimmedQuery);

  if (isVoiceFileQuery) {
    const exactResults = await searchByFilenameWithRetry(
      trimmedQuery,
      limit,
      knowledgeSubdirs,
      "knowledge"
    );
    if (exactResults.length > 0) {
      return formatResults(exactResults);
    }
  }

  const allResults = await semanticSearch(
    query,
    limit,
    knowledgeSubdirs,
    settings
  );

  if (allResults.length === 0 && isVoiceFileQuery) {
    console.log(`[Knowledge] Voice file query returned no semantic results, retrying exact filename search with delay`);
    const exactResults = await searchByFilenameWithRetry(
      trimmedQuery,
      limit,
      knowledgeSubdirs,
      "knowledge"
    );
    if (exactResults.length > 0) {
      return formatResults(exactResults);
    }

    console.log(`[Knowledge] Voice file exact search still empty, falling back to latest documents`);
    const fallbackResults = await fallbackLatestSearch(limit, knowledgeSubdirs, settings);
    if (fallbackResults.length > 0) {
      return formatResults(fallbackResults);
    }
  }

  if (allResults.length === 0) {
    return "No relevant documents found in the knowledge base.";
  }

  return formatResults(allResults);
}

async function searchByFilenameWithRetry(
  filename: string,
  limit: number,
  knowledgeSubdirs: string[],
  areaFilter: string
): Promise<Array<{ text: string; score: number; metadata: Record<string, unknown> }>> {
  for (let attempt = 0; attempt < VOICE_FILE_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`[Knowledge] Retry #${attempt} for exact filename: ${filename}`);
      await sleep(VOICE_FILE_RETRY_DELAY_MS);
    }

    const exactResults: Array<{ text: string; score: number; metadata: Record<string, unknown> }> = [];
    for (const subdir of knowledgeSubdirs) {
      try {
        const results = await searchMemoryByFilename(subdir, filename, areaFilter);
        console.log(`[Knowledge] Exact filename search in ${subdir}: ${results.length} results`);
        exactResults.push(...results);
      } catch (error) {
        console.log(`[Knowledge] Error in exact filename search ${subdir}: ${error}`);
      }
    }

    if (exactResults.length > 0) {
      console.log(`[Knowledge] Found ${exactResults.length} exact filename matches for ${filename}`);
      return exactResults.slice(0, limit);
    }
  }

  return [];
}

async function semanticSearch(
  query: string,
  limit: number,
  knowledgeSubdirs: string[],
  settings: AppSettings
): Promise<Array<{ text: string; score: number; metadata: Record<string, unknown> }>> {
  const allResults: Array<{ text: string; score: number; metadata: Record<string, unknown> }> = [];

  for (const subdir of knowledgeSubdirs) {
    try {
      const results = await searchMemory(
        query,
        limit,
        settings.memory.similarityThreshold,
        subdir,
        settings,
        "knowledge"
      );
      console.log(`[Knowledge] Subdir ${subdir} returned ${results.length} results`);
      allResults.push(...results);
    } catch (error) {
      console.log(`[Knowledge] Error searching subdir ${subdir}: ${error}`);
    }
  }

  console.log(`[Knowledge] Total semantic results from all subdirs: ${allResults.length}`);
  return allResults;
}

async function fallbackLatestSearch(
  limit: number,
  knowledgeSubdirs: string[],
  settings: AppSettings
): Promise<Array<{ text: string; score: number; metadata: Record<string, unknown> }>> {
  const allResults: Array<{ text: string; score: number; metadata: Record<string, unknown> }> = [];

  for (const subdir of knowledgeSubdirs) {
    try {
      const results = await searchMemory(
        "",
        limit,
        settings.memory.similarityThreshold,
        subdir,
        settings,
        "knowledge"
      );
      console.log(`[Knowledge] Fallback: Subdir ${subdir} returned ${results.length} results`);
      allResults.push(...results);
    } catch (error) {
      console.log(`[Knowledge] Fallback error searching subdir ${subdir}: ${error}`);
    }
  }
  console.log(`[Knowledge] Fallback total results: ${allResults.length}`);
  return allResults;
}

function formatResults(
  allResults: Array<{ text: string; score: number; metadata: Record<string, unknown> }>
): string {
  allResults.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const unique = allResults.filter(r => {
    if (seen.has(r.text)) return false;
    seen.add(r.text);
    return true;
  });

  const formatted = unique
    .map((r, i) => {
      const filename = typeof r.metadata?.filename === "string" ? r.metadata.filename : "";
      const isAudio = r.metadata?.audioTranscribed === true;
      const header = filename
        ? `[Document ${i + 1}] (relevance: ${(r.score * 100).toFixed(1)}%)${isAudio ? ` 🎙️ ${filename}` : ` 📄 ${filename}`}`
        : `[Document ${i + 1}] (relevance: ${(r.score * 100).toFixed(1)}%)`;
      return `${header}\n${r.text}`;
    })
    .join("\n\n---\n\n");

  const result = `Found ${unique.length} relevant document chunks:\n\n${formatted}`;
  console.log(`[Knowledge] Returning result, length: ${result.length}, preview: "${result.substring(0, 100)}..."`);
  return result;
}
