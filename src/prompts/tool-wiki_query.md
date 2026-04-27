# Wiki Query Tool

Search the project's persistent wiki for compiled knowledge.

## What the Wiki Contains

The wiki is a structured knowledge base maintained by the LLM. It contains:
- **Sources/** — Summaries of ingested documents with extracted entities and concepts
- **Entities/** — Pages about people, organizations, places mentioned across documents
- **Concepts/** — Pages about topics and themes discussed in documents
- **Synthesis/** — Cross-document analyses and comparisons

## When to Use

- As the **primary search tool** for knowledge questions
- Before falling back to `knowledge_query` (raw RAG search)
- When the user asks about topics, entities, or themes from their documents

## Priority Order

1. `wiki_query` — for compiled, cross-referenced knowledge
2. `knowledge_query` — for exact text matching in raw documents
3. `search_web` — for external information not in the wiki

## Tips

- Use natural language queries
- The wiki returns full page content with cross-references already resolved
- If the wiki doesn't have enough detail, use `wiki_read_page` to get full page content
