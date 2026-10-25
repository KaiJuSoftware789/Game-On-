import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next =
    url.searchParams.get("next") === "/events" ? "/events" : "/profile";
  if (code && hasSupabaseConfig()) {
    try {
      const client = await createClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(
            next === "/events" ? next : "/profile#game-accounts",
            url.origin,
          ),
        );
    } catch {
      /* Return a visible retry message without exposing auth details. */
    }
  }
  return NextResponse.redirect(new URL(`${next}#sign-in-error`, url.origin));
}
