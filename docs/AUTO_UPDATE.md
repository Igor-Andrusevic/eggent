# 🔄 Автоматические обновления Eggent

## 📋 Обзор

Система автоматических обновлений Eggent с уведомлениями в Telegram. Обновляет Eggent из upstream, применяет патчи и пересобирает Docker контейнер - полностью автоматически!

## ✨ Возможности

- ✅ **Автоматическая проверка обновлений** по расписанию
- ✅ **Автоматическое применение обновлений** через git rebase
- ✅ **Автоматическое применение патчей** через npm install
- ✅ **Автоматическая пересборка Docker** контейнера
- ✅ **Telegram уведомления** о всех этапах обновления
- ✅ **Обработка конфликтов** с уведомлением для ручного разрешения
- ✅ **Health check** после обновления
- ✅ **Backup ветки** перед каждым обновлением

## 🚀 Быстрый старт

### Шаг 1: Настройка Telegram уведомлений

```bash
cd ~/.eggent
bash scripts/setup-update-notifications.sh
```

Скрипт проведёт вас через:
1. Проверку Telegram bot токена
2. Получение вашего Telegram Chat ID
3. Тестовую отправку сообщения
4. Настройку расписания обновлений

### Шаг 2: Готово!

Теперь Eggent будет обновляться автоматически, и вы будете получать уведомления в Telegram.

## 📱 Уведомления в Telegram

Вы будете получать:

### 1. ✉️ Начало обновления
```
🔄 Eggent Auto-Update Started

Time: 2026-03-13 14:30:00
Server: srv02.takeshi-n8n.eu

Checking for updates from upstream...
```

### 2. ✅ Успешное обновление
```
✅ Eggent Updated Successfully

Time: 2026-03-13 14:35:00
New commits: 5

Changes applied:
• Git update (rebase)
• Patches applied
• Docker rebuilt
• Container restarted

Status: All systems operational
```

### 3. ❌ Ошибка обновления
```
❌ Eggent Update Failed

Time: 2026-03-13 14:40:00
Error: Update process failed. Check logs.

Check logs: /home/takeshi/.eggent/data/logs/auto-update.log
```

### 4. ⚠️ Конфликты слияния
```
⚠️ Update Conflicts Detected

Time: 2026-03-13 14:45:00
Git rebase has conflicts that need manual resolution.

Conflicting files:
• src/lib/agent/agent.ts
• src/app/api/chat/route.ts

Please resolve manually:
cd ~/.eggent
git status
git rebase --continue
```

### 5. ✓ Нет обновлений
```
✓ Eggent Already Up to Date

Time: 2026-03-13 14:50:00
No new commits from upstream

Status: Running latest version
```

## ⚙️ Настройка расписания

### Варианты расписания

При запуске `setup-update-notifications.sh` выберите частоту:

1. **Ежедневно в 02:00** (рекомендуется)
   - Крон: `0 2 * * *`
   - Обновления каждую ночь

2. **Еженедельно по воскресеньям в 02:00**
   - Крон: `0 2 * * 0`
   - Обновления раз в неделю

3. **Каждые 6 часов**
   - Крон: `0 */6 * * *`
   - Частые обновления

4. **Каждые 12 часов**
   - Крон: `0 */12 * * *`
   - Два раза в день

5. **Только вручную**
   - Без крона
   - Запускайте вручную когда нужно

### Ручное изменение расписания

```bash
# Просмотр текущих крон задач
crontab -l

# Редактирование
crontab -e

# Формат для Eggent авто-обновления:
0 2 * * * cd ~/.eggent && bash scripts/auto-update.sh >> ~/.eggent/data/logs/cron.log 2>&1
```

## 🔧 Ручное обновление

### Быстрое обновление (с уведомлениями)

```bash
cd ~/.eggent
bash scripts/auto-update.sh
```

### Обновление с подробным выводом

```bash
cd ~/.eggent
bash scripts/auto-update.sh 2>&1 | tee data/logs/manual-update.log
```

### Обновление без автоматических скриптов

Если вы предпочитаете полный контроль:

```bash
cd ~/.eggent

# 1. Создать backup
git branch backup-$(date +%Y%m%d)

# 2. Получить обновления
git fetch upstream
git rebase upstream/main

# 3. Разрешить конфликты (если есть)
git status
# [Редактировать файлы]
git add <разрешённые файлы>
git rebase --continue

# 4. Отправить в fork
git push origin main --force-with-lease

# 5. Применить патчи
npm install

# 6. Пересобрать
docker compose build --no-cache app
docker compose up -d app
```

## 📊 Логи

### Логи автоматических обновлений

```bash
# Основной лог
tail -f ~/.eggent/data/logs/auto-update.log

# Cron лог
tail -f ~/.eggent/data/logs/cron.log
```

### Поиск ошибок

```bash
# Последние ошибки
grep -i "error\|failed\|conflict" ~/.eggent/data/logs/auto-update.log | tail -20

# Все обновления за сегодня
grep "$(date +%Y-%m-%d)" ~/.eggent/data/logs/auto-update.log
```

### История обновлений

```bash
# История backup веток
git branch | grep auto-update-backup

# Сравнить с upstream
git log --oneline upstream/main ^main
```

