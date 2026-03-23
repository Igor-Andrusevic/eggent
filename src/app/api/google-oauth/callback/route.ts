import { NextRequest } from "next/server";
import { exchangeCode } from "@/lib/tools/google-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.APP_PORT || 3000}`;
    return Response.redirect(
      `${baseUrl}/dashboard/settings?google_oauth_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.APP_PORT || 3000}`;
    return Response.redirect(
      `${baseUrl}/dashboard/settings?google_oauth_error=no_code`
    );
  }

  try {
    await exchangeCode(code);
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.APP_PORT || 3000}`;
    return Response.redirect(
      `${baseUrl}/dashboard/settings?google_oauth_success=true`
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.APP_PORT || 3000}`;
    return Response.redirect(
      `${baseUrl}/dashboard/settings?google_oauth_error=${encodeURIComponent(errorMessage)}`
    );
  }
}
