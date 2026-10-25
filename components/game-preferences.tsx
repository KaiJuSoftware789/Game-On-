"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { Icon } from "./icons";

export function GamePreferences({
  games,
  catalogError,
}: {
  games: Game[];
  catalogError: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">BUILD YOUR LINEUP</div>
          <h1>
            Your games. <span>Your people.</span>
          </h1>
          <p>
            Choose the games you play. Your lineup is public so other players
            can find common ground.
          </p>
        </div>
        {user && (
          <Link href={`/players/${user.id}`} className="button secondary">
            View public profile
            <Icon name="arrow" />
          </Link>
        )}
      </div>
      {loading ? (
        <div className="panel loading-state" role="status">
          Loading your games…
        </div>
      ) : !user ? (
        <div className="panel empty-state">
          <span className="empty-icon">
            <Icon name="game" />
          </span>
          <h2>Make it your lineup</h2>
          <p>Sign in to choose games and save them to your account.</p>
          <Link href="/account?next=/games" className="button primary">
            Sign in to choose games
            <Icon name="arrow" />
          </Link>
        </div>
      ) : catalogError ? (
        <div className="panel empty-state" role="alert">
          <h2>Games couldn’t be loaded</h2>
          <p>Please try again in a moment.</p>
          <button className="button secondary" onClick={() => router.refresh()}>
            Try again
          </button>
        </div>
      ) : (
        <GameSelection key={user.id} userId={user.id} games={games} />
      )}
    </>
  );
}

function GameSelection({ userId, games }: { userId: string; games: Game[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
        const result = await createClient()
          .from("user_games")
          .select("game_id")
          .eq("user_id", userId);
        if (result.error) throw result.error;
        if (active) {
          const ids = (result.data ?? []).map((row) => row.game_id as number);
          setSelected(ids);
          setSaved(ids);
        }
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [userId, retry]);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { error } = await createClient().rpc("save_my_games", {
        game_ids: selected,
      });
      if (error) throw error;
      setSaved([...selected]);
      setMessage("Your games have been saved.");
      router.refresh();
    } catch {
      setError(
        "We couldn’t save your games. Your changes are still here; please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="panel loading-state" role="status">
        Loading your saved games…
      </div>
    );
  if (loadError)
    return (
      <div className="panel empty-state" role="alert">
        <h2>Your saved games couldn’t be loaded</h2>
        <p>Try again to safely edit your existing selections.</p>
        <button
          className="button secondary"
          onClick={() => setRetry(retry + 1)}
        >
          Try again
        </button>
      </div>
    );
  if (!games.length)
    return (
      <div className="panel empty-state">
        <h2>No games available yet</h2>
        <p>Check back soon to build your lineup.</p>
      </div>
    );
  const dirty =
    selected.length !== saved.length ||
    selected.some((id) => !saved.includes(id));

  return (
    <section aria-labelledby="games-heading">
      <div className="games-heading">
        <h2 id="games-heading">
          My games <span className="count-badge">{selected.length}</span>
        </h2>
        <span className="muted">Select all that you play</span>
      </div>
      <div className="game-grid">
        {games.map((game, index) => (
          <label
            key={game.id}
            className={`game-card game-color-${index % 5} ${selected.includes(game.id) ? "selected" : ""}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(game.id)}
              disabled={saving}
              onChange={() => {
                setSelected((current) =>
                  current.includes(game.id)
                    ? current.filter((id) => id !== game.id)
                    : [...current, game.id],
                );
                setMessage("");
                setError("");
              }}
            />
            <span className="game-art" aria-hidden="true">
              <span className="game-monogram">
                {game.name
                  .split(/[\s-]+/)
                  .map((word) => word[0])
                  .join("")
                  .slice(0, 3)}
              </span>
              <Icon name="game" />
            </span>
            <span className="game-card-content">
              <strong>{game.name}</strong>
              <small>{game.platform}</small>
            </span>
            <span className="selection-check" aria-hidden="true">
              {selected.includes(game.id) ? (
                <Icon name="check" />
              ) : (
                <Icon name="plus" />
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="save-bar">
        <div>
          <strong>
            {selected.length} {selected.length === 1 ? "game" : "games"}{" "}
            selected
          </strong>
          <p>
            {dirty ? "You have unsaved changes." : "Your lineup is up to date."}
          </p>
        </div>
        <button
          className="button primary"
          disabled={saving || !dirty}
          onClick={() => {
            void save();
          }}
        >
          <Icon name="check" />
          {saving ? "Saving…" : "Save my games"}
        </button>
      </div>
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
