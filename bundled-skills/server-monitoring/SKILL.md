---
name: server-monitoring
description: Комплексный мониторинг состояния сервера: CPU, RAM, диск, сеть, Docker контейнеры, логи, безопасность. Выполняй команды напрямую, Docker имеет доступ к хосту через volume mounts.
tags: monitoring, system, server, security, docker
---

# Server Monitoring Skill

Ты специализируешься на мониторинге сервера Ubuntu 24.04. Контейнер Eggent имеет прямой доступ к хост-системе через volume mounts.

## Архитектура доступа

**Контейнер запущен от пользователя `node` (UID 1000) с sudo NOPASSWD.**

| Ресурс хоста | Путь в контейнере | Доступ |
|---|---|---|
| Логи `/var/log/*` | `/host/var/log/*` | **Требует sudo** (0640 syslog:adm) |
| Процессы `/proc/*` | `/host/proc/*` | Напрямую (read-only mount) |
| Система `/sys/*` | `/host/sys/*` | Напрямую (read-only mount) |
| Docker socket | `/var/run/docker.sock` | Напрямую (group docker) |

## Правила sudo

```
# Команды Docker - БЕЗ sudo
docker ps
docker stats --no-stream

# Чтение логов хоста - С sudo
sudo tail -n 50 /host/var/log/syslog
sudo grep "Invalid user" /host/var/log/auth.log
```

## Команды мониторинга

### CPU и Load Average

```bash
cat /host/proc/loadavg
# Формат: 1min 5min 15min current_processes/total_processes last_pid

# Количество ядер CPU
cat /host/proc/cpuinfo | grep -c ^processor
```

### Память (RAM + Swap)

```bash
cat /host/proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable|Cached|SwapTotal|SwapFree'
```

### Uptime

```bash
cat /host/proc/uptime
# Формат: uptime_seconds idle_seconds

# Конвертация в читаемый формат:
awk '{printf "%d days, %d hours, %d minutes", $1/86400, ($1%86400)/3600, ($1%3600)/60}' /host/proc/uptime
```

### Дисковое пространство

```bash
df -h /                                    # Корневой раздел хоста
docker system df                           # Docker образы, контейнеры, volumes
```

### Сетевые соединения

```bash
# TCP соединения (количество)
wc -l < /host/proc/net/tcp

# UDP соединения (количество)
wc -l < /host/proc/net/udp

# Открытые порты через Docker
docker ps --format "{{.Ports}}"
```

### Docker контейнеры

```bash
docker ps -a                                          # Все контейнеры
docker stats --no-stream                             # Ресурсы в реальном времени
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"  # Статус в таблице
```

### Логи системы

```bash
# Системные логи (требуют sudo)
sudo tail -n 100 /host/var/log/syslog

# Только ошибки
sudo grep -i "error\|critical\|panic" /host/var/log/syslog | tail -50
```

### Логи авторизации (SSH, sudo)

```bash
# Требуют sudo!
sudo tail -n 100 /host/var/log/auth.log

# Неудачные попытки входа
sudo grep "Failed password\|Invalid user" /host/var/log/auth.log | tail -50
```

## Формат полного отчёта

При запросе "статус", "состояние", "status" или "отчёт":

```
🖥️ СОСТОЯНИЕ СЕРВЕРА

⏰ Время: [текущее время]
📊 Uptime: [дни, часы, минуты]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💾 CPU & Memory:
  CPU Load: [1min] [5min] [15min] (ядер: X)
  RAM: [использовано] / [всего] ([процент]%)
  Swap: [использовано] / [всего] ([процент]%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💽 Дисковое пространство:
  Root (/): [использовано] / [всего] ([процент]%)
  Docker:
    Images: [размер]
    Containers: [размер]
    Volumes: [размер]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🐳 Docker контейнеры:
  Запущено: X из Y
  [таблица статуса контейнеров]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 Сеть:
  TCP соединений: X
  UDP соединений: X
  Открытые порты: [список из docker ps]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Проблемы:
  [если есть - 🔴 выделить критические]
  [если нет - ✅ Сервер работает нормально]
```

## Критические пороги

**Немедленно предупреждай о:**

| Метрика | Критический порог |
|---|---|
| Disk usage | > 90% 🔴 |
| RAM usage | > 90% 🔴 |
| Swap usage | > 50% ⚠️ |
| Load average (1min) | > количество ядер CPU 🔴 |
| Docker контейнер | exited / restarting 🔴 |
| Ошибки в логах | ERROR, CRITICAL, panic 🔴 |

## Quick Commands

| Запрос | Действие |
|---|---|
| "статус" / "status" / "состояние" | Полный отчёт |
| "cpu" / "процессор" | CPU и Load |
| "ram" / "память" | Память и Swap |
| "disk" / "диск" | Дисковое пространство |
| "docker" / "контейнеры" | Docker статус |
| "network" / "сеть" | Сеть и порты |
| "logs" / "логи" | Последние ошибки |
| "uptime" | Время работы |

## Скрипт быстрого сбора данных

```bash
# Собрать все метрики одной командой:
echo "=== CPU ===" && cat /host/proc/loadavg && \
echo "=== MEMORY ===" && cat /host/proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree' && \
echo "=== UPTIME ===" && awk '{printf "%d days, %d hours, %d minutes\n", $1/86400, ($1%86400)/3600, ($1%3600)/60}' /host/proc/uptime && \
echo "=== DISK ===" && df -h / && \
echo "=== DOCKER ===" && docker ps --format "table {{.Names}}\t{{.Status}}\t{{.CPUPerc}}\t{{.MemPerc}}" && \
docker system df
```

## Best Practices

1. **Сначала собери данные, потом анализируй**
   - Выполни все команды сбора
   - Сформируй отчёт
   - Выдели проблемы

2. **Критические проблемы в начало отчёта**
   - 🔴 Жирный шрифт
   - Конкретные рекомендации

3. **Будь кратким**
   - Самое важное - в начале
   - Детали - по запросу

4. **Используй эмодзи**
   - 🖥️ 💾 💽 🐳 🌐 ⚠️ ✅ 🔴
   - Улучшает читаемость в Telegram
