---
name: docker-monitoring
description: Мониторинг Docker контейнеров: статус, ресурсы, логи, перезапуски, network, volumes
tags: docker, monitoring, containers, resources
---

# Docker Monitoring Skill

Ты специализируешься на мониторинге Docker контейнеров на сервере. Проверяешь статус, ресурсы, логи и проблемы.

## 🎯 Принципы работы

1. **Все команды выполняются напрямую**
   ```bash
   docker <команда>
   ```

2. **Контейнеры на этом сервере:**
   - `eggent-app-1` - Eggent приложение (порт 3000)
   - `nginx-proxy-manager-app-1` - Reverse proxy (порты 80, 443, 81)

## 📊 Проверки Docker

### 1. Статус контейнеров

```bash
docker ps -a                         # Все контейнеры (включая остановленные)
docker ps                            # Только запущенные
```

### 2. Ресурсы контейнеров

```bash
docker stats --no-stream            # Использование CPU, RAM, Network, Disk
```

### 3. Логи контейнеров

```bash
docker logs --tail=50 eggent-app-1  # Eggent логи
docker logs --tail=50 nginx-proxy-manager-app-1  # NPM логи
docker logs --tail=100 --since 1h eggent-app-1  # За последний час
```

### 4. Сеть и volumes

```bash
docker network ls                    # Список сетей
docker volume ls                     # Список volumes
docker inspect eggent-app-1         # Детальная информация
```

### 5. Docker образы

```bash
docker images                        # Список образов
docker system df                     # Использование диска
```

## 📋 Формат отчёта Docker

При запросе "docker", "контейнеры" предоставляй:

```
🐳 DOCKER КОНТЕЙНЕРЫ

📊 Общий статус:
  Запущено: [количество] из [всего]
  Статус: [✅ Все работают / ⚠️ Проблемы]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Eggent App (eggent-app-1):
  Статус: [✅ running / ❌ exited / ⚠️ restarting]
  Uptime: [время работы]
  Image: [название образа]
  💾 Ресурсы:
    CPU: [процент]
    RAM: [использовано / лимит]
    Network: [↑ upload / ↓ download]
  📋 Последние логи:
    [последние 3-5 строк]

📦 Nginx Proxy Manager (nginx-proxy-manager-app-1):
  Статус: [✅ running / ❌ exited / ⚠️ restarting]
  Uptime: [время работы]
  Image: [название образа]
  💾 Ресурсы:
    CPU: [процент]
    RAM: [использовано / лимит]
    Network: [↑ upload / ↓ download]
  📋 Последние логи:
    [последние 3-5 строк]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💽 Docker дисковое пространство:
  Образы: [размер]
  Контейнеры: [размер]
  Build cache: [размер]
  Всего: [размер]

🌐 Сети:
  eggent_default: [статус]
  nginx-proxy-manager_default: [статус]

⚠️ Проблемы:
  [если есть проблемы - выделить 🔴]
  [перезапуски, ошибки, перегруз ресурсов]
```

## 🚨 Критические проблемы

**Немедленно сообщай о:**
- 🔴 Контейнер не запущен (exited)
- 🔴 Контейнер постоянно перезапускается (restarting)
- 🔴 CPU > 80% или RAM > 90%
- 🔴 Ошибки в логах (ERROR, CRITICAL, panic)
- 🔴 Диск переполнен (>90%)

## 🔍 Анализ проблем

### Контейнер не запускается:

```bash
docker logs eggent-app-1 --tail=100  # Последние 100 строк
docker inspect eggent-app-1          # Детальная информация
```

**Ищем в логах:**
- Ошибки (ERROR, CRITICAL)
- Exception
- Failed to start
- Cannot connect

### Перезапуски контейнера:

```bash
docker ps -a                         # Проверить статус
```

### Проблемы с ресурсами:

```bash
docker stats --no-stream            # Проверить нагрузку
docker system df                    # Проверить диск
```

### Проблемы с сетью:

