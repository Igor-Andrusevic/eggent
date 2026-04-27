import { generateText } from "ai";
import { createModel } from "@/lib/providers/llm-provider";
import { loadDocument } from "@/lib/memory/loaders";
import { isAudioFile, transcribeAudio } from "@/lib/memory/audio-transcription";
import {
  ensureWikiStructure,
  writePage,
  readIndex,
  appendLog,
} from "@/lib/wiki/wiki-store";
import type { WikiIngestResult } from "@/lib/wiki/types";
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

  const truncatedText = sourceText.length > 15000
    ? sourceText.slice(0, 15000) + "\n\n[... document truncated ...]"
    : sourceText;

  let parsed: IngestResponse;
  try {
    parsed = await callLlmForIngest(truncatedText, settings);
  } catch (error) {
    result.errors.push(`LLM ingest failed for ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    await appendLog(projectId, {
      timestamp: new Date().toISOString(),
      operation: "ingest",
      detail: `FAILED: ${filename}`,
      affectedPages: [],
    });
    return result;
  }

  const stem = filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();

  try {
    const summaryContent = buildSourcePageContent(filename, parsed.summary, parsed.entities, parsed.concepts);
    await writePage(projectId, "sources", stem, summaryContent);
    result.createdPages.push(`sources/${stem}`);
  } catch (error) {
    result.errors.push(`Failed to write source page: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const entity of parsed.entities) {
    try {
      const entityContent = buildEntityPageContent(entity.name, entity.type, entity.description, filename);
      const existingIndex = await readIndex(projectId);
      const exists = existingIndex.some((e) => e.category === "entities" && e.name === entity.name);

      await writePage(projectId, "entities", entity.name, entityContent);
      if (exists) {
        result.updatedPages.push(`entities/${entity.name}`);
      } else {
        result.createdPages.push(`entities/${entity.name}`);
      }
    } catch (error) {
      result.errors.push(`Failed to write entity ${entity.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const concept of parsed.concepts) {
    try {
      const conceptContent = buildConceptPageContent(concept.name, concept.explanation, filename);
      const existingIndex = await readIndex(projectId);
      const exists = existingIndex.some((e) => e.category === "concepts" && e.name === concept.name);

      await writePage(projectId, "concepts", concept.name, conceptContent);
      if (exists) {
        result.updatedPages.push(`concepts/${concept.name}`);
      } else {
        result.createdPages.push(`concepts/${concept.name}`);
      }
    } catch (error) {
      result.errors.push(`Failed to write concept ${concept.name}: ${error instanceof Error ? error.message : String(error)}`);
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
