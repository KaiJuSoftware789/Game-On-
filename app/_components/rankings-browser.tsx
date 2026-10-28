"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  GAMES,
  readSessions,
  matchesGameSection,
  type GameSection,
} from "@/lib/sessions";
import {
  getSessionSnapshot,
  STORAGE_UNAVAILABLE,
  subscribeToSessions,
} from "@/lib/session-store";
import { queuesForGame, type RankingBoard } from "@/lib/rankings";
import { Icon } from "./icon";
import { GameSectionBadge } from "./game-section";
import { useRankingService } from "./rankings-connection";

const getServerSnapshot = () => null;
const EMPTY_BOARD: RankingBoard = { entries: [], total: 0, mine: null };

export default function RankingsBrowser() {
  const service = useRankingService();
  const { client, user, revision, refresh } = service;
  const gameRaw = useSyncExternalStore(
    subscribeToSessions,
    getSessionSnapshot,
    getServerSnapshot,
  );
  const library = useMemo(
    () => readSessions(gameRaw === STORAGE_UNAVAILABLE ? null : gameRaw),
    [gameRaw],
  );
  const games = useMemo(() => [...GAMES, ...library.games], [library.games]);
  const section: GameSection = "all";
  const selection = "valorant";
  const mode = "competitive";
  const [offset, setOffset] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    data: RankingBoard | null;
    error: string;
  }>();
  const choices = games.filter((game) => matchesGameSection(game.id, section));
  const game = choices.find((game) => game.id === selection) || choices[0];
  const queues = queuesForGame(game);
  const queue = queues.find((item) => item.id === mode) || queues[0];
  const queryKey = `${game?.id}:${queue?.id}:${offset}:${revision}:${user?.id || ""}`;
  const board = !queue
    ? EMPTY_BOARD
    : client
      ? response?.key === queryKey
        ? response.data
        : null
      : EMPTY_BOARD;
  const boardError = response?.key === queryKey ? response.error : "";

  useEffect(() => {
    if (!client || !queue) return;
    let active = true;
    client
      .rpc("ranking_board", {
        p_game: queue.game,
        p_queue: queue.id,
        p_offset: offset,
      })
      .then(({ data, error }) => {
        if (active)
          setResponse({
            key: queryKey,
            data: error ? null : data,
            error: error
              ? "The leaderboard couldn't be loaded. Try again in a moment."
              : "",
          });
      });
    return () => {
      active = false;
    };
  }, [client, queue, offset, queryKey]);

  const storageError =
    gameRaw === STORAGE_UNAVAILABLE
      ? "Browser storage is unavailable. You can still browse public ranks."
      : library.error;

  return (
    <>

      <div className="page-shell rankings-page" id="rankings">
        <section className="rankings-hero" aria-labelledby="ranking-title">
          <div>
            <span className="eyebrow">
              <Icon name="trophy" />
              THE RANK YOU PLAY AT.
            </span>
            <h1 id="ranking-title">
              Your games.
              <br />
              <span className="accent">Your in-game ranks.</span>
            </h1>

          </div>
          <div className="ranking-hero-mark" aria-hidden="true">
            <Icon name="trophy" />
            <span>
              EARNED IN GAME.
              <br />
              SHARED HERE.
            </span>
          </div>
        </section>
        {storageError && (
          <p role="alert" className="error-banner">
            {storageError}
          </p>
        )}

        <div
          className={`rankings-layout ${!queue ? "rankings-layout-empty" : ""}`}
        >
          <section className="leaderboard" aria-labelledby="board-title">
            <div className="leaderboard-heading">
              <div>
                <span className="eyebrow">IN-GAME RANK LEADERBOARD</span>
                <h2 id="board-title">
                  {game?.name || "Unofficial games"}
                  <span className="accent">.</span>
                </h2>
              </div>
              {game && <GameSectionBadge id={game.id} />}
            </div>
            {queue && (
              <p className="leaderboard-description">
                {queue.name} · Highest rank first. Players with the same tier
                share a position on this board.
              </p>
            )}
            {!game ? (
              <div className="profile-empty">
                <Icon name="gamepad" />
                <h3>Add your game.</h3>
                <p>
                  Your unofficial games appear here after you add them to your
                  game library.
                </p>
                <Link href="/profile" className="button button-outline">
                  Go to your profile
                </Link>
              </div>
            ) : !queue ? (
              <div className="profile-empty">
                <Icon name="gamepad" />
                <h3>Feature coming soon</h3>
                <p>In-game leaderboards are on the way.</p>
              </div>
            ) : boardError ? (
              <div className="profile-empty">
                <Icon name="trophy" />
                <h3>Feature coming soon</h3>
                <p>Live in-game ranks will appear here when available.</p>
                <button
                  className="button button-outline"
                  type="button"
                  onClick={refresh}
                >
                  Retry leaderboard
                </button>
              </div>
            ) : !board ? (
              <p className="ranking-loading" role="status">
                Loading in-game ranks…
              </p>
            ) : !board.entries.length ? (
              <div className="profile-empty">
                <Icon name="trophy" />
                <h3>Feature coming soon</h3>
                <p>
                  Live in-game leaderboards are on the way, starting with
                  VALORANT.
                </p>
              </div>
            ) : (
              <>
                {client && board.mine && (
                  <div className="your-ranking">
                    <span className="rank-number">#{board.mine.position}</span>
                    <div>
                      <strong>Your position on this board</strong>
                      <small>Synced in-game rank</small>
                    </div>
                    <strong>{board.mine.rank_name}</strong>
                  </div>
                )}
                <div className="leaderboard-table-wrap">
                  <table className="leaderboard-table">
                    <caption className="sr-only">
                      {game.name} · {queue.name} · {client ? "Public" : "Local"}{" "}
                      in-game ranks
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Position</th>
                        <th scope="col">Player</th>
                        <th scope="col">In-game rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.entries.map((entry) => (
                        <tr
                          key={entry.player_id}
                          className={
                            entry.player_id === user?.id ||
                            entry.player_id === "local-you"
                              ? "ranking-you"
                              : ""
                          }
                        >
                          <td>
                            <span
                              className={`rank-number ${entry.position <= 3 ? "rank-top" : ""}`}
                            >
                              <span>#{entry.position}</span>
                            </span>
                          </td>
                          <td>
                            <div className="ranked-player">
                              <span className="avatar" aria-hidden="true">
                                {entry.username.slice(0, 2).toUpperCase()}
                              </span>
                              <div>
                                <strong>{entry.username}</strong>
                                <span>
                                  {entry.player_id === "local-you"
                                    ? "You · Local only"
                                    : entry.player_id === user?.id
                                      ? "You"
                                      : "Player"}
                                </span>
                                <small>
                                  Updated{" "}
                                  {new Date(
                                    entry.updated_at,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    timeZone: "UTC",
                                  })}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td className="ranking-score">
                            <strong>{entry.rank_name}</strong>
                            <span>Synced in-game rank</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="leaderboard-footer">
                  <span>
                    {client
                      ? `${offset + 1}–${Math.min(offset + 25, board.total)} of ${board.total} players`
                      : "Visible only in this browser"}
                  </span>
                  {client && board.total > 25 && (
                    <div>
                      <button
                        className="button button-quiet"
                        type="button"
                        disabled={!offset}
                        onClick={() => setOffset(Math.max(0, offset - 25))}
                      >
                        Previous
                      </button>
                      <button
                        className="button button-quiet"
                        type="button"
                        disabled={offset + 25 >= board.total}
                        onClick={() => setOffset(offset + 25)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
          {queue && (
            <aside className="ranking-panel">
              <span className="eyebrow">VALORANT · YOUR RIOT ID</span>
              <h2>Your rank starts in game.</h2>
              <p>
                Save your Name#Tag on your profile. Live VALORANT ranks are
                coming soon.
              </p>
              <Link
                className="button button-primary"
                href="/profile#game-accounts"
              >
                Add or view Riot ID
                <Icon name="arrow" />
              </Link>
              <p className="ranking-fine-print">
                You can change your saved game username once every three months.
              </p>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
