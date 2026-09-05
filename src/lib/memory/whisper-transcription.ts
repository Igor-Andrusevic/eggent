import { execFile } from "child_process";
import path from "path";

const PYTHON_BIN =
  process.env.PYTHON_VENV
    ? path.join(process.env.PYTHON_VENV, "bin", "python3")
    : process.env.PYTHON_BIN || "/usr/bin/python3";

const WHISPER_SCRIPT = path.join(
  process.cwd(),
  "scripts",
  "transcribe-whisper.py"
);

const WHISPER_MODEL = process.env.WHISPER_MODEL || "small";

const TRANSCRIPTION_TIMEOUT_MS = parseInt(
  process.env.WHISPER_TRANSCRIPTION_TIMEOUT || "120000",
  10
);

interface WhisperResult {
  text: string;
  language: string | null;
}

function runPythonScript(
  args: string[],
  timeout: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      PYTHON_BIN,
      [WHISPER_SCRIPT, ...args],
      {
        timeout,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
      },
      (error, stdout) => {
        if (error) {
          reject(
            new Error(
              `Whisper transcription failed: ${error.message}`
            )
          );
          return;
        }
        resolve(stdout.trim());
      }
    );

    child.on("error", (err) => {
      reject(
        new Error(`Failed to start whisper process: ${err.message}`)
      );
    });
  });
}

export function isWhisperAvailable(): boolean {
  try {
    return true;
  } catch {
    return false;
  }
}

export async function transcribeWithWhisper(
  audioFilePath: string
): Promise<string> {
  const args = [audioFilePath, "--model", WHISPER_MODEL];

  const stdout = await runPythonScript(args, TRANSCRIPTION_TIMEOUT_MS);

  let result: WhisperResult;
  try {
    result = JSON.parse(stdout) as WhisperResult;
  } catch {
    throw new Error(`Invalid JSON response from whisper: ${stdout.slice(0, 200)}`);
  }

  if (!result.text) {
    throw new Error("Whisper returned empty transcription");
  }

  return result.text;
}