```bash
docker network ls                    # Список сетей
docker inspect eggent-app-1 | grep -A 10 Network  # Сеть контейнера
```

## 📝 Quick Commands

```
"docker" / "контейнеры"              → Полный отчёт по Docker
"eggent"                            → Статус Eggent контейнера
"nginx" / "npm"                     → Статус Nginx Proxy Manager
"logs" / "логи docker"              → Логи контейнеров
"docker stats"                      → Ресурсы контейнеров
"docker prune"                      → Информация о чистке (не выполнять!)
```

## 🔍 Детальная диагностика

### Логи за определенный период:
```bash
sudo -u smotrini docker logs --since 1h eggent-app-1           # За последний час
sudo -u smotrini docker logs --since 30m nginx-proxy-manager-app-1  # За 30 минут
sudo -u smotrini docker logs --tail 500 eggent-app-1 | grep ERROR  # Только ошибки
```

### Информация о контейнере:
```bash
sudo -u smotrini docker inspect eggent-app-1                 # Вся информация
sudo -u smotrini docker inspect eggent-app-1 | grep -A 5 Mounts  # Монтируемые volumes
sudo -u smotrini docker inspect eggent-app-1 | grep -A 10 Ports  # Порты
```

### Проверка здоровья:
```bash
sudo -u smotrini docker inspect eggent-app-1 | grep -i health  # Health check статус
```

## 💡 Типичные проблемы и решения

### 1. Перезапуск контейнера
**Признаки:** Статус "restarting" или частые смены статуса
**Проверить:**
```bash
sudo -u smotrini docker logs eggent-app-1 --tail=100
```
**Возможные причины:**
- Ошибка в приложении
- Нехватка памяти
- Проблема с конфигурацией

### 2. Контейнер не запускается
**Признаки:** Статус "exited"
**Проверить:**
```bash
sudo -u smotrini docker logs eggent-app-1 --tail=100
sudo -u smotrini docker inspect eggent-app-1 | grep ExitCode
```

### 3. Высокая нагрузка CPU/RAM
**Признаки:** CPU > 80%, RAM > 90%
**Проверить:**
```bash
sudo -u smotrini docker stats --no-stream
sudo -u smotrini docker logs eggent-app-1 --tail=100 | grep -i error
```

### 4. Проблемы с диском
**Признаки:** Cannot write, No space left
**Проверить:**
```bash
sudo -u smotrini docker system df
sudo -u smotrini df -h
```
**Решение:**
```bash
# Это только информация! НЕ выполняй автоматически!
sudo -u smotrini docker image prune -a        # Удалить неиспользуемые образы
sudo -u smotrini docker builder prune --force # Удалить build cache
```

## ✅ Best Practices

1. **Структурированный отчёт**
   - Разделяй информацию по контейнерам
   - Используй разделители ━━━━
   - Эмодзи для визуализации 🐳📦💾

2. **Критические проблемы 🔴**
   - В начало отчёта
   - Жирный шрифт
   - Конкретные рекомендации

3. **Логи разумными порциями**
   - 3-5 последних строк в основном отчёте
   - Больше - только по запросу
   - Фильтруй ошибки

4. **Контекст важен**
   - Не просто "CPU: 80%"
   - А "CPU: 80% (высокая нагрузка, возможно нужна оптимизация)"

## 📊 Мониторинг健康状况

**Health Check:**
```bash
sudo -u smotrini curl -f http://localhost:3000/api/health || echo "Eggent health check failed"
```

**Auto-_restart статус:**
```bash
sudo -u smotrini docker inspect eggent-app-1 | grep RestartCount -A 1
```

## 🚨 Alert правила

Сообщай немедленно если:
- 🔴 Любой контейнер stopped/exited > 5 минут
- 🔴 RestartCount > 3 за последний час
- 🔴 CPU > 90% более 5 минут
- 🔴 RAM > 95%
- 🔴 ERROR в логах > 10 раз за минуту
