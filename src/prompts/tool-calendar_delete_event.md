# Google Calendar Delete Event

Delete an event from Google Calendar.

## When to Use
- User asks to cancel a meeting
- User wants to remove an event from calendar
- User mentions deleting or removing a scheduled item

## Parameters
- `event_id`: ID of the event to delete (required)

## Best Practices
- First use calendar_list_events to find the event ID
- Confirm with user before deleting (show event summary)
- Note that this permanently removes the event
- For recurring events, this may affect the series

## Workflow
1. List events to identify the correct event
2. Show event summary to user for confirmation
3. Delete after user confirms

## Caution
Deletion is permanent. Always confirm with user first.
