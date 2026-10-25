"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import type { RankingAccount } from "@/lib/rankings";

export function useRankingService() {
  const [client] = useState(() =>
    hasSupabaseConfig() ? createClient() : null,
  );
  const [user, setUser] = useState<User | null>();
  const [authError, setAuthError] = useState("");
  const [revision, setRevision] = useState(0);
  const [savedAccount, setSavedAccount] = useState<{
    key: string;
    data: RankingAccount | null;
    error: string;
  }>();
  const accountKey = `${user?.id || ""}:${revision}`;

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setUser(data.session?.user || null);
      if (error)
        setAuthError(
          "Your sign-in couldn't be restored. Please sign in again.",
        );
      if (window.location.hash === "#sign-in-error")
        setAuthError(
          "That confirmation link couldn't be completed. Try signing in or request a new confirmation email.",
        );
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user || null);
        setRevision((value) => value + 1);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (!client || !user?.id) return;
    let active = true;
    client.rpc("ranking_account").then(({ data, error }) => {
      if (active)
        setSavedAccount({
          key: accountKey,
          data: error ? null : data,
          error: error
            ? "Your public ranking account couldn't be loaded. Try refreshing."
            : "",
        });
    });
    return () => {
      active = false;
    };
  }, [client, user?.id, accountKey]);

  return {
    client,
    user,
    authError,
    clearAuthError: () => setAuthError(""),
    revision,
    account: savedAccount?.key === accountKey ? savedAccount.data : null,
    accountError: savedAccount?.key === accountKey ? savedAccount.error : "",
    accountLoading: !!user && savedAccount?.key !== accountKey,
    refresh: () => setRevision((value) => value + 1),
  };
}

export type RankingService = ReturnType<typeof useRankingService>;
