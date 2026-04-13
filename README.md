# Eggent

<p align="center">
  <a href="./docs/assets/eggent-banner.png">
    <img src="./docs/assets/eggent-banner.png" alt="Eggent banner" width="980" />
</p>

> Форк [eggent-ai/eggent](https://github.com/eggent-ai/eggent) с дополнительными возможностями: Zhipu AI GLM-5.1, cron-автоматизация с выбором модели, улучшенная интеграция Telegram, автообновления и мониторинг.

Eggent — локальная AI-платформа для создания команды специализированных агентов. Создавайте агентов с собственными навыками и MCP-серверами, переключайтесь между ними на естественном языке и делегируйте задачи наиболее подходящему агенту.

## Возможности

- **Мультиагентная архитектура** — создавайте специализированных агентов с уникальными наборами навыков
- **Организация по проектам** — изолированные контексты, файлы и базы знаний
- **Память и знания** — векторное хранилище с семантическим поиском (RAG)
- **Интеграция MCP** — подключайте внешние инструменты через Model Context Protocol
- **Cron-автоматизация** — планируйте повторяющиеся задачи и напоминания с выбором модели для каждой задачи
- **Интеграция Telegram** — общайтесь с агентами из Telegram
- **Мультипровайдер** — OpenAI, Anthropic, Google Gemini, Zhipu AI (GLM-5.1), OpenRouter
- **Веб-поиск и чтение страниц** — поиск через Tavily + инструмент `web_fetch` для прямых ссылок

- **37 встроенных навыков** — включая Bitrix24, SendforSign, NotebookLM, мониторинг серверов, YouTube-поиск

### Кастомные улучшения форка

- **Zhipu AI (GLM-5.1)** — поддержка модели GLM-5.1 Coding Plan с автоматическим `baseUrl`, валидация порядка инструментов и повтор с сокращённой историей при ошибке 400
- **Cron с выбором модели** — каждая cron-задача может использовать свою модель (GLM-5.1 для одних задач, GPT-4o для других)
- **Cron UI** — редактирование задач в интерфейсе, human-readable расписание, селектор модели
- **Cron автозапуск** — шедулер запускается автоматически при старте сервера + retry для уведомлений Telegram
- **Автоматическое транскрибирование аудио** — голосовые сообщения в Telegram расшифровываются через Gemini Flash
- **Автоимпорт файлов из Telegram** — документы, отправленные в Telegram, автоматически попадают в базу знаний
- **Быстрое переключение проектов** — команды `/<имя_проекта>` и алиасы `/family`, `/work`, `/monitoring`
- **Автоопределение таймзоны** — по языковым настройкам Telegram (30+ языков)
- **Автообновление с уведомлениями** — автоматический `git pull` из upstream с отчётом в Telegram (с 10:00 до 21:00)
- **Мониторинг серверов** — навыки для мониторинга Docker-контейнеров через CLI
- **NotebookLM** — встроенный навык для генерации подкастов через Google NotebookLM
- **YouTube-поиск** — yt-dlp в Docker-образе для навыка last30days
- **Gemini совместимость** — объединение последовательных сообщений ассистента, валидация истории для предотвращения ошибок API 400

## Что нового

### Апрель 2026 — Упрощение cron и исправление провайдеров

- **Cron: упрощение шедулера** — убрано verbose-логирование (tickCount, тайминги), удалена функция восстановления зависших задач `recoverStaleRunningJobs`
- **Cron: унификация лимитов** — cron-задачи теперь используют стандартный лимит `MAX_TOOL_STEPS_PER_TURN = 15` (ранее отдельный `MAX_TOOL_STEPS_CRON = 30`)
- **Cron: уменьшение timeout** — `DEFAULT_JOB_TIMEOUT_MS` сокращён с 20 до 10 минут
- **Custom провайдер: обязательный API key** — удалена поддержка опционального API key (`allowMissingApiKey`) для OpenAI-совместимых провайдеров, теперь API key обязателен
- **Исправление загрузки моделей** — убраны дублирующие функции нормализации URL для custom провайдера, упрощена логика `createOpenAICompatibleChatModel`

### Кастомные изменения форка (после v0.1.5)

- **GLM-5.1 Coding Plan** — апгрейд провайдера Zhipu AI с GLM-5 Turbo до GLM-5.1
- **Cron: per-task модель** — каждая cron-задача может использовать отдельную модель и провайдер
- **Cron UI** — редактирование задач, человекочитаемое расписание, селектор модели в интерфейсе
- **Cron автозапуск** — шедулер стартует автоматически при запуске сервера, retry для Telegram-уведомлений
- **NotebookLM bundled skill** — встроенный навык генерации подкастов (заменён git submodule)
- **yt-dlp** — добавлен в Docker-образ для YouTube-поиска в навыке last30days
- **Мониторинг навыков** — обновлены для работы с node user в Docker-группе
- **Bitrix24 и SendforSign** — новые встроенные навыки
- **Безопасность** — обновлён Next.js до 15.5.14
- **Аудио** — улучшена надёжность транскрибации голосовых сообщений (точный поиск файлов, нативный HTTP)
- **Docker** — pinned версия bun для предотвращения 404 при установке

### v0.1.5 — Web Fetch для прямых ссылок (upstream)

- Новый инструмент `web_fetch` для открытия и чтения конкретных URL
- Извлечение текста из HTML, обработка JSON/text, таймауты и лимиты размера ответа
- `search_web` теперь только для поиска, прямые ссылки обрабатываются через `web_fetch`
- Обновлённый UI вывода инструментов (метка `Web Fetch` + превью URL)

## Релизы

- Архив релизов: [docs/releases/README.md](./docs/releases/README.md)
- Последний upstream-релиз: [v0.1.5 — Web Fetch for Direct Links](./docs/releases/0.1.5-web-fetch-direct-links.md)

## Участие и поддержка

- Руководство для контрибьюторов: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Сообщить об ошибке: [Форма баг-репорта](https://github.com/eggent-ai/eggent/issues/new?template=bug_report.yml)
- Предложить фичу: [Форма запроса](https://github.com/eggent-ai/eggent/issues/new?template=feature_request.yml)
- Кодекс поведения: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Политика безопасности: [SECURITY.md](./SECURITY.md)

## Cron: выбор модели для каждой задачи

По умолчанию cron-задачи используют глобальную модель из настроек (`chatModel`). Но можно указать отдельную модель для конкретной задачи — например, GLM-5.1 для тяжёлых задач или GPT-4o-mini для простых уведомлений.

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
        "provider": "zhipuai",
        "model": "glm-5.1",
        "apiKey": "your-api-key"
      }
    }
  }'
