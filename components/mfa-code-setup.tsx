"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/app/_components/modal";
import { VerificationCode } from "./verification-code";

export function MfaCodeSetup({ type, onComplete, onClose }: { type: "totp" | "phone"; onComplete: () => Promise<void>; onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [factor, setFactor] = useState<{ id: string; qr?: string; secret?: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [smsChallenge, setSmsChallenge] = useState("");
  const autoStarted = useRef(false);
  const start = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const auth = createClient().auth;
      const security = await createClient().rpc("require_mfa");
      if (security.error) throw new Error("Security setup is unavailable. Please retry later.");
      if (type === "totp") {
        const result = await auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${crypto.randomUUID().slice(0, 8)}`, issuer: "Game-On" });
        if (result.error) throw result.error;
        setFactor({ id: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret });
      } else {
        const normalized = phone.replace(/[\s().-]/g, "");
        if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("Include your country code, for example +1 555 123 4567.");
        const result = await auth.mfa.enroll({ factorType: "phone", phone: normalized, friendlyName: `SMS ${crypto.randomUUID().slice(0, 8)}` });
        if (result.error) throw result.error;
        setFactor({ id: result.data.id });
        const sent = await auth.mfa.challenge({ factorId: result.data.id });
        if (sent.error) throw sent.error;
        setSmsChallenge(sent.data.id);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn’t start setup.";
      setError(`${message} This method must be enabled in Supabase${type === "phone" ? " with an SMS provider and SMS MFA support" : ""}.`);
    } finally { setBusy(false); }
  }, [phone, type]);
  useEffect(() => {
    if (type !== "totp") return;
    const timer = window.setTimeout(() => {
      if (autoStarted.current) return;
      autoStarted.current = true;
      void start();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [start, type]);
  async function verify() {
    if (!factor) return;
    setBusy(true); setError("");
    try {
      // TOTP creates a fresh challenge; SMS uses the latest challenge sent below.
      const auth = createClient().auth;
      const result = type === "totp"
        ? await auth.mfa.challengeAndVerify({ factorId: factor.id, code })
        : await (async () => {
          const challenge = smsChallenge;
          if (!challenge) throw new Error("Send an SMS code first.");
          return auth.mfa.verify({ factorId: factor.id, challengeId: challenge, code });
        })();
      if (result.error) throw result.error;
      await onComplete();
      onClose();
    } catch { setError("Invalid or expired code. Try again or request a new SMS code."); }
    finally { setBusy(false); }
  }
  async function sendSms() {
    if (!factor) return;
    setBusy(true); setError("");
    try {
      const result = await createClient().auth.mfa.challenge({ factorId: factor.id });
      if (result.error) throw result.error;
      setSmsChallenge(result.data.id);
    } catch { setError("Couldn’t send a code. Wait a moment and retry."); }
    finally { setBusy(false); }
  }
  function cancel() {
    if (busy) return;
    if (!factor) { onClose(); return; }
    setBusy(true);
    void createClient().auth.mfa.unenroll({ factorId: factor.id }).then((result) => {
      if (result.error) throw result.error;
      onClose();
    }).catch(() => setError("Couldn’t cancel setup. Please retry.")).finally(() => setBusy(false));
  }
  return <Modal titleId="mfa-setup-title" onClose={cancel} className="mfa-setup-modal"><section className="account-edit-form">
    <h3 id="mfa-setup-title">{type === "totp" ? "Set up authenticator app" : "Set up SMS 2FA"}</h3>
    {type === "totp" && <><h4>Step 1: Scan this QR code</h4><p>Scan with your authenticator app like Google Authenticator, Microsoft Authenticator, etc.</p></>}
    {!factor ? <>
      {type === "totp" ? <p role="status">{error ? "QR code unavailable." : "Generating your QR code…"}</p> : <><label htmlFor="mfa-setup-phone">Phone number with country code</label><input id="mfa-setup-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></>}
      {(type === "phone" || error) && <button className="button secondary" disabled={busy} onClick={() => void start()}>{busy ? "Starting…" : type === "totp" ? "Retry" : "Set up SMS"}</button>}
    </> : <>
      {factor.qr && <>
        {/* Supabase generates the enrollment QR locally for this user. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={factor.qr} width={200} height={200} alt="Scan this QR code with your authenticator app" className="mfa-setup-qr" />
        <details><summary>Can’t scan the QR code?</summary><code className="mfa-setup-secret">{factor.secret}</code></details>
      </>}
      {type === "phone" && <button className="button secondary" disabled={busy} onClick={() => void sendSms()}>{smsChallenge ? "Resend code" : "Send verification code"}</button>}
      <form onSubmit={(event) => { event.preventDefault(); void verify(); }}>
        <h4>{type === "totp" ? "Step 2: Enter the one-time code" : "Enter the verification code"}</h4>
        <p>Enter the 6-digit code {type === "totp" ? "generated by your authenticator app" : "sent to your phone"}.</p>
        <VerificationCode value={code} onChange={setCode} disabled={busy} />
        <div className="mfa-enable-action"><button className="button secondary" disabled={busy || code.length !== 6 || (type === "phone" && !smsChallenge)}>Enable</button></div>
      </form>
    </>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="inline-button mfa-cancel-link" disabled={busy} onClick={cancel}>Cancel setup</button>
  </section></Modal>;
}
