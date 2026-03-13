# Eggent Compatibility Patches

## Overview

This document describes two critical patches for Eggent that fix API compatibility issues:
1. **Gemini API compatibility patch** - Separates text from tool calls in assistant messages
2. **Telegram reply_to_message_id fix** - Prevents errors when bot replies to old messages

Both patches are automatically applied by `scripts/patch-gemini-fix.sh`.

## Patch 1: Gemini API Compatibility

### Problem

Google Gemini API has strict requirements for message ordering when using function calls (tools):

> **Error:** `Please ensure that function response turn comes immediately after a function call turn.`

This occurs when an assistant message contains both text content AND tool calls in the same message. Gemini requires these to be separate messages.

## Solution

The patch modifies `src/lib/agent/agent.ts` to split assistant messages that have both text and tool calls into two separate messages:

1. **First message:** Text only (if any)
2. **Second message:** Tool calls only

This ensures proper ordering that Gemini requires.

## Files Modified

- `src/lib/agent/agent.ts` - Main fix
- `scripts/patch-gemini-fix.sh` - Automated patch script
- `package.json` - Added `patch:gemini` and `postinstall` commands

## How It Works

### After (Fixed Code):
```typescript
} else if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
  // Split into two messages for Gemini compatibility
  if (m.content && m.content.trim()) {
    result.push({ role: "assistant", content: m.content }); // Text only
  }
  const toolCallContent = m.toolCalls.map(tc => ({...}));
  result.push({ role: "assistant", content: toolCallContent }); // Tools only
}
```

## Patch 2: Telegram reply_to_message_id Fix

### Problem

When the Telegram bot tries to reply to a user message, it uses `reply_to_message_id` parameter. However, if:
- The message was sent via API (not direct user input)
- The message is too old
- The message was deleted

Telegram returns an error:
> **Error:** `Bad Request: message to be replied not found`

This causes the bot to fail even though it processed the request correctly.

### Solution

Remove the `reply_to_message_id` parameter when sending responses. The bot will still send the message to the correct chat, just without marking it as a reply to a specific message.

### Files Modified

Both patches modify:
- `src/lib/agent/agent.ts` - Gemini fix
- `src/app/api/integrations/telegram/route.ts` - Telegram fix
- `scripts/patch-gemini-fix.sh` - Unified patcher (applies both fixes)
- `package.json` - Added `patch:gemini` and `postinstall` commands

### How It Works

The unified patcher (`scripts/patch-gemini-fix.sh`) applies both fixes:

1. **Patch 1 - Gemini API**: Separates text content from tool calls in assistant messages
   - Checks if pattern exists in `agent.ts`
   - Creates backup
   - Applies sed replacement to split messages
   - Verifies patch was applied

2. **Patch 2 - Telegram**: Removes `reply_to_message_id` parameter
   - Checks if problematic pattern exists in `telegram/route.ts`
   - Creates backup
   - Removes messageId parameter from sendTelegramMessage call
   - Verifies patch was applied

Both patches are applied in a single run, with clear status output for each.

## Usage

### Manual Patch Application

If the patch was reverted after an update:

```bash
cd ~/.eggent
npm run patch:gemini
docker compose restart app  # If using Docker
```

### Automatic Application

The patch is applied automatically when:
1. Running `npm install` (via `postinstall` hook)
2. Running `npm run patch:gemini` manually

The script checks if the patch is already applied and skips if present.

## Verification

To verify the patch is applied:

```bash
grep "IMPORTANT: Gemini requires text and tool calls" src/lib/agent/agent.ts
```

If the line is present, the patch is active.

## After Updates

When updating Eggent:

1. Pull the latest changes
2. Run `npm install` (automatically applies patch)
3. If using Docker, restart: `docker compose restart app`
4. Verify Telegram bot works

## Troubleshooting

### Patch Not Applied

If you see the Gemini error after an update:

```bash
cd ~/.eggent
bash scripts/patch-gemini-fix.sh
docker compose restart app
```

### Script Fails

If the script fails:
1. Check backup file created: `src/lib/agent/agent.ts.backup-*`
2. Manually restore if needed
3. Check if code structure has changed in new version

## Related Issues

- Telegram bot not responding with Google Gemini models
- Error: "function response turn comes immediately after a function call turn"
- AI calls failing with 400 status from Gemini API

## Cleaning Up Old Chats

After applying the patch, old chat messages may still have the problematic structure. Use the cleanup script:

```bash
cd ~/.eggent
bash scripts/cleanup-chats.sh
```

This will:
1. Create a backup of all chats
2. Offer options to delete Telegram session chats or ALL chats
3. Allow you to start fresh with correct message structure

**Recommended:** Delete Telegram session chats (option 1) to fix immediate issues without losing other chat history.

## Alternative Solutions

If you prefer not to use the patch:
1. Switch to OpenAI or Anthropic models in settings
2. These providers are more lenient with message ordering

## Testing the Fix

To verify the fix works:

1. Apply the patch: `npm run patch:gemini`
2. Restart the app: `docker compose restart app`
3. Send a message to your Telegram bot
4. Check logs: `docker logs -f eggent-app-1`
5. You should NOT see "function response turn comes immediately after a function call turn" error
