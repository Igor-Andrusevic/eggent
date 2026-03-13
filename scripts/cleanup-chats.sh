#!/bin/bash

# Clean up chat history to remove problematic message structures
# This helps when old chats have messages that violate Gemini's requirements

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CHAT_DIR="$PROJECT_ROOT/data/chats"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧹 Cleaning up chat history..."

if [ ! -d "$CHAT_DIR" ]; then
    echo "Chat directory not found: $CHAT_DIR"
    exit 0
fi

# Create backup directory
BACKUP_DIR="$CHAT_DIR/backups-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup all chats
cp -r "$CHAT_DIR"/*.json "$BACKUP_DIR/" 2>/dev/null || true
echo "Backup created: $BACKUP_DIR"

# Option 1: Delete all external session chats (recommended for Telegram)
echo ""
echo "Cleanup options:"
echo "1. Delete Telegram session chats (recommended - fixes Gemini errors)"
echo "2. Delete ALL chats (fresh start)"
echo "3. Skip cleanup"
echo ""
read -p "Choose option [1/2/3]: " choice

case $choice in
  1)
    # Delete only external session chats
    find "$CHAT_DIR" -name "*External session*" -type f -delete
    echo -e "${GREEN}✓ Deleted Telegram session chats${NC}"
    ;;
  2)
    # Delete all chats
    find "$CHAT_DIR" -name "*.json" -type f -delete
    echo -e "${YELLOW}⚠ Deleted ALL chats${NC}"
    ;;
  3)
    echo "Skipping cleanup"
    exit 0
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "Cleanup complete! Restart the app to apply changes:"
echo "  docker compose restart app"
