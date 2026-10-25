import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/types";
import { CreateTicket } from "@/components/create-ticket";

export default async function NewTicketPage() {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, name, platform")
    .order("name")
    .returns<Game[]>();
  return <CreateTicket games={data ?? []} gamesError={Boolean(error)} />;
}
