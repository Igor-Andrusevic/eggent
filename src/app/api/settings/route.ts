import { NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/storage/settings-store";
import type { AppSettings } from "@/lib/types";

export async function GET() {
  const settings = await getSettings();
  return Response.json(maskSettingsKeys(settings));
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<AppSettings>;
    const current = await getSettings();
    const sanitized = restoreMaskedKeys(body, current);
    const updated = await saveSettings(sanitized);
    return Response.json(maskSettingsKeys(updated));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save settings",
      },
      { status: 500 }
    );
  }
}

function maskSettingsKeys(settings: AppSettings): AppSettings {
  const masked: AppSettings = structuredClone(settings);

  if (masked.chatModel.apiKey) {
    masked.chatModel.apiKey = maskKey(masked.chatModel.apiKey);
  }
  if (masked.embeddingsModel.apiKey) {
    masked.embeddingsModel.apiKey = maskKey(masked.embeddingsModel.apiKey);
  }
  if (masked.search.apiKey) {
    masked.search.apiKey = maskKey(masked.search.apiKey);
  }
  if (masked.auth.passwordHash) {
    masked.auth.passwordHash = maskKey(masked.auth.passwordHash);
  }
  if (masked.googleWorkspace?.clientSecret) {
    masked.googleWorkspace.clientSecret = maskKey(masked.googleWorkspace.clientSecret);
  }
  if (masked.apiKeysByProvider) {
    const maskedMap: Record<string, string> = {};
    for (const [provider, key] of Object.entries(masked.apiKeysByProvider)) {
      maskedMap[provider] = key ? maskKey(key) : key;
    }
    masked.apiKeysByProvider = maskedMap;
  }

  return masked;
}

function restoreMaskedKeys(
  incoming: Partial<AppSettings>,
  current: AppSettings
): Partial<AppSettings> {
  const next: Partial<AppSettings> = structuredClone(incoming);

  if (isMaskedKey(next.chatModel?.apiKey)) {
    const provider = next.chatModel?.provider || current.chatModel.provider;
    const byProvider = current.apiKeysByProvider?.[provider];
    next.chatModel = {
      ...(next.chatModel || {}),
      apiKey: byProvider || current.chatModel.apiKey,
    };
  }

  if (isMaskedKey(next.embeddingsModel?.apiKey)) {
    const provider = next.embeddingsModel?.provider || current.embeddingsModel.provider;
    const byProvider = current.apiKeysByProvider?.[provider];
    next.embeddingsModel = {
      ...(next.embeddingsModel || {}),
      apiKey: byProvider || current.embeddingsModel.apiKey,
    };
  }

  if (isMaskedKey(next.search?.apiKey)) {
    const provider = next.search?.provider || current.search.provider;
    const byProvider = current.apiKeysByProvider?.[`search_${provider}`];
    next.search = {
      ...(next.search || {}),
      apiKey: byProvider || current.search.apiKey,
    };
  }
  if (isMaskedKey(next.auth?.passwordHash)) {
    next.auth = {
      ...(next.auth || {}),
      passwordHash: current.auth.passwordHash,
    };
  }

  if (isMaskedKey(next.googleWorkspace?.clientSecret)) {
    next.googleWorkspace = {
      ...(next.googleWorkspace || {}),
      clientSecret: current.googleWorkspace?.clientSecret || "",
    };
  }

  if (next.apiKeysByProvider) {
    const restoredMap: Record<string, string> = { ...next.apiKeysByProvider };
    for (const [provider, key] of Object.entries(restoredMap)) {
      if (isMaskedKey(key) && current.apiKeysByProvider?.[provider]) {
        restoredMap[provider] = current.apiKeysByProvider[provider];
      }
    }
    next.apiKeysByProvider = restoredMap;
  }

  return next;
}

function isMaskedKey(value: unknown): value is string {
  return typeof value === "string" && value.includes("****");
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}
