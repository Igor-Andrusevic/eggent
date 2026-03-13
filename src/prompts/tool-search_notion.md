# Search Notion Tool

Search for pages and databases in Notion using semantic search.

## When to Use

- When you need to find a parent page or database before creating new content
- When the user asks to find something in their Notion workspace
- Before creating a page to check if it already exists
- To get page IDs for updating existing content

## Usage

Provide a descriptive search query:
- Use page titles, keywords, or concepts
- The search is semantic, so natural language works best
- Optionally filter by type: "page" or "database"

## Tips

- Be specific in your search query for better results
- If searching for a parent page, use the exact page name if possible
- Results show the page title, ID, and type (page 📄 or database 🗃️)
- Page IDs are needed when you want to create content inside a specific page

## Example

```
User: "Find my Development notes page"
→ search_notion { query: "Development", filter: "page" }
```

Returns:
```
Found 1 result:
[1] 📄 Development
    ID: 1a2b3c4d-5e6f-7890-abcd-ef1234567890
```
