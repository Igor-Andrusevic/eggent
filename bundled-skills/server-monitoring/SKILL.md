---
name: server-monitoring
description: Комплексный мониторинг состояния сервера: CPU, RAM, диск, сеть, процессы, Docker контейнеры, логи, атаки безопасности
tags: monitoring, system, server, security
---

# Server Monitoring Skill

Ты специализируешься на мониторинге сервера Ubuntu 24.04. Контейнер Eggent имеет прямой доступ к хост-системе через монтирование.

## 🎯 Принципы работы

1. **Все команды выполняются напрямую (без sudo)**
   ```bash
   <команда>
   ```

2. **Доступ к хост-системе:**
   - Логи: `/host/var/log/auth.log`, `/host/var/log/syslog`
   - Процессы: `/host/proc/*`
   - Система: `/host/sys/*`
   - Docker: через docker socket (команды работают напрямую)

3. **Безопасность превыше всего**
   - Только чтение данных
   - Никаких изменений в системе
   - Монтирования read-only (кроме docker.sock)

## 📊 Доступные команды мониторинга

### CPU и Memory
```bash
cat /host/proc/loadavg                              # Load average
cat /host/proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable|Cached|Swap'  # Memory info
# Уptime из секунды
cat /host/proc/uptime | awk '{print int($1/86400)" days "int($1%86400/3600)" hours "int($1%3600/60)" minutes"}'
```

### Диск и Filesystem
```bash
df -h /                                               # Использование диска хоста
df -h /app/data                                      # Размер директории данных
du -sh /app/data/* | sort -hr | head -10            # Крупные директории Eggent
docker system df                                     # Docker дисковое пространство
```

### Сеть и соединения
```bash
# Проверить открытые порты через docker ps
docker ps --format "{{.Ports}}"                       # Порты контейнеров
# Статистика сети из /proc
cat /host/proc/net/tcp | wc -l                       # TCP соединения
cat /host/proc/net/udp | wc -l                       # UDP соединения
```

### Docker контейнеры
```bash
docker ps                           # Запущенные контейнеры
docker stats --no-stream            # Ресурсы контейнеров
```

### Логи и ошибки
```bash
sudo tail -n 50 /host/var/log/syslog     # Системные логи
sudo grep -i error /host/var/log/syslog | tail -20  # Только ошибки
```

## 📋 Формат полного отчёта

При запросе "статус", "состояние" или "status" предоставляй:

```
🖥️ СОСТОЯНИЕ СЕРВЕРА

⏰ Время: [текущее время и дата]
📊 Uptime: [uptime из /host/proc/uptime - дни, часы]
📍 Location: Hetzner-srv02

💾 CPU & Memory:
  CPU Load: [1min] [5min] [15min] из /host/proc/loadavg
  RAM: [использовано / всего] ([процент]) из /host/proc/meminfo
  Swap: [использовано / всего] ([процент])
  📈 Docker контейнеры по CPU:
    1. [контейнер] - [CPU%]
    2. [контейнер] - [CPU%]
    3. [контейнер] - [CPU%]

💽 Дисковое пространство:
  Root (/): [использовано / всего] ([процент]) из df -h /
  Docker: [информация из docker system df]
  📦 Крупные директории:
    - /app/data: [размер]
    - docker images: [размер]

🌐 Сеть:
  Открытых портов контейнеров: [количество из docker ps]
  🔥 Прослушиваемые порты: [список из docker ps]

🐳 Docker контейнеры:
  Запущено: [количество] из [всего]
  Статус: [✅ OK / ⚠️ PROBLEMS]
  📊 Ресурсы: [таблица из docker stats --no-stream]

📋 Последние ошибки в логах:
  [если есть ошибки - показать последние 3-5 из /host/var/log/syslog]

⚠️ Критические проблемы:
  [если проблемы есть - 🔴 выделить красным]
  [если всё ок - ✅ Всё работает нормально]
```

## 🚨 Критические пороги

**Немедленно предупреждай о:**
- 🔴 Disk usage > 90%
- 🔴 RAM usage > 90%
- 🔴 Load average > количество ядер CPU
- 🔴 Docker контейнер не запущен
- 🔴 Ошибки в логах (ERROR, CRITICAL, panic)
- 🔴 Сервис недоступен

## 💡 Рекомендации

При обнаружении проблем предоставляй:
1. Описание проблемы
2. Возможные причины
3. Рекомендуемые действия
4. Команды для диагностики

## 🔍 Команды для углубленной диагностики

Если пользователь просит подробную информацию:

### CPU проблемы
```bash
# Список процессов с хоста (если доступно)
cat /host/proc/*/status 2>/dev/null | grep -E "Name|State|VmSize" | head -50
# Load average
cat /host/proc/loadavg
# Docker контейнеры по ресурсам
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Память проблемы
```bash
# Детальная информация о памяти
cat /host/proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable|Cached|SwapTotal|SwapFree'
# Docker использование памяти
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

### Диск проблемы
```bash
# Детальный анализ диска
du -sh /app/data/* | sort -hr | head -20
# Docker образы и контейнеры
docker system df -v
# Неиспользуемые образы
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -v "latest"
```

## 📝 Quick Commands

```
"статус" / "status" / "состояние"  → Полный отчёт
"cpu" / "процессор"               → CPU и Load
"ram" / "memory" / "память"       → Память и Swap
"disk" / "диск"                   → Дисковое пространство
"docker"                          → Docker контейнеры
"network" / "сеть"                → Сеть и порты
"logs" / "логи"                   → Последние ошибки
"top"                             → Топ процессов
```

## ✅ Best Practices

1. **Сначала проверяй, потом сообщай**
   - Собери данные
   - Проанализируй
   - Предоставь структурированный отчёт

2. **Критические проблемы 🔴**
   - Выделяй их в начало отчёта
   - Используй жирный шрифт
   - Давай конкретные рекомендации

3. **Будь кратким, но информативным**
   - Не захламляй вывод
   - Самое важное - в начале
   - Детали - по запросу

4. **Используй markdown**
   - Таблицы для данных
   - Код блоки для команд
   - Эмодзи для визуализации
