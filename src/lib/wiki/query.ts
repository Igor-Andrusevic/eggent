import { readIndex, readPage, readPageByPath } from "@/lib/wiki/wiki-store";
import type { WikiPage, WikiIndexEntry } from "@/lib/wiki/types";

export interface WikiQueryResult {
  page: WikiPage;
  indexEntry: WikiIndexEntry;
  relevanceScore: number;
}

export async function queryWiki(
  projectId: string,
  query: string,
  limit: number = 5
): Promise<{ results: WikiQueryResult[]; error?: string }> {
  const indexEntries = await readIndex(projectId);
  if (indexEntries.length === 0) {
    return { results: [], error: "Wiki is empty. No pages have been created yet." };
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);

  const scored: WikiQueryResult[] = [];

  for (const entry of indexEntries) {
    const score = scoreEntry(entry, queryLower, queryWords);
    if (score > 0) {
      const page = await readPageByPath(projectId, entry.relativePath);
      if (page) {
        const contentScore = scoreContent(page.content, queryLower, queryWords);
        const finalScore = score * 0.4 + contentScore * 0.6;
        scored.push({ page, indexEntry: entry, relevanceScore: finalScore });
      }
    }
  }

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return { results: scored.slice(0, limit) };
}

export async function getWikiPage(
  projectId: string,
  category: string,
  name: string
): Promise<WikiPage | null> {
  return readPage(projectId, category as WikiPage["category"], name);
}

export async function searchWikiPages(
  projectId: string,
  query: string,
  limit: number = 10
): Promise<Array<{ path: string; name: string; snippet: string; score: number }>> {
  const indexEntries = await readIndex(projectId);
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);

  const results: Array<{ path: string; name: string; snippet: string; score: number }> = [];

  for (const entry of indexEntries) {
    const page = await readPageByPath(projectId, entry.relativePath);
    if (!page) continue;

    const contentScore = scoreContent(page.content, queryLower, queryWords);
    const indexScore = scoreEntry(entry, queryLower, queryWords);
    const finalScore = contentScore * 0.7 + indexScore * 0.3;

    if (finalScore > 0) {
      results.push({
        path: entry.relativePath,
        name: entry.name,
        snippet: extractSnippet(page.content, queryWords),
        score: finalScore,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export function formatWikiResults(
  results: WikiQueryResult[]
): string {
  if (results.length === 0) {
    return "No relevant wiki pages found.";
  }

  return results
    .map((r, i) => {
      const header = `[Wiki Page ${i + 1}] ${r.indexEntry.category}/${r.indexEntry.name} (relevance: ${(r.relevanceScore * 100).toFixed(1)}%)`;
      const meta = `Category: ${r.indexEntry.category} | Updated: ${r.indexEntry.updatedAt}`;
      return `${header}\n${meta}\n\n${r.page.content}`;
    })
    .join("\n\n---\n\n");
}

function scoreEntry(
  entry: WikiIndexEntry,
  queryLower: string,
  queryWords: string[]
): number {
  let score = 0;
  const nameLower = entry.name.toLowerCase();
  const summaryLower = entry.summary.toLowerCase();

  if (nameLower.includes(queryLower)) {
    score += 0.5;
  }

  for (const word of queryWords) {
    if (nameLower.includes(word)) score += 0.15;
    if (summaryLower.includes(word)) score += 0.1;
  }

  if (entry.category === "synthesis") score += 0.05;

  return Math.min(score, 1.0);
}

function scoreContent(
  content: string,
  queryLower: string,
  queryWords: string[]
): number {
  const contentLower = content.toLowerCase();
  let score = 0;

  if (contentLower.includes(queryLower)) {
    score += 0.3;
  }

  for (const word of queryWords) {
    const regex = new RegExp(word, "gi");
    const matches = contentLower.match(regex);
    if (matches) {
      score += Math.min(matches.length * 0.05, 0.2);
    }
  }

  const headings = content.match(/^#+\s+.+$/gm);
  if (headings) {
    for (const heading of headings) {
      const headingLower = heading.toLowerCase();
      for (const word of queryWords) {
        if (headingLower.includes(word)) score += 0.1;
      }
    }
  }

  return Math.min(score, 1.0);
}

function extractSnippet(content: string, queryWords: string[]): string {
  const lines = content.split("\n");
  let bestLine = "";
  let bestScore = 0;

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    let lineScore = 0;
    for (const word of queryWords) {
      if (lineLower.includes(word)) lineScore++;
    }
    if (lineScore > bestScore) {
      bestScore = lineScore;
      bestLine = line.trim();
    }
  }

  if (!bestLine) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---")) {
        return trimmed.length > 150 ? trimmed.slice(0, 147) + "..." : trimmed;
      }
    }
  }

  return bestLine.length > 150 ? bestLine.slice(0, 147) + "..." : bestLine;
}
