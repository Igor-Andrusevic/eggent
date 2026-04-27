import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  queryWiki,
  getWikiPage,
  searchWikiPages,
  formatWikiResults,
  type WikiQueryResult,
} from "@/lib/wiki/query";
import {
  ensureWikiStructure,
  writePage,
  deleteWiki,
} from "@/lib/wiki/wiki-store";

const TEST_PROJECT_ID = "test-wiki-query";

beforeEach(async () => {
  await deleteWiki(TEST_PROJECT_ID);
  await ensureWikiStructure(TEST_PROJECT_ID);
});

afterEach(async () => {
  await deleteWiki(TEST_PROJECT_ID);
});

describe("query", () => {
  it("returns error for empty wiki", async () => {
    const { results, error } = await queryWiki(TEST_PROJECT_ID, "test", 5);
    expect(results).toHaveLength(0);
    expect(error).toContain("empty");
  });

  it("finds pages by name match", async () => {
    await writePage(TEST_PROJECT_ID, "concepts", "machine-learning",
      "# Machine Learning\nMachine learning is a subfield of AI.");

    const { results } = await queryWiki(TEST_PROJECT_ID, "machine learning", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].page.name).toBe("machine-learning");
  });

  it("finds pages by content match", async () => {
    await writePage(TEST_PROJECT_ID, "sources", "report",
      "# Report\nThis document discusses neural networks and deep learning.");

    const { results } = await queryWiki(TEST_PROJECT_ID, "neural networks", 5);
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects limit parameter", async () => {
    await writePage(TEST_PROJECT_ID, "sources", "doc-1", "# Doc 1\nContent about Python programming.");
    await writePage(TEST_PROJECT_ID, "sources", "doc-2", "# Doc 2\nMore Python content.");
    await writePage(TEST_PROJECT_ID, "sources", "doc-3", "# Doc 3\nEven more Python.");

    const { results } = await queryWiki(TEST_PROJECT_ID, "Python", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns empty results for non-matching query", async () => {
    await writePage(TEST_PROJECT_ID, "sources", "cooking", "# Cooking\nHow to bake bread.");

    const { results } = await queryWiki(TEST_PROJECT_ID, "quantum physics", 5);
    expect(results).toHaveLength(0);
  });
});

describe("getWikiPage", () => {
  it("returns a page by category and name", async () => {
    const content = "# Test\nSome content here.";
    await writePage(TEST_PROJECT_ID, "entities", "test-entity", content);

    const page = await getWikiPage(TEST_PROJECT_ID, "entities", "test-entity");
    expect(page).not.toBeNull();
    expect(page!.content).toBe(content);
  });

  it("returns null for non-existent page", async () => {
    const page = await getWikiPage(TEST_PROJECT_ID, "entities", "nonexistent");
    expect(page).toBeNull();
  });
});

describe("searchWikiPages", () => {
  it("returns matching pages with snippets", async () => {
    await writePage(TEST_PROJECT_ID, "concepts", "kubernetes",
      "# Kubernetes\nKubernetes is a container orchestration platform.");

    const results = await searchWikiPages(TEST_PROJECT_ID, "container orchestration", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("kubernetes");
    expect(results[0].snippet).toBeTruthy();
  });
});

describe("formatWikiResults", () => {
  it("formats results into readable text", () => {
    const results: WikiQueryResult[] = [
      {
        page: {
          category: "sources",
          name: "test-doc",
          filePath: "/path/to/test-doc.md",
          content: "# Test\nContent here.",
          createdAt: "2026-04-27T00:00:00.000Z",
          updatedAt: "2026-04-27T00:00:00.000Z",
        },
        indexEntry: {
          category: "sources",
          name: "test-doc",
          relativePath: "sources/test-doc.md",
          summary: "A test document.",
          updatedAt: "2026-04-27",
        },
        relevanceScore: 0.85,
      },
    ];

    const formatted = formatWikiResults(results);
    expect(formatted).toContain("[Wiki Page 1]");
    expect(formatted).toContain("85.0%");
    expect(formatted).toContain("Content here.");
  });

  it("returns message for empty results", () => {
    const formatted = formatWikiResults([]);
    expect(formatted).toContain("No relevant wiki pages");
  });
});
