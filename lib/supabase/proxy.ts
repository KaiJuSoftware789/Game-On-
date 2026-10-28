import { hasSupabaseConfig } from "./config";

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const deadline = new AbortController();
  let finished = false;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, deadline.signal])
            : deadline.signal,
        }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          if (finished) return;
          cookies.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      supabase.auth.getClaims(),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          finished = true;
          deadline.abort();
          resolve();
        }, 4_000);
      }),
    ]);
  } catch {
    // Data access still authenticates through Supabase and RLS. An unavailable
    // session service must not prevent public pages from rendering.
  } finally {
    finished = true;
    clearTimeout(timer);
  }

  return response;
}
