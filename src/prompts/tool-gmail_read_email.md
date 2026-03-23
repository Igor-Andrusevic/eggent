# Gmail Read Email

Read the full content of a specific Gmail message by ID.

## When to Use
- User wants to read a specific email in detail
- After listing emails, user asks to see full content
- User needs to extract information from an email
- User asks "what does the email say?"

## Parameters
- `message_id`: Required. The ID from gmail_list_emails results

## Best Practices
- Always get message_id from gmail_list_emails first
- Present email content in a clean, readable format
- Extract and highlight key information (dates, links, action items)
- For emails with attachments, note that attachments are not downloaded

## Return Format
Returns: id, threadId, from, to, subject, date, full body text, labels.
