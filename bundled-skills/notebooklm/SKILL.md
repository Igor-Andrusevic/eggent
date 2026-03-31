---
name: notebooklm
description: Google NotebookLM integration for querying notebooks, managing sources, and generating AI artifacts via notebooklm-py Python library.
homepage: https://github.com/teng-lin/notebooklm-py
metadata:
  {
    "eggent":
      {
        "emoji": "📓",
        "requires": { "files": ["~/.notebooklm/storage_state.json"] },
      },
  }
---

# notebooklm

Interact with Google NotebookLM through the `notebooklm-py` async Python library. Query your notebooks with source-grounded answers, manage sources, generate AI artifacts (podcasts, reports, quizzes), and more.

## Setup

Authentication uses Google session cookies stored in `~/.notebooklm/storage_state.json`.

To obtain the auth file:

1. On a machine with a browser, install: `pip install "notebooklm-py[browser]"`
2. Run: `notebooklm login`
3. Copy `~/.notebooklm/storage_state.json` to the server at `~/.notebooklm/storage_state.json`

If the session expires, re-run `notebooklm login` and replace the file.

## How to Use

All operations use **async Python** via `code_execution` with `runtime="python"`.

**Always wrap code in async main + asyncio.run:**

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        notebooks = await client.notebooks.list()
        for nb in notebooks:
            print(f"{nb.id}: {nb.title} ({nb.sources_count} sources)")

asyncio.run(main())
```

## Common Operations

### List All Notebooks

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        notebooks = await client.notebooks.list()
        for nb in notebooks:
            print(f"ID: {nb.id}")
            print(f"Title: {nb.title}")
            print(f"Sources: {nb.sources_count}")
            print("---")

asyncio.run(main())
```

### Get Notebook Description (AI Summary + Suggested Topics)

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        desc = await client.notebooks.get_description("NOTEBOOK_ID")
        print(f"Summary: {desc.summary}")
        for topic in desc.suggested_topics:
            print(f"  - {topic.question}")

asyncio.run(main())
```

### Ask a Question (Main Feature)

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        result = await client.chat.ask(
            "NOTEBOOK_ID",
            "What are the main findings about X?",
        )
        print(result.answer)
        for ref in result.references:
            print(f"  [{ref.citation_number}] Source: {ref.source_id}")

asyncio.run(main())
```

**Ask with specific sources only:**

```python
result = await client.chat.ask(
    "NOTEBOOK_ID",
    "Summarize the key points",
    source_ids=["SOURCE_ID_1", "SOURCE_ID_2"],
)
```

**Continue a conversation (follow-up):**

```python
result2 = await client.chat.ask(
    "NOTEBOOK_ID",
    "Can you elaborate on the first point?",
    conversation_id=result.conversation_id,
)
```

### List Sources in a Notebook

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        sources = await client.sources.list("NOTEBOOK_ID")
        for src in sources:
            print(f"ID: {src.id}")
            print(f"Title: {src.title}")
            print(f"Type: {src.kind}")

asyncio.run(main())
```

### Get Full Text of a Source

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        fulltext = await client.sources.get_fulltext("NOTEBOOK_ID", "SOURCE_ID")
        print(f"Title: {fulltext.title}")
        print(f"Chars: {fulltext.char_count}")
        print(fulltext.content[:2000])

asyncio.run(main())
```

### Get AI-Generated Source Guide (Summary + Keywords)

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        guide = await client.sources.get_guide("NOTEBOOK_ID", "SOURCE_ID")
        print(f"Summary: {guide['summary']}")
        print(f"Keywords: {guide['keywords']}")

asyncio.run(main())
```

### Add Sources to a Notebook

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        nb_id = "NOTEBOOK_ID"

        await client.sources.add_url(nb_id, "https://example.com/article")
        await client.sources.add_text(nb_id, "My Notes", "Content here...")
        await client.sources.add_youtube(nb_id, "https://youtube.com/watch?v=VIDEO_ID")

asyncio.run(main())
```

### Generate Audio Overview (Podcast)

```python
import asyncio
from notebooklm import NotebookLMClient, AudioFormat, AudioLength

async def main():
    async with await NotebookLMClient.from_storage() as client:
        status = await client.artifacts.generate_audio(
            "NOTEBOOK_ID",
            audio_format=AudioFormat.DEEP_DIVE,
            audio_length=AudioLength.DEFAULT,
        )
        final = await client.artifacts.wait_for_completion(
            "NOTEBOOK_ID",
            status.task_id,
            timeout=300,
            poll_interval=5,
        )
        if final.is_complete:
            print(f"Audio ready: {final.url}")

asyncio.run(main())
```

### Generate a Report

```python
import asyncio
from notebooklm import NotebookLMClient, ReportFormat

async def main():
    async with await NotebookLMClient.from_storage() as client:
        status = await client.artifacts.generate_report(
            "NOTEBOOK_ID",
            title="Research Summary",
            format=ReportFormat.STUDY_GUIDE,
        )
        final = await client.artifacts.wait_for_completion(
            "NOTEBOOK_ID", status.task_id, timeout=300,
        )
        if final.is_complete:
            path = await client.artifacts.download_report("NOTEBOOK_ID", "/tmp/report.md")
            print(f"Saved to: {path}")

asyncio.run(main())
```

### List and Download Artifacts

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        artifacts = await client.artifacts.list("NOTEBOOK_ID")
        for art in artifacts:
            print(f"ID: {art.id}")
            print(f"Title: {art.title}")
            print(f"Type: {art.kind}")
            print(f"Completed: {art.is_completed}")

asyncio.run(main())
```

### Create a New Notebook

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        nb = await client.notebooks.create("My New Notebook")
        print(f"Created: {nb.id} - {nb.title}")

asyncio.run(main())
```

## Important Notes

- **Always use `async with await NotebookLMClient.from_storage() as client:`** — the client manages HTTP connections and must be used as an async context manager.
- **Rate limiting:** Google limits aggressive usage. Add `await asyncio.sleep(2)` between bulk operations if you get `RPCError`.
- **Authentication:** If you get auth errors, the session cookies may have expired. The client auto-refreshes CSRF tokens, but expired cookies require re-running `notebooklm login`.
- **Error handling:** Use `from notebooklm import RPCError` and wrap calls in try/except.
- **Source types:** Use `src.kind` property (returns enum: `pdf`, `web_page`, `youtube`, `pasted_text`, etc.).
- **Artifact types:** Use `art.kind` property (returns enum: `audio`, `video`, `report`, `quiz`, `flashcards`, etc.).

## Audio/Video Formats

```python
from notebooklm import AudioFormat, AudioLength, VideoFormat, VideoStyle

AudioFormat.DEEP_DIVE    # In-depth discussion
AudioFormat.BRIEF        # Quick summary
AudioFormat.CRITIQUE     # Critical analysis
AudioFormat.DEBATE       # Two-sided debate

AudioLength.SHORT        # ~5 min
AudioLength.DEFAULT      # ~10 min
AudioLength.LONG         # ~15 min

VideoFormat.EXPLAINER    # Explainer video
VideoFormat.BRIEF        # Short video
```

## Research (Web/Drive Search)

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:
        result = await client.research.start("NOTEBOOK_ID", "AI safety regulations", mode="fast")
        task_id = result["task_id"]

        while True:
            status = await client.research.poll("NOTEBOOK_ID")
            if status["status"] == "completed":
                break
            await asyncio.sleep(10)

        imported = await client.research.import_sources("NOTEBOOK_ID", task_id, status["sources"][:5])
        print(f"Imported {len(imported)} sources")

asyncio.run(main())
```
