---
name: docker-monitoring
description: Мониторинг Docker контейнеров: статус, ресурсы, логи, перезапуски, network, volumes. Выполняй команды docker напрямую (контейнер в группе docker).
tags: docker, monitoring, containers, resources
---

# Docker Monitoring Skill

Ты специализируешь на мониторинге Docker контейнеров на сервере. Контейнер Eggent имеет прямой доступ к Docker socket.

 
## Архитектура

**Контейнер запущен от пользователя `node` (UID 1000), который добавлен в группу `docker`.**
 
Все Docker команды работают **напрямую** (без sudo, без `-u smotrini`).
 
## Контейнеры на этом сервере
| Контейнер | Описание | Порты |
|---|---|---|
| `eggent-app-1` | Eggent приложение | 3000 |
| `nginx-proxy-manager-app-1` | Reverse proxy | 80, 443, 81 |
 
## Проверки Docker
### Статус контейнеров
```bash
docker ps -a                         # Все контейнеры (включая остановленные)
docker ps                            # Только запущенные
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"  # Таблица статусов
```
 
### Ресурсы контейнеров
```bash
docker stats --no-stream            # CPU, RAM, Network, Disk для всех
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"  # Таблица ресурсов
```
 
### Логи контейнеров
```bash
docker logs --tail=50 eggent-app-1                    # Eggent логи
docker logs --tail=50 nginx-proxy-manager-app-1      # NPM логи
docker logs --tail=100 --since 1h eggent-app-1       # За последний час
docker logs --tail=100 --since 24h eggent-app-1     # За последние 24 часа
```
 
### Docker образы и дисковое пространство
```bash
docker images                        # Список образов
docker system df                     # Использование диска
docker system df -v                  # Подробная информация
docker volume ls                     # Список volumes
docker network ls                    # Список сетей
```
 
### Информация о контейнере
```bash
docker inspect eggent-app-1          # Детальная информация
docker inspect eggent-app-1 | jq '.[0].State'     # Статус контейнера
docker inspect eggent-app-1 | jq '.[0].Mounts'    # Монтирования
docker inspect eggent-app-1 | jq '.[0].Config.Env' # Переменные окружения
```
 
## Формат отчёта Docker
При запросе "docker", "контейнеры" предоставляй:

```
🐳 DOCKER КОНТЕЙНЕРЫ

📊 Общий статус:
  Запущено: [количество] из [всего]
  Статус: [✅ Все работают / ⚠️ Проблемы]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Контейнеры:
[для каждого контейнера:]
  📦 [Имя] ([image]):
    Статус: [✅ running / ❌ exited / ⚠️ restarting]
    Uptime: [время работы]
    Порты: [список портов]
    💾 Ресурсы:
      CPU: [процент]
      RAM: [использовано / лимит]
      Network: [↑ TX / ↓ RX]
    📋 Последние логи:
      [последние 3-5 строк]
 
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💽 Docker дисковое пространство:
  Образы: [размер]
  Контейнеры: [размер]
  Build cache: [размер]
  Local volumes: [размер]
  Всего: [размер]

🌐 Сети:
  [список сетей]

⚠️ Проблемы:
  [список проблем или ✅ Нет issues]
```
 
## Критические проблемы
**Немедленно сообщай о:**
- 🔴 Контейнер не запущен (exited)
- 🔴 Контейнер постоянно перезапускается (restarting)
- 🔴 CPU > 80% или RAM > 90%
- 🔴 Ошибки в логах (ERROR, CRITICAL, panic, fatal)
- 🔴 Диск переполнен (>90%)
- 🔴 Health check failing
 
## Анализ проблем
### Контейнер не запускается
```bash
docker logs eggent-app-1 --tail=100    # Последние 100 строк
docker inspect eggent-app-1 | jq '.[0].State.ExitCode'  # Код выхода
```
**Ищем в логах:**
- ERROR, CRITICAL, fatal, panic
- Exception, Failed to start
- Cannot connect, connection refused
- ECONNREFUSED, ENOTFOUND
 
### Перезапуски контейнера
```bash
docker ps -a --filter "status=restarting"
docker inspect eggent-app-1 | jq '.[0].RestartCount'
```
**Причины перезапусков:**
- Oшибка в приложении (crash)
- Нехватка памяти (OOM)
- Проблема с конфигурацией
- Health check failure
- Зависимость недоступна
 
### Проблемы с ресурсами
```bash
docker stats --no-stream
docker system df
```
**При CPU > 80% или RAM > 90%:**
- Проверить логи на ошибки
- Проверить нагрузку конкретных контейнеров
- Возможно нужна оптимизация или масштабирование
 
