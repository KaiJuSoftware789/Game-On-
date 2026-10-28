"use client";

import Link from "next/link";
import { ProfileEditor } from "./profile-editor";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";

const reasons = [
  ["harassment", "Harassment or bullying"],
  ["hate_speech", "Hate speech or discrimination"],
  ["inappropriate_profile", "Inappropriate username or profile"],
  ["spam", "Spam or unwanted advertising"],
  ["scam", "Scam, fraud or impersonation"],
  ["threats", "Threats or violent content"],
  ["sexual_content", "Inappropriate sexual content"],
  ["privacy", "Sharing private information"],
  ["cheating", "Cheating or disruptive gameplay"],
  ["other", "Something else"],
];

export function ProfileActions({ playerId, playerName, placement = "body", showGoBack = false, initiallyEditing = false }: { playerId: string; playerName: string; placement?: "header" | "body"; showGoBack?: boolean; initiallyEditing?: boolean }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.id === playerId) return placement === "header" ? <EditProfile key={user.id} userId={user.id} showGoBack={showGoBack} initiallyEditing={initiallyEditing} /> : null;
  if (placement === "header") return null;
  return <ReportPlayer key={`${user.id}:${playerId}`} playerId={playerId} playerName={playerName} />;
}

function EditProfile({ userId, showGoBack, initiallyEditing }: { userId: string; showGoBack: boolean; initiallyEditing: boolean }) {
  const [open, setOpen] = useState(initiallyEditing);
  return <div className="profile-edit">
    <div className="profile-edit-buttons">
    {showGoBack && <Link href="/games" className="button secondary">Go back</Link>}
    <button className="button secondary" aria-expanded={open} aria-controls="edit-profile" onClick={() => setOpen(value => !value)}>{open ? "Close editor" : "Edit profile"}</button>
    </div>
    {open && <section id="edit-profile" className="panel profile-editor" aria-label="Edit profile">
      <ProfileEditor userId={userId} />
    </section>}
  </div>;
}

function ReportPlayer({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !reason) return;
    setBusy(true); setError("");
    try {
      const result = await createClient().rpc("report_player", { player_id: playerId, report_reason: reason, report_details: details.trim() });
      if (result.error) { setError(result.error.code === "P0001" ? result.error.message : "Couldn’t submit the report. Please try again."); return; }
      setSent(true); setDetails("");
    } catch { setError("Couldn’t submit the report. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="report-player">
    <button className="button quiet" aria-expanded={open} aria-controls="player-report-form" onClick={() => setOpen(value => !value)}>{open ? "Close report" : "Report player"}</button>
    {open && <section className="panel report-form" id="player-report-form" aria-label="Report player">
      {sent ? <p role="status">Report submitted. Your report is private and has been saved for review.</p> : <form onSubmit={submit}>
        <h2>Report {playerName}</h2>
        <p>Your report is not shared with this player. Reporting does not automatically penalize an account.</p>
        <label htmlFor="report-reason">Reason</label>
        <select id="report-reason" value={reason} onChange={event => setReason(event.target.value)} required disabled={busy}><option value="" disabled>Select a reason</option>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <label htmlFor="report-details">Details (optional)</label>
        <textarea id="report-details" value={details} onChange={event => setDetails(event.target.value)} maxLength={2000} rows={4} disabled={busy} placeholder="Describe what happened and include relevant context." />
        <small>{details.length}/2000</small>
        {error && <p role="alert" className="notice error">{error}</p>}
        <div><button className="button secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="button primary" disabled={busy || !reason}>{busy ? "Submitting…" : "Submit report"}</button></div>
      </form>}
    </section>}
  </div>;
}
