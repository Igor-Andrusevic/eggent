import { readIndex, readPageByPath, listPages } from "@/lib/wiki/wiki-store";
import type { WikiLintIssue, WikiLintResult } from "@/lib/wiki/types";

export async function lintWiki(projectId: string): Promise<WikiLintResult> {
  const issues: WikiLintIssue[] = [];

  const allPages = await listPages(projectId);
  if (allPages.length === 0) {
    return {
      issues: [],
      totalPages: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  const indexEntries = await readIndex(projectId);
  const indexedPaths = new Set(indexEntries.map((e) => e.relativePath));

  for (const page of allPages) {
    const relativePath = `${page.category}/${page.name}.md`;

    if (!indexedPaths.has(relativePath)) {
      issues.push({
        type: "missing_cross_reference",
        pagePath: relativePath,
        description: `Page exists on disk but is missing from index.md`,
        severity: "warning",
      });
    }

    const content = await readPageByPath(projectId, relativePath);
    if (content && content.content.trim().split("\n").filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith(">")).length < 3) {
      issues.push({
        type: "empty_page",
        pagePath: relativePath,
        description: `Page has very little substantive content`,
        severity: "info",
      });
    }

    if (content) {
      const orphanCheck = checkOrphanPage(content.content, allPages, relativePath);
      if (orphanCheck.isOrphan) {
        issues.push({
          type: "orphan",
          pagePath: relativePath,
          description: orphanCheck.reason,
          severity: "warning",
        });
      }
    }
  }

  for (const entry of indexEntries) {
    const page = await readPageByPath(projectId, entry.relativePath);
    if (!page) {
      issues.push({
        type: "stale",
        pagePath: entry.relativePath,
        description: `Index references page that doesn't exist on disk`,
        severity: "error",
      });
    }
  }

  return {
    issues,
    totalPages: allPages.length,
    checkedAt: new Date().toISOString(),
  };
}

function checkOrphanPage(
  content: string,
  _allPages: Array<{ category: string; name: string; path: string }>,
  currentPath: string
): { isOrphan: boolean; reason: string } {
  if (currentPath.startsWith("sources/")) {
    return { isOrphan: false, reason: "" };
  }

  if (currentPath.startsWith("entities/") || currentPath.startsWith("concepts/")) {
    return { isOrphan: false, reason: "" };
  }

  const wikiLinks: string[] = [];
  const linkRegex = /\[([^\]]*)\]\(\.\.\/([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(content)) !== null) {
    wikiLinks.push(match[2]);
  }

  if (currentPath.startsWith("synthesis/") && wikiLinks.length === 0) {
    return {
      isOrphan: true,
      reason: "Synthesis page has no cross-references to other wiki pages",
    };
  }

  return { isOrphan: false, reason: "" };
}

export function formatLintResult(result: WikiLintResult): string {
  const lines: string[] = [
    `Wiki Lint Report — ${result.checkedAt}`,
    `Total pages: ${result.totalPages}`,
    `Issues found: ${result.issues.length}`,
    "",
  ];

  if (result.issues.length === 0) {
    lines.push("No issues found. Wiki is healthy.");
    return lines.join("\n");
  }

  const grouped = new Map<string, typeof result.issues>();
  for (const issue of result.issues) {
    const list = grouped.get(issue.severity) ?? [];
    list.push(issue);
    grouped.set(issue.severity, list);
  }

  for (const severity of ["error", "warning", "info"] as const) {
    const issues = grouped.get(severity);
    if (!issues || issues.length === 0) continue;

    lines.push(`### ${severity.toUpperCase()} (${issues.length})`);
    for (const issue of issues) {
      lines.push(`- [${issue.type}] ${issue.pagePath}: ${issue.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
