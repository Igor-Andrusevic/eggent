import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const USER_PREFERENCES_DIR = path.join(DATA_DIR, "user-preferences");

export type TimezoneDetectionStatus = "pending" | "confirmed" | "skipped" | "rejected";

export interface UserPreferences {
  userId: string;
  userTimezone?: string;
  userLocale?: string;
  timezoneDetected?: TimezoneDetectionStatus;
  timezoneAskedAt?: string;
  createdAt: string;
  updatedAt: string;
}

function userPreferencesFilePath(userId: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 128);
  return path.join(USER_PREFERENCES_DIR, `${safeUserId}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(USER_PREFERENCES_DIR, { recursive: true });
}

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const filePath = userPreferencesFilePath(userId);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as UserPreferences;
    return {
      userId: parsed.userId,
      userTimezone: parsed.userTimezone,
      userLocale: parsed.userLocale,
      timezoneDetected: parsed.timezoneDetected,
      timezoneAskedAt: parsed.timezoneAskedAt,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function saveUserPreferences(preferences: UserPreferences): Promise<void> {
  await ensureDir();
  const filePath = userPreferencesFilePath(preferences.userId);
  await fs.writeFile(filePath, JSON.stringify(preferences, null, 2), "utf-8");
}

export async function getOrCreateUserPreferences(userId: string): Promise<UserPreferences> {
  const existing = await getUserPreferences(userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const created: UserPreferences = {
    userId,
    createdAt: now,
    updatedAt: now,
  };
  await saveUserPreferences(created);
  return created;
}

export async function updateUserTimezone(
  userId: string,
  timezone: string,
  status: TimezoneDetectionStatus = "confirmed"
): Promise<UserPreferences> {
  const prefs = await getOrCreateUserPreferences(userId);
  prefs.userTimezone = timezone;
  prefs.timezoneDetected = status;
  prefs.updatedAt = new Date().toISOString();
  await saveUserPreferences(prefs);
  return prefs;
}

export async function updateUserLocale(userId: string, locale: string): Promise<UserPreferences> {
  const prefs = await getOrCreateUserPreferences(userId);
  prefs.userLocale = locale;
  prefs.updatedAt = new Date().toISOString();
  await saveUserPreferences(prefs);
  return prefs;
}

export async function markTimezoneAsked(userId: string): Promise<UserPreferences> {
  const prefs = await getOrCreateUserPreferences(userId);
  prefs.timezoneAskedAt = new Date().toISOString();
  if (!prefs.timezoneDetected) {
    prefs.timezoneDetected = "pending";
  }
  prefs.updatedAt = new Date().toISOString();
  await saveUserPreferences(prefs);
  return prefs;
}
