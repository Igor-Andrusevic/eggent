import { generateText } from "ai";
import { createModel } from "@/lib/providers/llm-provider";
import { loadDocument } from "@/lib/memory/loaders";
import { isAudioFile, transcribeAudio } from "@/lib/memory/audio-transcription";
import {
  ensureWikiStructure,
  writePage,
  readIndex,
  readPage,
  appendLog,
} from "@/lib/wiki/wiki-store";
import type { WikiIngestResult, WikiPageCategory } from "@/lib/wiki/types";
import type { AppSettings } from "@/lib/types";

const INGEST_PROMPT = `You are a wiki maintainer. Your job is to read a source document and produce structured wiki content.

Given the source text below, produce the following:

1. **SUMMARY** (for the sources/ page): A concise 2-3 paragraph summary of the key information in this document.

2. **ENTITIES**: A list of named entities (people, organizations, places, products, etc.) mentioned in the document. For each entity, provide:
   - Name (kebab-case, e.g. "john-smith")
   - Type (person, organization, place, product, etc.)
   - A 1-2 sentence description based on what the document says about this entity
   Only include entities that have meaningful mentions (not just passing references).

3. **CONCEPTS**: A list of key concepts, topics, or themes discussed. For each concept:
   - Name (kebab-case, e.g. "machine-learning")
   - A 2-3 sentence explanation of the concept as discussed in this document

4. **CROSS_REFERENCES**: Names of existing wiki pages that should be updated or cross-referenced with this new content (if any are mentioned or related).

Respond in this exact JSON format:
{
  "summary": "...",
  "entities": [{"name": "...", "type": "...", "description": "..."}],
  "concepts": [{"name": "...", "explanation": "..."}],
  "crossReferences": ["entity-or-concept-name", ...]
}

If the document is too short or trivial to extract meaningful entities/concepts, return empty arrays.
Keep entity and concept names concise and kebab-case.`;

const MERGE_PROMPT = `You are a wiki editor merging new information into an existing wiki page.

Rules:
- Preserve ALL existing information — never delete or lose existing content
- Integrate the new information naturally into the existing structure
- If new info contradicts existing info, keep both with a note like "Note: [source] states..."
- Add the new source to the Sources section if not already listed
- Update the "Last updated" date to today
- Keep the same markdown heading structure
- Do NOT invent information not present in either version
- Return ONLY the merged markdown content, no explanation

EXISTING PAGE:
---
{existingContent}
---

NEW INFORMATION from source "{sourceFile}":
---
{newExtract}
---

Produce the merged page content:`;

const MAX_CHUNK_CHARS = 14000;
const MAX_CHUNKS = 5;
const CHUNK_OVERLAP = 2000;
const MAX_MERGE_CONTENT = 8000;

