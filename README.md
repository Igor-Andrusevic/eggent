# Eggent

<p align="center">
  <a href="./docs/assets/eggent-banner.png">
    <img src="./docs/assets/eggent-banner.png" alt="Eggent banner" width="980" />
</p>

> Форк [eggent-ai/eggent](https://github.com/eggent-ai/eggent) с дополнительными возможностями: DeepSeek V4, Zhipu AI GLM-5.1, cron-автоматизация с fallback-моделями, улучшенная интеграция Telegram, автообновления и мониторинг.

Eggent — локальная AI-платформа для создания команды специализированных агентов. Создавайте агентов с собственными навыками и MCP-серверами, переключайтесь между ними на естественном языке и делегируйте задачи наиболее подходящему агенту.

## Возможности

- **Мультиагентная архитектура** — специализированные агенты с уникальными наборами навыков
- **Организация по проектам** — изолированные контексты, файлы и базы знаний
- **Гибридная память** — векторное хранилище с RAG + LLM Wiki (compiled knowledge base по паттерну Karpathy)
- **Мультипровайдер** — OpenAI, Anthropic, Google Gemini, DeepSeek V4, Zhipu AI (GLM-5.1), OpenRouter, Ollama, Codex CLI, Gemini CLI
- **Cron-автоматизация** — повторяющиеся задачи с выбором модели и fallback на альтернативных провайдерах при ошибках
- **Интеграция Telegram** — общение с агентами из Telegram, автоимпорт файлов, транскрибирование голосовых, HTML-форматирование ответов
- **Интеграция MCP** — подключение внешних инструментов через Model Context Protocol
- **Веб-поиск и чтение страниц** — поиск через Tavily + инструмент `web_fetch` для прямых ссылок
- **37 встроенных навыков** — Bitrix24, SendforSign, NotebookLM, мониторинг серверов, YouTube-поиск и др.

## Поддерживаемые AI-провайдеры

| Провайдер | Модели | API Key | Auth |
| --- | --- | --- | --- |
| **OpenAI** | GPT-4o, o1, o3, o4, GPT-5.x (динамический список) | `OPENAI_API_KEY` | API Key |
| **Anthropic** | Claude (динамический список) | `ANTHROPIC_API_KEY` | API Key |
| **Google** | Gemini 2.5 Pro/Flash, Gemma 4 | `GOOGLE_API_KEY` | API Key |
| **DeepSeek** | V4 Flash (Thinking/No-Thinking), V4 Pro | `DEEPSEEK_API_KEY` | API Key |
| **Zhipu AI** | GLM-5.1, GLM-5 Turbo, GLM-4.7 Flash (FREE) | `ZHIPUAI_API_KEY` | API Key |
| **OpenRouter** | 200+ моделей (динамический список) | `OPENROUTER_API_KEY` | API Key |
| **Ollama** | Локальные модели | Не требуется | — |
| **Codex CLI** | GPT-5.x Codex | Не требуется | OAuth |
| **Gemini CLI** | Gemini 3.1/2.5 | Не требуется | OAuth |
| **Custom** | Любой OpenAI-совместимый API | Зависит | API Key |

## Улучшения форка

### AI-провайдеры
- **DeepSeek V4** — поддержка Flash (thinking/no-thinking) и Pro, автоматическая обработка `reasoning_content` для multi-turn диалогов
- **Zhipu AI GLM-5.1** — автоматический `baseUrl`, валидация порядка инструментов, повтор с сокращённой историей при ошибке 400
- **Gemini-совместимость** — объединение последовательных сообщений ассистента, валидация истории для API

### Cron
- **Выбор модели для задачи** — каждая cron-задача может использовать свою модель (GLM-5.1 для тяжёлых, DeepSeek V4 Flash для быстрых или GPT-4o-mini для простых уведомлений)
- **Fallback при ошибке модели** — если основная модель недоступна (401, 403, 429, billing и т.д.), cron автоматически перебирает альтернативных провайдеров: Google → DeepSeek → OpenAI → Anthropic → OpenRouter → Zhipu
- **UI редактирования** — интерфейс для управления задачами, человекочитаемое расписание, селектор модели
- **Автозапуск шедулера** — стартует при запуске сервера, retry для Telegram-уведомлений

### Telegram
- **HTML-форматирование** — ответы ИИ с bold, italic, code, links; таблицы конвертируются в списки; fallback на plain text при ошибке парсинга
- **Автоимпорт файлов** — документы из Telegram автоматически попадают в базу знаний проекта
- **Транскрибирование голосовых** — через Gemini Flash (бесплатно)
- **Автоопределение таймзоны** — по языковым настройкам (30+ языков)
- **Быстрое переключение проектов** — команды `/<имя_проекта>` и алиасы `/family`, `/work`, `/monitoring`

### Инфраструктура
- **Автообновление из upstream** — `auto-update.sh` с авто-abort зависших rebase, `--include-untracked` stash, очистка старых backup-веток, уведомления в Telegram (10:00–21:00)
- **Мониторинг серверов** — навыки для проверки Docker-контейнеров через CLI
- **Контроль свободного места** — `backup-eggent.sh` проверяет диск перед созданием бэкапа (MIN_FREE_SPACE_GB=2)

### Встроенные навыки
- **NotebookLM** — генерация подкастов
- **YouTube-поиск** — `yt-dlp` в Docker-образе
- **Bitrix24, SendforSign** — дополнительные навыки в комплекте

## Установка

| Способ | Для кого | Команда |
| --- | --- | --- |
| Однокомандный установщик | Быстрая установка, Docker | `curl -fsSL https://raw.githubusercontent.com/eggent-ai/eggent/main/scripts/install.sh \| bash` |
| Локальная установка | Прямой запуск на машине | `npm run setup:local` |
| Docker | Контейнеризированная среда | `npm run setup:docker` |
| Вручную | Полный контроль | См. [Ручная установка](#ручная-установка) |

### 1. Однокомандный установщик

```bash
curl -fsSL https://raw.githubusercontent.com/eggent-ai/eggent/main/scripts/install.sh | bash
```

Что делает:
- Устанавливает Docker (macOS/Linux), если не установлен
- Клонирует/обновляет Eggent в `~/.eggent`
- Запускает Docker-деплой

Переменные окружения:
- `EGGENT_INSTALL_DIR` — целевая директория (по умолчанию: `~/.eggent`)
- `EGGENT_BRANCH` — ветка git (по умолчанию: `main`)
- `EGGENT_REPO_URL` — URL репозитория (по умолчанию: `https://github.com/eggent-ai/eggent.git`)
- `EGGENT_AUTO_INSTALL_DOCKER` — `1`/`0` (по умолчанию: `1`)
- `EGGENT_APP_BIND_HOST` — хост привязки Docker (Linux: `0.0.0.0`, иначе `127.0.0.1`)

### 2. Docker-деплой

```bash
docker compose up --build
docker compose build --no-cache app   # После изменения зависимостей
docker compose logs -f app
docker compose restart app
```

### 3. Локальная разработка

```bash
npm install
npm run dev              # http://localhost:3000
npm run build
npm run start
```

### 4. Ручная установка

```bash
cp .env.example .env
# убедитесь, что python3 установлен и доступен в PATH
npm install
npm run build
npm run start
```

## Обновление

Перед обновлением сделайте резервные копии `.env` и `data/`.

| Метод установки | Команда обновления |
| --- | --- |
| Однокомандный установщик | Запустить ту же команду `curl ... \| bash` |
| Docker (из репозитория) | `git pull --ff-only origin main && npm run setup:docker` |
| Локально (Node + npm) | `git pull --ff-only origin main && npm run setup:local` |

Проверка после обновления:

```bash
curl http://localhost:3000/api/health
```

### Автообновление

Скрипт `scripts/auto-update.sh` автоматически подтягивает изменения из upstream, разрешает конфликты rebase и отправляет отчёт в Telegram. Для настройки укажите в `.env`:

```
TELEGRAM_UPDATE_NOTIFICATIONS=<chat_id>
```

Добавьте в cron (запуск каждые 2 часа с 10:00 до 21:00):

```bash
0 */2 10-21 * * cd ~/.eggent && bash scripts/auto-update.sh
```

## Конфигурация

### Переменные окружения (.env)

```bash
# AI-провайдеры (хотя бы один обязателен)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=sk-...              # DeepSeek V4 Flash/Pro
ZHIPUAI_API_KEY=...                  # GLM-5.1
OPENROUTER_API_KEY=...
TAVILY_API_KEY=...                   # Веб-поиск

# Telegram интеграция
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
TELEGRAM_DEFAULT_PROJECT_ID=ai
TELEGRAM_UPDATE_NOTIFICATIONS=<chat_id>   # Уведомления об автообновлениях

# Приложение
APP_BASE_URL=https://your-domain.com     # HTTPS для вебхуков
APP_BIND_HOST=127.0.0.1                  # 0.0.0.0 для публичного доступа
APP_PORT=3000
EXTERNAL_API_TOKEN=...                   # Автогенерируется при setup
```

### Структура данных

```
data/
├── settings/
│   ├── settings.json           # Настройки приложения (модели, память, поиск)
│   ├── telegram-integration.json
│   └── project-access.json
├── projects/<project-id>/
│   ├── .meta/
│   │   ├── knowledge/          # Файлы для RAG-индексации
│   │   ├── wiki/               # LLM Wiki (summaries, entities, concepts, synthesis)
│   │   │   ├── index.md        # Каталог wiki-страниц
│   │   │   ├── log.md          # Хронология операций
│   │   │   ├── sources/        # Summary-страницы по источникам
│   │   │   ├── entities/       # Сущности (люди, организации, места)
│   │   │   ├── concepts/       # Концепции и темы
│   │   │   └── synthesis/      # Кросс-анализы
│   │   ├── skills/             # Кастомные навыки проекта
│   │   └── mcp/                # Конфигурация MCP-серверов
│   └── memory/                 # Векторная БД
├── external-sessions/          # Состояние сессий Telegram
├── user-preferences/           # Таймзона и локаль пользователей
├── chats/                      # История чатов
├── chat-files/                 # Загруженные файлы
└── cron/main/                  # Cron-задачи и логи выполнения
```

## Cron: выбор модели и fallback

По умолчанию cron-задачи используют глобальную модель из настроек (`chatModel`). Для конкретной задачи можно указать свою модель. При ошибке (401, 403, 429, billing, timeout и т.д.) cron автоматически перебирает доступных провайдеров.

### Пример через API

```bash
curl -X POST http://localhost:3000/api/projects/<project-id>/cron \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Утренний отчёт",
    "schedule": { "kind": "cron", "expr": "0 9 * * *" },
    "payload": {
      "kind": "agentTurn",
      "message": "Составь утренний отчёт по серверам",
      "model": {
        "provider": "deepseek",
        "model": "deepseek-v4-flash:no-think",
        "apiKey": "your-api-key"
      }
    }
  }'
```

### Пример через чат с агентом

> «Создай cron-задачу на каждый день в 9 утра: составь отчёт по серверам. Используй модель deepseek»

### Доступные провайдеры

`openai`, `anthropic`, `google`, `deepseek`, `openrouter`, `zhipuai`, `ollama`, `codex-cli`, `gemini-cli`, `custom`

Если `model` не указан — используется глобальная модель из настроек. Если указанная модель недоступна — cron пробует альтернативных провайдеров (Google → DeepSeek → OpenAI → Anthropic → OpenRouter → Zhipu), проверяя наличие API-ключей в `.env`.

## Интеграция Telegram

- **Вебхуки** — обработка сообщений в реальном времени
- **HTML-форматирование** — bold, italic, code, links, списки; таблицы → именованные списки
- **Автоимпорт файлов** — документы из Telegram автоматически попадают в базу знаний
- **Транскрибирование голосовых** — через Gemini Flash (бесплатно) или OpenAI Whisper
- **Автоопределение таймзоны** — по языковым настройкам пользователя
- **Управление доступом** — авторизация по белому списку user_id

### Команды Telegram

| Команда | Описание |
| --- | --- |
| `/start` | Справка и текущий проект |
| `/help` | Справка |
| `/new` | Новый разговор (сброс контекста) |
| `/timezone <tz>` | Установить таймзону (например, `/timezone Europe/Moscow`) |
| `/<имя_проекта>` | Переключиться на проект |
| `/family` | Алиас: проект «Семья» |
| `/work` | Алиас: проект «Работа» |
| `/monitoring` | Алиас: проект «Сервер - Мониторинг» |

### Настройка Telegram

1. Создайте бота через [@BotFather](https://t.me/BotFather)
2. Установите вебхук: `https://your-domain.com/api/integrations/telegram/webhook`
3. Укажите в `.env` токен бота и секрет вебхука
4. Добавьте свой Telegram user ID в `TELEGRAM_ALLOWED_USER_IDS`

## Стек технологий

- **Фреймворк**: Next.js 15.5 с App Router
- **AI SDK**: Vercel AI SDK v6
- **UI**: React 19, Tailwind CSS 4
- **Состояние**: Zustand
- **Хранилище**: Файловое JSON + векторные эмбеддинги + LLM Wiki (markdown)
- **Тестирование**: Vitest (тесты wiki-модуля)
- **Контейнеры**: Docker с multi-stage сборкой

## Структура проекта

```
src/                # Код приложения (Next.js App Router)
scripts/            # Скрипты установки и утилиты
bundled-skills/     # Встроенные наборы навыков
data/               # Runtime-состояние (генерируется локально)
docs/               # Дополнительная документация
docker-compose.yml  # Контейнерный runtime
Dockerfile          # Multi-stage production-сборка
```

## Релизы

- Архив релизов: [docs/releases/README.md](./docs/releases/README.md)
- Последний upstream-релиз: [v0.1.5 — Web Fetch for Direct Links](./docs/releases/0.1.5-web-fetch-direct-links.md)

## Участие и поддержка

- Руководство для контрибьюторов: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Сообщить об ошибке: [Issues](https://github.com/eggent-ai/eggent/issues/new?template=bug_report.yml)
- Предложить фичу: [Issues](https://github.com/eggent-ai/eggent/issues/new?template=feature_request.yml)
- Кодекс поведения: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Политика безопасности: [SECURITY.md](./SECURITY.md)

## Лицензия

MIT License — см. [LICENSE](LICENSE)
