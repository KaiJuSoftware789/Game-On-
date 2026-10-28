"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const AuthContext = createContext<{ user: User | null; loading: boolean; displayName?: string }>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false });
    });
    return () => subscription.unsubscribe();
  }, []);

  const [profile, setProfile] = useState<{ id: string; name: string } | null>(null);
  const userId = state.user?.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    async function refresh() {
      const { data } = await createClient().from("profiles").select("display_name").eq("id", userId!).maybeSingle();
      if (active && data) setProfile({ id: userId!, name: data.display_name });
    }
    void refresh();
    window.addEventListener("profile-updated", refresh);
    return () => { active = false; window.removeEventListener("profile-updated", refresh); };
  }, [userId]);
  return <AuthContext value={{ ...state, displayName: profile?.id === userId ? profile?.name : undefined }}>{children}</AuthContext>;
}

export const useAuth = () => useContext(AuthContext);