```

### Пример через чат с агентом

Просто скажите агенту, какую модель использовать:

> «Создай cron-задачу на каждый день в 9 утра: составь отчёт по серверам. Используй модель glm-5.1»

### Доступные провайдеры

`openai`, `anthropic`, `google`, `openrouter`, `zhipuai`, `ollama`, `custom`

Если `model` не указан — используется глобальная модель из настроек.

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

Переменные окружения установщика:
- `EGGENT_INSTALL_DIR`: целевая директория (по умолчанию: `~/.eggent`)
- `EGGENT_BRANCH`: ветка git (по умолчанию: `main`)
- `EGGENT_REPO_URL`: URL репозитория (по умолчанию: `https://github.com/eggent-ai/eggent.git`)
- `EGGENT_AUTO_INSTALL_DOCKER`: `1`/`0` (по умолчанию: `1`)
- `EGGENT_APP_BIND_HOST`: хост привязки Docker (Linux: `0.0.0.0`, иначе `127.0.0.1`)

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

Если установлен через однокомандный установщик — запустите ту же команду снова:

```bash
curl -fsSL https://raw.githubusercontent.com/eggent-ai/eggent/main/scripts/install.sh | bash
```

Если запускаете из репозитория через Docker:

```bash
git pull --ff-only origin main
npm run setup:docker
```

Если запускаете локально (Node + npm):

```bash
git pull --ff-only origin main
npm run setup:local
```

Проверка после обновления:

```bash
curl http://localhost:3000/api/health
```

### Автообновление (кастомная функция)

Скрипт `scripts/auto-update.sh` автоматически подтягивает изменения из upstream и отправляет уведомление в Telegram. Работает с 10:00 до 21:00. Для настройки укажите в `.env`:

```
TELEGRAM_UPDATE_NOTIFICATIONS=<chat_id>
```

Настройте cron для регулярного запуска:

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
ZHIPUAI_API_KEY=...               # GLM-5.1
OPENROUTER_API_KEY=...
TAVILY_API_KEY=...                # Веб-поиск

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
│   │   └── skills/             # Кастомные навыки проекта
│   └── memory/                 # Векторная БД
├── external-sessions/          # Состояние сессий Telegram
├── user-preferences/           # Таймзона и локаль пользователей
├── chats/                      # История чатов
└── chat-files/                 # Загруженные файлы
```

## Интеграция Telegram

- **Вебхуки** — обработка сообщений в реальном времени
- **Автоимпорт файлов** — документы из Telegram автоматически попадают в базу знаний
- **Транскрибирование голосовых** — через Gemini Flash (бесплатно) или OpenAI Whisper
- **Определение таймзоны** — автоматически по языковым настройкам пользователя
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
- **Хранилище**: Файловое JSON + векторные эмбеддинги
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

## Лицензия

MIT License — см. [LICENSE](LICENSE)
