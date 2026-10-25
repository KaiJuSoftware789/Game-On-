"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
export function useEventConnection() {
  const [client] = useState(() =>
    hasSupabaseConfig() ? createClient() : null,
  );
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!client);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setUser(data.session?.user || null);
      setReady(true);
      if (error)
        setError("Your sign-in couldn't be restored. Please sign in again.");
      if (window.location.hash === "#sign-in-error")
        setError(
          "That confirmation link couldn't be completed. Please sign in again.",
        );
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user || null);
        setReady(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  return { client, user, ready, error };
}
export type EventConnection = ReturnType<typeof useEventConnection>;
