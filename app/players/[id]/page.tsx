import { gamingPlatforms } from "@/lib/gaming-accounts";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Game } from "@/lib/types";
import { Icon } from "@/components/icons";
import { ProfileActions } from "@/components/profile-actions";
import { ProfileFriendship } from "@/components/profile-friendship";
import { MessagePlayer } from "@/components/recent-messages";

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
  const [profile, details, selections, catalog] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profile_details").select("bio, visibility, gaming_accounts").eq("user_id", id).maybeSingle(),
    supabase.from("user_games").select("game_id").eq("user_id", id),
    supabase
      .from("games")
      .select("id, name, platform")
      .order("name")
      .returns<Game[]>(),
  ]);
  if (profile.error || details.error || selections.error || catalog.error)
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
          <div className="profile-heading-actions"><ProfileActions playerId={id} playerName={profile.data.display_name} placement="header" /></div>
          <h1>{profile.data.display_name}</h1>
          {details.data?.bio && <p className="profile-bio">{details.data.bio}</p>}
        </div>
        {details.data?.visibility !== "public" && (
          <span className="profile-badge">Private profile</span>
        )}
      </div>
      <section aria-labelledby="player-games">
        <MessagePlayer playerId={id} />
        <ProfileFriendship playerId={id} />
        <ProfileActions playerId={id} playerName={profile.data.display_name} />
        {!details.data ? <div className="panel empty-state"><h2>This profile is private</h2><p>This player limits who can see their bio and games.</p></div> : <>
        {gamingPlatforms.some(platform=>details.data?.gaming_accounts?.[platform.id]) && <section className="profile-gaming-accounts" aria-labelledby="gaming-accounts-heading"><h2 id="gaming-accounts-heading">Connections</h2><p className="muted">User-provided handles · Unverified</p><div className="gaming-account-grid">{gamingPlatforms.filter(platform=>details.data?.gaming_accounts?.[platform.id]).map(platform=><div className="panel gaming-account" key={platform.id}><strong>{platform.name}</strong><span>{String(details.data!.gaming_accounts[platform.id])}</span></div>)}</div></section>}
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
        </>}
      </section>
    </>
  );
}
