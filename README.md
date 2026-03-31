# Eggent

<p align="center">
  <a href="./docs/assets/eggent-banner.png">
    <img src="./docs/assets/eggent-banner.png" alt="Eggent banner" width="980" />
</p>

> Форк [eggent-ai/eggent](https://github.com/eggent-ai/eggent) с дополнительными возможностями: Zhipu AI, улучшенная интеграция Telegram, автообновления и мониторинг.

Eggent — локальная AI-платформа для создания команды специализированных агентов. Создавайте агентов с собственными навыками и MCP-серверами, переключайтесь между ними на естественном языке и делегируйте задачи наиболее подходящему агенту.

## Возможности

- **Мультиагентная архитектура** — создавайте специализированных агентов с уникальными наборами навыков
- **Организация по проектам** — изолированные контексты, файлы и базы знаний
- **Память и знания** — векторное хранилище с семантическим поиском (RAG)
- **Интеграция MCP** — подключайте внешние инструменты через Model Context Protocol
- **Cron-автоматизация** — планируйте повторяющиеся задачи и напоминания
- **Интеграция Telegram** — общайтесь с агентами из Telegram
- **Мультипровайдер** — OpenAI, Anthropic, Google Gemini, Zhipu AI (GLM-5 Turbo), OpenRouter
- **Веб-поиск и чтение страниц** — поиск через Tavily + инструмент `web_fetch` для прямых ссылок

### Кастомные улучшения форка

- **Zhipu AI (GLM-5 Turbo)** — поддержка китайской модели с автоматическим `baseUrl`
- **Автоматическое транскрибирование аудио** — голосовые сообщения в Telegram расшифровываются через Gemini Flash
- **Автоимпорт файлов из Telegram** — документы, отправленные в Telegram, автоматически попадают в базу знаний
- **Быстрое переключение проектов** — команды `/<имя_проекта>` и алиасы `/family`, `/work`, `/monitoring`
- **Автоопределение таймзоны** — по языковым настройкам Telegram (30+ языков)
- **Автообновление с уведомлениями** — автоматический `git pull` из upstream с отчётом в Telegram (с 10:00 до 21:00)
- **Мониторинг серверов** — навык для мониторинга Docker-контейнеров через CLI
- **YouTube-поиск** — yt-dlp в Docker-образе для навыка last30days

## Что нового

### v0.1.5 — Web Fetch для прямых ссылок (upstream)

- Новый инструмент `web_fetch` для открытия и чтения конкретных URL
- Извлечение текста из HTML, обработка JSON/text, таймауты и лимиты размера ответа
- `search_web` теперь только для поиска, прямые ссылки обрабатываются через `web_fetch`
- Обновлённый UI вывода инструментов (метка `Web Fetch` + превью URL)

### Кастомные изменения форка

- Голосовые сообщения: улучшенная транскрибация с точным поиском файлов и нативным HTTP
- Zhipu AI: валидация порядка инструментов и повтор с сокращённой историей при ошибке 400
- Gemini: объединение последовательных сообщений ассистента для предотвращения ошибок API
- Docker: pinned версия bun, монтирование X auth cookies для last30days
- Обработка ошибки «недостаточно средств» с понятным сообщением пользователю

## Релизы

- Последний релиз: [0.1.5 — Web Fetch for Direct Links](./docs/releases/0.1.5-web-fetch-direct-links.md)
- Тело релиза на GitHub: [v0.1.5](./docs/releases/github-v0.1.5.md)
- Архив релизов: [docs/releases/README.md](./docs/releases/README.md)

## Участие и поддержка

- Руководство для контрибьюторов: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Сообщить об ошибке: [Форма баг-репорта](https://github.com/eggent-ai/eggent/issues/new?template=bug_report.yml)
- Предложить фичу: [Форма запроса](https://github.com/eggent-ai/eggent/issues/new?template=feature_request.yml)
- Кодекс поведения: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Политика безопасности: [SECURITY.md](./SECURITY.md)

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
ZHIPUAI_API_KEY=...               # GLM-5 Turbo
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

- **Фреймворк**: Next.js 15 с App Router
- **AI SDK**: Vercel AI SDK
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
