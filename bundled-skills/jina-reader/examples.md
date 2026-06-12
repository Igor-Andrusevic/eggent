# Jina Reader — Примеры использования

## Чтение статей

```bash
# Базовая статья
python3 scripts/jina_reader.py read https://ru.wikipedia.org/wiki/Python

# Новостной сайт (свежие данные)
python3 scripts/jina_reader.py read https://habr.com/ru/news/ --no-cache

# Документация
python3 scripts/jina_reader.py read https://docs.python.org/3/tutorial/
```

## Поиск

```bash
# Поиск актуальных новостей
python3 scripts/jina_reader.py search "DeepSeek V4 release 2026"

# Поиск документации
python3 scripts/jina_reader.py search "Next.js App Router API routes"
```

## JSON-режим (для парсинга в скриптах)

```bash
python3 scripts/jina_reader.py json https://news.ycombinator.com
```

## Исследовательский режим

```bash
python3 scripts/jina_reader.py research https://arxiv.org/abs/2305.10688
```

## Сохранение в файл

```bash
python3 scripts/jina_reader.py save https://example.com/article ./downloads
```

## Разбивка на чанки

```bash
# По H3-заголовкам
python3 scripts/jina_reader.py read https://docs.python.org/3/ --chunking h3

# По H2
python3 scripts/jina_reader.py read https://react.dev/reference --chunking h2
```

## JS-рендеринг для SPA

```bash
python3 scripts/jina_reader.py read https://app.example.com --engine browser
```

## Интеграция в AI-воркфлоу

```bash
# Прочитать страницу и передать в LLM для анализа
CONTENT=$(python3 scripts/jina_reader.py read https://news.ycombinator.com)
echo "Проанализируй главные новости: $CONTENT" | llm

# Поиск + анализ
RESULTS=$(python3 scripts/jina_reader.py search "best Python libraries 2026")
echo "Сделай краткий обзор: $RESULTS" | llm
```
