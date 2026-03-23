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

async function getOAuthConfig(): Promise<{ clientId: string; clientSecret: string; redirectUri: string } | null> {
  const settings = await getSettings();
  const clientId = settings.googleWorkspace.clientId?.trim();
  const clientSecret = settings.googleWorkspace.clientSecret?.trim();
  
  if (!clientId || !clientSecret) {
    return null;
  }
  
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.APP_PORT || 3000}`;
  const redirectUri = `${baseUrl}/api/google-oauth/callback`;
  
  return { clientId, clientSecret, redirectUri };
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
    
    // Verify token by fetching user info
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${client.credentials.access_token}`,
      },
    });
    
    if (!response.ok) {
      // Token might be expired, try to refresh
      await client.getAccessToken();
      
      if (client.credentials.access_token) {
        const retryResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: {
            Authorization: `Bearer ${client.credentials.access_token}`,
          },
        });
        
        if (retryResponse.ok) {
          const userInfo = await retryResponse.json() as { email?: string };
          return {
            connected: true,
            hasCredentials: true,
            email: userInfo.email,
          };
        }
      }
      
      return {
        connected: false,
        hasCredentials: true,
        error: "Token expired or invalid",
      };
    }
    
    const userInfo = await response.json() as { email?: string };
    
    return {
      connected: true,
      hasCredentials: true,
      email: userInfo.email,
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
