"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UsernameEditor({ userId }: { userId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await createClient().from("profiles").select("display_name").eq("id", userId).single();
        if (result.error) throw result.error;
        if (active) { setName(result.data.display_name); setSaved(result.data.display_name); setError(""); }
      } catch { if (active) setError("Couldn’t load your username. Please retry."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [userId, retry]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await createClient().rpc("set_player_name", { new_name: name.trim() });
      if (result.error) {
        setError(result.error.code === "P0001" ? result.error.message : "Couldn’t save your username. Please try again.");
        return;
      }
      setName(name.trim()); setSaved(name.trim()); setNotice("Username updated.");
      window.dispatchEvent(new Event("profile-updated"));
      router.refresh();
    } catch { setError("Couldn’t save your username. Please try again."); }
    finally { setBusy(false); }
  }
  return <form className="username-editor" onSubmit={save}>
    <label htmlFor="username">Public username</label>
    <input id="username" value={name} onChange={event => { setName(event.target.value); setNotice(""); }} minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9 ._\-]*" required disabled={loading || busy || !saved} aria-describedby="username-help" />
    <p id="username-help" className="muted">3–32 characters. Use letters, numbers, spaces, dots, underscores or hyphens. Keep it respectful. This name appears on your public profile and in messages.</p>
    {loading ? <p role="status">Loading username…</p> : <button className="button secondary" disabled={busy || !saved || name.trim() === saved}>{busy ? "Saving…" : "Save username"}</button>}
    {error && <p role="alert" className="notice error">{error} {!saved && <button type="button" className="inline-button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry</button>}</p>}
    {notice && <p role="status">{notice}</p>}
  </form>;
}
