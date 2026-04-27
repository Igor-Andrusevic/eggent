# Wiki Lint Tool

Health-check the project wiki for issues and inconsistencies.

## What It Checks

- **Orphan pages** — Pages with no inbound cross-references
- **Stale references** — Index entries pointing to deleted pages
- **Missing cross-references** — Pages that exist but aren't in the index
- **Empty pages** — Pages with very little content
- **Contradictions** — Conflicting information between pages

## When to Use

- Periodically, to keep the wiki healthy
- After bulk-ingesting many documents
- When the user asks about wiki health
- After deleting or renaming pages

## What to Do with Results

- Fix orphan pages by adding cross-references
- Remove stale index entries
- Expand empty pages with more content
- Resolve contradictions by updating affected pages
