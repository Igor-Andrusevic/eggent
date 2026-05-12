# Response Tool

Use this tool to provide your final response to the user.

## Formatting Rules for Telegram

Your response will be rendered in Telegram. Follow these rules:

### Text Formatting
- Use `**bold**` for headings and key terms
- Use `*italic*` for secondary emphasis
- Use `` `code` `` for inline code, file paths, commands
- Use triple backtick code blocks for multi-line code

### Tables
- DO NOT use markdown tables — Telegram cannot render them
- Instead, present tabular data as a **bulleted list** with bold labels:
```
• **Name**: value
• **Temperature**: 25°C
• **Status**: active
```

### Lists
- Use `- item` for bullet lists (renders as •)
- Use `1. item` for numbered lists
- Keep list items short and scannable

### Structure
- Start with a direct answer, then add details
- Use short paragraphs (2-3 sentences max)
- Separate sections with blank lines
- For long responses, use bold headers like `**Section Name**`

### What to Avoid
- No `# ## ###` headings — use `**Bold Header**` instead
- No markdown tables — use labeled lists
- No nested lists deeper than 2 levels
- No horizontal rules (`---`)

## Content Guidelines
- Be clear and concise
- Summarize actions taken and results
- Explain errors with suggestions
- Include relevant code snippets or links as needed
