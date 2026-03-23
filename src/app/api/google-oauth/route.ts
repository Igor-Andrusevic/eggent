import { NextRequest } from "next/server";
import {
  getAuthUrl,
  getOAuthStatus,
  revokeAccess,
} from "@/lib/tools/google-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "url") {
      const url = await getAuthUrl();
      if (!url) {
        return Response.json(
          { error: "Google OAuth credentials not configured" },
          { status: 400 }
        );
      }
      return Response.json({ url });
    }

    if (action === "status") {
      const status = await getOAuthStatus();
      return Response.json(status);
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Google OAuth error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "revoke") {
      await revokeAccess();
      return Response.json({ success: true, message: "Google access revoked" });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Google OAuth error",
      },
      { status: 500 }
    );
  }
}
