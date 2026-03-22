#!/bin/bash

# Eggent Auto-Updater with Telegram Notifications
# This script automatically updates Eggent from upstream and sends notifications

set -e

# ==============================================================================
# CONFIGURATION
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/data/logs/auto-update.log"
ENV_FILE="$PROJECT_ROOT/.env"

# Load environment variables from .env file
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_NOTIFICATION_CHAT_ID="${TELEGRAM_UPDATE_NOTIFICATIONS:-}"
BACKUP_BRANCH_PREFIX="auto-update-backup"

# Time restrictions (only update and notify during these hours)
ALLOWED_START_HOUR=10
ALLOWED_END_HOUR=21

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==============================================================================
# TIME CHECK FUNCTIONS
# ==============================================================================

is_allowed_time() {
    local current_hour=$(date +%H)
    current_hour=${current_hour#0}  # Remove leading zero

    if [ "$current_hour" -ge "$ALLOWED_START_HOUR" ] && [ "$current_hour" -lt "$ALLOWED_END_HOUR" ]; then
        return 0  # Allowed time
    else
        return 1  # Outside allowed hours
    fi
}

# ==============================================================================
# LOGGING FUNCTIONS
# ==============================================================================

log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

send_telegram_message() {
    local message="$1"
    local parse_mode="${2:-Markdown}"

    # Check if current time is within allowed hours
    if ! is_allowed_time; then
        log "${YELLOW}⏰ Вне времени уведомлений ($ALLOWED_START_HOUR:00-$ALLOWED_END_HOUR:00), пропускаем Telegram уведомление${NC}"
        return 0
    fi

    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_NOTIFICATION_CHAT_ID" ]; then
        log "${YELLOW}⚠ Telegram уведомления не настроены${NC}"
        return 1
    fi

    # Escape special characters for Markdown
    local escaped_message=$(echo "$message" | sed 's/[_*[\]()~`>#+=|{}.!-]/\\&/g')

    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{
            \"chat_id\": \"$TELEGRAM_NOTIFICATION_CHAT_ID\",
            \"text\": \"$escaped_message\",
            \"parse_mode\": \"$parse_mode\",
            \"disable_web_page_preview\": true
        }" >> "$LOG_FILE" 2>&1
}

send_update_start_notification() {
    local message="*🔄 Eggent: Начало автоматического обновления*%0A%0A"
    message+="Время: $(date '+%Y-%m-%d %H:%M:%S')%0A"
    message+="Сервер: $(hostname)%0A%0A"
    message+="Проверка наличия обновлений..."

    send_telegram_message "$message" "Markdown"
}

send_update_success_notification() {
    local commits_count="$1"
    local message="*✅ Eggent: Обновление успешно завершено*%0A%0A"
    message+="Время: $(date '+%Y-%m-%d %H:%M:%S')%0A"
    message+="Новых коммитов: $commits_count%0A%0A"
    message+="Применённые изменения:%0A"
    message+="• Git обновление (rebase)%0A"
    message+="• Патчи применены%0A"
    message+="• Docker пересобран%0A"
    message+="• Контейнер перезапущен%0A%0A"
    message+="Статус: Все системы работают"

    send_telegram_message "$message" "Markdown"
}

send_update_error_notification() {
    local error_message="$1"
    local message="*❌ Eggent: Ошибка обновления*%0A%0A"
    message+="Время: $(date '+%Y-%m-%d %H:%M:%S')%0A"
    message+="Ошибка: $error_message%0A%0A"
    message="❌ Eggent: Ошибка обновления%0A%0AВремя: $(date '+%Y-%m-%d %H:%M:%S')%0AОшибка: $error_message%0A%0AПроверьте логи: $LOG_FILE"

    send_telegram_message "$message" "Markdown"
}

send_conflicts_notification() {
    local conflict_files="$1"
    local message="*⚠️ Eggent: Обнаружены конфликты*%0A%0A"
    message+="Время: $(date '+%Y-%m-%d %H:%M:%S')%0A"
    message+="Git rebase обнаружил конфликты, требующие ручного разрешения.%0A%0A"
    message+="Файлы с конфликтами:%0A"
    message+="$conflict_files%0A%0A"
    message="⚠️ Eggent: Обнаружены конфликты%0A%0AВремя: $(date '+%Y-%m-%d %H:%M:%S')%0AGit rebase обнаружил конфликты%0A%0AФайлы:%0A$conflict_files%0A%0AРазрешите вручную:%0A"
    message+="\`cd ~/.eggent\`%0A"
    message+="\`git status\`%0A"
    message+="\`git rebase --continue\`"

    send_telegram_message "$message" "Markdown"
}

send_no_updates_notification() {
    local message="*✓ Eggent: Уже актуальная версия*%0A%0A"
    message+="Время: $(date '+%Y-%m-%d %H:%M:%S')%0A"
    message+="Нет новых коммитов%0A%0A"
    message+="Статус: Запущена последняя версия"

    send_telegram_message "$message" "Markdown"
}

# ==============================================================================
# UPDATE FUNCTIONS
# ==============================================================================

check_updates_available() {
    cd "$PROJECT_ROOT"

    # Fetch from upstream
    log "${BLUE}Получение обновлений из upstream...${NC}"
    git fetch upstream >> "$LOG_FILE" 2>&1

    # Check if there are new commits
    local local_commit=$(git rev-parse HEAD)
    local upstream_commit=$(git rev-parse upstream/main)

    if [ "$local_commit" = "$upstream_commit" ]; then
        return 1  # No updates
    fi

    return 0  # Updates available
}

count_new_commits() {
    cd "$PROJECT_ROOT"
    git rev-list --count HEAD..upstream/main
}

create_backup_branch() {
    local backup_name="$BACKUP_BRANCH_PREFIX-$(date +%Y%m%d-%H%M%S)"
    cd "$PROJECT_ROOT"
    git branch "$backup_name" >> "$LOG_FILE" 2>&1
    log "${GREEN}✓ Created backup branch: $backup_name${NC}"
    echo "$backup_name"
}

perform_update() {
    cd "$PROJECT_ROOT"

    log "${BLUE}Запуск процесса обновления...${NC}"

    # Create backup
    local backup_branch=$(create_backup_branch)

    # Try rebase
    log "${BLUE}Применение rebase из upstream/main...${NC}"
    if ! git rebase upstream/main >> "$LOG_FILE" 2>&1; then
        # Check if it's a conflict
        if git status | grep -q "both modified"; then
            local conflict_files=$(git diff --name-only --diff-filter=U | head -10 | sed 's/^/• /')
            send_conflicts_notification "$conflict_files"
            log "${RED}✗ Rebase conflicts detected${NC}"
            return 1
        fi
        log "${RED}✗ Rebase failed${NC}"
        return 1
    fi

    log "${GREEN}✓ Rebase successful${NC}"

    # Push to fork
    log "${BLUE}Отправка в fork...${NC}"
    git push origin main --force-with-lease >> "$LOG_FILE" 2>&1
    log "${GREEN}✓ Pushed to fork${NC}"

    # Apply patches
    log "${BLUE}Применение патчей...${NC}"
    npm install >> "$LOG_FILE" 2>&1
    log "${GREEN}✓ Patches applied${NC}"

    # Rebuild Docker
    log "${BLUE}Пересборка Docker контейнера...${NC}"
    if ! docker compose build --no-cache app >> "$LOG_FILE" 2>&1; then
        log "${RED}✗ Container build failed${NC}"
        send_update_error_notification "Docker build failed. Check logs: $LOG_FILE"
        return 1
    fi
    log "${GREEN}✓ Container rebuilt${NC}"

    # Restart container
    log "${BLUE}Перезапуск контейнера...${NC}"
    docker compose up -d app >> "$LOG_FILE" 2>&1
    log "${GREEN}✓ Container restarted${NC}"

    # Wait for health check
    log "${BLUE}Ожидание проверки работоспособности...${NC}"
    sleep 10

    if docker exec eggent-app-1 curl -f http://localhost:3000/api/health >> "$LOG_FILE" 2>&1; then
        log "${GREEN}✓ Health check passed${NC}"
        return 0
    else
        log "${YELLOW}⚠ Health check failed, but container is running${NC}"
        return 0
    fi
}

# ==============================================================================
# MAIN
# ==============================================================================

main() {
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"

    # Start logging
    echo "" >> "$LOG_FILE"
    echo "=====================================" >> "$LOG_FILE"
    echo "Auto-Update started: $(date)" >> "$LOG_FILE"
    echo "=====================================" >> "$LOG_FILE"

    log "${BLUE}Eggent Auto-Updater${NC}"
    log "${BLUE}======================${NC}"

    # Check if current time is within allowed hours
    if ! is_allowed_time; then
        local current_hour=$(date +%H:%M)
        log "${YELLOW}⏰ Текущее время $current_hour (вне $ALLOWED_START_HOUR:00-$ALLOWED_END_HOUR:00)${NC}"
        log "${YELLOW}⏰ Skipping auto-update (повтор в разрешённое время)${NC}"
        exit 0
    fi

    log "${GREEN}✅ Проверка времени пройдена ($(date +%H:%M))${NC}"

    # Send start notification
    send_update_start_notification

    # Check for updates
    if ! check_updates_available; then
        log "${GREEN}✓ Нет обновлений${NC}"
        send_no_updates_notification
        exit 0
    fi

    # Count new commits
    local commits_count=$(count_new_commits)
    log "${GREEN}✓ $commits_count новых коммитов${NC}"

    # Perform update
    if perform_update; then
        log "${GREEN}╔══════════════════════════════════════╗${NC}"
        log "${GREEN}║   Обновление успешно завершено!      ║${NC}"
        log "${GREEN}╚══════════════════════════════════════╝${NC}"
        send_update_success_notification "$commits_count"
        exit 0
    else
        log "${RED}✗ Обновление не удалось${NC}"
        send_update_error_notification "Update process failed. Check logs."
        exit 1
    fi
}

# Run main function
main "$@"
