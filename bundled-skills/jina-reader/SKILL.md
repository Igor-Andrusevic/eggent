---
name: jina-reader
description: Jina Reader — чтение веб-страниц, поиск и загрузка контента для LLM. Преобразует любой URL в чистый Markdown.
homepage: https://jina.ai/reader
metadata:
  {
    "eggent": {
      "emoji": "🌐",
      "requires": { "envs": ["JINA_API_KEY"] },
      "envs": [
        {
          "name": "JINA_API_KEY",
          "label": "Jina API Key",
          "secret": true,
          "placeholder": "jina_..."
        }
      ]
    }
  }
---

# Jina Reader

Преобразует веб-страницы в Markdown, идеально для grounding LLM. Работает с любыми URL: статьи, документация, блоги, PDF, новости.

## Endpoints

| Метод | URL | Назначение |
|-------|-----|-----------|
| GET/POST | `https://r.jina.ai/{url}` | Чтение страницы |
| GET/POST | `https://s.jina.ai/{query}` | Поиск + чтение |

**Аутентификация:** `Authorization: Bearer <JINA_API_KEY>`

**API-ключ:** из переменной окружения `JINA_API_KEY` (см. `.env`)

## Основные заголовки

| Заголовок | Значение | Описание |
|-----------|---------|----------|
| `X-Respond-With` | `markdown` (default), `text`, `html`, `screenshot`, `pageshot` | Формат ответа |
| `X-Respond-With` | `frontmatter` | Добавить YAML frontmatter (title, url, date) |
| `Accept` | `text/markdown`, `application/json`, `text/plain`, `text/html` | Формат ответа |
| `X-Return-Format` | `markdown`, `html`, `text`, `screenshot`, `pageshot` | Альтернатива Accept |
| `X-No-Cache` | `true` | Пропустить кеш, свежие данные |
| `X-Max-Tokens` | число | Лимит токенов на выходе |
| `X-Markdown-Chunking` | `h2`, `h3`, `lines:N` | Разбивка на чанки |
| `X-Preset` | `research`, `summary`, `social` | Пресет параметров |
| `X-Timeout` | секунды (30 default) | Таймаут запроса |
| `X-Wait-For-Seconds` | секунды | Задержка перед рендерингом JS |
| `X-Remove-Selector` | CSS-селектор | Удалить элементы из результата |
| `X-Target-Selector` | CSS-селектор | Извлечь только указанные элементы |
| `X-Engine` | `direct`, `browser` | Движок рендеринга (browser для JS-сайтов) |
| `X-Proxy-Url` | URL прокси | Маршрутизация через прокси |
| `X-Proxy-Allowed-Domains` | домены | Разрешённые домены для прокси |

## Рецепты

### Чтение статьи
```bash
curl "https://r.jina.ai/https://example.com/article" \
  -H "Authorization: Bearer $JINA_API_KEY"
```

### JSON-ответ
```bash
curl "https://r.jina.ai/https://example.com" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Accept: application/json"
```

### С frontmatter
```bash
curl "https://r.jina.ai/https://example.com" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "X-Respond-With: frontmatter"
```

### Поиск
```bash
curl -X POST "https://s.jina.ai/latest AI news" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "Content-Type: application/json"
```

### Разбивка на чанки
```bash
curl "https://r.jina.ai/https://example.com" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "X-Markdown-Chunking: h3"
```

### Режим Research
```bash
curl "https://r.jina.ai/https://example.com" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "X-Preset: research"
```

### JS-рендеринг
```bash
curl "https://r.jina.ai/https://spa-site.com" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "X-Engine: browser" \
  -H "X-Wait-For-Seconds: 5"
```

### Свежие данные (без кеша)
```bash
curl "https://r.jina.ai/https://news-site.com" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "X-No-Cache: true"
```

### Ограничение токенов
```bash
curl "https://r.jina.ai/https://long-article.com" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "X-Max-Tokens: 2000"
```

### Извлечение конкретного блока
```bash
curl "https://r.jina.ai/https://docs.example.com" \
  -H "Authorization: Bearer $JINA_API_KEY" \
  -H "X-Target-Selector: main, article, .content"
```

## CLI

```bash
python3 scripts/jina_reader.py read <url>        # Чтение URL
python3 scripts/jina_reader.py search <query>    # Поиск и чтение
python3 scripts/jina_reader.py json <url>        # JSON-вывод
python3 scripts/jina_reader.py research <url>    # Режим исследования
```

## Лимиты

- Бесплатно: 1M токенов
- Reader Core: 20 req/min, Reader Pro: 50 req/min
- Максимальный размер страницы: ~5MB HTML