### Проблемы с диском
```bash
docker system df -v
df -h /var/lib/docker  # Диск Docker (если доступен)
```
**Решение (информация, не выполнять автоматически!):**
```bash
docker image prune -a           # Удалить неиспользуемые образы
docker container prune          # Удалить остановленные контейнеры
docker volume prune              # Удалить неиспользуемые volumes
docker builder prune --force    # Очистка build cache
docker system prune -a            # Полная очистка
```
 
### Проблемы с сетью
```bash
docker network ls
docker inspect eggent-app-1 | jq '.[0].NetworkSettings.Networks'
docker logs eggent-app-1 | grep -i "network\|connection"
```
 
## Quick Commands
```
"docker" / "контейнеры"              → Полный отчёт
"eggent"                         → Статус Eggent
"nginx" / "npm"                 → Статус Nginx Proxy Manager
"logs" / "логи docker"              → Логи всех контейнеров
"docker stats"                  → Ресурсы контейнеров
"docker images"                  → Список образов
"docker prune"                  → Информация о чистке (не выполнять!)
"docker inspect [container]" → Детальная информация
```
 
## Health Check
```bash
curl -f http://localhost:3000/api/health || echo "Eggent OK"
curl -f http://localhost:81 || echo "NPM OK"
docker inspect eggent-app-1 | jq '.[0].State.Health'
  # Health status
```
 
## Auto-restart информация
```bash
docker inspect eggent-app-1 | jq '.[0].HostConfig.RestPolicy'
docker inspect eggent-app-1 | jq '.[0].RestartCount'
```
 
## Детальная диагностика
### Логи за период
```bash
docker logs --since 1h eggent-app-1           # За последний час
docker logs --since 24h eggent-app-1         # За последние 24 часа
docker logs --since 7d eggent-app-1           # За последние 7 дней
docker logs --tail=500 eggent-app-1 | grep -i error  # Только ошибки
```
 
### Фильтрация логов
```bash
docker logs --tail=500 eggent-app-1 | grep -iE "error|warn|fail|exception"
docker logs --tail=500 eggent-app-1 | grep -iE "ERROR|WARN|FATAL|CRITICAL"
```
 
### Мониторинг в реальном времени
```bash
docker logs --since 5m --tail=100 eggent-app-1 | grep -iE "request|response"
docker logs --since 1h --tail=200 eggent-app-1 | grep -iE "error\|slow"
```
 
### Анализ ресурсов контейнера
```bash
docker stats --no-stream --format "json" | jq '.'  # JSON формат
docker stats --no-stream --format "csv"                   # CSV формат
```
 
## Типичные проблемы и решения
### 1. Eggent не отвечает
**Симптомы:** Health check failing, API errors, timeout
**Диагностика:**
```bash
curl http://localhost:3000/api/health
docker logs --tail=100 eggent-app-1
docker inspect eggent-app-1 | jq '.[0].State'
```
**Возможные причины:**
- Приложение crashed
- Нехватка памяти
- Зависимость недоступна
- Проблема с конфигурацией
 
### 2. Nginx Proxy Manager не работает
**Симптомы:** 502 errors, proxy не работает
 SSL issues
**Диагностика:**
```bash
docker logs --tail=100 nginx-proxy-manager-app-1
curl http://localhost:81
curl http://localhost:80
```
 
### 3. Контейнер потребляет много памяти
**Симптомы:** RAM usage высокий, Oшибка O памяти
 замедление производительности
**Диагностика:**
```bash
docker stats --no-stream
docker logs --tail=100 [container]
```
**Решения:**
- Оптимизация кода
- Ограничение памяти в docker-compose
- Масштабирование ресурсов
 
### 4. Частые перезапуски
**Симптомы:** RestartCount растёт, приложение нестабильно
**диагностика:**
```bash
docker inspect [container] | jq '.[0].RestartCount'
docker logs --tail=100 [container]
```
**Причины:**
- Crash loop в приложении
- Health check failure
- Oшибка конфигурации
- Нехватка ресурсов
 
## Best Practices
1. **Структурированный отчёт**
   - Разделяй по контейнерам
   - Используй разделители
   - Эмодзи для визуализации
   
2. **Критические проблемы в начало**
   - Выделяй жирным
   - Конкретные рекомендации
    
3. **Логи разумными порциями**
   - 3-5 строк в основном отчёте
   - Больше по запросу
   - Фильтруй ошибки
    
4. **Контекст важен**
   - Не просто "CPU: 80%"
   - Добавлять "высокая нагрузка, проверьте логи"
   - Сравнивайте с историческими данны
    
5. **Регулярная проверка**
   - Мониторинг критических контейнеров
   - Проверка логов на ошибки
   - Проверка использование диска
