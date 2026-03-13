#!/bin/bash

# Quick helper to get Telegram Chat ID
# Usage: bash scripts/get-telegram-chatid.sh

set -e

ENV_FILE="/home/takeshi/.eggent/.env"
TELEGRAM_BOT_TOKEN=$(grep "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | cut -d'=' -f2)

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "Error: TELEGRAM_BOT_TOKEN not found in .env"
    exit 1
fi

echo "=========================================="
echo "Get Your Telegram Chat ID"
echo "=========================================="
echo ""
echo "1. Open Telegram and find your bot (search for bot name or create new with @BotFather)"
echo "2. Send ANY message to your bot (e.g., /start or 'hello')"
echo "3. Wait 5 seconds..."
echo ""
echo "Your bot token: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo ""
echo "4. Then visit this URL in your browser:"
echo ""
echo -e "\033[1;34mhttps://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates\033[0m"
echo ""
echo "5. Look for \"chat\":{\"id\":NUMBER} in the response"
echo "6. Copy that number - this is your Chat ID"
echo ""
echo "Example:"
echo '  {"message":{"message_id":1,"from":{"id":123456789,"is_bot":false,"first_name":"John"},"chat":{"id":123456789,"first_name":"John","type":"private"},"date":1234567890,"text":"/start"}}'
echo ""
echo "  In this example, your Chat ID is: \033[1;32m123456789\033[0m"
echo ""
echo "=========================================="
