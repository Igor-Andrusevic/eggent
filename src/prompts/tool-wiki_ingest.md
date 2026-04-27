# Wiki Ingest Tool

Manually trigger wiki processing for a file from the project's knowledge base.

## What Ingest Does

1. Reads the file content
2. Uses LLM to extract key information
3. Creates a summary page in `sources/`
4. Extracts entities into `entities/` pages
5. Extracts concepts into `concepts/` pages
6. Updates the wiki index

## When to Use

- When a file was uploaded but wiki ingest failed
- When you want to re-process a file with updated extraction
- When the user explicitly asks to process a file into the wiki

## Notes

- Ingest runs automatically when files are uploaded
- This tool is for manual re-processing or recovery
- The process may take a few seconds for large documents
