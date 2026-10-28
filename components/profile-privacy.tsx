"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ProfilePrivacy({ userId }: { userId: string }) {
 const router=useRouter();
 const [visibility,setVisibility]=useState("public");
 const [audience,setAudience]=useState("friends");
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [retry,setRetry]=useState(0);
 useEffect(()=>{let active=true; void (async()=>{try{
  const result=await createClient().from("profile_details").select("visibility,private_audience").eq("user_id",userId).single();
  if(result.error)throw result.error;
  if(active){setVisibility(result.data.visibility);setAudience(result.data.private_audience);setLoaded(true);setError("");}
 }catch{if(active)setError("Couldn’t load privacy settings.");}})();return()=>{active=false;};},[userId,retry]);
 async function save(event:FormEvent){event.preventDefault();if(busy||!loaded)return;setBusy(true);setError("");setNotice("");try{
  const result=await createClient().rpc("set_profile_privacy",{profile_visibility:visibility,audience});
  if(result.error)throw result.error;setNotice("Privacy settings saved.");router.refresh();
 }catch{setError("Couldn’t save privacy settings. Please try again.");}finally{setBusy(false);}}
 return <form className="privacy-editor" onSubmit={save}><div className="edit-profile-title"><h2>Edit profile</h2><div><label className="sr-only" htmlFor="profile-visibility">Profile mode</label><select id="profile-visibility" value={visibility} disabled={!loaded||busy} onChange={e=>{setVisibility(e.target.value);setNotice("");}}><option value="public">Public</option><option value="private">Private</option></select></div></div>
 {visibility==="private"&&<><label htmlFor="private-audience">Who can see your bio and games?</label><select id="private-audience" value={audience} disabled={busy} onChange={e=>{setAudience(e.target.value);setNotice("");}}><option value="friends">Friends and me</option><option value="only_me">Only me</option></select></>}
 <p>Your username stays visible so players can find and message you. Public profiles share your bio and games with everyone. Private profiles default to friends and you.</p>
 <button className="button secondary" disabled={!loaded||busy}>{busy?"Saving…":"Save privacy"}</button>
 {error&&<p role="alert">{error} {!loaded&&<button type="button" className="inline-button" onClick={()=>setRetry(v=>v+1)}>Retry</button>}</p>}{notice&&<p role="status">{notice}</p>}</form>;
}
