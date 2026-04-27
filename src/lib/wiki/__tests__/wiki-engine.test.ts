import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  wikiQuery,
  wikiReadPage,
  wikiCreatePage,
  wikiLint,
  wikiGetStatus,
} from "@/lib/wiki/wiki-engine";
import { deleteWiki } from "@/lib/wiki/wiki-store";

const TEST_PROJECT_ID = "test-wiki-engine";

beforeEach(async () => {
  await deleteWiki(TEST_PROJECT_ID);
});

afterEach(async () => {
  await deleteWiki(TEST_PROJECT_ID);
});

describe("wikiCreatePage", () => {
  it("creates a new wiki page", async () => {
    const result = await wikiCreatePage(
      TEST_PROJECT_ID,
      "concepts",
      "test-concept",
      "# Test Concept\nThis is a test concept page."
    );

    expect(result).toContain("created");
    expect(result).toContain("concepts/test-concept");
  });

  it("sanitizes page name", async () => {
    const result = await wikiCreatePage(
      TEST_PROJECT_ID,
      "entities",
      "John Smith (Researcher)",
      "# John Smith\nA researcher."
    );

    expect(result).toContain("created");
    expect(result).toContain("john-smith-researcher");
  });

  it("rejects invalid category", async () => {
    const result = await wikiCreatePage(
      TEST_PROJECT_ID,
      "invalid",
      "test",
      "# Test"
    );

    expect(result).toContain("Invalid category");
  });
});

describe("wikiReadPage", () => {
  it("reads an existing page", async () => {
    await wikiCreatePage(
      TEST_PROJECT_ID,
      "sources",
      "my-doc",
      "# My Doc\nContent here."
    );

    const content = await wikiReadPage(TEST_PROJECT_ID, "sources/my-doc");
    expect(content).toContain("My Doc");
  });

  it("returns error for invalid path", async () => {
    const result = await wikiReadPage(TEST_PROJECT_ID, "invalid-path");
    expect(result).toContain("Invalid");
  });

  it("returns error for non-existent page", async () => {
    const result = await wikiReadPage(TEST_PROJECT_ID, "sources/nonexistent");
    expect(result).toContain("not found");
  });
});

describe("wikiQuery", () => {
  it("returns empty message for wiki with no pages", async () => {
    const result = await wikiQuery(TEST_PROJECT_ID, "test", 5);
    expect(result).toContain("empty");
  });

  it("finds pages after creation", async () => {
    await wikiCreatePage(
      TEST_PROJECT_ID,
      "concepts",
      "kubernetes",
      "# Kubernetes\nKubernetes is a container orchestration system for managing microservices."
    );

    const result = await wikiQuery(TEST_PROJECT_ID, "kubernetes container", 5);
    expect(result).toContain("Kubernetes");
  });
});

describe("wikiLint", () => {
  it("returns healthy report for empty wiki", async () => {
    const result = await wikiLint(TEST_PROJECT_ID);
    expect(result).toContain("Total pages: 0");
    expect(result).toContain("No issues");
  });

  it("detects issues in wiki", async () => {
    const fs = await import("fs/promises");
    const path = await import("path");

    const wikiDir = path.join(
      process.cwd(), "data", "projects", TEST_PROJECT_ID,
      ".meta", "wiki"
    );
    await fs.mkdir(path.join(wikiDir, "sources"), { recursive: true });
    await fs.writeFile(
      path.join(wikiDir, "sources", "untracked.md"),
      "# Untracked\nNot in index.",
      "utf-8"
    );

    const result = await wikiLint(TEST_PROJECT_ID);
    expect(result).toContain("missing_cross_reference");
  });
});

describe("wikiGetStatus", () => {
  it("shows status for empty wiki", async () => {
    const status = await wikiGetStatus(TEST_PROJECT_ID);
    expect(status).toContain("0 pages");
  });

  it("shows status with pages", async () => {
    await wikiCreatePage(TEST_PROJECT_ID, "sources", "doc-1", "# Doc 1\nContent");
    await wikiCreatePage(TEST_PROJECT_ID, "entities", "person-1", "# Person 1\nDescription");

    const status = await wikiGetStatus(TEST_PROJECT_ID);
    expect(status).toContain("2 pages");
    expect(status).toContain("sources");
    expect(status).toContain("entities");
  });
});
