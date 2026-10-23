import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth-config";

function redirectWithinApp(path: string) {
  // Relative locations preserve the browser's host, including behind a proxy.
  // All destinations come from the fixed allowlist or the account page below.
  return new NextResponse(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (code && !request.nextUrl.searchParams.has("error")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectWithinApp(next);
  }
  const query = new URLSearchParams({ error: "sign_in_failed", next });
  return redirectWithinApp(`/account?${query}`);
}
