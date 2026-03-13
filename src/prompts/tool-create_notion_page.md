# Create Notion Page Tool

Create a new page in Notion with smart parent resolution.

## Features

- **Automatic parent search**: If you provide `parentName`, the tool will search for the page
- **Workspace root fallback**: If no parent is found or specified, creates in workspace root
- **Direct parent ID**: Use `parentId` for precise control
- **Content support**: Optionally add page content

## When to Use

- When the user asks to create a note, page, or document in Notion
- To save information to Notion
- To create task lists, meeting notes, or documentation
- When user wants to "remember" something in Notion

## Usage

### Simple (creates in workspace root)
```
create_notion_page { title: "My New Page" }
```

### With content
```
create_notion_page {
  title: "Meeting Notes - 2026-03-10",
  content: "## Attendees\n- Alice\n- Bob\n\n## Discussion\n..."
}
```

### With parent name (automatic search)
```
create_notion_page {
  title: "Task: Fix login bug",
  parentName: "Development"
}
```

### With direct parent ID
```
create_notion_page {
  title: "Subtask",
  parentId: "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  parentType: "page"
}
```

## Parameter Guide

- **title** (required): Page title
- **content** (optional): Page content in Markdown format
- **parentName** (optional): Search for parent by name
- **parentId** (optional): Direct parent ID (skips search)
- **parentType** (optional): "page", "database", or "workspace" (default: "page")

## Best Practices

1. **Search first**: When creating inside a specific page, use `search_notion` to find the parent
2. **Use parentName**: More user-friendly than direct IDs
3. **Add context**: Include meaningful content when creating notes
4. **Check result**: The tool returns the page URL for verification

## Response Format

```
✅ Page created successfully in "Development"

📝 Page: https://notion.so/1a2b3c4d5e6f7890abcdefghijkl1234567890
```

## Example Workflow

```
User: "Create a task list in my Development project"

Agent:
1. search_notion { query: "Development", filter: "page" }
2. create_notion_page {
     title: "Task List - Q1 2026",
     parentName: "Development",
     content: "## Tasks\n- [ ] Task 1\n- [ ] Task 2"
   }
```

## Error Handling

- If parent page not found by name: Creates in workspace root instead
- If Notion MCP not configured: Returns clear error message
- If creation fails: Shows detailed error with troubleshooting hints
