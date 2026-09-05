#!/usr/bin/env python3
"""
Whisper transcription script using faster-whisper.
Usage: python3 transcribe-whisper.py <audio_file_path> [--model tiny|base|small|medium|large|large-v3]
Output: transcription text to stdout
"""
import sys
import os
import json
import argparse
import subprocess
from pathlib import Path


def ensure_faster_whisper():
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        pip_bin = os.environ.get("PIP_BIN", "pip")
        subprocess.check_call(
            [pip_bin, "install", "faster-whisper"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


ensure_faster_whisper()


MODEL_DIR = os.path.join(os.path.dirname(__file__), "whisper-models")

DEFAULT_MODEL = "tiny"


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio file using faster-whisper")
    parser.add_argument("audio_file", help="Path to the audio file")
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help=f"Model size (default: {DEFAULT_MODEL})")
    parser.add_argument("--language", default=None,
                        help="Language code (e.g. ru, en, auto)")
    args = parser.parse_args()

    audio_path = args.audio_file
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}"}), file=sys.stderr)
        sys.exit(1)

    from faster_whisper import WhisperModel

    model_size = args.model
    compute_type = "int8"
    cpu_count = os.cpu_count() or 4
    num_workers = min(cpu_count, 2)

    os.makedirs(MODEL_DIR, exist_ok=True)

    model = WhisperModel(
        model_size,
        device="cpu",
        compute_type=compute_type,
        download_root=MODEL_DIR,
        num_workers=num_workers,
        cpu_threads=cpu_count,
    )

    language = args.language
    segments, info = model.transcribe(
        audio_path,
        language=language,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    transcoded_lang = info.language
    detected_lang = transcoded_lang if transcoded_lang and transcoded_lang != "unknown" else None

    transcript_parts = []
    for segment in segments:
        transcript_parts.append(segment.text.strip())

    transcript = " ".join(transcript_parts).strip()

    print(json.dumps({
        "text": transcript,
        "language": detected_lang,
    }))


if __name__ == "__main__":
    main()
