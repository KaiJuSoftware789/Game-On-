import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/types";
import { GamePreferences } from "@/components/game-preferences";

export default async function GamesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, name, platform")
    .order("name")
    .returns<Game[]>();
  return <GamePreferences games={data ?? []} catalogError={Boolean(error)} />;
}
