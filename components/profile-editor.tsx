"use client";
import { useEffect,useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { gamingPlatforms, cleanGamingAccounts } from "@/lib/gaming-accounts";
type Fields={name:string;bio:string;visibility:string;audience:string;accounts:Record<string,string>};
export function ProfileEditor({userId}:{userId:string}){
 const router=useRouter();const [fields,setFields]=useState<Fields|null>(null);const [saved,setSaved]=useState<Fields|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");const [retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;void(async()=>{try{const c=createClient();const [p,d]=await Promise.all([c.from("profiles").select("display_name").eq("id",userId).single(),c.from("profile_details").select("bio,visibility,private_audience,gaming_accounts").eq("user_id",userId).single()]);if(p.error||d.error)throw new Error();if(active){const f={name:p.data.display_name,bio:d.data.bio,visibility:d.data.visibility,audience:d.data.private_audience,accounts:d.data.gaming_accounts ?? {}};setFields(f);setSaved(f);setError("");}}catch{if(active)setError("Couldn’t load your profile.");}})();return()=>{active=false;};},[userId,retry]);
 function change(key:keyof Fields,value:string){setFields(f=>f?{...f,[key]:value}:f);setNotice("");}
 const dirty=fields&&saved&&JSON.stringify(fields)!==JSON.stringify(saved);
 async function save(e:FormEvent){e.preventDefault();if(!fields||!dirty||busy)return;setBusy(true);setError("");setNotice("");try{const result=await createClient().rpc("save_my_profile",{new_name:fields.name.trim(),new_bio:fields.bio.trim(),profile_visibility:fields.visibility,audience:fields.audience,accounts:cleanGamingAccounts(fields.accounts)});if(result.error){setError(result.error.code==="P0001"?result.error.message:"Couldn’t save changes. Please try again.");return;}const next={...fields,name:fields.name.trim(),bio:fields.bio.trim(),accounts:cleanGamingAccounts(fields.accounts)};setFields(next);setSaved(next);setNotice("All changes saved.");window.dispatchEvent(new Event("profile-updated"));router.refresh();}catch{setError("Couldn’t save changes. Please try again.");}finally{setBusy(false);}}
 return <form className="unified-profile-editor" onSubmit={save}>
 <div className="edit-profile-title"><h2>Edit profile</h2><div className="profile-save-controls">{fields&&<><label className="sr-only" htmlFor="profile-visibility">Profile mode</label><select id="profile-visibility" value={fields.visibility} disabled={busy} onChange={e=>change("visibility",e.target.value)}><option value="public">Public</option><option value="private">Private</option></select></>}<button className="button primary" disabled={!dirty||busy}>{busy?"Saving…":"Save changes"}</button></div></div>
 {error&&<p role="alert" className="notice error">{error} {!fields&&<button type="button" className="inline-button" onClick={()=>setRetry(v=>v+1)}>Retry</button>}</p>}
 {notice&&<p role="status">{notice}</p>}
 {!fields&&!error&&<p role="status">Loading profile…</p>}
 {fields&&<fieldset disabled={busy}>
 <label htmlFor="username">Username</label><input id="username" required maxLength={80} value={fields.name} onChange={e=>change("name",e.target.value)} aria-describedby="username-help"/>
 <p id="username-help">3–32 characters: letters, numbers, spaces, . _ - only. No profanity.</p>
 {fields.visibility==="private"&&<><label htmlFor="private-audience">Who can see your bio and games?</label><select id="private-audience" value={fields.audience} onChange={e=>change("audience",e.target.value)}><option value="friends">Friends and me</option><option value="only_me">Only me</option></select></>}
 <p>Your username stays visible. Your profile mode controls who can see your bio, games, and gaming accounts.</p>
 <label htmlFor="bio">About you</label><textarea id="bio" rows={3} maxLength={200} value={fields.bio} onChange={e=>change("bio",e.target.value)} placeholder="Tell players a little about yourself…"/><small>{fields.bio.length}/200</small>
 <h3 className="gaming-accounts-title">Connections</h3><p>Add your handles so players can find you. These are user-provided and unverified. Clear a handle to remove it.</p>
 <div className="gaming-account-inputs">{gamingPlatforms.map(platform=><div key={platform.id}><label htmlFor={`gaming-${platform.id}`}>{platform.name}</label><input id={`gaming-${platform.id}`} value={fields.accounts[platform.id]??""} maxLength={80} placeholder={platform.example} onChange={e=>{setFields(f=>f?{...f,accounts:{...f.accounts,[platform.id]:e.target.value}}:f);setNotice("");}} /></div>)}</div>
 {dirty&&<p role="status">You have unsaved changes.</p>}
 </fieldset>}
 </form>;
}