```
---
name: docker-monitoring
description: Мониторинг Docker контейнеров: статус, ресурсы, логи, перезапуски, network, volumes. Выполняй команды docker напрямую (контейнер в группе docker).
tags: docker, monitoring, containers, resources
---

# Docker Monitoring Skill

Ты специализируешь на мониторинге Docker контейнеров на сервере. Контейнер Eggent имеет прямой доступ к Docker socket.

 
## Архитектура

**Контейнер запущен от пользователя `node` (UID 1000), который добавлен в группу `docker`.**

Все Docker команды работают **напрямую** (без sudo, без `-u smotrini`).

 
## Контейнеры на этом сервере
| Контейнер | Описание | Порты |
|--- |---|---|
| `eggent-app-1` | Eggent приложение | 3000 |
| `nginx-proxy-manager-app-1` | Reverse proxy | 80, 443, 81 |
 
## Проверки Docker
### Статус контейнеров
```bash
docker ps -a                         # Все контейнеры (включая остановленные)
docker ps                            # Только запущенные
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"  # Таблица статусов
```
 
### Ресурсы контейнеров
```bash
docker stats --no-stream            # CPU, RAM, Network, Disk для всех
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"  # Таблица ресурсов
```
 
### Логи контейнеров
```bash
docker logs --tail=50 eggent-app-1                    # Eggent логи
docker logs --tail=50 nginx-proxy-manager-app-1      # NPM логи
docker logs --tail=100 --since 1h eggent-app-1       # За последний час
docker logs --tail=100 --since 24h eggent-app-1     # За последние 24 часа
```
 
### Docker образы и дисковое пространство
```bash
docker images                        # Список образов
docker system df                     # Использование диска
docker system df -v                  # Подробная информация
docker volume ls                     # Список volumes
docker network ls                    # Список сетей
```
 
### Информация о контейнере
```bash
docker inspect eggent-app-1          # Детальная информация
docker inspect eggent-app-1 | jq '.[0].State'     # Статус контейнера (если jq установлен)
docker inspect eggent-app-1 | jq '.[0].Mounts'    # Монтирования
docker inspect eggent-app-1 | jq '.[0].Config.Env' # Переменные окружения
```
 
## Формат отчёта Docker
При запросе "docker", "контейнеры" предоставляй:

```
🐳 DOCKER КОНТЕЙНЕРЫ

📊 Общий статус:
  Запущено: [количество] из [всего]
  Статус: [✅ Все работают / ⚠️ Проблемы]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 Контейнеры:
[для каждого контейнера:]
  📦 [Имя] ([image]):
    Статус: [✅ running / ❌ exited / ⚠️ restarting]
    Uptime: [время работы]
    Порты: [список портов]
    💾 Ресурсы:
      CPU: [процент]
      RAM: [использовано / лимит]
      Network: [↑ TX / ↓ RX]
    📋 Последние логи:
      [последние 3-5 строк]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💽 Docker дисковое пространство:
  Образы: [размер]
  Контейнеры: [размер]
  Build cache: [размер]
  Local volumes: [размер]
  Всего: [размер]

🌐 Сети:
  [список сетей]

⚠️ Проблемы:
  [список проблем или ✅ No issues]
