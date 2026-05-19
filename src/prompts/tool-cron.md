Use this tool for any delayed or scheduled action.

When the user asks to "remind later", "через N минут/секунд", "по расписанию", or "every day/week", prefer `cron` instead of `code_execution`.

Rules:
- For one-time reminders: use `action="add"` with `schedule.kind="at"` and ISO timestamp.
- For recurring reminders: use `schedule.kind="every"` or `schedule.kind="cron"`.
- For sub-minute recurring reminders, use `schedule.kind="every"` with `everyMs` (example: 30s -> `everyMs=30000`).
- Put the actual reminder text/instruction in `payload.message`.
- Do not send raw natural-language text as the job definition; always send structured fields (`schedule` + `payload` or `delaySeconds` + `message`).
- `delaySeconds` / `delayMs` are one-shot delays and should not be used for recurring jobs.
- If cron returns a preflight validation error, immediately retry once with normalized args (`action="add"`, explicit `schedule`, explicit `payload.message`) and do not repeat identical invalid arguments.
- After creating a job, report `id`, schedule, and expected next run time.
- For management requests, use:
  - `status` for scheduler state
  - `list` for jobs
  - `update` to enable/disable or edit
  - `run` to trigger immediately
  - `runs` to show execution history
  - `remove` to delete

Model selection:
- The system will automatically use the default AI model configured in settings.
- You may specify `payload.model` to override the model for this job (e.g. `{ "provider": "deepseek", "model": "deepseek-v4-pro" }`).
- If a job fails due to model unavailability, the system will automatically try alternative available providers (those with configured API keys). This fallback is transparent — no manual action needed.
- Only set `payload.model` when you specifically need a different model than the default.

Do not emulate scheduling with terminal `at`, `cron` shell files, or `time.sleep`.

Examples:
- One-shot in 65 seconds:
  - `action="add"`
  - `delaySeconds=65`
  - `message="Отправь пользователю: 😊"`
- One-shot absolute time:
  - `action="add"`
  - `schedule={ "kind":"at", "at":"2026-02-20T15:23:30Z" }`
  - `payload={ "kind":"agentTurn", "message":"Отправь пользователю: 😊" }`
- Daily at specific time:
  - `action="add"`
  - `schedule={ "kind":"cron", "expr":"47 19 * * *" }`
  - `payload={ "kind":"agentTurn", "message":"Отправь пользователю: прогноз погоды в Москве" }`
- Every 30 seconds:
  - `action="add"`
  - `schedule={ "kind":"every", "everyMs":30000 }`
  - `payload={ "kind":"agentTurn", "message":"Отправь пользователю: Привет!" }`