## 🛠️ Решение проблем

### Проблема: Нет уведомлений в Telegram

**Решение:**

1. Проверьте токен и chat ID:
   ```bash
   grep TELEGRAM_ ~/.eggent/.env
   ```

2. Отправьте тестовое сообщение вручную:
   ```bash
   curl -X POST "https://api.telegram.org/bot<token>/sendMessage" \
     -H "Content-Type: application/json" \
     -d '{"chat_id": "<chat_id>", "text": "Test"}'
   ```

3. Убедитесь, что вы запустили `/start` в боте

### Проблема: Конфликты при rebase

**Решение:**

1. Перейдите в каталог Eggent:
   ```bash
   cd ~/.eggent
   ```

2. Посмотрите конфликтующие файлы:
   ```bash
   git status
   ```

3. Откройте каждый файл и разрешите конфликт:
   ```
   <<<<<<< HEAD
   Ваша версия
   =======
   Версия из upstream
   >>>>>>> upstream/main
   ```

4. Сохраните файл и продолжите:
   ```bash
   git add <разрешённые файлы>
   git rebase --continue
   ```

5. Отправьте в fork:
   ```bash
   git push origin main --force-with-lease
   ```

### Проблема: Docker контейнер не запускается после обновления

**Решение:**

1. Проверьте логи контейнера:
   ```bash
   docker logs --tail=100 eggent-app-1
   ```

2. Если ошибка в коде - откатитесь:
   ```bash
   cd ~/.eggent
   git branch backup-$(date +%Y%m%d)
   git reset --hard auto-update-backup-<previous-date>
   docker compose build --no-cache app
   docker compose up -d app
   ```

3. Если проблема с патчами - примените вручную:
   ```bash
   cd ~/.eggent
   npm run patch:gemini
   docker compose restart app
   ```

### Проблема: Авто-обновление не запускается по расписанию

**Решение:**

1. Проверьте cron:
   ```bash
   crontab -l
   ```

2. Проверьте логи cron:
   ```bash
   grep CRON /var/log/syslog | tail -20
   ```

3. Проверьте права доступа:
   ```bash
   ls -la ~/.eggent/scripts/auto-update.sh
   # Должно быть -rwxr-xr-x
   ```

## 🔐 Безопасность

### Защита от потери данных

- **Backup ветки** создаются автоматически перед каждым обновлением
- **Данные в `data/`** не затрагиваются (Docker volume)
- **Rollback** возможен в любой момент

### Безопасность Git

- Используется `--force-with-lease` вместо `--force`
- Проверка конфликтов перед применением
- Подробное логирование всех действий

### Безопасность Telegram

- Токен хранится в `.env` (не в git)
- Chat ID хранится отдельно от bot token
- Сообщения не содержат чувствительной информации

## 📈 Мониторинг

### Статус обновлений

```bash
# Последнее обновление
tail -20 ~/.eggent/data/logs/auto-update.log

# Все backup ветки
git branch | grep auto-update-backup | sort -r

# Текущая версия vs upstream
git rev-list --left-right --count HEAD...upstream/main
```

### Статистика

```bash
# Сколько обновлений было применено
git branch | grep auto-update-backup | wc -l

# Размер логов
du -sh ~/.eggent/data/logs/

# Свободное место
df -h ~/.eggent
```

## 🔄 Жизненный цикл обновления

```
┌─────────────────────────────────────────────────────┐
│  1. Cron срабатывает по расписанию                   │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  2. Создаётся backup ветка                           │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  3. Git fetch upstream                              │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  4. Проверка: есть ли обновления?                    │
│     ├─ Нет → Отправить уведомление "Already up to date" │
│     └─ Да → Продолжить                               │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  5. Git rebase upstream/main                         │
│     ├─ Успех → Продолжить                            │
│     └─ Конфликты → Уведомить, выйти                  │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  6. Push в fork (origin)                            │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  7. NPM install (применить патчи)                   │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  8. Docker rebuild --no-cache                        │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  9. Docker restart                                   │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  10. Health check                                    │
│      ├─ OK → Успешное уведомление                    │
│      └─ Failed → Warning в уведомлении               │
└─────────────────────────────────────────────────────┘
```

## 📞 Поддержка

Если возникли проблемы:

1. **Проверьте логи**: `~/.eggent/data/logs/auto-update.log`
2. **Проверьте контейнер**: `docker ps | grep eggent`
3. **Проверьте health**: `curl http://localhost:3000/api/health`
4. **Откатитесь**: `git reset --hard auto-update-backup-<date>`

## 🎯 Лучшие практики

1. **Выберите подходящее расписание**
   - Продакшн: еженедельно
   - Тестирование: ежедневно
   - Стабильность: только вручную

2. **Мониторьте уведомления**
   -Respond to conflicts quickly
   - Check health after updates

3. **Регулярно проверяйте логи**
   - Раз в неделю просматривайте `auto-update.log`
   - Следите за ошибками и предупреждениями

4. **Тестируйте после обновлений**
   - Проверьте Telegram бот
   - Проверьте web interface
   - Проверьте API endpoints

---

**Дата создания:** 2026-03-13
**Версия:** 1.0
