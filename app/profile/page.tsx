import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  redirect(user ? `/players/${user.id}` : "/account?next=/profile");
}
