#!/usr/bin/env python3
"""Jina Reader CLI — чтение веб-страниц, поиск и загрузка контента для LLM."""

import json
import os
import sys
import urllib.request
import urllib.error

API_KEY = os.environ.get("JINA_API_KEY", "")
BASE_URL = "https://r.jina.ai"
SEARCH_URL = "https://s.jina.ai"


USER_AGENT = "Mozilla/5.0 (compatible; Eggent/1.0; +https://github.com/anomalyco/eggent)"


def _build_request(url: str, headers: dict[str, str], method: str = "GET") -> urllib.request.Request:
    common_headers = {"User-Agent": USER_AGENT, **headers}
    if method == "POST":
        data = json.dumps({"url": url}).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE_URL}/",
            data=data,
            headers={"Content-Type": "application/json", **common_headers},
            method="POST",
        )
    elif method == "SEARCH":
        data = json.dumps({"q": url}).encode("utf-8")
        req = urllib.request.Request(
            SEARCH_URL,
            data=data,
            headers={"Content-Type": "application/json", **common_headers},
            method="POST",
        )
    else:
        req = urllib.request.Request(
            f"{BASE_URL}/{url}",
            headers=common_headers,
        )
    return req


def _make_request(url: str, headers: dict[str, str], method: str = "GET") -> str:
    req = _build_request(url, headers, method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        sys.exit(f"HTTP {e.code}: {body}")
    except urllib.error.URLError as e:
        sys.exit(f"Network error: {e.reason}")


def read_url(url: str, output_format: str = "markdown", chunking: str = "", no_cache: bool = False, max_tokens: int = 0, engine: str = "") -> str:
    headers = {"Authorization": f"Bearer {API_KEY}"}

    format_map = {
        "markdown": "text/markdown",
        "json": "application/json",
        "text": "text/plain",
        "html": "text/html",
    }
    accept = format_map.get(output_format, "text/markdown")
    headers["Accept"] = accept

    if output_format in ("markdown",):
        headers["X-Respond-With"] = "frontmatter"

    if chunking:
        headers["X-Markdown-Chunking"] = chunking

    if no_cache:
        headers["X-No-Cache"] = "true"

    if max_tokens > 0:
        headers["X-Max-Tokens"] = str(max_tokens)

    if engine:
        headers["X-Engine"] = engine

    return _make_request(url, headers)


def search_query(query: str, output_format: str = "markdown") -> str:
    headers = {"Authorization": f"Bearer {API_KEY}"}

    format_map = {
        "markdown": "text/markdown",
        "json": "application/json",
        "text": "text/plain",
        "html": "text/html",
    }
    accept = format_map.get(output_format, "text/markdown")
    headers["Accept"] = accept

    return _make_request(query, headers, method="SEARCH")


def research_url(url: str) -> str:
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "X-Preset": "research",
        "X-Respond-With": "frontmatter",
    }
    return _make_request(url, headers)


def save_result(url: str, content: str, output_dir: str = ".") -> str:
    filename = url.rstrip("/").split("/")[-1] or "page"
    safe_name = "".join(c if c.isalnum() else "_" for c in filename)[:50]
    path = os.path.join(output_dir, f"jina_{safe_name}.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


def print_usage() -> None:
    print("Jina Reader CLI")
    print()
    print("  python3 jina_reader.py read <url>              Чтение URL → Markdown")
    print("  python3 jina_reader.py json <url>              Чтение URL → JSON")
    print("  python3 jina_reader.py search <query>          Поиск + чтение")
    print("  python3 jina_reader.py research <url>          Режим исследования")
    print("  python3 jina_reader.py save <url> [dir]        Сохранить в файл")
    print()
    print("  Опции read:")
    print("    --no-cache          Свежие данные")
    print("    --chunking <h2|h3|lines:N>   Разбивка")
    print("    --max-tokens N      Лимит токенов")
    print("    --engine browser    JS-рендеринг")
    print("    --format <fmt>      markdown|json|text|html")
    print()
    print(f"  API Key: {API_KEY[:12]}...")


def main() -> None:
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "read":
        if len(sys.argv) < 3:
            sys.exit("Usage: jina_reader.py read <url> [options]")
        url = sys.argv[2]
        args = sys.argv[3:]
        kwargs: dict = {}
        i = 0
        while i < len(args):
            if args[i] == "--no-cache":
                kwargs["no_cache"] = True
            elif args[i] == "--chunking" and i + 1 < len(args):
                i += 1
                kwargs["chunking"] = args[i]
            elif args[i] == "--max-tokens" and i + 1 < len(args):
                i += 1
                kwargs["max_tokens"] = int(args[i])
            elif args[i] == "--engine" and i + 1 < len(args):
                i += 1
                kwargs["engine"] = args[i]
            elif args[i] == "--format" and i + 1 < len(args):
                i += 1
                kwargs["output_format"] = args[i]
            i += 1
        result = read_url(url, **kwargs)
        print(result)

    elif cmd == "json":
        if len(sys.argv) < 3:
            sys.exit("Usage: jina_reader.py json <url>")
        url = sys.argv[2]
        print(read_url(url, output_format="json"))

    elif cmd == "search":
        if len(sys.argv) < 3:
            sys.exit("Usage: jina_reader.py search <query>")
        query = sys.argv[2]
        print(search_query(query))

    elif cmd == "research":
        if len(sys.argv) < 3:
            sys.exit("Usage: jina_reader.py research <url>")
        url = sys.argv[2]
        print(research_url(url))

    elif cmd == "save":
        if len(sys.argv) < 3:
            sys.exit("Usage: jina_reader.py save <url> [dir]")
        url = sys.argv[2]
        output_dir = sys.argv[3] if len(sys.argv) > 3 else "."
        content = read_url(url)
        path = save_result(url, content, output_dir)
        print(f"Saved: {path}")

    else:
        print(f"Unknown command: {cmd}")
        print_usage()
        sys.exit(1)


if __name__ == "__main__":
    main()
