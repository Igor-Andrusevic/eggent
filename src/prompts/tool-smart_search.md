# Smart Search Tool

Use this as your **only** search tool. It automatically searches all knowledge sources in the right order and combines results.

## What It Searches

1. **Wiki** — LLM-curated, cross-referenced compiled knowledge (entities, concepts, summaries)
2. **Knowledge Base (RAG)** — raw document chunks via semantic search (automatic fallback)
3. **Memory** — facts, preferences, and solutions you've explicitly saved

## When to Use

- **Any time** you need to find information from the project's documents, wiki, or memory
- For conceptual questions about document content
- For exact text/quote lookups in documents
- For recalling facts the user told you to remember
- **Always use smart_search instead of wiki_query, knowledge_query, or memory_load**

## How It Works

- Wiki is searched first (compiled, cross-referenced knowledge)
- If wiki results are insufficient, knowledge base (RAG) is searched automatically
- Memory is searched as additional fallback
- Results from all sources are merged, ranked, and deduplicated
- Each result shows its source: [Wiki], [RAG], or [Memory]

## Tips

- Use natural language queries — the tool handles semantic matching
- Wiki results are preferred because they contain curated, cross-referenced knowledge
- RAG results provide exact text fragments from uploaded documents
- Memory results show facts you've explicitly saved
