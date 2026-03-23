# Google Calendar Create Event

Create a new event in Google Calendar.

## When to Use
- User asks to schedule a meeting or event
- User wants to add something to their calendar
- User mentions creating a reminder or appointment

## Parameters
- `summary`: Event title (required)
- `start`: Start time ISO 8601 or date YYYY-MM-DD for all-day (required)
- `end`: End time ISO 8601 or date YYYY-MM-DD for all-day (required)
- `description`: Event description (optional)
- `location`: Location or video call URL (optional)
- `attendees`: Array of email addresses (optional)

## Time Format
- Timed event: `2024-01-15T10:30:00` (ISO 8601)
- All-day event: `2024-01-15` (date only)

## Best Practices
- Always confirm event details with user before creating
- Include timezone consideration for the user's location
- For video calls, add meeting URL to location field
- Ask about attendees if it seems like a meeting

## Example
```
summary: "Team Standup"
start: "2024-01-15T09:00:00"
end: "2024-01-15T09:30:00"
attendees: ["team@example.com"]
```
