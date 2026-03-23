# Gmail Send Email

Send an email via Gmail.

## When to Use
- User asks to send an email
- User wants to reply to a conversation
- User needs to compose and send a message

## Parameters
- `to`: Recipient email address (required)
- `subject`: Email subject line (required)
- `body`: Email body text (required)
- `reply_to_message_id`: Optional message ID to reply to (maintains thread)

## Best Practices
- Confirm with user before sending sensitive emails
- For replies, use reply_to_message_id to maintain thread context
- Compose clear, professional email content
- Include proper greeting and closing

## Example
```
to: "john@example.com"
subject: "Re: Meeting Tomorrow"
body: "Hi John,\n\nI'll see you at 2pm.\n\nBest regards"
reply_to_message_id: "18a3b4c5d6e7f8g9"
```
