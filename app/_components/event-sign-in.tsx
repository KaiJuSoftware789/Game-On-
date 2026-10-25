"use client";
import { useState, type FormEvent } from "react";
import { Modal } from "./modal";
import type { EventConnection } from "./events-connection";
export function EventSignIn({
  service,
  onClose,
}: {
  service: EventConnection;
  onClose: () => void;
}) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !service.client) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const email = String(data.get("email") || "").trim(),
        password = String(data.get("password") || "");
      const result = signup
        ? await service.client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=/events`,
            },
          })
        : await service.client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) onClose();
      else {
        form.reset();
        setNotice("Check your email to confirm your account, then sign in.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't sign in. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      titleId="event-auth-title"
      onClose={onClose}
      className="event-auth-modal"
    >
      <div className="modal-heading">
        <span className="eyebrow">YOUR LOCAL GAMING COMMUNITY</span>
        <h2 id="event-auth-title">
          {signup ? "Create an account" : "Sign in to publish"}
        </h2>
        <p>
          Anyone can browse. Sign in to publish events people can find by ZIP
          code.
        </p>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success-banner">
          {notice}
        </p>
      )}
      <form className="ranking-form" onSubmit={submit}>
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          Password
          <input
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={signup ? 8 : undefined}
            required
          />
        </label>
        <button type="submit" disabled={busy} className="button button-primary">
          {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
        </button>
        <button
          className="button button-quiet"
          type="button"
          disabled={busy}
          onClick={() => setSignup(!signup)}
        >
          {signup
            ? "Already registered? Sign in"
            : "New here? Create an account"}
        </button>
      </form>
    </Modal>
  );
}
