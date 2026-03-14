---
name: gemini-audio
description: Transcribe audio using Google Gemini 1.5 Pro multimodal AI.
homepage: https://ai.google.dev/gemini-api/docs/audio
metadata:
  {
    "eggent":
      {
        "emoji": "🎵",
        "requires": { "bins": ["curl", "base64", "jq"], "env": ["GOOGLE_API_KEY"] },
        "primaryEnv": "GOOGLE_API_KEY",
      },
  }
---

# Gemini Audio Transcription

Transcribe audio files using Google Gemini 1.5 Pro's multimodal capabilities.

## Quick start

```bash
{baseDir}/scripts/transcribe-gemini.sh /path/to/audio.ogg
```

Defaults:

- Model: `gemini-1.5-pro-latest`
- Output: `<input>-gemini.txt`

## Supported formats

Gemini 1.5 Pro supports multiple audio formats:
- `.ogg` (Opus codec)
- `.mp3`
- `.wav`
- `.m4a`
- And more

## API key

Set `GOOGLE_API_KEY`, or configure it in `~/.eggent/.env`:

```bash
GOOGLE_API_KEY=your_api_key_here
```

Get your API key at: https://makersuite.google.com/app/apikey

## Advantages over OpenAI Whisper

- **Free tier available** - Google Gemini has generous free tier
- **Multimodal** - Can understand audio with context
- **Multilingual** - Supports multiple languages out of the box
- **No additional setup** - Uses existing Google API infrastructure
