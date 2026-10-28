"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import type { SignInProvider } from "@/lib/auth-config";
import { createClient } from "@/lib/supabase/client";

const name = (provider: string) => provider.startsWith("custom:") ? "Riot Games" : provider === "email" ? "Email" : provider === "phone" ? "Phone" : provider.charAt(0).toUpperCase() + provider.slice(1);
const settings: Record<string, string> = { google: "https://myaccount.google.com/", discord: "https://discord.com/app", "custom:riot": "https://account.riotgames.com/" };

export function ManageConnections({ providers }: { providers: SignInProvider[] }) {
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await createClient().auth.getUserIdentities();
      if (result.error) throw result.error;
      setIdentities(result.data.identities);
    } catch { setError("Couldn’t load connections. Please retry."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function link(provider: SignInProvider) {
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/account");
    const result = await createClient().auth.linkIdentity({ provider: provider.id, options: {
      redirectTo: callback.href, skipBrowserRedirect: true,
      queryParams: provider.id === "google" ? { prompt: "select_account" } : provider.id === "discord" ? { prompt: "consent" } : undefined,
    } });
    if (result.error || !result.data.url) throw result.error || new Error("Couldn’t connect provider.");
    window.location.assign(result.data.url);
  }
  async function change(identity: UserIdentity, replace = false) {
    const provider = providers.find((provider) => provider.id === identity.provider);
    if (identities.length < 2) return;
    if (!window.confirm(replace ? `Change your ${name(identity.provider)} account? The current connection will be removed first. If you cancel provider sign-in, use another connected method to sign in and reconnect here.` : `Remove ${name(identity.provider)}? You’ll need another connected method to sign in.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      // Fetch again so the final-identity safeguard also covers changes in other tabs.
      const latest = await createClient().auth.getUserIdentities();
      if (latest.error || latest.data.identities.length < 2) throw new Error("Keep at least one connected sign-in method.");
      const result = await createClient().auth.unlinkIdentity(identity);
      if (result.error) throw result.error;
      setNotice(`${name(identity.provider)} disconnected.`);
      setEditing(null);
      await refresh();
      if (replace && provider) await link(provider);
    } catch (cause) {
      const code = (cause as { code?: string })?.code;
      setError(code === "manual_linking_disabled" ? "Connection management must be enabled in Supabase Auth settings." : cause instanceof Error ? cause.message : "Couldn’t update the connection. Please retry.");
    } finally { setBusy(false); }
  }
  return <section className="passwordless-section manage-connections" aria-labelledby="connections-title">
    <h3 id="connections-title">Manage Connections</h3>
    {loading ? <p role="status">Loading connections…</p> : <>
      {identities.map((identity) => {
        const social = identity.provider !== "email" && identity.provider !== "phone";
        const provider = providers.find((provider) => provider.id === identity.provider);
        return <div className="connection-entry" key={identity.identity_id}>
          <div className="passwordless-actions"><strong>{name(identity.provider)}</strong><div className="connection-actions">
            <button className="inline-button mfa-setup-link" disabled={busy} onClick={() => setEditing(editing === identity.identity_id ? null : identity.identity_id)}>{editing === identity.identity_id ? "Done" : "Edit"}</button>
            {social && <button className="inline-button" disabled={busy || identities.length < 2} title={identities.length < 2 ? "Connect another sign-in method first" : undefined} onClick={() => void change(identity)}>Remove</button>}
          </div></div>
          {editing === identity.identity_id && <div className="connection-details">
            {social ? <>
              <p>Profile details for this connection are managed by {name(identity.provider)}.</p>
              {settings[identity.provider] && <a className="inline-button" href={settings[identity.provider]} target="_blank" rel="noopener noreferrer">Edit {name(identity.provider)} account</a>}
              {provider && <button className="button secondary account-action" disabled={busy || identities.length < 2 || !provider.enabled} onClick={() => void change(identity, true)}>Change connected account</button>}
              {identities.length < 2 && <p className="muted">Connect another sign-in method before changing or removing this connection.</p>}
            </> : <p className="muted">Edit this {name(identity.provider).toLowerCase()} in Account info above.</p>}
          </div>}
        </div>;
      })}
      {providers.filter((provider) => provider.enabled && !identities.some((identity) => identity.provider === provider.id)).map((provider) => <div key={provider.id} className="connection-entry"><div className="passwordless-actions"><span>{provider.name}</span><button className="inline-button mfa-setup-link" aria-label={`Add ${provider.name} connection`} disabled={busy} onClick={() => {
        setBusy(true); setError(""); setNotice("");
        void link(provider).catch((cause) => setError((cause as { code?: string })?.code === "manual_linking_disabled" ? "Enable Manual Linking in Supabase Auth settings to connect accounts." : "Couldn’t add the connection. Please retry.")).finally(() => setBusy(false));
      }}>Add</button></div></div>)}
    </>}
    {notice && <p className="notice success" role="status">{notice}</p>}
    {error && <><p className="notice error" role="alert">{error}</p><button className="inline-button" disabled={busy} onClick={() => { setError(""); void refresh(); }}>Retry</button></>}
  </section>;
}
