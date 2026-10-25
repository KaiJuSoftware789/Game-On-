"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeInviteUrl, type Game } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { Icon } from "./icons";

export function CreateTicket({
  games,
  gamesError,
}: {
  games: Game[];
  gamesError: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const invite = safeInviteUrl(String(form.get("invite_url") ?? "").trim());
    const title = String(form.get("title") ?? "").trim();
    if (!invite) {
      setError(
        "Add a valid HTTPS invite link for players to join your session.",
      );
      return;
    }
    if (title.length < 3) {
      setError("Give your ticket a title with at least 3 characters.");
      return;
    }
    setSaving(true);
    try {
      const result = await createClient()
        .from("tickets")
        .insert({
          game_id: Number(form.get("game_id")),
          title,
          description: String(form.get("description") ?? "").trim(),
          players_needed: Number(form.get("players_needed")),
          region: String(form.get("region")),
          invite_url: invite,
        });
      if (result.error) throw result.error;
      router.push("/tickets");
      router.refresh();
    } catch {
      setError("We couldn’t publish your ticket. Please try again.");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MAKE ROOM FOR YOUR TEAM</div>
          <h1>
            Start a <span>session.</span>
          </h1>
          <p>Tell players what you’re playing and invite them to join.</p>
        </div>
      </div>
      {loading ? (
        <div className="panel loading-state" role="status">
          Loading your account…
        </div>
      ) : !user ? (
        <div className="panel empty-state">
          <span className="empty-icon">
            <Icon name="tickets" />
          </span>
          <h2>Sign in to create a ticket</h2>
          <p>Your next party is one sign-in away.</p>
          <Link href="/account?next=/tickets/new" className="button primary">
            Sign in
            <Icon name="arrow" />
          </Link>
        </div>
      ) : gamesError || !games.length ? (
        <div className="panel empty-state" role="alert">
          <h2>
            {gamesError ? "Games couldn’t be loaded" : "No games available yet"}
          </h2>
          <p>Try again once games are available.</p>
          <button className="button secondary" onClick={() => router.refresh()}>
            Refresh
          </button>
        </div>
      ) : (
        <form className="panel ticket-form" onSubmit={submit}>
          <fieldset disabled={saving}>
            <legend className="sr-only">Session details</legend>
            <label>
              Game
              <select name="game_id" required defaultValue="">
                <option value="" disabled>
                  Choose a game
                </option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Session title
              <input
                name="title"
                required
                minLength={3}
                maxLength={100}
                placeholder="A few relaxed rounds — everyone welcome"
              />
            </label>
            <label>
              Description <span className="optional">optional</span>
              <textarea
                name="description"
                maxLength={1000}
                rows={4}
                placeholder="Share your game mode, skill level, and what kind of party you’re looking for."
              />
            </label>
            <div className="form-row">
              <label>
                Players wanted
                <input
                  name="players_needed"
                  type="number"
                  required
                  min={1}
                  max={20}
                  defaultValue={1}
                />
              </label>
              <label>
                Region
                <select name="region" defaultValue="Any region">
                  {[
                    "Any region",
                    "North America",
                    "Europe",
                    "Asia",
                    "Oceania",
                    "South America",
                  ].map((region) => (
                    <option key={region}>{region}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Session invite link
              <input
                name="invite_url"
                type="url"
                required
                maxLength={2048}
                placeholder="https://discord.gg/your-invite"
                aria-describedby="invite-hint"
              />
              <small id="invite-hint">
                Use an HTTPS lobby or Discord invite. This link will be visible
                to everyone.
              </small>
            </label>
            <p className="form-note">
              <Icon name="clock" />
              Tickets stay live for 4 hours. Close yours when your party is
              full.
            </p>
            <div className="form-actions">
              <Link href="/" className="button quiet">
                Cancel
              </Link>
              <button
                type="submit"
                className="button primary"
                disabled={saving}
              >
                <Icon name="plus" />
                {saving ? "Publishing…" : "Publish ticket"}
              </button>
            </div>
          </fieldset>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </>
  );
}
