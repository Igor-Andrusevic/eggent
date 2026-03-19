# Eggent

<p align="center">
  <a href="./docs/assets/eggent-banner.png">
    <img src="./docs/assets/eggent-banner.png" alt="Eggent banner" width="980" />
</p>

Eggent is a local-first AI workspace for building a team of focused agents.

Create specialized agents with their own skill packs and MCP servers, switch between them in plain human language, and delegate each task to the agent best trained for it.

## Features

- **Multi-Agent Architecture** - Create specialized agents with unique skill packs
- **Project-Based Organization** - Isolate contexts, files, and knowledge bases
- **Memory & Knowledge** - Persistent vector storage with semantic search (RAG)
- **MCP Integration** - Connect external tools via Model Context Protocol
- **Cron Automation** - Schedule recurring tasks and reminders
- **Telegram Integration** - Chat with agents from Telegram with automatic timezone detection
- **Multi-Provider Support** - OpenAI, Anthropic, Google Gemini, and more

## What's New in v0.1.3

### Automatic Timezone Detection for Telegram

Eggent now automatically detects user timezone based on their Telegram language settings:

- **Language → Timezone Mapping**: Supports 30+ languages with intelligent timezone guessing
- **Inline Confirmation**: Users confirm timezone with one tap on first message
- **Per-User Storage**: Timezone preferences persist across sessions
- **Exact Time Display**: No more rounding to the hour
- **Time-Sensitive Task Handling**: Agent asks to confirm timezone before scheduling tasks

## Releases

- Latest release snapshot: [0.1.5 - Web Fetch for Direct Links](./docs/releases/0.1.5-web-fetch-direct-links.md)
- GitHub release body : [v0.1.5](./docs/releases/github-v0.1.5.md)
- Release archive: [docs/releases/README.md](./docs/releases/README.md)

## Contributing and Support

- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Report a bug: [Bug report form](https://github.com/eggent-ai/eggent/issues/new?template=bug_report.yml)
- Request a feature: [Feature request form](https://github.com/eggent-ai/eggent/issues/new?template=feature_request.yml)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)

## Installation

| Path | Best for | Command |
| --- | --- | --- |
| One-command installer | Fastest setup, Docker-first | `curl -fsSL https://raw.githubusercontent.com/eggent-ai/eggent/main/scripts/install.sh \| bash` |
| Local production | Run directly on your machine | `npm run setup:local` |
| Docker isolated | Containerized runtime | `npm run setup:docker` |
| Manual setup | Full control | See [Manual Setup](#manual-setup) |

## Quick Start

### 1. One-command Installer

```bash
curl -fsSL https://raw.githubusercontent.com/eggent-ai/eggent/main/scripts/install.sh | bash
```

What it does:
- Installs Docker (if missing) on macOS/Linux
- Clones/updates Eggent in `~/.eggent`
- Runs Docker deployment

Environment variables:
- `EGGENT_INSTALL_DIR`: target directory (default: `~/.eggent`)
- `EGGENT_BRANCH`: git branch (default: `main`)
- `EGGENT_AUTO_INSTALL_DOCKER`: `1`/`0` (default: `1`)

### 2. Docker Development

```bash
docker compose up --build
docker compose build --no-cache app   # After dependency changes
docker compose logs -f app
docker compose restart app
```

### 3. Local Development

```bash
npm install
npm run dev              # http://localhost:3000
npm run build
npm run start
```

## Configuration

### Environment Variables (.env)

```bash
# Required for Telegram integration
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
APP_BASE_URL=https://your-domain.com  # Must be HTTPS for webhooks

# AI Provider API Keys (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# Optional
TELEGRAM_ADMIN_USER_IDS=123456789,987654321  # Comma-separated Telegram user IDs
DEFAULT_TELEGRAM_PROJECT=ai  # Default project for Telegram messages
```

### Data Directory Structure

```
data/
├── settings/
│   ├── settings.json           # App settings (models, memory, search config)
│   ├── telegram-integration.json
│   └── project-access.json
├── projects/<project-id>/
│   ├── .meta/
│   │   ├── knowledge/     # Files for RAG ingestion
│   │   └── skills/         # Custom project skills
│   └── memory/             # Vector DB
├── external-sessions/      # Telegram session state
├── user-preferences/       # Per-user timezone/locale storage
├── chats/                  # Chat history
└── chat-files/             # Uploaded files
```

## Telegram Integration

Eggent integrates with Telegram for mobile access to your agents:

- **Webhook-based**: Real-time message handling
- **Automatic File Import**: Documents sent via Telegram are automatically imported into knowledge base
- **Voice Message Transcription**: Audio messages transcribed using Gemini Flash (free) or OpenAI Whisper
- **Timezone Detection**: Automatic timezone detection based on user's language
- **Access Control**: Whitelist-based user authorization

### Telegram Commands

| Command | Description |
| --- | --- |
| `/start` | Show help and current project |
| `/help` | Show help |
| `/new` | Start new conversation (reset context) |
| `/timezone <tz>` | Set your timezone (e.g., `/timezone Europe/Rome`) |

### Setting up Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Set your webhook URL: `https://your-domain.com/api/integrations/telegram/webhook`
3. Configure `.env` with your bot token and webhook secret
4. Add your Telegram user ID to `TELEGRAM_ADMIN_USER_IDS`

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **AI SDK**: Vercel AI SDK
- **UI**: React 19, Tailwind CSS 4
- **State**: Zustand
- **Storage**: File-based JSON with vector embeddings
- **Container**: Docker with multi-stage builds

## License

MIT License - see [LICENSE](LICENSE)