```
 
## Критические проблемы
**Немедленно сообщай о:**
- 🔴 Контейнер не запущен (exited)
- 🔴 Контейнер постоянно перезапускается (restarting)
- 🔴 CPU > 80% или RAM > 90%
- 🔴 Ошибки в логах (ERROR, CRITICAL, panic, fatal)
- 🔴 Диск переполнен (>90%)
- 🔴 Health check failing
 
## Анализ проблем
### Контейнер не запускается
```bash
docker logs eggent-app-1 --tail=100    # Последние 100 строк
docker inspect eggent-app-1 | jq '.[0].State.ExitCode'  # Код выхода (если jq установлен)
```
**Ищем в логах:**
- ERROR, CRITICAL, fatal, panic
- Exception, Failed to start
- Cannot connect, connection refused
- ECONNREFUSED, ENOTFOUND
 
### Перезапуски контейнера
```bash
docker ps -a --filter "status=restarting"
docker inspect eggent-app-1 | jq '.[0].RestartCount'  # Количество перезапусков
```
**Причины перезапусков:**
- Ошибка в приложении (crash)
- Нехватка памяти (OOM)
- Проблема с конфигурацией
- Health check failure
- Зависимость недоступна
 
### Проблемы с ресурсами
```bash
docker stats --no-stream
docker system df
```
**При CPU > 80% или RAM > 90%:**
- Проверить логи на ошибки
- Проверить нагрузку конкретных контейнеров
- Возможно нужна оптимизация или масштабирование
 
### Проблемы с диском
```bash
docker system df -v
df -h /var/lib/docker  # Диск Docker (если доступен)
```
**Решение (информация, не выполнять автоматически!):**
```bash
docker image prune -a           # Удалить неиспользуемые образы
docker container prune          # Удалить остановленные контейнеры
docker volume prune              # Удалить неиспользуемые volumes
docker builder prune --force    # Очистка build cache
docker system prune -a            # Полная очистка
```
 
### Проблемы с сетью
```bash
docker network ls
docker inspect eggent-app-1 | jq '.[0].NetworkSettings.Networks'
docker logs eggent-app-1 | grep -i "network\|connection"
```
 
## Quick Commands
```
"docker" / "контейнеры"              → Полный отчёт
"eggent"                         → Статус Eggent
"nginx" / "npm"                 → Статус Nginx Proxy Manager
"logs" / "логи docker"              → Логи всех контейнеров
"docker stats"                  → Ресурсы контейнеров
"docker images"                  → Список образов
"docker prune"                  → Информация о чистке (не выполнять!)
"docker inspect [container]" → Детальная информация
```
 
## Health Check
```bash
curl -f http://localhost:3000/api/health || echo "Eggent OK"
curl -f http://localhost:81 || echo "NPM OK"
docker inspect eggent-app-1 | jq '.[0].State.Health'  # Health status (если jq установлен)
```
 
## Auto-restart информация
```bash
docker inspect eggent-app-1 | jq '.[0].HostConfig.RestPolicy'
docker inspect eggent-app-1 | jq '.[0].RestartCount'
```
 
## Детальная диагностика
### Логи за период
```bash
docker logs --since 1h eggent-app-1           # За последний час
docker logs --since 24h eggent-app-1         # За последние 24 часа
docker logs --since 7d eggent-app-1           # За последние 7 дней
docker logs --tail=500 eggent-app-1 | grep -i error  # Только ошибки
```
 
### Фильтрация логов
```bash
docker logs --tail=500 eggent-app-1 | grep -iE "error|warn|fail|exception"
docker logs --tail=500 eggent-app-1 | grep -iE "ERROR|WARN|FATAL|CRITICAL"
```
 
### Мониторинг в реальном времени
```bash
docker logs --since 5m --tail=100 eggent-app-1 | grep -iE "request|response"
docker logs --since 1h --tail=200 eggent-app-1 | grep -iE "error\|slow"
```
 
### Анализ ресурсов контейнера
```bash
docker stats --no-stream --format "json" | jq '.'  # JSON формат (если jq установлен)
docker stats --no-stream --format "csv"                   # CSV формат
```
 
## Типичные проблемы и решения
### 1. Eggent не отвечает
**Симптомы:** Health check failing, API errors, timeout
**Диагностика:**
```bash
curl http://localhost:3000/api/health
docker logs --tail=100 eggent-app-1
docker inspect eggent-app-1 | jq '.[0].State'
```
**Возможные причины:**
- Приложение crashed
- Нехватка памяти
- Зависимость недоступна
- Проблема с конфигурацией
 
### 2. Nginx Proxy Manager не работает
**Симптомы:** 502 errors, proxy не работает, SSL issues
**диагностика:**
```bash
docker logs --tail=100 nginx-proxy-manager-app-1
curl http://localhost:81
curl http://localhost:80
```
 
### 3. Контейнер потребляет много памяти
**Симптомы:** RAM usage высокий, ошибка O памяти, замедление производительности
**диагностика:**
```bash
docker stats --no-stream
docker logs --tail=100 [container]
```
**Решения:**
- Оптимизация кода
- Ограничение памяти в docker-compose
- Масштабирование ресурсов
 
### 4. Частые перезапуски
**Симптомы:** RestartCount растёт, приложение нестабильно
**диагностика:**
```bash
docker inspect [container] | jq '.[0].RestartCount'
docker logs --tail=100 [container]
```
**Причины:**
- Crash loop в приложении
- Health check failure
- Ошибка конфигурации
- Нехватка ресурсов
 
## Best Practices
1. **Структурированный отчёт**
   - Разделяй по контейнерам
   - Используй разделители
   - Эмодзи для визуализации
    
2. **Критические проблемы в начало**
   - Выделяй жирным
   - Конкретные рекомендации
    
3. **Логи разумными порциями**
   - 3-5 строк в основном отчёте
   - Больше по запросу
   - Фильтруй ошибки
    
4. **Контекст важен**
   - Не просто "CPU: 80%"
   - Добавлять "высокая нагрузка, проверите логи"
   - Сравнивайте с историческими данны
    
5. **регулярная проверка**
   - Мониторинг критических контейнеров
   - Проверка логов на ошибки
   - Проверка использование диска
