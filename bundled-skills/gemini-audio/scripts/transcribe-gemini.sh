#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  transcribe-gemini.sh <audio-file> [--out /path/to/out.txt]

Transcribe audio using Google Gemini 1.5 Pro multimodal capabilities.
EOF
  exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
fi

in="${1:-}"
shift || true

out=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      out="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      ;;
  esac
done

if [[ ! -f "$in" ]]; then
  echo "File not found: $in" >&2
  exit 1
fi

if [[ "${GOOGLE_API_KEY:-}" == "" ]]; then
  echo "Missing GOOGLE_API_KEY" >&2
  exit 1
fi

if [[ "$out" == "" ]]; then
  base="${in%.*}"
  out="${base}-gemini.txt"
fi

mkdir -p "$(dirname "$out")"

# Read audio file and base64 encode
audio_data=$(base64 -w 0 "$in")

# Call Gemini API with audio
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GOOGLE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"contents\": [{
      \"parts\": [
        {
          \"inline_data\": {
            \"mime_type\": \"audio/ogg\",
            \"data\": \"${audio_data}\"
          }
        },
        {
          \"text\": \"Transcribe this audio message. Return only the transcribed text without any additional commentary or formatting.\"
        }
      ]
    }]
  }" | jq -r '.candidates[0].content.parts[0].text // empty' > "$out"

if [[ ! -s "$out" ]]; then
  echo "Transcription failed or returned empty result" >&2
  exit 1
fi

echo "$out"
