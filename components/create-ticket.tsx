"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeInviteUrl, type Game } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { regionFromTimeZone } from "@/lib/regions";
import { Icon } from "./icons";

type TicketDraft = { ticket_game: number; ticket_title: string; ticket_description: string; ticket_players: number; ticket_region: string; ticket_invite: string };

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

  const [pending, setPending] = useState<TicketDraft | null>(null);
  const [hideWarning, setHideWarning] = useState(false);
  const warningDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (pending) warningDialog.current?.showModal(); else warningDialog.current?.close(); }, [pending]);

  async function publish(draft: TicketDraft, replace: boolean) {
    if (!user) return;
    setSaving(true);
    try {
      const result = await createClient().rpc("publish_ticket", { ...draft, replace_existing: replace });
      if (result.error?.message === "ticket_replace_required") { setPending(draft); setSaving(false); return; }
      if (result.error) throw result.error;
      if (pending && hideWarning) { try { localStorage.setItem(`hide-ticket-replacement:${user.id}`, "true"); } catch { /* Storage may be unavailable. */ } }
      setPending(null);
      router.push("/"); router.refresh();
    } catch { setError("We couldn’t publish your ticket. Your previous ticket has been kept. Please try again."); setSaving(false); }
  }

  const regionSelect = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (!regionSelect.current) return;
    try { regionSelect.current.value = regionFromTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* Keep the neutral default when unavailable. */ }
  }, [loading, user?.id, gamesError]);

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
    let skipWarning = false;
    try { skipWarning = localStorage.getItem(`hide-ticket-replacement:${user.id}`) === "true"; } catch { /* Show the warning when storage is unavailable. */ }
    await publish({ ticket_game: Number(form.get("game_id")), ticket_title: title, ticket_description: String(form.get("description") ?? "").trim(), ticket_players: Number(form.get("players_needed")), ticket_region: String(form.get("region")), ticket_invite: invite }, skipWarning);
  }

  return (
    <>
      <dialog ref={warningDialog} className="ticket-replace-dialog" aria-labelledby="replace-ticket-title" onCancel={event => { if (saving) event.preventDefault(); else setPending(null); }}>
        <h2 id="replace-ticket-title">Replace your previous ticket?</h2>
        <p>Creating another ticket will automatically delete your previous ticket. This cannot be undone.</p>
        <label className="replacement-preference"><input type="checkbox" checked={hideWarning} disabled={saving} onChange={event => setHideWarning(event.target.checked)} />Do not show again</label>
        <div className="replacement-actions"><button type="button" className="button quiet" disabled={saving} onClick={() => setPending(null)}>Cancel</button><button type="button" className="button primary" disabled={saving} onClick={() => { if (pending) void publish(pending, true); }}>{saving ? "Publishing…" : "Replace and publish"}</button></div>
        {error && <p role="alert" className="notice error">{error}</p>}
      </dialog>
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
            <div className="form-row">
              <label>
                Players wanted
                <select name="players_needed" required defaultValue="1">
                  {Array.from({ length: 10 }, (_, index) => index + 1).map(count => (
                    <option key={count} value={count}>{count === 10 ? "10+" : count}</option>
                  ))}
                </select>
              </label>
              <label>
                Region
                <select ref={regionSelect} name="region" defaultValue="Any region">
                  {[
                    "Any region",
                    "North America",
                    "Europe",
                    "Asia",
                    "Africa",
                    "Oceania",
                    "South America",
                  ].map((region) => (
                    <option key={region}>{region}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Description <span className="optional">optional</span>
              <textarea
                name="description"
                maxLength={1000}
                rows={4}
                placeholder="Share your game mode, skill level, and what kind of party you’re looking for."
              />
            </label>
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
