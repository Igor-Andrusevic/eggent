#!/bin/bash

# Setup Telegram notifications for Eggent auto-updates
# This script helps configure Telegram notifications

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Eggent Auto-Update Notifications Setup  ${NC}"
echo -e "${BLUE}══════════════════════════════════════════${NC}"
echo ""

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    echo "Please create .env file first"
    exit 1
fi

# Check if TELEGRAM_BOT_TOKEN is set
if ! grep -q "TELEGRAM_BOT_TOKEN=" "$ENV_FILE"; then
    echo -e "${YELLOW}⚠ TELEGRAM_BOT_TOKEN not found in .env${NC}"
    echo ""
    echo "To get your bot token:"
    echo "1. Open Telegram and search for @BotFather"
    echo "2. Send /newbot and follow instructions"
    echo "3. Copy the token and add to .env:"
    echo "   TELEGRAM_BOT_TOKEN=your_token_here"
    echo ""
    read -p "Press Enter to continue after adding token..."
fi

# Get Telegram bot token from .env
TELEGRAM_BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | cut -d'=' -f2)

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo -e "${RED}Error: TELEGRAM_BOT_TOKEN is empty${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Telegram bot token found${NC}"
echo ""

# Step 1: Get chat ID
echo -e "${BLUE}Step 1: Get your Telegram Chat ID${NC}"
echo "Your bot needs to know YOUR Telegram ID to send notifications."
echo ""
echo "To get your chat ID:"
echo "1. Open Telegram and search for your bot (or create a new one with @BotFather)"
echo "2. Send ANY message to your bot (e.g., /start)"
echo "3. Visit this URL in your browser:"
echo ""
echo -e "${YELLOW}https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates${NC}"
echo ""
echo "4. Look for \"chat\":{\"id\":NUMBER} in the response"
echo "5. Copy that number"
echo ""

read -p "Enter your Telegram Chat ID: " CHAT_ID

if [ -z "$CHAT_ID" ]; then
    echo -e "${RED}Error: Chat ID cannot be empty${NC}"
    exit 1
fi

# Validate chat ID is a number
if ! [[ "$CHAT_ID" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Chat ID must be a number${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Chat ID: $CHAT_ID${NC}"
echo ""

# Step 2: Test notification
echo -e "${BLUE}Step 2: Test Notification${NC}"
echo "Sending test message to your bot..."
echo ""

TEST_MESSAGE="✅ Eggent Auto-Update Notifications%0A%0AThis is a test message!%0A%0AIf you received this, notifications are working correctly."

curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{
        \"chat_id\": \"$CHAT_ID\",
        \"text\": \"$TEST_MESSAGE\",
        \"parse_mode\": \"Markdown\"
    }" > /dev/null

echo -e "${GREEN}✓ Test message sent!${NC}"
echo ""
echo "Check your Telegram - you should have received a message."
echo ""

read -p "Did you receive the message? (y/n): " RECEIVED

if [[ "$RECEIVED" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${GREEN}Great!${NC}"
else
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo "1. Make sure you STARTED a conversation with your bot (sent /start)"
    echo "2. Check that the bot token is correct"
    echo "3. Check that the chat ID is correct"
    echo "4. Try the getUpdates URL again to see current messages"
    exit 1
fi

# Step 3: Add to .env
echo ""
echo -e "${BLUE}Step 3: Save to .env${NC}"

# Check if TELEGRAM_UPDATE_NOTIFICATIONS already exists
if grep -q "^TELEGRAM_UPDATE_NOTIFICATIONS=" "$ENV_FILE"; then
    # Update existing value
    sed -i "s/^TELEGRAM_UPDATE_NOTIFICATIONS=.*/TELEGRAM_UPDATE_NOTIFICATIONS=$CHAT_ID/" "$ENV_FILE"
    echo -e "${GREEN}✓ Updated TELEGRAM_UPDATE_NOTIFICATIONS in .env${NC}"
else
    # Add new value
    echo "" >> "$ENV_FILE"
    echo "# Telegram chat ID for auto-update notifications" >> "$ENV_FILE"
    echo "TELEGRAM_UPDATE_NOTIFICATIONS=$CHAT_ID" >> "$ENV_FILE"
    echo -e "${GREEN}✓ Added TELEGRAM_UPDATE_NOTIFICATIONS to .env${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Setup Complete!                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Notifications configured:"
echo "  • Bot token: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo "  • Chat ID: $CHAT_ID"
echo ""
echo "Next steps:"
echo "  1. Setup automatic updates (see below)"
echo "  2. Or run manually: cd ~/.eggent && bash scripts/auto-update.sh"
echo ""
echo -e "${BLUE}══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Automatic Updates Setup                 ${NC}"
echo -e "${BLUE}══════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}⏰ Updates and notifications will only be active 10:00-21:00${NC}"
echo ""
echo "Choose update frequency:"
echo "  1) Daily at 10:00 (recommended)"
echo "  2) Daily at 10:00 and 18:00"
echo "  3) Every 3 hours (10:00-21:00 only)"
echo "  4) Weekly on Sunday at 10:00"
echo "  5) Manual only (no automatic updates)"
echo ""
read -p "Enter choice (1-5): " CHOICE

case $CHOICE in
    1)
        CRON_EXPR="0 10 * * *"
        CRON_DESC="daily at 10:00"
        ;;
    2)
        CRON_EXPR="0 10,18 * * *"
        CRON_DESC="daily at 10:00 and 18:00"
        ;;
    3)
        CRON_EXPR="0 10,13,16,19 * * *"
        CRON_DESC="every 3 hours (10:00-21:00)"
        ;;
    4)
        CRON_EXPR="0 10 * * 0"
        CRON_DESC="weekly on Sunday at 10:00"
        ;;
    5)
        CRON_EXPR=""
        CRON_DESC="manual only"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

