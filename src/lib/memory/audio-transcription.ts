import fs from "fs/promises";
import path from "path";
import type { AppSettings } from "@/lib/types";
import { transcribeWithGemini as geminiTranscribe } from "./gemini-transcription";

/**
 * Supported audio file extensions for transcription
 */
const AUDIO_EXTENSIONS = new Set([
  ".ogg", ".mp3", ".wav", ".m4a", ".mp4", ".mpeg", ".mpga", ".mp4",
  ".webm", ".amr", ".flac", ".wma"
]);

export type TranscriptionProvider = "auto" | "gemini" | "openai";

/**
 * Check if a file is an audio file based on extension
 */
export function isAudioFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

/**
 * Detect available transcription providers based on API keys
 */
function detectAvailableProviders(settings: AppSettings): TranscriptionProvider[] {
  const available: TranscriptionProvider[] = [];

  // Check for Google API key (Gemini)
  const googleKey = process.env.GOOGLE_API_KEY?.trim() ||
    (settings.chatModel.provider === "google" ? settings.chatModel.apiKey : null);
  if (googleKey && googleKey.length > 10) {
    available.push("gemini");
  }

  // Check for OpenAI API key
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ||
    (settings.chatModel.provider === "openai" ? settings.chatModel.apiKey : null);
  if (openaiKey && openaiKey.length > 10 && !openaiKey.startsWith("sk-...")) {
    available.push("openai");
  }

  return available;
}

/**
 * Select the best available transcription provider
 */
function selectProvider(settings: AppSettings, preferred?: TranscriptionProvider): TranscriptionProvider {
  const available = detectAvailableProviders(settings);

  if (available.length === 0) {
    throw new Error("No transcription providers available. Please configure GOOGLE_API_KEY or OPENAI_API_KEY.");
  }

  // Use preferred if specified and available
  if (preferred && preferred !== "auto" && available.includes(preferred)) {
    return preferred;
  }

  // Prefer Gemini (has free tier) over OpenAI
  return available.includes("gemini") ? "gemini" : available[0];
}

/**
 * Transcribe using Gemini API
 */
async function transcribeWithGemini(
  audioFilePath: string,
  settings: AppSettings
): Promise<string> {
  // Get Google API key
  const apiKey = process.env.GOOGLE_API_KEY?.trim() ||
    (settings.chatModel.provider === "google" ? settings.chatModel.apiKey : null);

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not found");
  }

  return await geminiTranscribe(audioFilePath, apiKey);
}

/**
 * Transcribe using OpenAI Whisper API
 */
async function transcribeWithOpenAI(
  audioFilePath: string,
  settings: AppSettings
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ||
    (settings.chatModel.provider === "openai" ? settings.chatModel.apiKey : null);

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not found");
  }

  const audioBuffer = await fs.readFile(audioFilePath);
  const filename = path.basename(audioFilePath);

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer]), filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "text");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Whisper API error (${response.status}): ${errorText}`);
    }

    const transcript = await response.text();
    const trimmed = transcript.trim();

    if (!trimmed) {
      throw new Error("OpenAI transcription returned empty text");
    }

    return trimmed;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Transcribe an audio file using available provider
 *
 * @param audioFilePath - Path to the audio file
 * @param settings - App settings containing API keys
 * @param preferredProvider - Preferred transcription provider (default: "auto")
 * @returns Transcribed text
 */
export async function transcribeAudio(
  audioFilePath: string,
  settings: AppSettings,
  preferredProvider: TranscriptionProvider = "auto"
): Promise<string> {
  try {
    // Check if file exists
    await fs.access(audioFilePath);

    // Select provider
    const provider = selectProvider(settings, preferredProvider);
    console.log(`[Audio Transcription] Using provider: ${provider}`);

    // Route to appropriate provider
    if (provider === "gemini") {
      return await transcribeWithGemini(audioFilePath, settings);
    } else if (provider === "openai") {
      return await transcribeWithOpenAI(audioFilePath, settings);
    }

    throw new Error(`Unsupported provider: ${provider}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Audio transcription failed: ${error.message}`);
    }
    throw new Error(`Audio transcription failed: ${String(error)}`);
  }
}
