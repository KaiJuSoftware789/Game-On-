"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  safeInviteUrl,
  ticketColumns,
  type Game,
  type Ticket,
} from "@/lib/types";
import { useAuth } from "./auth-provider";
import { HoldCloseTicket } from "./hold-close-ticket";
import { DemoTickets } from "./demo-tickets";
import { Icon } from "./icons";

export function TicketFeed({
  initialTickets,
  games,
  initialError,
  gamesError,
}: {
  initialTickets: Ticket[];
  games: Game[];
  initialError: boolean;
  gamesError: boolean;
}) {
  const [supabase] = useState(createClient);
  const { user } = useAuth();
  const [tickets, setTickets] = useState(initialTickets);
  const [error, setError] = useState(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [gameFilter, setGameFilter] = useState("all");
  const [closing, setClosing] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const requestId = useRef(0);
  const active = useRef(true);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const result = await supabase
        .from("tickets")
        .select(ticketColumns)
        .eq("status", "open")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<Ticket[]>();
      if (!active.current || id !== requestId.current) return;
      setError(Boolean(result.error));
      if (!result.error) setTickets(result.data ?? []);
    } catch {
      if (active.current && id === requestId.current) setError(true);
    } finally {
      if (active.current && id === requestId.current) setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    active.current = true;
    const invalidateRequests = () => {
      requestId.current++;
    };
    const channel = supabase
      .channel("live-tickets")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          void refresh();
        },
      )
      .subscribe((status) => {
        if (!active.current) return;
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void refresh();
      });
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      active.current = false;
      invalidateRequests();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [supabase, refresh]);

  async function closeTicket(id: string) {
    if (!user) return;
    setClosing(id);
    setActionError("");
    try {
      const result = await supabase
        .from("tickets")
        .update({ status: "closed" })
        .eq("id", id)
        .eq("host_id", user.id)
        .select("id")
        .single();
      if (result.error) throw result.error;
      await refresh();
    } catch {
      setActionError("We couldn’t close your ticket. Please try again.");
    } finally {
      setClosing(null);
    }
  }

  const visible = tickets.filter(
    (ticket) => gameFilter === "all" || String(ticket.game_id) === gameFilter,
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE PARTY STARTS HERE</div>
          <h1>
            Find your next <span>party.</span>
          </h1>
          <p>Real players. Open sessions. Your next good game starts here.</p>
        </div>
        <Link
          href={user ? "/tickets/new" : "/account?next=/tickets/new"}
          className="button primary"
        >
          <Icon name="plus" />
          Create a ticket
        </Link>
      </div>
      <section className="feed-panel" aria-labelledby="tickets-heading">
        <div className="section-heading">
          <div className="section-title">
            <span className="section-icon">
              <Icon name="tickets" />
            </span>
            <h2 id="tickets-heading">Live tickets</h2>
            {!error && <span className="count-badge">{tickets.length}</span>}
          </div>
          <span className={`live-status ${error ? "status-muted" : ""}`}>
            <span className="status-dot" />
            {error
              ? "Connection interrupted"
              : connected
                ? "Updating live"
                : "Auto-refresh · 30s"}
          </span>
        </div>
        <div className="feed-toolbar">
          <label className="filter-label" htmlFor="game-filter">
            Game
            <select
              id="game-filter"
              value={gameFilter}
              onChange={(event) => setGameFilter(event.target.value)}
              disabled={gamesError}
            >
              <option value="all">All games</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button quiet refresh-button"
            onClick={() => {
              void refresh();
            }}
            disabled={refreshing}
          >
            <Icon name="refresh" className={refreshing ? "spinning" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {actionError && (
          <p className="notice error" role="alert">
            {actionError}
          </p>
        )}
        {gamesError && (
          <p className="notice error">
            Game filters are temporarily unavailable. Refresh the page to try
            again.
          </p>
        )}
        {error ? (
          <div className="empty-state" role="alert">
            <span className="empty-icon">
              <Icon name="refresh" />
            </span>
            <h3>Tickets couldn’t be loaded</h3>
            <p>We couldn’t reach the ticket board. Please try again.</p>
            <button
              className="button secondary"
              disabled={refreshing}
              onClick={() => {
                void refresh();
              }}
            >
              Try again
              <Icon name="arrow" />
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state" role="status">
            <div className="empty-orbit">
              <span className="empty-icon">
                <Icon name="tickets" />
              </span>
              <span className="orbit-dot" />
            </div>
            <span className="eyebrow">ROOM FOR A NEW PARTY</span>
            <h3>
              {gameFilter === "all"
                ? "No tickets available"
                : "No tickets available for this game"}
            </h3>
            <p>
              There are no open sessions{" "}
              {gameFilter === "all" ? "right now" : "for this game right now"}.
              <br />
              Start one of your own, or check back soon.
            </p>
            <Link
              className="button secondary"
              href={user ? "/tickets/new" : "/account?next=/tickets/new"}
            >
              Create the first ticket
              <Icon name="arrow" />
            </Link>
            <span className="empty-footnote">
              New tickets appear here automatically.
            </span>
          </div>
        ) : (
          <div className="ticket-grid">
            {visible.map((ticket) => {
              const game = games.find((item) => item.id === ticket.game_id);
              const invite = safeInviteUrl(ticket.invite_url);
              return (
                <article className="ticket-card" key={ticket.id}>
                  <div className="ticket-topline">
                    <span className="game-tag">
                      {game?.name ?? "Gaming session"}
                    </span>
                    <span className="open-label">
                      <span className="status-dot" />
                      Open
                    </span>
                  </div>
                  <h3>{ticket.title}</h3>
                  <p className="ticket-description">
                    {ticket.description ||
                      "Join the party and find your next teammates."}
                  </p>
                  <div className="ticket-details">
                    <span>
                      <Icon name="user" />
                      {ticket.players_needed >= 10 ? "10+" : ticket.players_needed}{" "}
                      {ticket.players_needed === 1 ? "player" : "players"}{" "}
                      wanted
                    </span>
                    <span>
                      <Icon name="globe" />
                      {ticket.region}
                    </span>
                    <span>
                      <Icon name="game" />
                      {game?.platform ?? "Online"}
                    </span>
                  </div>
                  <div className="host-profile">
                    <Link
                      href={`/players/${ticket.host_id}`}
                      className="text-link"
                    >
                      View host profile
                      <Icon name="arrow" />
                    </Link>
                  </div>
                  <div className="ticket-footer">
                    {invite && (
                      <a
                        className="button primary"
                        href={invite}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Join session
                        <Icon name="arrow" />
                      </a>
                    )}
                    {user?.id === ticket.host_id && (
                      <HoldCloseTicket busy={closing === ticket.id} onConfirm={() => { void closeTicket(ticket.id); }} />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <DemoTickets games={games} gameFilter={gameFilter} />
    </>
  );
}
