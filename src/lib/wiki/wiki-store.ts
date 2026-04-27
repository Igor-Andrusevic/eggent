import fs from "fs/promises";
import path from "path";
import type { WikiPage, WikiPageCategory, WikiIndexEntry, WikiLogEntry } from "@/lib/wiki/types";

const DATA_DIR = path.join(process.cwd(), "data");

const WIKI_CATEGORIES: WikiPageCategory[] = ["sources", "entities", "concepts", "synthesis"];

export function getWikiDir(projectId: string): string {
  return path.join(DATA_DIR, "projects", projectId, ".meta", "wiki");
}

export function getIndexMdPath(projectId: string): string {
  return path.join(getWikiDir(projectId), "index.md");
}

export function getLogMdPath(projectId: string): string {
  return path.join(getWikiDir(projectId), "log.md");
}

export function getPagePath(projectId: string, category: WikiPageCategory, name: string): string {
  return path.join(getWikiDir(projectId), category, `${name}.md`);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureWikiStructure(projectId: string): Promise<void> {
  const wikiDir = getWikiDir(projectId);
  await ensureDir(wikiDir);
  for (const cat of WIKI_CATEGORIES) {
    await ensureDir(path.join(wikiDir, cat));
  }

  const indexPath = getIndexMdPath(projectId);
  try {
    await fs.access(indexPath);
  } catch {
    await fs.writeFile(indexPath, generateEmptyIndex(), "utf-8");
  }

  const logPath = getLogMdPath(projectId);
  try {
    await fs.access(logPath);
  } catch {
    await fs.writeFile(logPath, "# Wiki Log\n\n", "utf-8");
  }
}

function generateEmptyIndex(): string {
  return `# Wiki Index

## Sources

## Entities

## Concepts

## Synthesis
`;
}

export async function wikiExists(projectId: string): Promise<boolean> {
  try {
    await fs.access(getWikiDir(projectId));
    return true;
  } catch {
    return false;
  }
}

export async function readIndex(projectId: string): Promise<WikiIndexEntry[]> {
  const indexPath = getIndexMdPath(projectId);
  try {
    const content = await fs.readFile(indexPath, "utf-8");
    return parseIndexContent(content);
  } catch {
    return [];
  }
}

export function parseIndexContent(content: string): WikiIndexEntry[] {
  const entries: WikiIndexEntry[] = [];
  const lines = content.split("\n");
  let currentCategory: WikiPageCategory | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      const catName = trimmed.slice(3).trim().toLowerCase() as WikiPageCategory;
      if (WIKI_CATEGORIES.includes(catName)) {
        currentCategory = catName;
      }
      continue;
    }

    if (!currentCategory) continue;

    const linkMatch = trimmed.match(/^\-\s+\[([^\]]+)\]\(([^)]+)\)\s*[—\-]\s*(.+)$/);
    if (linkMatch) {
      const [, name, relativePath, rest] = linkMatch;
      const parts = rest.split(".").map((s) => s.trim());
      const summary = parts[0] || "";
      const updatedAtMatch = rest.match(/(\d{4}-\d{2}-\d{2})/);
      const updatedAt = updatedAtMatch ? updatedAtMatch[1] : "";
      const sourceCountMatch = rest.match(/Refs:\s*(\d+)/);

      entries.push({
        category: currentCategory,
        name,
        relativePath,
        summary,
        updatedAt,
        sourceCount: sourceCountMatch ? parseInt(sourceCountMatch[1], 10) : undefined,
      });
    }
  }

  return entries;
}

