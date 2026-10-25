import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { ticketColumns, type Game, type Ticket } from "@/lib/types";
import { TicketFeed } from "@/components/ticket-feed";

export default async function Home() {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createClient();
  const [tickets, games] = await Promise.all([
    supabase
      .from("tickets")
      .select(ticketColumns)
      .eq("status", "open")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<Ticket[]>(),
    supabase
      .from("games")
      .select("id, name, platform")
      .order("name")
      .returns<Game[]>(),
  ]);
  return (
    <TicketFeed
      initialTickets={tickets.data ?? []}
      games={games.data ?? []}
      initialError={Boolean(tickets.error)}
      gamesError={Boolean(games.error)}
    />
  );
}
