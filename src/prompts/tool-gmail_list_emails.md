# Gmail List Emails

Search and list Gmail messages using Gmail query syntax.

## When to Use
- User asks to check their inbox or emails
- User wants to search for specific emails
- User needs to find emails from a sender or with specific subject
- User asks about unread emails

## Query Syntax Examples
- `is:unread` - Unread messages only
- `from:example@gmail.com` - Emails from specific sender
- `to:me@example.com` - Emails sent to specific address
- `subject:meeting` - Emails with "meeting" in subject
- `has:attachment` - Emails with attachments
- `newer_than:7d` - Emails from last 7 days
- `is:starred` - Starred emails
- Combine: `is:unread from:boss@company.com`

## Best Practices
- Start with small max_results (10-20) to avoid overwhelming output
- Use specific queries to narrow down results
- For reading full email content, use gmail_read_email with the message ID
- Present results in a clean, readable format

## Return Format
Returns list of emails with: id, threadId, from, subject, date, snippet, unread status.