export async function writeIndex(projectId: string, entries: WikiIndexEntry[]): Promise<void> {
  const indexPath = getIndexMdPath(projectId);
  await ensureDir(path.dirname(indexPath));

  const grouped = new Map<WikiPageCategory, WikiIndexEntry[]>();
  for (const cat of WIKI_CATEGORIES) {
    grouped.set(cat, []);
  }
  for (const entry of entries) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }

  const sections: string[] = ["# Wiki Index\n"];
  for (const cat of WIKI_CATEGORIES) {
    sections.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`);
    const catEntries = grouped.get(cat) ?? [];
    if (catEntries.length === 0) {
      sections.push("");
    } else {
      for (const e of catEntries) {
        const suffix = e.updatedAt ? ` Updated ${e.updatedAt}.` : "";
        const refs = e.sourceCount ? ` Refs: ${e.sourceCount} sources.` : "";
        sections.push(`- [${e.name}](${e.relativePath}) — ${e.summary}${suffix}${refs}`);
      }
      sections.push("");
    }
  }

  await fs.writeFile(indexPath, sections.join("\n").trim() + "\n", "utf-8");
}

export async function updateIndexEntry(
  projectId: string,
  entry: WikiIndexEntry
): Promise<void> {
  const entries = await readIndex(projectId);
  const existingIdx = entries.findIndex(
    (e) => e.category === entry.category && e.name === entry.name
  );
  if (existingIdx >= 0) {
    entries[existingIdx] = entry;
  } else {
    entries.push(entry);
  }
  await writeIndex(projectId, entries);
}

export async function removeIndexEntry(
  projectId: string,
  category: WikiPageCategory,
  name: string
): Promise<void> {
  const entries = await readIndex(projectId);
  const filtered = entries.filter(
    (e) => !(e.category === category && e.name === name)
  );
  await writeIndex(projectId, filtered);
}

export async function readPage(
  projectId: string,
  category: WikiPageCategory,
  name: string
): Promise<WikiPage | null> {
  const filePath = getPagePath(projectId, category, name);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const stat = await fs.stat(filePath);
    return {
      category,
      name,
      filePath,
      content,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function readPageByPath(
  projectId: string,
  relativePath: string
): Promise<WikiPage | null> {
  const segments = relativePath.replace(/\.md$/, "").split("/");
  if (segments.length !== 2) return null;
  const [category, name] = segments as [WikiPageCategory, string];
  if (!WIKI_CATEGORIES.includes(category)) return null;
  return readPage(projectId, category, name);
}

export async function writePage(
  projectId: string,
  category: WikiPageCategory,
  name: string,
  content: string
): Promise<string> {
  const filePath = getPagePath(projectId, category, name);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");

  await updateIndexEntry(projectId, {
    category,
    name,
    relativePath: `${category}/${name}.md`,
    summary: extractSummary(content),
    updatedAt: new Date().toISOString().slice(0, 10),
    sourceCount: undefined,
  });

  return filePath;
}

export async function deletePage(
  projectId: string,
  category: WikiPageCategory,
  name: string
): Promise<boolean> {
  const filePath = getPagePath(projectId, category, name);
  try {
    await fs.unlink(filePath);
    await removeIndexEntry(projectId, category, name);
    return true;
  } catch {
    return false;
  }
}

export async function listPages(
  projectId: string,
  category?: WikiPageCategory
): Promise<Array<{ category: WikiPageCategory; name: string; path: string }>> {
  const wikiDir = getWikiDir(projectId);
  const categories = category ? [category] : WIKI_CATEGORIES;
  const result: Array<{ category: WikiPageCategory; name: string; path: string }> = [];

  for (const cat of categories) {
    const catDir = path.join(wikiDir, cat);
    try {
      const files = await fs.readdir(catDir);
      for (const file of files) {
        if (file.endsWith(".md")) {
          result.push({
            category: cat,
            name: file.replace(/\.md$/, ""),
            path: `${cat}/${file}`,
          });
        }
      }
    } catch {
      // directory doesn't exist yet
    }
  }

  return result;
}

export async function appendLog(
  projectId: string,
  entry: WikiLogEntry
): Promise<void> {
  const logPath = getLogMdPath(projectId);
  await ensureDir(path.dirname(logPath));

  const affectedStr = entry.affectedPages.length > 0
    ? `\n- Affected: ${entry.affectedPages.join(", ")}`
    : "";
  const logLine = `## [${entry.timestamp}] ${entry.operation} | ${entry.detail}${affectedStr}\n\n`;

  await fs.appendFile(logPath, logLine, "utf-8");
}

export async function readLog(
  projectId: string,
  limit: number = 50
): Promise<string> {
  const logPath = getLogMdPath(projectId);
  try {
    const content = await fs.readFile(logPath, "utf-8");
    if (limit <= 0) return content;
    const entries = content.split(/^## /m).filter(Boolean);
    const recent = entries.slice(-limit);
    return recent.length > 0 ? "## " + recent.join("## ") : content;
  } catch {
    return "No wiki log found.";
  }
}

export async function deleteWiki(projectId: string): Promise<void> {
  const wikiDir = getWikiDir(projectId);
  try {
    await fs.rm(wikiDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function extractSummary(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("---") && !trimmed.startsWith("```")) {
      const summary = trimmed.length > 120 ? trimmed.slice(0, 117) + "..." : trimmed;
      return summary;
    }
  }
  return "No summary available.";
}
