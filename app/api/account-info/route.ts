import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid request." }, { status: 403 });
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    const body = await request.json();
    if (body.action === "begin") {
      const result = await client.rpc("begin_account_edit");
      if (result.error) throw new Error("Couldn’t start verification. Please retry.");
      return Response.json({ challenge: result.data }, { headers: { "Cache-Control": "no-store" } });
    }
    const { field, value, challenge, userId } = body;
    if (userId !== user.id || !["username", "email", "phone"].includes(field) || typeof value !== "string" || value.length > 254 || typeof challenge !== "string") throw new Error("Invalid account change.");
    if (field === "email" && !user.email) throw new Error("Only connected email addresses can be edited here.");
    if (body.action === "verify") {
      const result = await client.rpc("check_account_edit_primary", { challenge });
      if (result.error) return Response.json({ error: result.error.message }, { status: 403 });
      return Response.json({ verified: true });
    }
    const authorized = await client.rpc("authorize_account_edit", { challenge });
    if (authorized.error) return Response.json({ error: authorized.error.message }, { status: 403 });
    if (field === "username") {
      const result = await client.rpc("set_player_name", { new_name: value.trim() });
      if (result.error) throw new Error(result.error.message);
    } else {
      const result = await client.auth.updateUser({ [field]: value.trim() }, { emailRedirectTo: `${new URL(request.url).origin}/auth/callback?next=/account` });
      if (result.error) throw new Error("Couldn’t update your contact information. Check the value and try again.");
    }
    return Response.json({ message: field === "username" ? "Username updated." : field === "email" ? "Check your email to confirm the change." : "Check your new number for a verification code." });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "Couldn’t update your account." }, { status: 400 });
  }
}
