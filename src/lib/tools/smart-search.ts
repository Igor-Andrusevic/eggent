import { queryWiki } from "@/lib/wiki/query";
import { searchMemory } from "@/lib/memory/memory";
import { queryKnowledge } from "@/lib/memory/knowledge";
import type { AppSettings } from "@/lib/types";

export interface SmartSearchResult {
  text: string;
  score: number;
  source: "wiki" | "knowledge" | "memory";
  sourceDetail: string;
}

export async function smartSearch(
  query: string,
  limit: number,
  projectId: string | undefined,
  memorySubdir: string,
  knowledgeSubdirs: string[],
  settings: AppSettings
): Promise<string> {
  const all: SmartSearchResult[] = [];

  if (projectId) {
    try {
      const { results, error } = await queryWiki(projectId, query, limit, settings);
      if (!error && results.length > 0) {
        for (const r of results) {
          all.push({
            text: r.page.content,
            score: r.relevanceScore,
            source: "wiki",
            sourceDetail: `${r.indexEntry.category}/${r.indexEntry.name}`,
          });
        }
      } else if (error) {
        console.log(`[SmartSearch] Wiki query returned: ${error}`);
      }
    } catch (e) {
      console.log(`[SmartSearch] Wiki search failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (all.length < limit) {
    try {
      const knowledgeText = await queryKnowledge(query, limit, knowledgeSubdirs, settings);
      if (knowledgeText && knowledgeText !== "No relevant documents found in the knowledge base.") {
        const parsed = parseKnowledgeResults(knowledgeText);
        for (const p of parsed) {
          all.push({
            text: p.text,
            score: p.score * 0.8,
            source: "knowledge",
            sourceDetail: p.filename || "document",
          });
        }
      }
    } catch (e) {
      console.log(`[SmartSearch] Knowledge search failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (settings.memory?.enabled !== false && all.length < limit) {
    try {
      const memResults = await searchMemory(
        query,
        limit,
        settings.memory?.similarityThreshold ?? 0.35,
        memorySubdir,
        settings
      );
      for (const r of memResults) {
        all.push({
          text: r.text,
          score: r.score * 0.7,
          source: "memory",
          sourceDetail: `${r.metadata.area || "unknown"}`,
        });
      }
    } catch (e) {
      // memory search is optional
    }
  }

  if (all.length === 0) {
    return "No results found in wiki, knowledge base, or memory. Try uploading documents or saving information to memory.";
  }

  all.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const deduped: SmartSearchResult[] = [];
  for (const r of all) {
    const key = r.text.slice(0, 120);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  const top = deduped.slice(0, limit);

  return top
    .map((r, i) => {
      const sourceLabel = sourceIcon(r.source);
      const header = `[${i + 1}] ${sourceLabel} ${r.sourceDetail} (score: ${(r.score * 100).toFixed(0)}%)`;
      return `${header}\n${r.text}`;
    })
    .join("\n\n---\n\n");
}

function sourceIcon(source: SmartSearchResult["source"]): string {
  switch (source) {
    case "wiki":
      return "[Wiki]";
    case "knowledge":
      return "[RAG]";
    case "memory":
      return "[Memory]";
  }
}

function parseKnowledgeResults(
  text: string
): Array<{ text: string; score: number; filename?: string }> {
  const results: Array<{ text: string; score: number; filename?: string }> = [];
  const blocks = text.split(/\[Document \d+\]/g).filter(Boolean);

  for (const block of blocks) {
    const scoreMatch = block.match(/relevance:\s*([\d.]+)%/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) / 100 : 0.5;

    const filenameMatch = block.match(/([🎙️📄]\s*\S+)/);
    const filename = filenameMatch ? filenameMatch[1] : undefined;

    const cleanText = block
      .replace(/\(relevance: [\d.]+%\)\s*/g, "")
      .replace(/[🎙️📄]\s*\S+/g, "")
      .trim();

    if (cleanText) {
      results.push({ text: cleanText, score, filename });
    }
  }

  return results;
}
