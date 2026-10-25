"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  getGameAccountSnapshot,
  saveGameUsername,
  subscribeToGameAccounts,
} from "@/lib/game-account-store";
import { normalizeRiotId, readGameAccounts } from "@/lib/rankings";
import { STORAGE_UNAVAILABLE } from "@/lib/session-store";
import { useRankingService } from "./rankings-connection";
import { Icon } from "./icon";

const getServerSnapshot = () => null;
export function GameAccountPanel() {
  const service = useRankingService();
  const {
    client,
    user,
    account,
    accountError,
    accountLoading,
    authError,
    refresh,
  } = service;
  const raw = useSyncExternalStore(
    subscribeToGameAccounts,
    getGameAccountSnapshot,
    getServerSnapshot,
  );
  const local = useMemo(
    () => readGameAccounts(raw === STORAGE_UNAVAILABLE ? null : raw),
    [raw],
  );
  const saved = client
    ? account?.game_accounts.find((item) => item.game === "valorant")
    : local.accounts[0];
  const [now, setNow] = useState(0);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const locked = !!saved && now < Date.parse(saved.nextChangeAt);
  const storageError = !client
    ? raw === STORAGE_UNAVAILABLE
      ? "Browser storage is unavailable. Your Riot ID can’t be saved yet."
      : local.error
    : null;
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  async function action(
    name: string,
    task: () => void | Promise<void>,
    success: string,
  ) {
    if (busy) return;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice(success);
      setNow(Date.now());
      refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your game account couldn't be saved. Try again.",
      );
    } finally {
      setBusy("");
    }
  }
  async function rpc(name: string, args?: Record<string, unknown>) {
    const { error } = await client!.rpc(name, args);
    if (error) throw new Error(error.message);
  }
  function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    service.clearAuthError();
    const form = event.currentTarget,
      data = new FormData(form);
    const email = String(data.get("email") || "").trim(),
      password = String(data.get("password") || "");
    void action(
      "auth",
      async () => {
        const result = signup
          ? await client!.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
              },
            })
          : await client!.auth.signInWithPassword({ email, password });
        if (result.error) throw new Error(result.error.message);
        form.reset();
      },
      signup
        ? "Check your email to confirm your account, then sign in."
        : "Signed in. Add your VALORANT Riot ID below.",
    );
  }
  const rank = saved?.ranks.find((item) => item.queue === "competitive");

  return (
    <div className="ranking-panel game-account-panel">
      <div className="game-account-intro">
        <span className="profile-game-mark game-theme-coral" aria-hidden="true">
          V
        </span>
        <div>
          <span className="eyebrow">VALORANT · COMPETITIVE</span>
          <h3>Your Riot account</h3>
        </div>
      </div>
      {(error || authError || accountError || storageError) && (
        <p className="error-banner" role="alert">
          {error || accountError || authError || storageError}
        </p>
      )}
      {notice && (
        <p className="success-banner" role="status">
          {notice}
        </p>
      )}
      {saved && (
        <div className="valorant-rank-card" aria-label="VALORANT account">
          <div className="rank-card-heading">
            <strong>{saved.username}</strong>
            <span>{client ? "Saved Riot ID" : "Local preview"}</span>
          </div>
          <div className="rank-card-current">
            <span className="rank-emblem" aria-hidden="true">
              <Icon name="trophy" />
            </span>
            <div>
              <span>CURRENT IN-GAME RANK</span>
              <strong>{rank?.rank || "Feature coming soon"}</strong>
              <small>
                {rank
                  ? `Updated ${new Date(rank.updatedAt).toLocaleString("en-US")}`
                  : "Live VALORANT ranks will appear here."}
              </small>
            </div>
          </div>
          <a
            href={`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(saved.username)}/overview`}
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            View on Tracker.gg <Icon name="arrow" />
          </a>
        </div>
      )}
      {client && user === undefined ? (
        <p role="status">Checking sign-in…</p>
      ) : client && !user ? (
        <>
          <p>
            Sign in to save your Riot ID to your profile. Your game username can
            be changed once every three months.
          </p>
          <form className="ranking-form" onSubmit={authenticate}>
            <label className="field">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            <label className="field">
              Password
              <input
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 8 : undefined}
                required
              />
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={!!busy}
            >
              {busy === "auth"
                ? "Please wait…"
                : signup
                  ? "Create account"
                  : "Sign in"}
            </button>
            <button
              className="button button-quiet"
              type="button"
              disabled={!!busy}
              onClick={() => setSignup(!signup)}
            >
              {signup
                ? "Already registered? Sign in"
                : "New here? Create an account"}
            </button>
          </form>
        </>
      ) : accountLoading ? (
        <p role="status">Loading your game account…</p>
      ) : accountError ? (
        <button
          className="button button-outline"
          type="button"
          onClick={refresh}
        >
          Retry account
        </button>
      ) : (
        <>
          {locked ? (
            <p className="username-cooldown">
              <Icon name="clock" />
              <span>
                Riot ID locked until{" "}
                <time dateTime={saved.nextChangeAt}>
                  {new Date(saved.nextChangeAt).toLocaleString("en-US")}
                </time>
                . You can change it once every three months.
              </span>
            </p>
          ) : (
            <form
              key={`${user?.id || "local"}:${saved?.username || "new"}`}
              className="ranking-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void action(
                  "save",
                  async () => {
                    const username = normalizeRiotId(
                      String(data.get("username") || ""),
                    );
                    if (client)
                      await rpc("ranking_save_username", {
                        p_username: username,
                      });
                    else saveGameUsername(username);
                  },
                  "Your Riot ID is saved. You can change it again in three months.",
                );
              }}
            >
              <label className="field">
                VALORANT Riot ID
                <input
                  name="username"
                  aria-label="VALORANT Riot ID"
                  defaultValue={saved?.username || ""}
                  placeholder="PlayerName#NA1"
                  required
                  maxLength={40}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="riot-id-help"
                />
              </label>
              <p id="riot-id-help">
                Use your full Name#Tag. Saving starts a three-month change lock.
                This updates your Game On profile; it doesn’t rename your Riot
                account.
              </p>
              <button
                className="button button-primary"
                type="submit"
                disabled={!!busy || !!storageError}
              >
                {busy === "save" ? "Saving…" : "Save Riot ID"}
              </button>
            </form>
          )}
          {client && user && (
            <>
              {saved && (
                <button
                  className="button button-quiet"
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    void action(
                      "visibility",
                      () =>
                        rpc("ranking_set_visibility", {
                          p_visible: !saved.visible,
                        }),
                      saved.visible
                        ? "Hidden from public rankings. Your change lock stays in place."
                        : "Your synced rank can appear on the public leaderboard.",
                    )
                  }
                >
                  {saved.visible
                    ? "Hide from leaderboard"
                    : "Show on leaderboard"}
                </button>
              )}
            </>
          )}
        </>
      )}
      {client && user && (
        <button
          className="button button-quiet"
          type="button"
          disabled={!!busy}
          onClick={() =>
            void action(
              "signout",
              async () => {
                const { error } = await client.auth.signOut();
                if (error) throw error;
              },
              "Signed out.",
            )
          }
        >
          Sign out
        </button>
      )}
      {!saved && (
        <p className="ranking-fine-print">
          <strong>Feature coming soon</strong> · Live VALORANT ranks.
        </p>
      )}
      {!client && (
        <p className="ranking-fine-print">
          Your Riot ID and change lock are saved only in this browser.
        </p>
      )}
      <Link className="text-link ranking-profile-link" href="/rankings">
        View in-game leaderboard
      </Link>
    </div>
  );
}
