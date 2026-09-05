import { OAuth2Client } from "google-auth-library";
import fs from "fs/promises";
import path from "path";
import { getSettings } from "@/lib/storage/settings-store";

const DATA_DIR = path.join(process.cwd(), "data");
const GOOGLE_OAUTH_DIR = path.join(DATA_DIR, "google-oauth");
const TOKENS_FILE = path.join(GOOGLE_OAUTH_DIR, "tokens.json");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks",
];

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface OAuthStatus {
  connected: boolean;
  hasCredentials: boolean;
  email?: string;
  error?: string;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export function getBaseUrl(): string {
  const raw = process.env.APP_BASE_URL || `http://localhost:${process.env.APP_PORT || 3000}`;
  return raw.replace(/\/+$/, "");
}

export function getRedirectUri(): string {
  const baseUrl = getBaseUrl();

  if (process.env.NODE_ENV === "development" && !process.env.APP_BASE_URL) {
    console.warn(
      "[google-oauth] APP_BASE_URL not set, using default:",
      baseUrl,
      "(Google will reject this in production with redirect_uri_mismatch)",
    );
  }

  return `${baseUrl}/api/google-oauth/callback`;
}

async function getOAuthConfig(): Promise<{ clientId: string; clientSecret: string; redirectUri: string } | null> {
  const settings = await getSettings();
  const clientId = settings.googleWorkspace?.clientId?.trim();
  const clientSecret = settings.googleWorkspace?.clientSecret?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret, redirectUri: getRedirectUri() };
}

export async function createOAuth2Client(): Promise<OAuth2Client | null> {
  const config = await getOAuthConfig();
  if (!config) {
    return null;
  }
  
  const client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
  
  const tokens = await loadTokens();
  if (tokens) {
    client.setCredentials(tokens);
  }
  
  return client;
}

export async function getAuthUrl(): Promise<string | null> {
  const config = await getOAuthConfig();
  if (!config) {
    return null;
  }
  
  const client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
  
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function exchangeCode(code: string): Promise<GoogleTokens | null> {
  const config = await getOAuthConfig();
  if (!config) {
    throw new Error("Google OAuth credentials not configured");
  }
  
  const client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
  
  const { tokens } = await client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Failed to obtain required tokens");
  }
  
  const googleTokens: GoogleTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope || SCOPES.join(" "),
    token_type: tokens.token_type || "Bearer",
    expiry_date: tokens.expiry_date || Date.now() + 3600000,
  };
  
  await saveTokens(googleTokens);
  
  return googleTokens;
}

export async function loadTokens(): Promise<GoogleTokens | null> {
  try {
    const content = await fs.readFile(TOKENS_FILE, "utf-8");
    return JSON.parse(content) as GoogleTokens;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: GoogleTokens): Promise<void> {
  await ensureDir(GOOGLE_OAUTH_DIR);
  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

export async function deleteTokens(): Promise<void> {
  try {
    await fs.unlink(TOKENS_FILE);
  } catch {
    // ignore if file doesn't exist
  }
}

async function verifyAccessToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`,
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function getOAuthStatus(): Promise<OAuthStatus> {
  const config = await getOAuthConfig();
  
  if (!config) {
    return {
      connected: false,
      hasCredentials: false,
      error: "Google OAuth credentials not configured",
    };
  }
  
  const tokens = await loadTokens();
  
  if (!tokens) {
    return {
      connected: false,
      hasCredentials: true,
    };
  }
  
  try {
    const client = await createOAuth2Client();
    if (!client) {
      return {
        connected: false,
        hasCredentials: true,
        error: "Failed to create OAuth client",
      };
    }
    
    const tokenValid = await verifyAccessToken(client.credentials.access_token as string);

    if (!tokenValid) {
      await client.getAccessToken();

      if (client.credentials.access_token) {
        const retryValid = await verifyAccessToken(client.credentials.access_token as string);
        if (retryValid) {
          return {
            connected: true,
            hasCredentials: true,
          };
        }
      }

      return {
        connected: false,
        hasCredentials: true,
        error: "Token expired or invalid",
      };
    }

    return {
      connected: true,
      hasCredentials: true,
    };
  } catch (error) {
    return {
      connected: false,
      hasCredentials: true,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function revokeAccess(): Promise<void> {
  const tokens = await loadTokens();
  
  if (tokens?.access_token) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, {
        method: "POST",
      });
    } catch {
      // ignore revoke errors
    }
  }
  
  await deleteTokens();
}

export async function ensureAuthenticatedClient(): Promise<OAuth2Client> {
  const client = await createOAuth2Client();
  
  if (!client) {
    throw new Error("Google OAuth not configured. Please configure credentials in settings.");
  }
  
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error("Google account not connected. Please authorize access in settings.");
  }
  
  // Check if token needs refresh
  if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
    await client.getAccessToken();
    
    if (client.credentials.access_token && client.credentials.refresh_token) {
      const newTokens: GoogleTokens = {
        access_token: client.credentials.access_token as string,
        refresh_token: client.credentials.refresh_token as string,
        scope: client.credentials.scope || tokens.scope,
        token_type: client.credentials.token_type || "Bearer",
        expiry_date: client.credentials.expiry_date as number,
      };
      await saveTokens(newTokens);
    }
  }
  
  return client;
}
