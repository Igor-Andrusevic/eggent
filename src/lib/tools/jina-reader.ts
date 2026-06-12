import { validateUrlForFetch } from "@/lib/utils/ssrf-guard";

const JINA_API_KEY = process.env.JINA_API_KEY || "";
const READER_BASE = "https://r.jina.ai";
const SEARCH_BASE = "https://s.jina.ai";
const FETCH_TIMEOUT_MS = 60000;
const FETCH_MAX_CHARS = 24000;

interface JinaSearchResult {
  title: string;
  url: string;
  description: string;
  content: string;
  publishedTime?: string;
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice(7)}`;
  if (!trimmed.startsWith("https://")) return `https://${trimmed}`;
  return trimmed;
}

function trimContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + "\n\n[...content truncated...]";
}

export async function jinaFetchPage(rawUrl: string): Promise<string> {
  const url = normalizeUrl(rawUrl);
  const ssrf = validateUrlForFetch(url);
  if (!ssrf.safe) {
    return `Jina fetch error: ${ssrf.reason}`;
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${READER_BASE}/${url}`, {
      method: "GET",
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${JINA_API_KEY}`,
        "User-Agent": "Mozilla/5.0 (compatible; Eggent/1.0)",
        "X-Respond-With": "frontmatter",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      return `Jina fetch error: HTTP ${response.status} — ${errorText.slice(0, 500)}`;
    }

    const content = await response.text();
    const trimmed = trimContent(content, FETCH_MAX_CHARS);
    return trimmed || "Jina fetch returned empty content.";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return `Jina fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s.`;
    }
    return `Jina fetch error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    clearTimeout(timeout);
  }
}

export async function jinaSearchWeb(query: string, limit: number = 5): Promise<string> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${SEARCH_BASE}/${encodeURIComponent(query)}`, {
      method: "GET",
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${JINA_API_KEY}`,
        "User-Agent": "Mozilla/5.0 (compatible; Eggent/1.0)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      return `Jina search error: HTTP ${response.status} — ${errorText.slice(0, 500)}`;
    }

    const data = await response.json();
    const results: JinaSearchResult[] = (data.data || []).slice(0, limit);

    if (results.length === 0) {
      return "Jina search returned no results.";
    }

    const lines: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      lines.push(`[${i + 1}] ${r.title}`);
      lines.push(`    URL: ${r.url}`);
      if (r.description) lines.push(`    ${r.description}`);
      if (r.content) {
        lines.push(`    Content: ${trimContent(r.content, 800)}`);
      }
      lines.push("");
    }

    return lines.join("\n").trim();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return `Jina search timed out after ${FETCH_TIMEOUT_MS / 1000}s.`;
    }
    if (error instanceof SyntaxError) {
      return `Jina search error: Failed to parse response.`;
    }
    return `Jina search error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    clearTimeout(timeout);
  }
}

export function isJinaAvailable(): boolean {
  return Boolean(JINA_API_KEY);
}
