#!/bin/bash

# Patch for Eggent compatibility fixes
# This script applies:
# 1. Gemini API compatibility patch (separates text from tool calls)
# 2. Telegram reply_to_message_id fix (prevents errors on old messages)
# 3. Telegram auto-import to knowledge base (files auto-embedded for search)
#
# Run this after updating Eggent to re-apply patches if needed.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AGENT_FILE="$PROJECT_ROOT/src/lib/agent/agent.ts"
TELEGRAM_FILE="$PROJECT_ROOT/src/app/api/integrations/telegram/route.ts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 Checking Eggent compatibility patches..."

# Check if files exist
if [ ! -f "$AGENT_FILE" ]; then
    echo -e "${RED}Error: Agent file not found at $AGENT_FILE${NC}"
    exit 1
fi

if [ ! -f "$TELEGRAM_FILE" ]; then
    echo -e "${RED}Error: Telegram file not found at $TELEGRAM_FILE${NC}"
    exit 1
fi

# Track if any patches were applied
PATCHES_APPLIED=false

# ============================================================================
# Patch 1: Gemini API compatibility
# ============================================================================
echo ""
echo -e "${BLUE}[1/3]${NC} Gemini API compatibility patch..."

if grep -q "IMPORTANT: Gemini requires text and tool calls to be in separate messages" "$AGENT_FILE"; then
    echo -e "${GREEN}  ✓ Gemini patch already applied${NC}"
else
    if grep -q "assistant message with tool calls - AI SDK uses 'input' not 'args'" "$AGENT_FILE"; then
        echo "  Applying Gemini compatibility patch..."

        # Create backup
        BACKUP_FILE="$AGENT_FILE.backup-$(date +%Y%m%d-%H%M%S)"
        cp "$AGENT_FILE" "$BACKUP_FILE"
        echo "  Backup created: $BACKUP_FILE"

        # Apply the patch using sed
        sed -i '/} else if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {/,/result.push({ role: "assistant", content });/c\
    } else if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {\
      // Assistant message with tool calls\
      // IMPORTANT: Gemini requires text and tool calls to be in separate messages\
      // If there'"'"'s both text and tool calls, split into two messages\
      if (m.content && m.content.trim()) {\
        // First message: text only\
        result.push({ role: "assistant", content: m.content });\
      }\
      // Second message: tool calls only\
      const toolCallContent = m.toolCalls.map(tc => ({\
        type: "tool-call" as const,\
        toolCallId: tc.toolCallId,\
        toolName: tc.toolName,\
        input: tc.args,\
      }));\
      result.push({ role: "assistant", content: toolCallContent });' "$AGENT_FILE"

        # Verify the patch was applied
        if grep -q "IMPORTANT: Gemini requires text and tool calls to be in separate messages" "$AGENT_FILE"; then
            echo -e "${GREEN}  ✓ Gemini patch applied successfully!${NC}"
            PATCHES_APPLIED=true
        else
            echo -e "${RED}  ✗ Gemini patch application failed${NC}"
            echo "  Restoring backup..."
            cp "$BACKUP_FILE" "$AGENT_FILE"
            exit 1
        fi
    else
        echo -e "${YELLOW}  ⚠ Gemini patch pattern not found. May already be fixed.${NC}"
    fi
fi

# ============================================================================
# Patch 2: Telegram reply_to_message_id fix
# ============================================================================
echo ""
echo -e "${BLUE}[2/3]${NC} Telegram reply_to_message_id fix..."

if grep -q "Don'\''t reply to old message - just send the response" "$TELEGRAM_FILE"; then
    echo -e "${GREEN}  ✓ Telegram reply patch already applied${NC}"
else
    # Check for the pattern that needs to be fixed
    if grep -q "await sendTelegramMessage(botToken, chatId, result.reply, messageId);" "$TELEGRAM_FILE"; then
        echo "  Applying Telegram reply fix..."

        # Create backup
        BACKUP_FILE="$TELEGRAM_FILE.backup-$(date +%Y%m%d-%H%M%S)"
        cp "$TELEGRAM_FILE" "$BACKUP_FILE"
        echo "  Backup created: $BACKUP_FILE"

        # Apply the patch - remove messageId parameter
        sed -i 's/await sendTelegramMessage(botToken, chatId, result.reply, messageId);/await sendTelegramMessage(botToken, chatId, result.reply);/g' "$TELEGRAM_FILE"

        # Verify the patch was applied
        if ! grep -q "await sendTelegramMessage(botToken, chatId, result.reply, messageId);" "$TELEGRAM_FILE"; then
            # Old pattern not found - patch applied
            echo -e "${GREEN}  ✓ Telegram reply patch applied successfully!${NC}"
            PATCHES_APPLIED=true
        else
            echo -e "${YELLOW}  ⚠ Telegram reply patch may not have applied correctly${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ Telegram reply patch pattern not found. May already be fixed.${NC}"
    fi
fi

# ============================================================================
# Patch 3: Telegram auto-import to knowledge base
# ============================================================================
echo ""
echo -e "${BLUE}[3/3]${NC} Telegram auto-import to knowledge base..."

