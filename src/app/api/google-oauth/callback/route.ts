import { NextRequest } from "next/server";
import { exchangeCode, getBaseUrl } from "@/lib/tools/google-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const baseUrl = getBaseUrl();

  if (error) {
    return Response.redirect(
      `${baseUrl}/dashboard/settings?google_oauth_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return Response.redirect(
      `${baseUrl}/dashboard/settings?google_oauth_error=no_code`
    );
  }

  try {
    await exchangeCode(code);
    return Response.redirect(
      `${baseUrl}/dashboard/settings?google_oauth_success=true`
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return Response.redirect(
      `${baseUrl}/dashboard/settings?google_oauth_error=${encodeURIComponent(errorMessage)}`
    );
  }
}
