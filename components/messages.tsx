"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { useConversations, conversationsChanged } from "./recent-messages";
import { MessagePlayerSearch } from "./message-player-search";
import { MessagePins, PinMessage, PinConversation } from "./message-pins";
type Profile = { id: string; display_name: string };

type Message = { id: number; sender_id: string; recipient_id: string; body: string; created_at: string };

export function Messages({ recipient }: { recipient?: string }) {
  const { user, loading } = useAuth();
  return <><div className="page-heading"><div><div className="eyebrow">KEEP THE PARTY GOING</div><h1>Messages.</h1><p>Private conversations with your fellow players.</p></div></div>{loading ? <p role="status">Loading…</p> : user ? <Inbox key={user.id} userId={user.id} recipient={recipient} /> : <div className="panel empty-state"><h2>Sign in to message players</h2><Link href="/account?next=/messages" className="button primary">Sign in</Link></div>}</>;
}

function Inbox({ userId, recipient }: { userId: string; recipient?: string }) {
  const { rows: conversations, error, loading } = useConversations(userId);
  return <div className="messaging-layout"><aside className="panel conversation-list" aria-label="Conversations"><MessagePlayerSearch userId={userId} /><h2>Conversations</h2>{loading ? <p role="status">Loading…</p> : error ? <p role="alert">Couldn’t load conversations. <button className="inline-button" onClick={conversationsChanged}>Retry</button></p> : conversations.length ? conversations.map(conversation => <div key={conversation.peer_id}><Link className={`conversation ${recipient === conversation.peer_id ? "selected" : ""}`} key={conversation.peer_id} href={`/messages?to=${conversation.peer_id}`} aria-current={recipient === conversation.peer_id ? "page" : undefined}><strong>{conversation.pinned ? "★ " : ""}{conversation.display_name}</strong><span>{conversation.body}</span><small>{conversation.last_opened_at ? "Opened " + new Date(conversation.last_opened_at).toLocaleString() : "New conversation"}</small></Link><PinConversation peerId={conversation.peer_id} pinned={conversation.pinned} /></div>) : <p className="muted">No conversations yet.</p>}</aside>{recipient && recipient !== userId ? <Chat key={`${userId}-${recipient}`} userId={userId} recipient={recipient} /> : <div className="panel empty-state"><h2>{conversations.length ? "Your conversations" : "Your next teammate starts with hello."}</h2><p>{conversations.length ? "Select a conversation or search for a player in the inbox." : "Search for a player by name to start your first conversation."}</p></div>}</div>;
}

function Chat({ userId, recipient }: { userId: string; recipient: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [limit, setLimit] = useState(50);
  const [more, setMore] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; void createClient().rpc("open_conversation", { other_player: recipient }).then(({ error }) => { if (active) { if (error) setSendError("Couldn’t update recent conversations."); else conversationsChanged(); } }); return () => { active = false; }; }, [recipient, userId]);
  const bottom = useRef<HTMLDivElement>(null);
  const latest = messages.at(-1)?.id;
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    let active = true;
    let version = 0;
    const client = createClient();
    async function refresh() {
      const request = ++version;
      try {
        const [person, history] = await Promise.all([
          client.from("profiles").select("id, display_name").eq("id", recipient).maybeSingle(),
          client.from("messages").select("id, sender_id, recipient_id, body, created_at").or(`and(sender_id.eq.${userId},recipient_id.eq.${recipient}),and(sender_id.eq.${recipient},recipient_id.eq.${userId})`).order("id", { ascending: false }).limit(limit),
        ]);
        if (person.error || history.error) throw new Error("Conversation unavailable");
        if (active && request === version) {
          setProfile(person.data); setMessages((history.data ?? []).reverse()); setMore((history.data?.length ?? 0) === limit);
          setError(person.data ? "" : "This player is no longer available.");
        }
      } catch { if (active && request === version) setError("Couldn’t load this conversation. Try again."); }
      finally { if (active && request === version) setLoading(false); }
    }
    refreshRef.current = refresh;
    void refresh();
    const channel = client.channel(`chat-${userId}-${recipient}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void refresh()).subscribe();
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); refreshRef.current = null; void client.removeChannel(channel); };
  }, [userId, recipient, limit, retry]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [latest]);
  const send = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() || sending || !profile || error) return;
    setSending(true); setSendError("");
    try {
      const result = await createClient().from("messages").insert({ recipient_id: recipient, body: draft.trim() });
      if (result.error) throw result.error;
      setDraft(""); window.dispatchEvent(new Event("message-sent")); await refreshRef.current?.();
    } catch { setSendError("Message wasn’t sent. Your draft is saved here; try again."); }
    finally { setSending(false); }
  }, [draft, sending, profile, error, recipient]);
  return <div className="chat-column"><MessagePins userId={userId} recipient={recipient}><section className="panel chat-panel" aria-label="Private conversation"><header><h2>{profile?.display_name ?? "Conversation"}</h2>{profile && <Link className="text-link" href={`/players/${recipient}`}>View profile</Link>}</header>{error && <p className="notice error" role="alert">{error} <button className="inline-button" onClick={() => setRetry(retry + 1)}>Retry</button></p>}<div className="message-history" role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text">{loading ? <p role="status">Loading messages…</p> : <>{more && <button className="button quiet" onClick={() => setLimit(limit + 50)}>Load older messages</button>}{!messages.length && !error && <p className="muted">No messages yet. Say hello!</p>}{messages.map(message => <article key={message.id} className={`message-bubble ${message.sender_id === userId ? "sent" : "received"}`}><span className="sr-only">{message.sender_id === userId ? "You" : profile?.display_name}:</span><p>{message.body}</p><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time><PinMessage id={message.id} /></article>)}<div ref={bottom} /></>}</div><form onSubmit={send} className="message-compose"><label htmlFor="message-body" className="sr-only">Message</label><textarea id="message-body" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message…" maxLength={2000} rows={3} disabled={sending || !profile || Boolean(error)} required /><div><small>{draft.length}/2000</small><button className="button primary" disabled={sending || !profile || Boolean(error) || !draft.trim()}>{sending ? "Sending…" : "Send message"}</button></div>{sendError && <p role="alert" className="notice error">{sendError}</p>}</form></section></MessagePins></div>;
}
