#!/usr/bin/env bash
# Lightweight Memory Monitor for Eggent host
# Triggered via cron (e.g., every 5 minutes)

LOG_DIR="/home/takeshi/.eggent/data/logs"
HIST_LOG="$LOG_DIR/mem-history.log"
ALERT_LOG="$LOG_DIR/mem-alerts.log"
MAX_HIST_LINES=3000

mkdir -p "$LOG_DIR"

DATE_ISO=$(date '+%Y-%m-%d %H:%M:%S')

# Parse /proc/meminfo in kB
MEM_TOTAL=$(grep -m1 '^MemTotal:' /proc/meminfo | awk '{print $2}')
MEM_AVAIL=$(grep -m1 '^MemAvailable:' /proc/meminfo | awk '{print $2}')
SWAP_TOTAL=$(grep -m1 '^SwapTotal:' /proc/meminfo | awk '{print $2}')
SWAP_FREE=$(grep -m1 '^SwapFree:' /proc/meminfo | awk '{print $2}')

MEM_AVAIL_MB=$(( MEM_AVAIL / 1024 ))
SWAP_USED_MB=$(( (SWAP_TOTAL - SWAP_FREE) / 1024 ))

# Append 1-line history
echo "$DATE_ISO | MemAvail: ${MEM_AVAIL_MB}MB | SwapUsed: ${SWAP_USED_MB}MB" >> "$HIST_LOG"

# Keep history file bounded
if [ -f "$HIST_LOG" ] && [ $(wc -l < "$HIST_LOG") -gt "$MAX_HIST_LINES" ]; then
    tail -n 2000 "$HIST_LOG" > "$HIST_LOG.tmp" && mv "$HIST_LOG.tmp" "$HIST_LOG"
fi

# Alert condition: available RAM < 500MB or swap used > 4000MB
if [ "$MEM_AVAIL_MB" -lt 500 ] || [ "$SWAP_USED_MB" -gt 4000 ]; then
    echo "============================================================" >> "$ALERT_LOG"
    echo "ALERT: Low memory detected at $DATE_ISO" >> "$ALERT_LOG"
    echo "MemAvail: ${MEM_AVAIL_MB}MB | SwapUsed: ${SWAP_USED_MB}MB" >> "$ALERT_LOG"
    echo "--- FREE -H ---" >> "$ALERT_LOG"
    free -h >> "$ALERT_LOG" 2>&1
    echo "--- TOP 10 PROCESSES BY RSS ---" >> "$ALERT_LOG"
    ps aux --sort=-rss | head -11 >> "$ALERT_LOG" 2>&1
    echo "--- DOCKER STATS ---" >> "$ALERT_LOG"
    docker stats --no-stream >> "$ALERT_LOG" 2>&1
    echo "" >> "$ALERT_LOG"
fi
