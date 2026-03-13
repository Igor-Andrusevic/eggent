# 🤖 Автоматические обновления Eggent

## ⚡ Быстрый старт (2 минуты)

```bash
cd ~/.eggent
bash scripts/setup-update-notifications.sh
```

## ✨ Что вы получите

- ✅ **Автоматические обновления** по расписанию
- ✅ **Telegram уведомления** о всех этапах
- ✅ **Автоматическое применение патчей** (Gemini fix, Telegram fix)
- ✅ **Автоматическая пересборка** Docker контейнера
- ✅ **Уведомления о конфликтах** для ручного разрешения

## 📱 Примеры уведомлений

### ✅ Успешное обновление:
```
✅ Eggent Updated Successfully

New commits: 5
Changes applied:
• Git update (rebase)
• Patches applied
• Docker rebuilt
• Container restarted

Status: All systems operational
```

### ⚠️ Требуется внимание:
```
⚠️ Update Conflicts Detected

Conflicting files:
• src/lib/agent/agent.ts

Please resolve manually:
cd ~/.eggent
git status
git rebase --continue
```

## 📚 Документация

- **Подробное руководство:** `docs/AUTO_UPDATE.md`
- **Ручное обновление:** `UPDATE_GUIDE.md`
- **Патчи:** `docs/GEMINI_PATCH.md`

## 🛠️ Полезные команды

```bash
# Ручное обновление (с уведомлениями)
cd ~/.eggent && bash scripts/auto-update.sh

# Просмотр логов
tail -f ~/.eggent/data/logs/auto-update.log

# Текущее расписание
crontab -l | grep auto-update

# Статус обновлений
git branch | grep auto-update-backup
```

## 🔧 Настройка переменных

Добавьте в `.env`:

```bash
# Telegram notifications для auto-update
TELEGRAM_UPDATE_NOTIFICATIONS=ваш_chat_id
```

**Или запустите setup скрипт** - он всё настроит автоматически!

---

**Вопросы?** См. `docs/AUTO_UPDATE.md`
