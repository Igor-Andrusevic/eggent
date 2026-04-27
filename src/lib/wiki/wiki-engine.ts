import { ensureWikiStructure, writePage, appendLog, readLog, readIndex } from "@/lib/wiki/wiki-store";
import { ingestSource } from "@/lib/wiki/ingest";
import { queryWiki, getWikiPage, formatWikiResults } from "@/lib/wiki/query";
import { lintWiki, formatLintResult } from "@/lib/wiki/lint";
import type { WikiPageCategory, WikiIngestResult } from "@/lib/wiki/types";
import type { AppSettings } from "@/lib/types";

export async function wikiQuery(
  projectId: string,
  query: string,
  limit: number
): Promise<string> {
  const { results, error } = await queryWiki(projectId, query, limit);
  if (error) return error;
  return formatWikiResults(results);
}

export async function wikiReadPage(
  projectId: string,
  path: string
): Promise<string> {
  const segments = path.replace(/\.md$/, "").split("/");
  if (segments.length !== 2) {
    return `Invalid page path: ${path}. Expected format: category/name`;
  }
  const [category, name] = segments;
  const page = await getWikiPage(projectId, category, name);
  if (!page) {
    return `Wiki page not found: ${path}`;
  }
  return page.content;
}

export async function wikiCreatePage(
  projectId: string,
  category: string,
  name: string,
  content: string
): Promise<string> {
  const validCategories: WikiPageCategory[] = ["sources", "entities", "concepts", "synthesis"];
  if (!validCategories.includes(category as WikiPageCategory)) {
    return `Invalid category: ${category}. Must be one of: ${validCategories.join(", ")}`;
  }

  const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!sanitizedName) {
    return "Invalid page name. Use lowercase letters, numbers, and hyphens.";
  }

  await ensureWikiStructure(projectId);
  const filePath = await writePage(projectId, category as WikiPageCategory, sanitizedName, content);

  await appendLog(projectId, {
    timestamp: new Date().toISOString(),
    operation: "create_page",
    detail: `${category}/${sanitizedName}`,
    affectedPages: [`${category}/${sanitizedName}`],
  });

  return `Wiki page created: ${category}/${sanitizedName} (${filePath})`;
}

export async function wikiIngestFile(
  projectId: string,
  filename: string,
  knowledgeDir: string,
  settings: AppSettings
): Promise<string> {
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(knowledgeDir, filename);

  try {
    await fs.access(filePath);
  } catch {
    return `File not found: ${filename}`;
  }

  const result = await ingestSource(projectId, filePath, filename, settings);

  const parts: string[] = [
    `Wiki ingest completed for: ${filename}`,
    `Created: ${result.createdPages.length} pages`,
    `Updated: ${result.updatedPages.length} pages`,
  ];

  if (result.createdPages.length > 0) {
    parts.push(`New pages: ${result.createdPages.join(", ")}`);
  }
  if (result.updatedPages.length > 0) {
    parts.push(`Updated pages: ${result.updatedPages.join(", ")}`);
  }
  if (result.errors.length > 0) {
    parts.push(`Errors: ${result.errors.join("; ")}`);
  }

  return parts.join("\n");
}

export async function wikiLint(projectId: string): Promise<string> {
  const result = await lintWiki(projectId);
  return formatLintResult(result);
}

export async function wikiGetStatus(projectId: string): Promise<string> {
  const indexEntries = await readIndex(projectId);
  const log = await readLog(projectId, 5);

  const categoryCounts = new Map<string, number>();
  for (const entry of indexEntries) {
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + 1);
  }

  const parts: string[] = [
    `Wiki Status: ${indexEntries.length} pages total`,
  ];

  for (const [cat, count] of categoryCounts) {
    parts.push(`  ${cat}: ${count}`);
  }

  if (indexEntries.length > 0) {
    parts.push("\nRecent log entries:");
    parts.push(log);
  }

  return parts.join("\n");
}

export { ingestSource };
export type { WikiIngestResult };
