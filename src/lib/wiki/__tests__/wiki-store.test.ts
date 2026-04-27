import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  ensureWikiStructure,
  getWikiDir,
  getIndexMdPath,
  getLogMdPath,
  writePage,
  readPage,
  readPageByPath,
  deletePage,
  listPages,
  readIndex,
  appendLog,
  readLog,
  parseIndexContent,
  deleteWiki,
} from "@/lib/wiki/wiki-store";

const TEST_PROJECT_ID = "test-wiki-project";

beforeEach(async () => {
  await deleteWiki(TEST_PROJECT_ID);
});

afterEach(async () => {
  await deleteWiki(TEST_PROJECT_ID);
});

describe("wiki-store", () => {
  describe("ensureWikiStructure", () => {
    it("creates wiki directory structure with index.md and log.md", async () => {
      await ensureWikiStructure(TEST_PROJECT_ID);

      const wikiDir = getWikiDir(TEST_PROJECT_ID);
      const stat = await fs.stat(wikiDir);
      expect(stat.isDirectory()).toBe(true);

      for (const cat of ["sources", "entities", "concepts", "synthesis"]) {
        const catDir = path.join(wikiDir, cat);
        const catStat = await fs.stat(catDir);
        expect(catStat.isDirectory()).toBe(true);
      }

      const indexContent = await fs.readFile(getIndexMdPath(TEST_PROJECT_ID), "utf-8");
      expect(indexContent).toContain("# Wiki Index");

      const logContent = await fs.readFile(getLogMdPath(TEST_PROJECT_ID), "utf-8");
      expect(logContent).toContain("# Wiki Log");
    });

    it("is idempotent — calling twice does not throw", async () => {
      await ensureWikiStructure(TEST_PROJECT_ID);
      await expect(ensureWikiStructure(TEST_PROJECT_ID)).resolves.not.toThrow();
    });
  });

  describe("writePage / readPage", () => {
    beforeEach(async () => {
      await ensureWikiStructure(TEST_PROJECT_ID);
    });

    it("writes and reads a wiki page", async () => {
      const content = "# Test Page\n\nThis is test content.";
      await writePage(TEST_PROJECT_ID, "sources", "test-doc", content);

      const page = await readPage(TEST_PROJECT_ID, "sources", "test-doc");
      expect(page).not.toBeNull();
      expect(page!.content).toBe(content);
      expect(page!.category).toBe("sources");
      expect(page!.name).toBe("test-doc");
    });

    it("returns null for non-existent page", async () => {
      const page = await readPage(TEST_PROJECT_ID, "sources", "nonexistent");
      expect(page).toBeNull();
    });

    it("overwrites existing page on second write", async () => {
      await writePage(TEST_PROJECT_ID, "entities", "test-entity", "Version 1");
      await writePage(TEST_PROJECT_ID, "entities", "test-entity", "Version 2");

      const page = await readPage(TEST_PROJECT_ID, "entities", "test-entity");
      expect(page!.content).toBe("Version 2");
    });
  });

  describe("readPageByPath", () => {
    beforeEach(async () => {
      await ensureWikiStructure(TEST_PROJECT_ID);
    });

    it("reads a page by relative path", async () => {
      await writePage(TEST_PROJECT_ID, "concepts", "ml", "# ML\nContent");

      const page = await readPageByPath(TEST_PROJECT_ID, "concepts/ml");
      expect(page).not.toBeNull();
      expect(page!.name).toBe("ml");
    });

    it("reads a page by relative path with .md extension", async () => {
      await writePage(TEST_PROJECT_ID, "concepts", "ml", "# ML\nContent");

      const page = await readPageByPath(TEST_PROJECT_ID, "concepts/ml.md");
      expect(page).not.toBeNull();
    });

    it("returns null for invalid path format", async () => {
      const page = await readPageByPath(TEST_PROJECT_ID, "invalid");
      expect(page).toBeNull();
    });

    it("returns null for invalid category", async () => {
      const page = await readPageByPath(TEST_PROJECT_ID, "invalid/name");
      expect(page).toBeNull();
    });
  });

  describe("deletePage", () => {
    beforeEach(async () => {
      await ensureWikiStructure(TEST_PROJECT_ID);
    });

    it("deletes an existing page", async () => {
      await writePage(TEST_PROJECT_ID, "sources", "to-delete", "Content");
      const deleted = await deletePage(TEST_PROJECT_ID, "sources", "to-delete");
      expect(deleted).toBe(true);

      const page = await readPage(TEST_PROJECT_ID, "sources", "to-delete");
      expect(page).toBeNull();
    });

    it("returns false for non-existent page", async () => {
      const deleted = await deletePage(TEST_PROJECT_ID, "sources", "nonexistent");
      expect(deleted).toBe(false);
    });
  });

  describe("listPages", () => {
    beforeEach(async () => {
      await ensureWikiStructure(TEST_PROJECT_ID);
    });

    it("lists all pages across categories", async () => {
      await writePage(TEST_PROJECT_ID, "sources", "doc-1", "Content 1");
      await writePage(TEST_PROJECT_ID, "entities", "entity-1", "Content 2");
      await writePage(TEST_PROJECT_ID, "concepts", "concept-1", "Content 3");

      const pages = await listPages(TEST_PROJECT_ID);
      expect(pages).toHaveLength(3);
    });

    it("filters by category", async () => {
      await writePage(TEST_PROJECT_ID, "sources", "doc-1", "Content 1");
      await writePage(TEST_PROJECT_ID, "entities", "entity-1", "Content 2");

      const pages = await listPages(TEST_PROJECT_ID, "sources");
      expect(pages).toHaveLength(1);
      expect(pages[0].category).toBe("sources");
    });

    it("returns empty array when no pages exist", async () => {
      const pages = await listPages(TEST_PROJECT_ID);
      expect(pages).toHaveLength(0);
    });
  });

  describe("index.md management", () => {
    beforeEach(async () => {
      await ensureWikiStructure(TEST_PROJECT_ID);
    });

    it("updates index when writing a page", async () => {
      await writePage(TEST_PROJECT_ID, "sources", "my-doc", "# My Doc\nA test document about AI.");

      const entries = await readIndex(TEST_PROJECT_ID);
      const found = entries.find((e) => e.name === "my-doc" && e.category === "sources");
      expect(found).toBeDefined();
      expect(found!.summary).toBeTruthy();
    });

    it("removes entry from index when page is deleted", async () => {
      await writePage(TEST_PROJECT_ID, "entities", "temp", "# Temp\nTemporary content");
      await deletePage(TEST_PROJECT_ID, "entities", "temp");

      const entries = await readIndex(TEST_PROJECT_ID);
      const found = entries.find((e) => e.name === "temp");
      expect(found).toBeUndefined();
    });
  });

  describe("log.md management", () => {
    beforeEach(async () => {
      await ensureWikiStructure(TEST_PROJECT_ID);
    });

    it("appends log entries", async () => {
      await appendLog(TEST_PROJECT_ID, {
        timestamp: "2026-04-27T14:30:00.000Z",
        operation: "ingest",
        detail: "test-file.pdf",
        affectedPages: ["sources/test-file"],
      });

      const log = await readLog(TEST_PROJECT_ID);
      expect(log).toContain("ingest");
      expect(log).toContain("test-file.pdf");
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 10; i++) {
        await appendLog(TEST_PROJECT_ID, {
          timestamp: new Date().toISOString(),
          operation: "ingest",
          detail: `file-${i}.pdf`,
          affectedPages: [],
        });
      }

      const log = await readLog(TEST_PROJECT_ID, 3);
      const entryCount = (log.match(/## \[/g) || []).length;
      expect(entryCount).toBeLessThanOrEqual(4); // includes header
    });
  });
});

describe("parseIndexContent", () => {
  it("parses a valid index.md content", () => {
    const content = `# Wiki Index

## Sources
- [My Document](sources/my-document.md) — A test document about AI. Updated 2026-04-27.

## Entities
- [John Smith](entities/john-smith.md) — A researcher. Updated 2026-04-27.

## Concepts
- [Machine Learning](concepts/machine-learning.md) — AI subfield. Refs: 3 sources. Updated 2026-04-27.

## Synthesis
`;

    const entries = parseIndexContent(content);
    expect(entries).toHaveLength(3);

    expect(entries[0].category).toBe("sources");
    expect(entries[0].name).toBe("My Document");
    expect(entries[0].summary).toContain("test document");

    expect(entries[1].category).toBe("entities");
    expect(entries[1].name).toBe("John Smith");

    expect(entries[2].category).toBe("concepts");
    expect(entries[2].sourceCount).toBe(3);
  });

  it("returns empty array for empty index", () => {
    const entries = parseIndexContent("# Wiki Index\n\n## Sources\n\n## Entities\n");
    expect(entries).toHaveLength(0);
  });
});
