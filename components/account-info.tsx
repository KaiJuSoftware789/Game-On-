"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";

type Draft = { userId: string; field: "username" | "email" | "phone"; value: string; challenge: string };
const storageKey = "game-on:account-edit";

export function AccountInfo() {
  const { user, displayName } = useAuth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [phoneToConfirm, setPhoneToConfirm] = useState("");
  const [hasPasskey, setHasPasskey] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as Draft | null;
        if (saved?.userId === user?.id) setDraft(saved);
      } catch { /* A fresh edit remains available. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, [user?.id]);
  useEffect(() => {
    let active = true;
    if (user) void createClient().auth.passkey.list().then(({ data }) => { if (active) setHasPasskey(Boolean(data?.length)); }).catch(() => {});
    return () => { active = false; };
  }, [user]);

  if (!user) return null;
  const currentUser = user;
  async function request(body: object) {
    const response = await fetch("/api/account-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Account update failed.");
    return result;
  }
  function persist(value: Draft) { sessionStorage.setItem(storageKey, JSON.stringify(value)); setDraft(value); }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Verification failed. Try again."); }
    finally { setBusy(false); setPassword(""); }
  }
  async function begin(field: Draft["field"], value: string) {
    await run(async () => {
      const result = await request({ action: "begin" });
      persist({ userId: currentUser.id, field, value, challenge: result.challenge });
      setSmsSent(false); setCode("");
      setMfaChallenge(null);
    });
  }
  async function verify(method: string) {
    await run(async () => {
      const auth = createClient().auth;
      if (method === "password") {
        const result = await auth.signInWithPassword(currentUser.email ? { email: currentUser.email, password } : { phone: currentUser.phone!, password });
        if (result.error || result.data.user?.id !== currentUser.id) throw new Error("Current password verification failed.");
      } else if (method === "passkey") {
        const result = await auth.signInWithPasskey();
        if (result.error || result.data.user?.id !== currentUser.id) throw new Error("Use a sign-in passkey belonging to this account.");
      } else if (method === "sms") {
        if (!currentUser.phone) throw new Error("No phone is connected.");
        const result = smsSent ? await auth.verifyOtp({ phone: currentUser.phone, token: code, type: "sms" }) : await auth.signInWithOtp({ phone: currentUser.phone, options: { shouldCreateUser: false } });
        if (result.error) throw result.error;
        if (!smsSent) { setSmsSent(true); setNotice("Enter the code sent to your existing phone number."); return; }
      } else {
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", "/account");
        const result = await auth.signInWithOAuth({ provider: method as "google" | "discord", options: { redirectTo: callback.href, skipBrowserRedirect: true, queryParams: method === "google" ? { prompt: "select_account" } : method === "discord" ? { prompt: "consent" } : undefined } });
        if (result.error || !result.data.url) throw new Error("Couldn’t reconnect your sign-in provider.");
        window.location.assign(result.data.url); return;
      }
      setNotice("Sign-in verified. Continue below to verify 2FA and save.");
      setSmsSent(false); setCode("");
    });
  }
  async function save() {
    if (!draft) return;
    await run(async () => {
      const auth = createClient().auth;
      await request({ ...draft, action: "verify" });
      const list = await auth.mfa.listFactors();
      if (list.error) throw list.error;
      const factor = list.data.all.find((factor) => factor.status === "verified" && factor.factor_type === "webauthn") || list.data.all.find((factor) => factor.status === "verified");
      if (factor) {
        if (factor.factor_type === "webauthn") {
          const result = await auth.mfa.webauthn.authenticate({ factorId: factor.id });
          if (result.error || !result.data) throw new Error("Passkey verification was canceled or failed. Nothing was changed.");
        } else {
          if (!mfaChallenge || mfaChallenge.factorId !== factor.id) {
            const result = await auth.mfa.challenge({ factorId: factor.id });
            if (result.error) throw result.error;
            setMfaChallenge({ factorId: factor.id, challengeId: result.data.id });
            setCode(""); setNotice(factor.factor_type === "phone" ? "Enter your two-factor SMS code below." : "Enter the code from your authenticator app below.");
            return;
          }
          const result = await auth.mfa.verify({ ...mfaChallenge, code });
          if (result.error) throw new Error("Invalid or expired two-factor code. Nothing was changed.");
          setMfaChallenge(null); setCode("");
        }
      }
      const result = await request(draft);
      setNotice(result.message);
      if (draft.field === "phone") setPhoneToConfirm(draft.value);
      sessionStorage.removeItem(storageKey); setDraft(null);
      window.dispatchEvent(new Event("profile-updated"));
    });
  }
  const maskEmail = (email: string) => email ? `••••••@${email.split("@")[1] || "••••"}` : "Not connected";
  const maskPhone = (phone: string) => phone ? `••••••${phone.slice(-4)}` : "Not connected";
  return <section className="account-info" aria-labelledby="account-info-title">
    <h3 id="account-info-title">Account info</h3>
    {([
      ["username", "Username", displayName || "Player"],
      ["email", "Email", currentUser.email || ""],
      ["phone", "Phone number", currentUser.phone ? `+${currentUser.phone.replace(/^\+/, "")}` : ""],
    ] as const).map(([field, label, value]) => <div className="account-info-row" key={field}>
      <span>{label}</span><span className="account-info-value">{field === "username" || revealed.includes(field) ? value || "Not connected" : field === "email" ? maskEmail(value) : maskPhone(value)}</span>
      {field !== "username" && value && <button className="inline-button" onClick={() => setRevealed((previous) => previous.includes(field) ? previous.filter((item) => item !== field) : [...previous, field])}>{revealed.includes(field) ? "Hide" : "Reveal"}</button>}
      <button className="inline-button mfa-setup-link" disabled={busy || (!value && field !== "phone")} onClick={() => void begin(field, value)}>{field === "phone" && !value ? "Add" : "Edit"}</button>
    </div>)}
    {draft && <form className="account-edit-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label htmlFor="account-new-value">New {draft.field === "phone" ? "phone number (with country code)" : draft.field}</label>
      <input id="account-new-value" type={draft.field === "email" ? "email" : draft.field === "phone" ? "tel" : "text"} value={draft.value} maxLength={draft.field === "username" ? 32 : 254} required disabled={busy} onChange={(event) => persist({ ...draft, value: event.target.value })} />
      <p>First verify your existing password or connected sign-in method. Then verify 2FA to save.</p>
      {(currentUser.app_metadata.providers || []).includes("email") && <>
        <label htmlFor="account-current-password">Current password</label>
        <input id="account-current-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
        <button type="button" className="button secondary" disabled={busy || !password} onClick={() => void verify("password")}>Verify password</button>
      </>}
      {(currentUser.app_metadata.providers || []).filter((provider: string) => provider !== "email" && provider !== "phone").map((provider: string) => <button type="button" key={provider} className="button secondary" disabled={busy} onClick={() => void verify(provider)}>Verify with {provider}</button>)}
      {hasPasskey && <button type="button" className="button secondary" disabled={busy} onClick={() => void verify("passkey")}>Verify with sign-in passkey</button>}
      {currentUser.phone && <>
        {smsSent && <input aria-label="Sign-in SMS code" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} />}
        <button type="button" className="button secondary" disabled={busy} onClick={() => void verify("sms")}>{smsSent ? "Verify SMS code" : "Text existing phone"}</button>
      </>}
      {mfaChallenge && <><label htmlFor="account-mfa-code">Two-factor code</label><input id="account-mfa-code" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} /></>}
      <div className="passwordless-actions"><button className="button secondary" type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and save"}</button><button type="button" className="inline-button" disabled={busy} onClick={() => { sessionStorage.removeItem(storageKey); setDraft(null); setError(""); }}>Cancel</button></div>
    </form>}
    {phoneToConfirm && <form className="account-edit-form" onSubmit={(event) => { event.preventDefault(); void run(async () => {
      const result = await createClient().auth.verifyOtp({ phone: phoneToConfirm, token: code, type: "phone_change" });
      if (result.error) throw new Error("Invalid or expired phone confirmation code.");
      setPhoneToConfirm(""); setCode(""); setNotice("Phone number updated.");
    }); }}><label htmlFor="new-phone-code">Code sent to your new number</label><input id="new-phone-code" autoComplete="one-time-code" inputMode="numeric" value={code} required onChange={(event) => setCode(event.target.value)} /><button className="button secondary" disabled={busy}>Confirm phone</button></form>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {notice && <p className="notice success" role="status">{notice}</p>}
  </section>;
}
