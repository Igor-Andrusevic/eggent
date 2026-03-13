#!/bin/bash

# Quick fix for Telegram bot 401 Unauthorized error
# Resets webhook with correct secret_token

set -e

ENV_FILE="/home/takeshi/.eggent/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "Telegram Webhook Reset"
echo "=========================================="
echo ""

# Load settings from .env
if [ -f "$ENV_FILE" ]; then
    export $(grep "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | xargs)
    export $(grep "^TELEGRAM_WEBHOOK_SECRET=" "$ENV_FILE" | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_WEBHOOK_SECRET" ]; then
    echo -e "${RED}Error: TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET not set${NC}"
    exit 1
fi

WEBHOOK_URL="https://eggent.takeshi-n8n.eu/api/integrations/telegram"

echo "Bot token: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo "Webhook URL: $WEBHOOK_URL"
echo "Secret: ${TELEGRAM_WEBHOOK_SECRET:0:10}..."
echo ""

# Check current webhook status
echo "1. Checking current webhook status..."
CURRENT_STATUS=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo")
echo "$CURRENT_STATUS" | python3 -m json.tool 2>/dev/null || echo "$CURRENT_STATUS"
echo ""

# Delete current webhook
echo "2. Deleting current webhook..."
DELETE_RESULT=$(curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook")
echo "$DELETE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$DELETE_RESULT"
echo ""

sleep 2

# Create new webhook with secret_token
echo "3. Creating new webhook with secret_token..."
CREATE_RESULT=$(curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\"
  }")
echo "$CREATE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESULT"
echo ""

# Verify new webhook
echo "4. Verifying new webhook..."
sleep 2
VERIFY_RESULT=$(curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo")
echo "$VERIFY_RESULT" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_RESULT"
echo ""

# Check for errors
if echo "$VERIFY_RESULT" | grep -q "last_error_message"; then
    ERROR_MSG=$(echo "$VERIFY_RESULT" | grep "last_error_message" | cut -d'"' -f4)
    if [ -n "$ERROR_MSG" ] && [ "$ERROR_MSG" != "null" ]; then
        echo -e "${RED}⚠ Webhook has error: $ERROR_MSG${NC}"
        echo ""
        echo "Troubleshooting:"
        echo "1. Check if Eggent container is running: sudo docker ps | grep eggent"
        echo "2. Check Eggent logs: sudo docker logs --tail=50 eggent-app-1"
        echo "3. Check Nginx logs: sudo docker exec nginx-proxy-manager-app-1 tail -20 /data/logs/proxy-host-3_error.log"
        exit 1
    fi
fi

echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Webhook reset successfully!        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
echo "Test the bot by sending a message in Telegram."
echo ""
echo "Monitor logs:"
echo "  sudo docker exec nginx-proxy-manager-app-1 tail -f /data/logs/proxy-host-3_access.log"