# Check if required imports exist
IMPORTS_OK=true
if ! grep -q "import path from \"node:path\";" "$TELEGRAM_FILE"; then
    IMPORTS_OK=false
fi
if ! grep -q "import fs from \"node:fs/promises\";" "$TELEGRAM_FILE"; then
    IMPORTS_OK=false
fi
if ! grep -q "import { importKnowledgeFile } from \"@/lib/memory/knowledge\";" "$TELEGRAM_FILE"; then
    IMPORTS_OK=false
fi
if ! grep -q "import { getSettings } from \"@/lib/storage/settings-store\";" "$TELEGRAM_FILE"; then
    IMPORTS_OK=false
fi

# Check if knowledge import code exists
if grep -q "Automatically import file to project knowledge base" "$TELEGRAM_FILE"; then
    echo -e "${GREEN}  ✓ Telegram auto-import patch already applied${NC}"
else
    echo "  Applying Telegram auto-import patch..."

    # Create backup
    BACKUP_FILE="$TELEGRAM_FILE.backup-$(date +%Y%m%d-%H%M%S)"
    cp "$TELEGRAM_FILE" "$BACKUP_FILE"
    echo "  Backup created: $BACKUP_FILE"

    # Add missing imports if needed
    if ! grep -q "import path from \"node:path\";" "$TELEGRAM_FILE"; then
        sed -i '1a import path from "node:path";' "$TELEGRAM_FILE"
    fi
    if ! grep -q "import fs from \"node:fs/promises\";" "$TELEGRAM_FILE"; then
        sed -i '1a import fs from "node:fs/promises";' "$TELEGRAM_FILE"
    fi
    if ! grep -q "import { importKnowledgeFile } from \"@/lib/memory/knowledge\";" "$TELEGRAM_FILE"; then
        sed -i '1a import { importKnowledgeFile } from "@/lib/memory/knowledge";' "$TELEGRAM_FILE"
    fi
    if ! grep -q "import { getSettings } from \"@/lib/storage/settings-store\";" "$TELEGRAM_FILE"; then
        sed -i '1a import { getSettings } from "@/lib/storage/settings-store";' "$TELEGRAM_FILE"
    fi

    # Add knowledge import code after saveChatFile call
    # This is a complex insertion - we'll use a marker approach
    if grep -q "const saved = await saveChatFile(" "$TELEGRAM_FILE"; then
        # Create a temporary file with the patch
        cat > /tmp/telegram-knowledge-insert.txt << 'EOF'
      // Automatically import file to project knowledge base
      try {
        const chat = await getChat(externalContext.chatId);
        if (chat && chat.projectId) {
          const projectDir = path.join(process.cwd(), "data", "projects", chat.projectId);
          const knowledgeDir = path.join(projectDir, ".meta", "knowledge");

          // Ensure knowledge directory exists
          await fs.mkdir(knowledgeDir, { recursive: true });

          // Copy file to knowledge directory
          const knowledgeFilePath = path.join(knowledgeDir, incomingFile.fileName);
          await fs.writeFile(knowledgeFilePath, fileBuffer);

          // Import into vector DB for semantic search
          const settings = await getSettings();
          const result = await importKnowledgeFile(knowledgeDir, chat.projectId, settings, incomingFile.fileName);

          console.log(`Telegram file ${incomingFile.fileName} imported to knowledge base:`, {
            imported: result.imported,
            skipped: result.skipped,
            errors: result.errors.length
          });
        }
      } catch (error) {
        console.error("Error importing Telegram file to knowledge base:", error);
        // Continue even if knowledge import fails - file is still saved
      }
EOF

        # Insert after saveChatFile block (after the closing );)
        sed -i '/const saved = await saveChatFile(/,/);$/r /tmp/telegram-knowledge-insert.txt' "$TELEGRAM_FILE"
        rm -f /tmp/telegram-knowledge-insert.txt
    fi

    # Update success message
    if grep -q "Файл \"" "$TELEGRAM_FILE" && grep -q "сохранён и импортирован в базу знаний" "$TELEGRAM_FILE"; then
        : # Already updated
    else
        # Update the file save success message
        sed -i 's/Файл "\(.*\)" сохранён/Файл "\1" сохранён и импортирован в базу знаний!\\n\\nТеперь вы можете задавать вопросы по содержимому файла. Я буду искать релевантную информацию и отвечать на основе содержимого./' "$TELEGRAM_FILE"
    fi

    # Verify the patch was applied
    if grep -q "Automatically import file to project knowledge base" "$TELEGRAM_FILE"; then
        echo -e "${GREEN}  ✓ Telegram auto-import patch applied successfully!${NC}"
        PATCHES_APPLIED=true
    else
        echo -e "${YELLOW}  ⚠ Telegram auto-import patch may not have applied correctly${NC}"
        echo "  Check file manually: $TELEGRAM_FILE"
    fi
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
if [ "$PATCHES_APPLIED" = true ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       Patches applied successfully!         ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo "To apply the patches to the running application:"
    echo "  cd $PROJECT_ROOT"
    echo "  docker compose restart app"
else
    echo -e "${GREEN}✓ All patches already applied.${NC}"
fi

echo ""
echo "Done!"
