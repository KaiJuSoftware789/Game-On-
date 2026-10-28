"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function MessagePlayerSearch({ userId }: { userId: string }) {
  const [query, setQuery] = useState("");
  return <div className="message-player-search">
    <label htmlFor="message-player-search">Find or start a conversation</label>
    <div className="message-search-field">
      <input id="message-player-search" type="search" placeholder="Search players…" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} />
      {query && <button type="button" className="inline-button" onClick={() => setQuery("")}>Clear</button>}
    </div>
    {query.trim() && <SearchResults key={`${userId}:${query.trim()}`} userId={userId} query={query.trim()} onSelect={() => setQuery("")} />}
  </div>;
}

function SearchResults({ userId, query, onSelect }: { userId: string; query: string; onSelect: () => void }) {
  const [players, setPlayers] = useState<{ id: string; display_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const term = query.replace(/[\\%_]/g, "\\$&");
        const result = await createClient().from("profiles").select("id, display_name").neq("id", userId).ilike("display_name", `%${term}%`).order("display_name").limit(20);
        if (result.error) throw result.error;
        if (active) { setPlayers(result.data ?? []); setError(false); }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [userId, query, retry]);
  return <section className="message-search-results" aria-label="Player search results" aria-live="polite">
    {loading ? <p role="status">Searching…</p> : error ? <p role="alert">Couldn’t search players. <button className="inline-button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry</button></p> : players.length ? players.map(player => <Link className="conversation" key={player.id} href={`/messages?to=${player.id}`} onClick={onSelect}><strong>{player.display_name}</strong><span>Open conversation</span></Link>) : <p>No players found. Try another name.</p>}
  </section>;
}
