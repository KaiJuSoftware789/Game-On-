"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { MfaCodeSetup } from "./mfa-code-setup";

type Factor = { id: string; friendly_name?: string };

export function PasskeyMfa({ gate = false, children }: { gate?: boolean; children?: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [verifiedMethods, setVerifiedMethods] = useState<string[]>([]);
  const [codeFactors, setCodeFactors] = useState<{ id: string; factor_type: string }[]>([]);
  const [challenge, setChallenge] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [setupType, setSetupType] = useState<"totp" | "phone" | null>(null);
  const [disablingWithCode, setDisablingWithCode] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const autoStarted = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setChecking(false); setRequired(false); return; }
    setChecking(true);
    try {
      const auth = createClient().auth;
      const [list, assurance] = await Promise.all([auth.mfa.listFactors(), auth.mfa.getAuthenticatorAssuranceLevel()]);
      if (list.error || assurance.error) throw list.error || assurance.error;
      setFactors(list.data.all.filter((factor) => factor.factor_type === "webauthn" && factor.status === "verified"));
      setVerifiedMethods(list.data.all.filter((factor) => factor.status === "verified").map((factor) => factor.factor_type));
      setCodeFactors(list.data.all.filter((factor) => factor.status === "verified" && ["totp", "phone"].includes(factor.factor_type)));
      setRequired(assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2");
      setError("");
    } catch {
      setError("We couldn’t check two-factor authentication. Please retry.");
    } finally { setChecking(false); }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const startVerification = useCallback(async (factor: { id: string; factor_type: string }) => {
    setBusy(true); setError(""); setCode(""); setChallenge(null);
    setSelectedMethod(factor.factor_type);
    try {
      const auth = createClient().auth;
      if (factor.factor_type === "webauthn") {
        const result = await auth.mfa.webauthn.authenticate({ factorId: factor.id });
        if (result.error || !result.data) throw result.error || new Error("Verification incomplete");
        await refresh(); router.refresh();
      } else {
        const result = await auth.mfa.challenge({ factorId: factor.id });
        if (result.error) throw result.error;
        setChallenge({ factorId: factor.id, challengeId: result.data.id });
      }
    } catch {
      setError(factor.factor_type === "webauthn" ? "Passkey verification was canceled or blocked. Retry to open the device prompt." : "Couldn’t start verification. Please retry.");
    } finally { setBusy(false); }
  }, [refresh, router]);

  const availableFactors = [...factors.map((factor) => ({ ...factor, factor_type: "webauthn" })), ...codeFactors];
  const methodTypes = [...new Set(availableFactors.map((factor) => factor.factor_type))];
  const onlyFactor = methodTypes.length === 1 ? availableFactors[0] : undefined;
  useEffect(() => {
    if (!gate || loading || checking || !user || !required) {
      if (!user || !required) autoStarted.current = null;
      return;
    }
    if (!onlyFactor || busy || error) return;
    const key = `${user.id}:${onlyFactor.factor_type}`;
    const timer = window.setTimeout(() => {
      if (autoStarted.current === key) return;
      autoStarted.current = key;
      void startVerification(onlyFactor);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [gate, loading, checking, user, required, onlyFactor, busy, error, startVerification]);

  async function act(kind: "enable" | "verify" | "remove" | "disable", factorId?: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      if (window.location.hostname === "127.0.0.1") {
        setError("Open http://localhost:3000/account to use passkeys in this local preview. Passkeys are tied to a specific hostname.");
        return;
      }
      const auth = createClient().auth;
      if (!window.isSecureContext || !window.PublicKeyCredential) throw new Error("unsupported");
      if (kind === "enable") {
        const security = await createClient().rpc("require_mfa");
        if (security.error) {
          setError("Two-factor security setup is not ready. Apply the MFA database migration before enabling passkey 2FA.");
          return;
        }
        const result = await auth.mfa.webauthn.register({ friendlyName: `Game-On 2FA ${crypto.randomUUID().slice(0, 8)}` });
        if (result.error || !result.data) throw result.error || new Error("Enrollment incomplete");
        setNotice("Passkey two-factor authentication is enabled. Add a backup passkey on another device before relying on it.");
      } else {
        if (!factorId) throw new Error("missing factor");
        const result = await auth.mfa.webauthn.authenticate({ factorId });
        if (result.error || !result.data) throw result.error || new Error("Verification incomplete");
        if (kind === "disable") {
          // Always perform a fresh WebAuthn challenge above, even for AAL2
          // sessions. Keep the verified factor until last when removing backups.
          const list = await auth.mfa.listFactors();
          if (list.error) throw list.error;
          const enrolled = list.data.all
            .sort((a, b) => Number(a.id === factorId) - Number(b.id === factorId));
          for (const factor of enrolled) {
            const removed = await auth.mfa.unenroll({ factorId: factor.id });
            if (removed.error) throw removed.error;
          }
          setNotice("Two-factor authentication is now off.");
        }
        if (kind === "remove") {
          const result = await auth.mfa.unenroll({ factorId });
          if (result.error) throw result.error;
          setNotice("Passkey removed from two-factor authentication.");
        }
      }
      await refresh();
      router.refresh();
    } catch (cause) {
      // Re-read enrollment if only some backup removals succeeded.
      await refresh();
      const code = (cause as { code?: string })?.code;
      const details = cause as { message?: string; name?: string; cause?: { name?: string } };
      setError(code?.includes("disabled") ? "Passkey MFA is disabled in Supabase." : details.name === "NotAllowedError" || details.cause?.name === "NotAllowedError" ? "The passkey prompt was canceled, timed out, or was blocked by this browser. Try opening the app in Chrome or Edge." : `Couldn’t complete passkey verification. ${details.message || "Retry and approve the device prompt."}`);
    } finally { setBusy(false); }
  }

  if (gate && !loading && !user) return children;
  if (gate && !loading && !checking && !required && !error) return children;
  if (gate) return <section className="account-panel panel">
    <h1>Verify your sign-in</h1>
    {loading || checking ? <p role="status">Checking account security…</p> : <>
      <p>{methodTypes.length > 1 ? "Choose how to verify your sign-in." : selectedMethod === "totp" ? "Enter the code from your authenticator app." : selectedMethod === "phone" ? "Enter the code sent to your phone." : "Approve the passkey prompt to finish signing in."}</p>
      {busy && <p role="status">{selectedMethod === "webauthn" ? "Waiting for your passkey…" : "Starting verification…"}</p>}
      {methodTypes.length > 1 && methodTypes.map((type) => <button key={type} className="button secondary account-action" disabled={busy} onClick={() => void startVerification(availableFactors.find((factor) => factor.factor_type === type)!)}>{type === "webauthn" ? "Use passkey" : type === "totp" ? "Use authenticator app" : "Text me a code"}</button>)}
      {challenge && <form onSubmit={(event) => {
        event.preventDefault(); setBusy(true); setError("");
        void createClient().auth.mfa.verify({ ...challenge, code }).then(async (result) => {
          if (result.error) throw result.error;
          setChallenge(null); setCode(""); await refresh(); router.refresh();
        }).catch(() => setError("Invalid or expired code. Try again.")).finally(() => setBusy(false));
      }}><label htmlFor="signin-mfa-code">Two-factor code</label><input id="signin-mfa-code" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code} onChange={(event) => setCode(event.target.value)} /><button className="button secondary" disabled={busy}>Verify</button></form>}
      {!factors.length && !codeFactors.length && !error && <p>Contact support to recover access to your second factor.</p>}
      {error && <p role="alert" className="notice error">{error}</p>}
      {error && <button className="button quiet" disabled={busy} onClick={() => {
        const factor = availableFactors.find((factor) => factor.factor_type === selectedMethod) || onlyFactor;
        if (factor) void startVerification(factor); else void refresh();
      }}>Retry</button>}
      <button className="button quiet" disabled={busy} onClick={() => void createClient().auth.signOut().then(() => router.refresh())}>Sign out</button>
    </>}
  </section>;

  return <section className="passwordless-section" aria-labelledby="passkey-mfa-title">
      <div className="mfa-toggle-row">
        <h3 id="passkey-mfa-title">Two-factor authentication</h3>
        <button type="button" role="switch" aria-checked={verifiedMethods.length > 0} aria-labelledby="passkey-mfa-title" className="mfa-toggle" disabled={checking || busy || Boolean(error) || setupType !== null} onClick={() => {
          if (verifiedMethods.length) {
            if (!window.confirm("Are you sure you want to turn off 2FA? Verify your configured second factor to continue.")) return;
            if (factors.length) void act("disable", factors[0].id);
            else if (codeFactors.length) {
              setBusy(true);
              void createClient().auth.mfa.challenge({ factorId: codeFactors[0].id }).then((result) => {
                if (result.error) throw result.error;
                setChallenge({ factorId: codeFactors[0].id, challengeId: result.data.id }); setCode(""); setDisablingWithCode(true);
              }).catch(() => setError("Couldn’t start verification. 2FA is still enabled.")).finally(() => setBusy(false));
            }
          } else if (window.confirm("Set up a passkey to enable two-factor authentication? Your device will prompt you to create a 2FA passkey.")) void act("enable");
        }}><span /></button>
      </div>
    <ul className="mfa-methods" aria-label="Completed two-factor methods">
      {[
        { type: "webauthn", label: "Passkey" },
        { type: "totp", label: "Authenticator app" },
      ].map(({ type, label }) => <li key={type}><span>{label}</span>{checking ? <span className="muted">…</span> : verifiedMethods.includes(type) ? <span className="mfa-complete"><span aria-hidden="true">✓</span><span className="sr-only">Set up</span></span> : <button type="button" className="inline-button mfa-setup-link" aria-label={`Set up ${label}`} disabled={busy || setupType !== null} onClick={() => { setError(""); setNotice(""); if (type === "webauthn") void act("enable"); else setSetupType(type as "totp" | "phone"); }}>Not set up</button>}</li>)}
    </ul>
    {setupType && <MfaCodeSetup key={setupType} type={setupType} onClose={() => setSetupType(null)} onComplete={async () => { await refresh(); setNotice("Two-factor authentication enabled."); router.refresh(); }} />}
    {disablingWithCode && challenge && <form className="account-edit-form" onSubmit={(event) => {
      event.preventDefault(); setBusy(true); setError("");
      void (async () => {
        const auth = createClient().auth;
        const verified = await auth.mfa.verify({ ...challenge, code });
        if (verified.error || !verified.data) throw new Error("Invalid verification code. 2FA is still enabled.");
        const list = await auth.mfa.listFactors();
        if (list.error) throw list.error;
        for (const factor of list.data.all.sort((a, b) => Number(a.id === challenge.factorId) - Number(b.id === challenge.factorId))) {
          const result = await auth.mfa.unenroll({ factorId: factor.id });
          if (result.error) throw result.error;
        }
        setDisablingWithCode(false); setChallenge(null); setCode(""); setNotice("Two-factor authentication is now off."); router.refresh();
        await refresh();
      })().catch(async () => { await refresh(); setError("Couldn’t disable 2FA. Check your code and retry."); }).finally(() => setBusy(false));
    }}><label htmlFor="disable-mfa-code">Enter your second-factor code to turn off 2FA</label><input id="disable-mfa-code" inputMode="numeric" autoComplete="one-time-code" value={code} required onChange={(event) => setCode(event.target.value)} /><button className="button secondary" disabled={busy}>Verify and turn off</button><button type="button" className="inline-button" disabled={busy} onClick={() => { setDisablingWithCode(false); setChallenge(null); }}>Cancel</button></form>}
    {notice && <p role="status" className="notice success">{notice}</p>}
    {error && <><p role="alert" className="notice error">{error}</p><button className="inline-button" onClick={() => void refresh()}>Retry</button></>}
  </section>;
}
