# Google Calendar List Events

List events from Google Calendar within a date range.

## When to Use
- User asks about their schedule
- User wants to see upcoming events
- User needs to check availability
- User asks "what's on my calendar?"

## Parameters
- `time_min`: Start of range (ISO 8601 format, defaults to now)
- `time_max`: End of range (ISO 8601 format, defaults to 7 days from now)
- `max_results`: Maximum events to return (default 20)

## Date Format
Use ISO 8601 format: `2024-01-15T10:30:00Z` or include timezone offset

## Best Practices
- Default 7-day window is good for weekly overview
- For specific days, set time_min to start of day, time_max to end of day
- Present events chronologically with clear time formatting
- Note all-day events separately from timed events

## Return Format
Returns events with: id, summary, start/end times, location, attendees, status.
