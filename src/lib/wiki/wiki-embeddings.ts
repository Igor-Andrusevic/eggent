import fs from "fs/promises";
import path from "path";
import { embedTexts } from "@/lib/memory/embeddings";
import type { AppSettings } from "@/lib/types";

interface WikiEmbeddingEntry {
  path: string;
  embedding: number[];
  updatedAt: string;
}

interface WikiEmbeddingsDB {
  pages: WikiEmbeddingEntry[];
  lastUpdated: string;
}

const DATA_DIR = path.join(process.cwd(), "data");

const dbCache = new Map<string, WikiEmbeddingsDB>();

function getEmbeddingsPath(projectId: string): string {
  return path.join(DATA_DIR, "projects", projectId, ".meta", "wiki", "embeddings.json");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function loadDB(projectId: string): Promise<WikiEmbeddingsDB> {
  if (dbCache.has(projectId)) {
    return dbCache.get(projectId)!;
  }

  const dbPath = getEmbeddingsPath(projectId);
  try {
    const content = await fs.readFile(dbPath, "utf-8");
    const db: WikiEmbeddingsDB = JSON.parse(content);
    dbCache.set(projectId, db);
    return db;
  } catch {
    const db: WikiEmbeddingsDB = { pages: [], lastUpdated: new Date().toISOString() };
    dbCache.set(projectId, db);
    return db;
  }
}

async function saveDB(projectId: string, db: WikiEmbeddingsDB): Promise<void> {
  const dbPath = getEmbeddingsPath(projectId);
  await ensureDir(path.dirname(dbPath));
  db.lastUpdated = new Date().toISOString();
  await fs.writeFile(dbPath, JSON.stringify(db), "utf-8");
  dbCache.set(projectId, db);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function truncateForEmbedding(content: string): string {
  const lines = content.split("\n");
  const significant = lines.filter((l) => {
    const t = l.trim();
    return t && !t.startsWith(">");
  });
  const text = significant.join("\n").trim();
  return text.length > 800 ? text.slice(0, 800) : text;
}

export async function upsertWikiEmbedding(
  projectId: string,
  pagePath: string,
  content: string,
  settings: AppSettings
): Promise<void> {
  try {
    const text = truncateForEmbedding(content);
    if (!text.trim()) return;

    const embeddings = await embedTexts([text], settings.embeddingsModel);
    if (!embeddings || embeddings.length === 0) return;

    const db = await loadDB(projectId);
    const existingIdx = db.pages.findIndex((p) => p.path === pagePath);

    const entry: WikiEmbeddingEntry = {
      path: pagePath,
      embedding: embeddings[0],
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      db.pages[existingIdx] = entry;
    } else {
      db.pages.push(entry);
    }

    await saveDB(projectId, db);
  } catch (error) {
    console.error(`[WikiEmbeddings] Failed to upsert embedding for ${pagePath}:`, error);
  }
}

export async function searchWikiEmbeddings(
  projectId: string,
  query: string,
  limit: number,
  settings: AppSettings
): Promise<Array<{ path: string; score: number }>> {
  try {
    const db = await loadDB(projectId);
    if (db.pages.length === 0) return [];

    const embeddings = await embedTexts([query], settings.embeddingsModel);
    if (!embeddings || embeddings.length === 0) return [];

    const queryEmbedding = embeddings[0];

    const results = db.pages
      .map((page) => ({
        path: page.path,
        score: cosineSimilarity(queryEmbedding, page.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  } catch (error) {
    console.error(`[WikiEmbeddings] Search failed:`, error);
    return [];
  }
}

export async function deleteWikiEmbedding(
  projectId: string,
  pagePath: string
): Promise<void> {
  try {
    const db = await loadDB(projectId);
    db.pages = db.pages.filter((p) => p.path !== pagePath);
    await saveDB(projectId, db);
  } catch {
    // ignore
  }
}

export function clearEmbeddingsCache(projectId: string): void {
  dbCache.delete(projectId);
}
