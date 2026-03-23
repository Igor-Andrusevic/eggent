# Gmail Manage Labels

Manage Gmail labels on messages.

## When to Use
- User wants to mark email as read/unread
- User wants to archive, star, or apply custom labels
- User asks to organize their inbox

## Actions
- `list`: List all available labels
- `add`: Add labels to a message (e.g., mark as read, star)
- `remove`: Remove labels from a message

## Common Label IDs
- `UNREAD` - Mark as unread (remove to mark as read)
- `STARRED` - Star an email
- `IMPORTANT` - Mark as important
- `SPAM` - Mark as spam
- `TRASH` - Move to trash
- `INBOX` - Keep in inbox (remove to archive)

## Best Practices
- Use `list` action first to see available labels
- To mark as read: remove UNREAD label
- To mark as unread: add UNREAD label
- To archive: remove INBOX label