export async function ingestSource(
  projectId: string,
  filePath: string,
  filename: string,
  settings: AppSettings
): Promise<WikiIngestResult> {
  const result: WikiIngestResult = { createdPages: [], updatedPages: [], errors: [] };

  await ensureWikiStructure(projectId);

  let sourceText: string | null = null;
  try {
    if (isAudioFile(filename)) {
      sourceText = await transcribeAudio(filePath, settings);
    } else {
      const doc = await loadDocument(filePath);
      sourceText = doc?.text || null;
    }
  } catch (error) {
    result.errors.push(`Failed to load ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }

  if (!sourceText || !sourceText.trim()) {
    result.errors.push(`No text content in ${filename}`);
    return result;
  }

  const chunks = chunkText(sourceText, MAX_CHUNK_CHARS, CHUNK_OVERLAP, MAX_CHUNKS);

  const allParsed: IngestResponse[] = [];
  for (const chunk of chunks) {
    try {
      const parsed = await callLlmForIngest(chunk, settings);
      allParsed.push(parsed);
    } catch (error) {
      result.errors.push(`LLM ingest failed for ${filename} (chunk): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (allParsed.length === 0) {
    result.errors.push(`All ingest attempts failed for ${filename}`);
    await appendLog(projectId, {
      timestamp: new Date().toISOString(),
      operation: "ingest",
      detail: `FAILED: ${filename}`,
      affectedPages: [],
    });
    return result;
  }

  const merged = mergeChunkResults(allParsed);

  const stem = filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();

  try {
    const summaryContent = buildSourcePageContent(filename, merged.summary, merged.entities, merged.concepts);
    await writePage(projectId, "sources", stem, summaryContent);
    result.createdPages.push(`sources/${stem}`);
  } catch (error) {
    result.errors.push(`Failed to write source page: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const entity of merged.entities) {
    try {
      const existingIndex = await readIndex(projectId);
      const exists = existingIndex.some((e) => e.category === "entities" && e.name === entity.name);

      if (exists) {
        const existingPage = await readPage(projectId, "entities", entity.name);
        if (existingPage) {
          const mergedContent = await mergePageWithLlm(existingPage.content, entity.description, entity.type, filename, settings);
          await writePage(projectId, "entities", entity.name, mergedContent);
          result.updatedPages.push(`entities/${entity.name}`);
          continue;
        }
      }

      const entityContent = buildEntityPageContent(entity.name, entity.type, entity.description, filename);
      await writePage(projectId, "entities", entity.name, entityContent);
      result.createdPages.push(`entities/${entity.name}`);
    } catch (error) {
      result.errors.push(`Failed to write entity ${entity.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const concept of merged.concepts) {
    try {
      const existingIndex = await readIndex(projectId);
      const exists = existingIndex.some((e) => e.category === "concepts" && e.name === concept.name);

      if (exists) {
        const existingPage = await readPage(projectId, "concepts", concept.name);
        if (existingPage) {
          const mergedContent = await mergePageWithLlm(existingPage.content, concept.explanation, undefined, filename, settings);
          await writePage(projectId, "concepts", concept.name, mergedContent);
          result.updatedPages.push(`concepts/${concept.name}`);
          continue;
        }
      }

      const conceptContent = buildConceptPageContent(concept.name, concept.explanation, filename);
      await writePage(projectId, "concepts", concept.name, conceptContent);
      result.createdPages.push(`concepts/${concept.name}`);
    } catch (error) {
      result.errors.push(`Failed to write concept ${concept.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const ref of merged.crossReferences) {
    try {
      await addCrossReference(projectId, ref, filename);
    } catch {
      // cross-reference failures are non-critical
    }
  }

  await appendLog(projectId, {
    timestamp: new Date().toISOString(),
    operation: "ingest",
    detail: filename,
    affectedPages: [...result.createdPages, ...result.updatedPages],
  });

  return result;
}

async function mergePageWithLlm(
  existingContent: string,
  newExtract: string,
  _entityType: string | undefined,
  sourceFile: string,
  settings: AppSettings
): Promise<string> {
  const truncatedExisting = existingContent.length > MAX_MERGE_CONTENT
    ? existingContent.slice(0, MAX_MERGE_CONTENT) + "\n\n[... earlier content truncated ...]"
    : existingContent;

  const prompt = MERGE_PROMPT
    .replace("{existingContent}", truncatedExisting)
    .replace("{newExtract}", newExtract)
    .replace("{sourceFile}", sourceFile);

  const model = createModel(settings.utilityModel);

  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.1,
  });

  const sourceStem = sourceFile.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  const sourceLink = `- [${sourceFile}](../sources/${sourceStem}.md)`;

  let result = text.trim();

  if (!result.includes(sourceStem)) {
    if (result.includes("## Sources")) {
      result = result.replace(/(## Sources\n)/, `$1${sourceLink}\n`);
    } else {
      result += `\n\n## Sources\n\n${sourceLink}\n`;
    }
  }

  return result;
}

async function addCrossReference(
  projectId: string,
  referenceName: string,
  sourceFile: string
): Promise<void> {
  const sanitizedName = sanitizeName(referenceName);

  const categories: WikiPageCategory[] = ["entities", "concepts"];
  for (const category of categories) {
    const existingPage = await readPage(projectId, category, sanitizedName);
    if (existingPage) {
      const sourceStem = sourceFile.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
      const sourceLink = `[${sourceFile}](../sources/${sourceStem}.md)`;

      if (!existingPage.content.includes(sourceStem)) {
        let updated = existingPage.content;
        if (updated.includes("## Sources")) {
          updated = updated.replace(/(## Sources\n)/, `$1- ${sourceLink}\n`);
        } else {
          updated += `\n\n## Sources\n\n- ${sourceLink}\n`;
        }
        await writePage(projectId, category, sanitizedName, updated);
      }
      return;
    }
  }
}

function chunkText(
  text: string,
  maxChars: number,
  overlap: number,
  maxChunks: number
): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length && chunks.length < maxChunks) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const lastParagraph = text.lastIndexOf("\n\n", end);
      if (lastParagraph > start + maxChars * 0.5) {
        end = lastParagraph;
      }
    }

    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

function mergeChunkResults(results: IngestResponse[]): IngestResponse {
  if (results.length === 1) return results[0];

  const summary = results[0].summary;

  const entityMap = new Map<string, IngestEntity>();
  for (const r of results) {
    for (const e of r.entities) {
      const existing = entityMap.get(e.name);
      if (!existing || e.description.length > existing.description.length) {
        entityMap.set(e.name, e);
      }
    }
  }

  const conceptMap = new Map<string, IngestConcept>();
  for (const r of results) {
    for (const c of r.concepts) {
      const existing = conceptMap.get(c.name);
      if (!existing || c.explanation.length > existing.explanation.length) {
        conceptMap.set(c.name, c);
      }
    }
  }

  const crossRefSet = new Set<string>();
  for (const r of results) {
    for (const ref of r.crossReferences) {
      crossRefSet.add(ref);
    }
  }

  return {
    summary,
    entities: Array.from(entityMap.values()),
    concepts: Array.from(conceptMap.values()),
    crossReferences: Array.from(crossRefSet),
  };
}

interface IngestEntity {
  name: string;
  type: string;
  description: string;
}

interface IngestConcept {
  name: string;
  explanation: string;
}

interface IngestResponse {
  summary: string;
  entities: IngestEntity[];
  concepts: IngestConcept[];
  crossReferences: string[];
}

async function callLlmForIngest(
  sourceText: string,
  settings: AppSettings
): Promise<IngestResponse> {
  const model = createModel(settings.utilityModel);

  const { text } = await generateText({
    model,
    prompt: `${INGEST_PROMPT}\n\n---\n\nSource text:\n\n${sourceText}`,
    temperature: 0.1,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("LLM did not return valid JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    summary: String(parsed.summary || ""),
    entities: (Array.isArray(parsed.entities) ? parsed.entities : []).map((e: Record<string, unknown>) => ({
      name: sanitizeName(String(e.name || "")),
      type: String(e.type || "unknown"),
      description: String(e.description || ""),
    })).filter((e: IngestEntity) => e.name.length > 0),
    concepts: (Array.isArray(parsed.concepts) ? parsed.concepts : []).map((c: Record<string, unknown>) => ({
      name: sanitizeName(String(c.name || "")),
      explanation: String(c.explanation || ""),
    })).filter((c: IngestConcept) => c.name.length > 0),
    crossReferences: Array.isArray(parsed.crossReferences) ? parsed.crossReferences.map(String) : [],
  };
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSourcePageContent(
  filename: string,
  summary: string,
  entities: IngestEntity[],
  concepts: IngestConcept[]
): string {
  const entityLinks = entities.map((e) => `- [${e.name}](../entities/${e.name}.md) (${e.type})`).join("\n");
  const conceptLinks = concepts.map((c) => `- [${c.name}](../concepts/${c.name}.md)`).join("\n");

  return `# Source: ${filename}

> Imported: ${new Date().toISOString().slice(0, 10)}

## Summary

${summary}

## Extracted Entities

${entityLinks || "No significant entities extracted."}

## Extracted Concepts

${conceptLinks || "No significant concepts extracted."}
`;
}

function buildEntityPageContent(
  name: string,
  type: string,
  description: string,
  sourceFile: string
): string {
  return `# ${name.replace(/-/g, " ")}

> Type: ${type} | Last updated: ${new Date().toISOString().slice(0, 10)}

## Description

${description}

## Sources

- [${sourceFile}](../sources/${sourceFile.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase()}.md)
`;
}

function buildConceptPageContent(
  name: string,
  explanation: string,
  sourceFile: string
): string {
  return `# ${name.replace(/-/g, " ")}

> Last updated: ${new Date().toISOString().slice(0, 10)}

## Overview

${explanation}

## Sources

- [${sourceFile}](../sources/${sourceFile.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase()}.md)
`;
}
