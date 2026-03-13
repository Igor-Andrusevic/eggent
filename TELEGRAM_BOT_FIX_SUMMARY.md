# ✅ Eggent Telegram Bot - Исправлено!

## 🎯 Что было исправлено:

### 1. Gemini API Compatibility Patch
**Проблема:** `Please ensure that function response turn comes immediately after a function call turn`

**Решение:** Разделение assistant messages с tool calls на два отдельных сообщения

**Файл:** `src/lib/agent/agent.ts`

### 2. Telegram reply_to_message_id Fix
**Проблема:** `Bad Request: message to be replied not found`

**Решение:** Убран параметр `reply_to_message_id` при отправке ответов

**Файл:** `src/app/api/integrations/telegram/route.ts`

### 3. Docker Network Configuration
**Проблема:** 502 Bad Gateway - контейнер не был подключён к Nginx Proxy Manager

**Решение:** Добавлена сеть `nginx-proxy-manager_default` в `docker-compose.yml`

### 4. Old Chat Cleanup
**Удалены:** Старые чаты с неправильной структурой сообщений

## 📁 Созданные файлы:

1. **`scripts/patch-gemini-fix.sh`** - Автоматический патчер (применяет оба исправления)
2. **`scripts/cleanup-chats.sh`** - Очистка старых чатов
3. **`docs/GEMINI_PATCH.md`** - Документация

## 🔄 После обновлений Eggent:

Патчи применяются автоматически через `postinstall` hook:

```bash
cd ~/.eggent
git pull  # или как вы обновляетесь
npm install  # Патчи применятся автоматически
sudo docker compose build --no-cache app
sudo docker compose up -d app
```

Или вручную:
```bash
npm run patch:gemini
sudo docker compose build --no-cache app
sudo docker compose up -d app
```

## ✅ Текущий статус:

- ✅ Патч Gemini применён
- ✅ Патч Telegram применён
- ✅ Docker сеть исправлена
- ✅ Старые чаты очищены
- ✅ Патчер включает оба исправления
- ✅ postinstall hook настроен
- ✅ Контейнер пересобран и запущен

## 🧪 Как протестировать:

**Вручную через Telegram:**
1. Откройте Telegram
2. Найдите бота @AI_Andrusevichi_bot
3. Напишите: `/new`
4. Затем задайте любой вопрос

**Или через API:**
```bash
curl -X POST "https://api.telegram.org/bot<token>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": "<your_id>", "text": "Тест"}'
```

## 📊 Известные ограничения:

- **История чатов:** Старые сообщения до патча могут вызывать ошибки (очищены)
- **Webhook timing:** При большом количестве сообщений возможна задержка

## 🔍 Мониторинг:

```bash
# Статус контейнера
sudo docker ps | grep eggent

# Логи
sudo docker logs -f eggent-app-1

# Webhook статус
curl -s "https://api.telegram.org/bot<token>/getWebhookInfo"
```

---

**Дата исправления:** 2026-03-13
**Версия патчера:** 2.0 (унифицированный патчер с двумя исправлениями)
