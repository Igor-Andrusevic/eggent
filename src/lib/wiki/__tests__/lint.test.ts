import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { lintWiki, formatLintResult } from "@/lib/wiki/lint";
import {
  ensureWikiStructure,
  writePage,
  deleteWiki,
} from "@/lib/wiki/wiki-store";

const TEST_PROJECT_ID = "test-wiki-lint";

beforeEach(async () => {
  await deleteWiki(TEST_PROJECT_ID);
  await ensureWikiStructure(TEST_PROJECT_ID);
});

afterEach(async () => {
  await deleteWiki(TEST_PROJECT_ID);
});

describe("lint", () => {
  it("returns empty issues for empty wiki", async () => {
    const result = await lintWiki(TEST_PROJECT_ID);
    expect(result.issues).toHaveLength(0);
    expect(result.totalPages).toBe(0);
  });

  it("detects pages missing from index", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");

    const filePath = path.join(
      process.cwd(), "data", "projects", TEST_PROJECT_ID, ".meta", "wiki",
      "sources", "orphan.md"
    );
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "# Orphan\nThis page is not in the index.", "utf-8");

    const result = await lintWiki(TEST_PROJECT_ID);
    const orphanIssues = result.issues.filter((i) => i.type === "missing_cross_reference");
    expect(orphanIssues.length).toBeGreaterThan(0);
  });

  it("returns correct totalPages count", async () => {
    await writePage(TEST_PROJECT_ID, "sources", "doc-1", "# Doc 1\nContent");
    await writePage(TEST_PROJECT_ID, "entities", "entity-1", "# Entity 1\nDescription");

    const result = await lintWiki(TEST_PROJECT_ID);
    expect(result.totalPages).toBe(2);
  });

  it("detects synthesis pages with no cross-references as orphans", async () => {
    await writePage(
      TEST_PROJECT_ID,
      "synthesis",
      "comparison",
      "# Comparison\nA comparison with no links to other pages."
    );

    const result = await lintWiki(TEST_PROJECT_ID);
    const orphanIssues = result.issues.filter(
      (i) => i.type === "orphan" && i.pagePath.includes("comparison")
    );
    expect(orphanIssues.length).toBeGreaterThan(0);
  });
});

describe("formatLintResult", () => {
  it("formats healthy wiki report", () => {
    const result = formatLintResult({
      issues: [],
      totalPages: 5,
      checkedAt: "2026-04-27T15:00:00.000Z",
    });

    expect(result).toContain("Total pages: 5");
    expect(result).toContain("Issues found: 0");
    expect(result).toContain("No issues found");
  });

  it("formats issues grouped by severity", () => {
    const result = formatLintResult({
      issues: [
        {
          type: "orphan",
          pagePath: "synthesis/comparison",
          description: "No cross-references",
          severity: "warning",
        },
        {
          type: "stale",
          pagePath: "sources/old-doc",
          description: "Index references missing page",
          severity: "error",
        },
      ],
      totalPages: 10,
      checkedAt: "2026-04-27T15:00:00.000Z",
    });

    expect(result).toContain("WARNING (1)");
    expect(result).toContain("ERROR (1)");
    expect(result).toContain("No cross-references");
  });
});
