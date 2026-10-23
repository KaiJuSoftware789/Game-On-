import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/types";
import { Icon } from "@/components/icons";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  const supabase = await createClient();
  const [profile, selections, catalog] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("user_games").select("game_id").eq("user_id", id),
    supabase
      .from("games")
      .select("id, name, platform")
      .order("name")
      .returns<Game[]>(),
  ]);
  if (profile.error || selections.error || catalog.error)
    return (
      <div className="panel empty-state" role="alert">
        <h1>Profile couldn’t be loaded</h1>
        <p>Please try again in a moment.</p>
        <Link
          href={`/players/${id}`}
          className="button secondary"
          prefetch={false}
        >
          Try again
        </Link>
      </div>
    );
  if (!profile.data) notFound();
  const selectedIds = new Set(
    (selections.data ?? []).map((selection) => selection.game_id),
  );
  const games = (catalog.data ?? []).filter((game) => selectedIds.has(game.id));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PUBLIC PLAYER PROFILE</div>
          <h1>{profile.data.display_name}</h1>
          <p>
            Find a game you have in common. Start your next session together.
          </p>
        </div>
        <span className="profile-badge">
          <Icon name="globe" />
          Public profile
        </span>
      </div>
      <section aria-labelledby="player-games">
        <div className="games-heading">
          <h2 id="player-games">
            Games I play <span className="count-badge">{games.length}</span>
          </h2>
        </div>
        {games.length ? (
          <div className="game-grid">
            {games.map((game, index) => (
              <article
                key={game.id}
                className={`game-card game-color-${index % 5}`}
              >
                <span className="game-art" aria-hidden="true">
                  <span className="game-monogram">
                    {game.name
                      .split(/[\s-]+/)
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 3)}
                  </span>
                  <Icon name="game" />
                </span>
                <span className="game-card-content">
                  <strong>{game.name}</strong>
                  <small>{game.platform}</small>
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel empty-state">
            <span className="empty-icon">
              <Icon name="game" />
            </span>
            <h2>No games selected yet</h2>
            <p>This player hasn’t added any games to their lineup.</p>
          </div>
        )}
      </section>
      <Link className="button secondary profile-back" href="/">
        Explore live tickets
        <Icon name="arrow" />
      </Link>
    </>
  );
}
