const TG_TELEGRAM_TEXT_LIMIT = 4096;

const HTML_SPECIAL: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (ch) => HTML_SPECIAL[ch] ?? ch);
}

function escapeHtmlInTag(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function processInlineFormatting(text: string): string {
  let result = text;

  result = result.replace(
    /(?<!\w)\*\*(?!\s)(.+?)(?<!\s)\*\*(?!\w)/g,
    (_, content) => `<b>${processInlineFormatting(content)}</b>`
  );

  result = result.replace(
    /(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g,
    (_, content) => `<i>${processInlineFormatting(content)}</i>`
  );

  result = result.replace(
    /(?<!\w)__(?!\s)(.+?)(?<!\s)__(?!\w)/g,
    (_, content) => `<u>${processInlineFormatting(content)}</u>`
  );

  result = result.replace(
    /(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g,
    (_, content) => `<i>${processInlineFormatting(content)}</i>`
  );

  result = result.replace(
    /~~(.+?)~~/g,
    (_, content) => `<s>${content}</s>`
  );

  result = result.replace(
    /`([^`\n]+?)`/g,
    (_, content) => `<code>${escapeHtmlInTag(content)}</code>`
  );

  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, url) => `<a href="${url}">${text}</a>`
  );

  return result;
}

function convertTableToStructuredText(tableBlock: string): string {
  const lines = tableBlock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return escapeHtml(tableBlock);

  const parseRow = (row: string): string[] => {
    const trimmed = row.replace(/^\|/, "").replace(/\|$/, "").trim();
    return trimmed.split("|").map((cell) => cell.trim());
  };

  const headers = parseRow(lines[0]);
  const isSeparator = (line: string) => /^[\s|:-]+$/.test(line) && line.includes("-");
  if (!isSeparator(lines[1])) return escapeHtml(tableBlock);

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    if (cells.length > 0 && cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }

  if (rows.length === 0 && headers.length > 0) {
    return headers.map((h) => `  <b>${processInlineFormatting(h)}</b>`).join("\n");
  }

  const result: string[] = [];
  for (const row of rows) {
    const parts: string[] = [];
    for (let i = 0; i < row.length; i++) {
      const header = i < headers.length ? headers[i] : "";
      const value = row[i];
      if (header && value) {
        parts.push(`<b>${processInlineFormatting(header)}</b>: ${processInlineFormatting(value)}`);
      } else if (value) {
        parts.push(processInlineFormatting(value));
      }
    }
    if (parts.length > 0) {
      result.push(parts.join(" | "));
    }
  }

  return result.join("\n");
}

export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";

  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const codeBlocks: string[] = [];
  let processed = markdown.replace(codeBlockRegex, (_match, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
    return `\x00CODEBLOCK${idx}\x00`;
  });

  processed = processed.replace(/^#{1,3}\s+(.+)$/gm, (_, text) => {
    return `<b>${processInlineFormatting(text.trim())}</b>`;
  });

  const tableRegex = /((?:^\|.+\|$\n?)+)/gm;
  processed = processed.replace(tableRegex, (match) => {
    return `\n${convertTableToStructuredText(match)}\n`;
  });

  processed = processInlineFormatting(processed);

  processed = processed.replace(/^[-*]\s+(.+)$/gm, (_, content) => `• ${content}`);
  processed = processed.replace(/^\d+\.\s+(.+)$/gm, (_, content) => {
    return `${content}`;
  });

  processed = processed.replace(/^>\s?(.+)$/gm, "<blockquote>$1</blockquote>");

  processed = processed.replace(
    /\x00CODEBLOCK(\d+)\x00/g,
    (_, idx) => codeBlocks[parseInt(idx)]
  );

  processed = processed.replace(/\n{3,}/g, "\n\n");

  return processed.trim();
}

export function truncateTelegramHtml(html: string, limit: number = TG_TELEGRAM_TEXT_LIMIT): string {
  const plainText = html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  if (plainText.length <= limit) return html;

  let charBudget = limit;
  let result = "";
  let i = 0;

  while (i < html.length && charBudget > 0) {
    if (html[i] === "<") {
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) break;
      const tag = html.slice(i, tagEnd + 1);
      result += tag;
      i = tagEnd + 1;
      continue;
    }

    if (html[i] === "&") {
      const semiEnd = html.indexOf(";", i);
      if (semiEnd !== -1 && semiEnd - i <= 6) {
        const entity = html.slice(i, semiEnd + 1);
        if (charBudget >= 1) {
          result += entity;
          charBudget -= 1;
          i = semiEnd + 1;
          continue;
        }
      }
    }

    result += html[i];
    charBudget -= 1;
    i += 1;
  }

  const openTags: string[] = [];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(result)) !== null) {
    const fullTag = tagMatch[0];
    const tagName = tagMatch[1].toLowerCase();
    if (fullTag.startsWith("</")) {
      if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
        openTags.pop();
      }
    } else if (!fullTag.endsWith("/>")) {
      const selfClosing = ["br", "hr", "img"];
      if (!selfClosing.includes(tagName)) {
        openTags.push(tagName);
      }
    }
  }

  for (let t = openTags.length - 1; t >= 0; t--) {
    result += `</${openTags[t]}>`;
  }

  if (i < html.length) {
    result += "…";
  }

  return result;
}

export function formatTelegramReply(text: string): string {
  const html = markdownToTelegramHtml(text);
  return truncateTelegramHtml(html);
}
