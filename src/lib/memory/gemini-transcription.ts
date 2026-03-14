import fs from "fs/promises";
import path from "path";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

interface GeminiPart {
  inlineData?: {
    mimeType: string;
    data: string;
  };
  text?: string;
}

interface GeminiContent {
  parts: GeminiPart[];
}

interface GeminiRequest {
  contents: GeminiContent[];
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text?: string;
      }>;
    };
  }>;
}

/**
 * Get MIME type based on file extension
 */
function getAudioMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".ogg": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".webm": "audio/webm",
    ".flac": "audio/flac",
    ".amr": "audio/amr",
  };
  return mimeTypes[ext] || "audio/*";
}

/**
 * Transcribe audio using Google Gemini 1.5 Flash API
 *
 * Flash version is faster and has a generous free tier.
 */
export async function transcribeWithGemini(
  audioFilePath: string,
  apiKey: string
): Promise<string> {
  // Read audio file
  const audioBuffer = await fs.readFile(audioFilePath);
  const base64Audio = audioBuffer.toString("base64");

  // Prepare request
  const requestBody: GeminiRequest = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: getAudioMimeType(audioFilePath),
              data: base64Audio,
            },
          },
          {
            text: "Transcribe this audio message to text in the original language (Russian if Russian is spoken). Return ONLY the transcribed text without any additional commentary, labels, or formatting.",
          },
        ],
      },
    ],
  };

  // Make API request
  const url = `${GEMINI_API_URL}?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;

  // Extract transcribed text
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error("No candidates in Gemini response");
  }

  const part = candidate.content.parts[0];
  if (!part?.text) {
    throw new Error("No text in Gemini response");
  }

  const transcript = part.text.trim();

  if (!transcript) {
    throw new Error("Empty transcription from Gemini");
  }

  return transcript;
}
