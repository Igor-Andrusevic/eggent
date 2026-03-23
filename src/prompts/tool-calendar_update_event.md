# Google Calendar Update Event

Update an existing Google Calendar event.

## When to Use
- User wants to reschedule an event
- User asks to change event details
- User mentions updating a meeting

## Parameters
- `event_id`: ID of event to update (required)
- `summary`: New title (optional)
- `start`: New start time (optional)
- `end`: New end time (optional)
- `description`: New description (optional)
- `location`: New location (optional)
- `attendees`: New attendee list (optional)

## Best Practices
- First use calendar_list_events to find the event ID
- Only include fields that need to be changed
- Confirm changes with user before applying
- For time changes, ensure both start and end are appropriate

## Workflow
1. List events to find the event_id
2. Confirm what changes user wants
3. Call update with only changed fields
