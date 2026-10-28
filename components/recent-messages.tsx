"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase/client";

export type Conversation = { peer_id: string; display_name: string; body: string | null; created_at: string | null; pinned: boolean; last_opened_at: string | null };
export function conversationsChanged() { window.dispatchEvent(new Event("message-sent")); }
export function useConversations(userId?: string) {
 const [state, setState] = useState<{ owner?: string; rows: Conversation[]; loading: boolean; error: boolean }>({ rows: [], loading: true, error: false });
 useEffect(() => {
  if (!userId) return;
  let active = true; let version = 0;
  const client = createClient();
  async function refresh() {
   const request = ++version;
   try { const result = await client.rpc("recent_conversations"); if(result.error) throw result.error;
    if(active && request === version) setState({owner:userId, rows:result.data ?? [], loading:false, error:false});
   } catch { if(active && request === version) setState({owner:userId,rows:[],loading:false,error:true}); }
  }
  void refresh();
  const channel=client.channel(`recent-${crypto.randomUUID()}`).on("postgres_changes",{event:"*",schema:"public",table:"messages"},()=>void refresh()).on("postgres_changes",{event:"*",schema:"public",table:"conversation_preferences"},()=>void refresh()).subscribe();
  const timer=setInterval(refresh,15000); window.addEventListener("message-sent",refresh); window.addEventListener("focus",refresh);
  return ()=>{active=false;clearInterval(timer);window.removeEventListener("message-sent",refresh);window.removeEventListener("focus",refresh);void client.removeChannel(channel);};
 },[userId]);
 return state.owner === userId && userId ? state : {rows:[],loading:Boolean(userId),error:false};
}
export function RecentMessages({onNavigate}:{onNavigate:()=>void}) {
 const {user}=useAuth(); const {rows,loading,error}=useConversations(user?.id);
 if(!user) return null;
 return <section className="recent-friends" aria-label="Recent messages"><div className="sidebar-label">PINNED & RECENT MESSAGES</div>{loading ? <p>Loading…</p> : error ? <p>Messages unavailable. <button className="inline-button" onClick={conversationsChanged}>Retry</button></p> : rows.length ? rows.slice(0,8).map(row=><Link key={row.peer_id} href={`/messages?to=${row.peer_id}`} onClick={onNavigate}><span aria-label={row.pinned ? "Pinned" : undefined}>{row.pinned ? "★" : "·"}</span>{row.display_name}</Link>) : <p>No messages yet</p>}</section>;
}
export function MessagePlayer({playerId}:{playerId:string}) {const {user}=useAuth();return user && user.id !== playerId ? <div className="friend-actions"><Link className="button primary" href={`/messages?to=${playerId}`}>Message player</Link></div> : null;}
