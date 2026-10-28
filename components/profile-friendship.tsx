"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
type Friendship={id:string;requester_id:string;status:string};
export function ProfileFriendship({playerId}:{playerId:string}){
 const {user}=useAuth();
 return user&&user.id!==playerId?<FriendshipControl key={`${user.id}:${playerId}`} userId={user.id} playerId={playerId}/>:null;
}
function FriendshipControl({userId,playerId}:{userId:string;playerId:string}){
 const router=useRouter();const [row,setRow]=useState<Friendship|null>(null);const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;void(async()=>{try{const r=await createClient().from("friendships").select("id,requester_id,status").or(`and(requester_id.eq.${userId},recipient_id.eq.${playerId}),and(requester_id.eq.${playerId},recipient_id.eq.${userId})`).maybeSingle();if(r.error)throw r.error;if(active){setRow(r.data);setLoaded(true);setError("");}}catch{if(active)setError("Couldn’t load friendship.");}})();return()=>{active=false;};},[userId,playerId,retry]);
 async function act(action:"add"|"accept"|"remove"){if(busy)return;setBusy(true);setError("");try{const c=createClient();const r=action==="add"?await c.from("friendships").insert({recipient_id:playerId}):action==="accept"?await c.rpc("accept_friend_request",{request_id:row!.id}):await c.from("friendships").delete().eq("id",row!.id);if(r.error)throw r.error;setRetry(v=>v+1);router.refresh();}catch{setError("Couldn’t update friendship. Please retry.");}finally{setBusy(false);}}
 return <div className="friend-actions">{loaded&&(!row?<button className="button secondary" disabled={busy} onClick={()=>void act("add")}>Add friend</button>:<><span>{row.status==="accepted"?"Friends":row.requester_id===userId?"Friend request sent":"Wants to be your friend"}</span>{row.status==="pending"&&row.requester_id!==userId&&<button className="button secondary" disabled={busy} onClick={()=>void act("accept")}>Accept request</button>}<button className="button quiet" disabled={busy} onClick={()=>void act("remove")}>{row.status==="accepted"?"Remove friend":row.requester_id===userId?"Cancel request":"Decline request"}</button></>)}{error&&<p role="alert">{error} <button className="inline-button" onClick={()=>setRetry(v=>v+1)}>Retry</button></p>}</div>;
}