if [ -n "$CRON_EXPR" ]; then
    echo ""
    echo "Setting up cron job for $CRON_DESC..."

    # Create temporary cron file
    TEMP_CRON=$(mktemp)

    # Export current crontab
    crontab -l > "$TEMP_CRON" 2>/dev/null || true

    # Check if Eggent auto-update already exists
    if grep -q "scripts/auto-update.sh" "$TEMP_CRON" 2>/dev/null; then
        # Update existing cron entry
        sed -i "s|.*scripts/auto-update.sh.*|$CRON_EXPR cd $PROJECT_ROOT && bash scripts/auto-update.sh >> $PROJECT_ROOT/data/logs/cron.log 2>&1|" "$TEMP_CRON"
        echo -e "${GREEN}✓ Updated existing cron job${NC}"
    else
        # Add new cron entry
        echo "" >> "$TEMP_CRON"
        echo "# Eggent auto-update - $CRON_DESC" >> "$TEMP_CRON"
        echo "$CRON_EXPR cd $PROJECT_ROOT && bash scripts/auto-update.sh >> $PROJECT_ROOT/data/logs/cron.log 2>&1" >> "$TEMP_CRON"
        echo -e "${GREEN}✓ Added new cron job${NC}"
    fi

    # Install new crontab
    crontab "$TEMP_CRON"
    rm "$TEMP_CRON"

    echo ""
    echo -e "${GREEN}✓ Cron job installed${NC}"
    echo ""
    echo "Cron expression: $CRON_EXPR"
    echo "Log file: $PROJECT_ROOT/data/logs/cron.log"
    echo ""
    echo "To view cron jobs: crontab -l"
    echo "To view logs: tail -f $PROJECT_ROOT/data/logs/cron.log"
else
    echo ""
    echo -e "${YELLOW}Skipping automatic updates (manual mode)${NC}"
    echo ""
    echo "To run update manually:"
    echo "  cd ~/.eggent"
    echo "  bash scripts/auto-update.sh"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   All Done!                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "You will receive Telegram notifications:"
echo "  • When update starts"
echo "  • When update completes successfully"
echo "  • If update fails"
echo "  • If there are merge conflicts"
echo ""
