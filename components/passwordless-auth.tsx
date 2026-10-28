"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/auth-config";

export function PhoneSignIn({ enabled, disabled, next }: { enabled: boolean; disabled: boolean; next: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function send() {
    const normalized = (sentTo || phone).replace(/[\s().-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("Enter your phone number with country code, for example +1 555 123 4567.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await createClient().auth.signInWithOtp({ phone: normalized, options: { channel: "sms" } });
      if (error) throw error;
      setSentTo(normalized);
      setCode("");
      setCooldown(60);
    } catch {
      setError("We couldn’t send a code. Check your number and try again shortly.");
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      const { data, error } = await createClient().auth.verifyOtp({ phone: sentTo, token: code.trim(), type: "sms" });
      if (error || !data.session) throw error;
      router.replace(safeNextPath(next));
      router.refresh();
    } catch {
      setError("That code is invalid or has expired. Try again or request a new code.");
    } finally { setBusy(false); }
  }

  return <div className="passwordless-section">
    <h3>Sign in with your phone</h3>
    <p className="muted">We’ll text you a sign-in code. No password needed. New numbers create an account.</p>
    {!enabled ? <p className="sign-in-note">Phone sign-in is not available yet.</p> : <form onSubmit={(event) => { event.preventDefault(); if (!busy && !disabled) void (sentTo ? verify() : send()); }}>
      {sentTo ? <>
        <p role="status">Code sent to {sentTo}.</p>
        <label htmlFor="sms-code">Verification code</label>
        <input id="sms-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} disabled={busy || disabled} />
      </> : <>
        <label htmlFor="signin-phone">Phone number with country code</label>
        <input id="signin-phone" type="tel" autoComplete="tel" placeholder="+1 555 123 4567" maxLength={32} required value={phone} onChange={(event) => setPhone(event.target.value)} disabled={busy || disabled} />
      </>}
      <button className="button secondary" disabled={busy || disabled} type="submit">{busy ? "Please wait…" : sentTo ? "Verify and sign in" : "Send sign-in code"}</button>
      {sentTo && <div className="passwordless-actions">
        <button className="inline-button" type="button" disabled={busy || disabled || cooldown > 0} onClick={() => void send()}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button>
        <button className="inline-button" type="button" disabled={busy || disabled} onClick={() => { setSentTo(""); setCode(""); setError(""); }}>Use another number</button>
      </div>}
    </form>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}

type Passkey = { id: string; friendly_name?: string | null };
const subscribeToBrowser = () => () => {};
const browserSupportsPasskeys = () => window.isSecureContext && typeof window.PublicKeyCredential !== "undefined";

export function Passkeys({ signedIn, next, disabled = false }: { signedIn: boolean; next: string; disabled?: boolean }) {
  const router = useRouter();
  const supported = useSyncExternalStore(subscribeToBrowser, browserSupportsPasskeys, () => false);
  const [keys, setKeys] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void createClient().auth.passkey.list().then(({ data, error }) => {
      if (!active) return;
      if (error) setError("We couldn’t load your passkeys. Try again by refreshing the page.");
      else setKeys(data ?? []);
    }).catch(() => { if (active) setError("We couldn’t load your passkeys. Try refreshing the page."); });
    return () => { active = false; };
  }, [signedIn]);

  async function act(removeId?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const auth = createClient().auth;
      if (removeId) {
        const { error } = await auth.passkey.delete({ passkeyId: removeId });
        if (error) throw error;
        setKeys((keys) => keys.filter((key) => key.id !== removeId));
        setMessage("Passkey removed. You can still sign in with your phone or linked provider.");
      } else if (signedIn) {
        const { data, error } = await auth.registerPasskey();
        if (error) throw error;
        if (data) setKeys((keys) => [...keys, data]);
        setMessage("Passkey added. Use it next time you sign in.");
      } else {
        const { data, error } = await auth.signInWithPasskey();
        if (error || !data.session) throw error;
        router.replace(safeNextPath(next));
        router.refresh();
      }
    } catch {
      setError(removeId ? "We couldn’t remove that passkey. Please try again." : "Passkey setup or sign-in wasn’t completed. Try again, or use your phone or linked provider.");
    } finally { setBusy(false); }
  }

  return <div className={signedIn ? "passwordless-section" : ""}>
    {signedIn && <><h3>Passkeys</h3><p className="muted">Sign in using your device’s fingerprint, face, PIN, or security key.</p></>}
    <button className="button secondary account-action" disabled={!supported || busy || disabled} onClick={() => void act()}>{busy ? "Please wait…" : signedIn ? "Add a passkey" : "Sign in with a passkey"}</button>
    {!supported && <p className="sign-in-note">Passkeys require a supported browser and a secure connection.</p>}
    {signedIn && keys.map((key) => <div className="passwordless-actions" key={key.id}><span>{key.friendly_name || "Passkey"}</span><button className="inline-button" disabled={busy} onClick={() => { if (window.confirm("Remove this passkey? Make sure you can still sign in with your phone or linked provider.")) void act(key.id); }}>Remove</button></div>)}
    {message && <p className="notice success" role="status">{message}</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}
