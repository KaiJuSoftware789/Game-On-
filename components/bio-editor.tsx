"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function BioEditor({ userId }: { userId: string }) {
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
        const result = await createClient().from("profile_details").select("bio").eq("user_id", userId).single();
        if (result.error) throw result.error;
        if (active) { setName(result.data.bio); setSaved(result.data.bio); setError(""); }
      } catch { if (active) setError("Couldn’t load your bio. Please retry."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [userId, retry]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await createClient().rpc("set_player_bio", { new_bio: name.trim() });
      if (result.error) {
        setError(result.error.code === "P0001" ? result.error.message : "Couldn’t save your bio. Please try again.");
        return;
      }
      setName(name.trim()); setSaved(name.trim()); setNotice("Bio updated.");
      window.dispatchEvent(new Event("profile-updated"));
      router.refresh();
    } catch { setError("Couldn’t save your bio. Please try again."); }
    finally { setBusy(false); }
  }
  return <form className="bio-editor" onSubmit={save}>
    <label htmlFor="bio">About you</label>
    <textarea id="bio" value={name} onChange={event => { setName(event.target.value); setNotice(""); }} maxLength={200} rows={3} disabled={loading || busy} aria-describedby="bio-help" placeholder="Tell other players a little about yourself…" />
    <small>{name.length}/200</small><p id="bio-help" className="muted">Up to 200 characters. Your profile privacy setting controls who can see your bio. Keep it respectful.</p>
    {loading ? <p role="status">Loading bio…</p> : <button className="button secondary" disabled={busy || name.trim() === saved}>{busy ? "Saving…" : "Save bio"}</button>}
    {error && <p role="alert" className="notice error">{error} {error && <button type="button" className="inline-button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry</button>}</p>}
    {notice && <p role="status">{notice}</p>}
  </form>;
}
