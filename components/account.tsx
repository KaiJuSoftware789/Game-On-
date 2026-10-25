"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SignInProvider } from "@/lib/auth-config";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { Icon } from "./icons";

export function Account({
  providers,
  configError,
  callbackError,
  next,
}: {
  providers: SignInProvider[];
  configError: boolean;
  callbackError: boolean;
  next: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function signIn(provider: SignInProvider) {
    setBusy(provider.id);
    setError("");
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", next);
      const result = await createClient().auth.signInWithOAuth({
        provider: provider.id,
        options: { redirectTo: callback.href, skipBrowserRedirect: true },
      });
      if (result.error || !result.data.url) throw result.error;
      window.location.assign(result.data.url);
    } catch {
      setError(`We couldn’t start ${provider.name} sign-in. Please try again.`);
      setBusy(null);
    }
  }

  async function signOut() {
    setBusy("sign-out");
    setError("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.refresh();
    } catch {
      setError("We couldn’t sign you out. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR PLAYER PROFILE</div>
          <h1>{user ? "Your account." : "Join the party."}</h1>
          <p>
            {user
              ? "Your next session starts with you."
              : "One account for your games and your next teammates."}
          </p>
        </div>
      </div>
      <section className="account-panel panel">
        <span className="large-icon">
          <Icon name="user" />
        </span>
        {loading ? (
          <p role="status">Loading your account…</p>
        ) : user ? (
          <>
            <h2>
              {user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                "Player"}
            </h2>
            {user.email && <p className="muted">{user.email}</p>}
            <div className="account-facts">
              <span>Signed in with</span>
              <strong>
                {(user.app_metadata.providers ?? [user.app_metadata.provider])
                  .filter((provider): provider is string => Boolean(provider))
                  .map((provider: string) =>
                    provider.startsWith("custom:")
                      ? "Riot Games"
                      : provider.charAt(0).toUpperCase() + provider.slice(1),
                  )
                  .join(", ")}
              </strong>
            </div>
            <Link href="/games" className="button primary">
              <Icon name="game" />
              Manage my games
              <Icon name="arrow" />
            </Link>
            <button
              className="button quiet signout-button"
              disabled={Boolean(busy)}
              onClick={() => {
                void signOut();
              }}
            >
              <Icon name="logout" />
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : (
          <>
            <h2>Welcome to Game-On!</h2>
            <p className="muted">
              Sign in to post tickets and save the games you play.
            </p>
            <div className="provider-list">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  className={`provider-button provider-${provider.name.split(" ")[0].toLowerCase()}`}
                  disabled={!provider.enabled || Boolean(busy)}
                  onClick={() => {
                    void signIn(provider);
                  }}
                >
                  <span className="provider-mark" aria-hidden="true">
                    {provider.name === "Google" ? (
                      "G"
                    ) : provider.name === "Discord" ? (
                      <Icon name="game" />
                    ) : (
                      "R"
                    )}
                  </span>
                  <span>
                    {busy === provider.id
                      ? "Connecting…"
                      : `Continue with ${provider.name}`}
                    {!provider.enabled && <small>Not available yet</small>}
                  </span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
            {configError ? (
              <p className="notice error" role="alert">
                Sign-in is temporarily unavailable.{" "}
                <button
                  className="inline-button"
                  onClick={() => router.refresh()}
                >
                  Try again
                </button>
              </p>
            ) : (
              providers.some((provider) => !provider.enabled) && (
                <p className="sign-in-note">
                  Some sign-in options are still being connected. They’ll be
                  available once setup is complete.
                </p>
              )
            )}
            <div className="account-divider" />
            <Link href="/" className="text-link">
              Browse live tickets
              <Icon name="arrow" />
            </Link>
          </>
        )}
        {user && (
          <Link
            href={`/players/${user.id}`}
            className="text-link public-profile-link"
          >
            View public profile
            <Icon name="arrow" />
          </Link>
        )}
        {(error || (callbackError && !user)) && (
          <p className="notice error" role="alert">
            {error ||
              "Sign-in wasn’t completed. Please try again using one of the options above."}
          </p>
        )}
      </section>
    </>
  );
}
