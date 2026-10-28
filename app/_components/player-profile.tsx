"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  GAMES,
  findGame,
  matchesGameSection,
  readSessions,
  type GameSection,
} from "@/lib/sessions";
import {
  getSessionSnapshot,
  STORAGE_UNAVAILABLE,
  subscribeToSessions,
} from "@/lib/session-store";
import {
  readProfile,
  STAT_FIELDS,
  type Achievement,
  type PlayerStats,
} from "@/lib/profile";
import { getProfileSnapshot, subscribeToProfile } from "@/lib/profile-store";
import { Icon } from "./icon";
import { GameAccountPanel } from "./rankings-account";
import { GameEditor } from "./game-editor";
import { GameOptions, GameSectionBadge, GameSections } from "./game-section";
import {
  AchievementEditor,
  ProfileEditor,
  StatsEditor,
} from "./profile-editors";

const getServerSnapshot = () => null;
type Editor =
  | { type: "profile" }
  | { type: "stats"; existing?: PlayerStats }
  | { type: "achievement"; existing?: Achievement }
  | { type: "game" }
  | null;

export default function PlayerProfile() {
  const raw = useSyncExternalStore(
    subscribeToProfile,
    getProfileSnapshot,
    getServerSnapshot,
  );
  const libraryRaw = useSyncExternalStore(
    subscribeToSessions,
    getSessionSnapshot,
    getServerSnapshot,
  );
  const saved = useMemo(
    () => readProfile(raw === STORAGE_UNAVAILABLE ? null : raw),
    [raw],
  );
  const library = useMemo(
    () => readSessions(libraryRaw === STORAGE_UNAVAILABLE ? null : libraryRaw),
    [libraryRaw],
  );
  const games = useMemo(() => [...GAMES, ...library.games], [library.games]);
  const profile = saved.profile;
  const [editor, setEditor] = useState<Editor>(null);
  const [section, setSection] = useState<GameSection>("all");
  const [gameFilter, setGameFilter] = useState("");
  const [notice, setNotice] = useState("");
  const visible = (id: string) =>
    matchesGameSection(id, section) && (!gameFilter || id === gameFilter);
  const stats = profile.stats.filter((stat) => visible(stat.game));
  const achievements = profile.achievements.filter((item) =>
    visible(item.game),
  );
  const totalHours = profile.stats.reduce(
    (sum, stat) => sum + (stat.hours ?? 0),
    0,
  );
  const gameCount = new Set([
    ...profile.stats.map((stat) => stat.game),
    ...profile.achievements.map((item) => item.game),
  ]).size;
  const storageError =
    raw === STORAGE_UNAVAILABLE || libraryRaw === STORAGE_UNAVAILABLE
      ? "Browser storage is unavailable. Allow site storage to save your profile and game library."
      : saved.error || library.error;

  function onSaved() {
    setEditor(null);
    setNotice("Your profile has been updated in this browser.");
  }

  return (
    <>

      <div id="profile" className="page-shell profile-page">
        <div className="profile-page-heading">
          <span className="eyebrow">YOUR PLAYER CARD</span>
          <span className="demo-label">
            <Icon name="monitor" />
            Local profile
          </span>
        </div>
        <section className="profile-hero" aria-labelledby="profile-name">
          <div className="profile-avatar" aria-hidden="true">
            {profile.name ? (
              Array.from(profile.name).slice(0, 2).join("").toUpperCase()
            ) : (
              <Icon name="gamepad" />
            )}
          </div>
          <div className="profile-intro">
            <span className="eyebrow">GOOD GAMES. GREAT STORIES.</span>
            <h1 id="profile-name">
              {profile.name || "Your player profile"}
              <span className="accent">.</span>
            </h1>
            <p>
              {profile.bio ||
                "Every game has a story. Show your stats, celebrate your wins, and remember your personal bests."}
            </p>
          </div>
          <button
            type="button"
            className="button button-outline"
            onClick={() => setEditor({ type: "profile" })}
          >
            Edit profile
            <Icon name="edit" />
          </button>
        </section>
        <p className="profile-scope-note">
          <Icon name="monitor" />
          Only visible in this browser. Stats and achievements are
          self-reported; game accounts aren’t connected.
        </p>
        {storageError && (
          <p role="alert" className="error-banner">
            {storageError}
          </p>
        )}
        {notice && (
          <div className="success-banner" role="status">
            <Icon name="check" />
            <span>{notice}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss confirmation"
              onClick={() => setNotice("")}
            >
              <Icon name="close" />
            </button>
          </div>
        )}
        <dl className="profile-overview">
          <div>
            <dt>
              <Icon name="gamepad" />
              Games on your profile
            </dt>
            <dd>{gameCount}</dd>
          </div>
          <div>
            <dt>
              <Icon name="clock" />
              Total hours logged
            </dt>
            <dd>
              {totalHours.toLocaleString("en-US", { maximumFractionDigits: 1 })}
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="trophy" />
              Achievements & milestones
            </dt>
            <dd>{profile.achievements.length}</dd>
          </div>
        </dl>
        <div className="profile-filters">
          <GameSections
            value={section}
            onChange={(value) => {
              setSection(value);
              setGameFilter("");
            }}
          />
          <label className="field">
            <span className="sr-only">Filter profile by game</span>
            <select
              value={gameFilter}
              onChange={(event) => setGameFilter(event.target.value)}
            >
              <option value="">All games</option>
              <GameOptions
                games={games.filter((game) =>
                  matchesGameSection(game.id, section),
                )}
              />
            </select>
          </label>
          {(section !== "all" || gameFilter) && (
            <button
              type="button"
              className="button button-quiet"
              onClick={() => {
                setSection("all");
                setGameFilter("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        {section !== "unofficial" &&
          (!gameFilter || gameFilter === "valorant") && (
            <section
              id="game-accounts"
              className="profile-section"
              aria-labelledby="game-accounts-title"
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">YOUR IN-GAME IDENTITY</span>
                  <h2 id="game-accounts-title">
                    Game accounts<span className="accent">.</span>
                  </h2>
                </div>
              </div>
              <p className="profile-section-note">
                Starting with VALORANT. Your game username can be changed once
                every three months.
              </p>
              <GameAccountPanel />
            </section>
          )}
        <section className="profile-section" aria-labelledby="stats-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TIME WELL PLAYED</span>
              <h2 id="stats-title">
                Your game stats<span className="accent">.</span>
              </h2>
            </div>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setEditor({ type: "stats" })}
            >
              <Icon name="plus" />
              Add stats
            </button>
          </div>
          <p className="profile-section-note">
            Hours, assists, kills. Track the numbers that matter to your game.
          </p>
          {stats.length ? (
            <div className="profile-stats-grid">
              {stats.map((stat) => {
                const game = findGame(stat.game, games);
                return (
                  <article
                    className="profile-stat-card"
                    key={stat.game}
                    aria-label={`${game.name} stats`}
                  >
                    <div className="profile-card-heading">
                      <span
                        className={`profile-game-mark game-theme-${game.theme}`}
                        aria-hidden="true"
                      >
                        {game.mark}
                      </span>
                      <div>
                        <h3>{game.name}</h3>
                        <GameSectionBadge id={stat.game} />
                      </div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Edit ${game.name} stats`}
                        onClick={() =>
                          setEditor({ type: "stats", existing: stat })
                        }
                      >
                        <Icon name="edit" />
                      </button>
                    </div>
                    <dl className="game-stat-values">
                      {STAT_FIELDS.map(({ id, label }) => (
                        <div key={id}>
                          <dt>{label}</dt>
                          <dd>
                            {stat[id] === null ? (
                              <span aria-label="Not recorded">—</span>
                            ) : (
                              stat[id].toLocaleString("en-US", {
                                maximumFractionDigits: 1,
                              })
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <span className="self-reported">Self-reported</span>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="profile-empty">
              <Icon name="gamepad" />
              <h3>
                {profile.stats.length
                  ? "No stats in this selection."
                  : "Your next milestone starts here."}
              </h3>
              <p>
                {profile.stats.length
                  ? "Choose another section or game to see your stats."
                  : "Add stats for a favorite game. You can update your totals whenever you play."}
              </p>
            </div>
          )}
        </section>
        <section
          className="profile-section"
          aria-labelledby="achievements-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">MOMENTS WORTH CELEBRATING</span>
              <h2 id="achievements-title">
                Notable achievements<span className="accent">.</span>
              </h2>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={() => setEditor({ type: "achievement" })}
            >
              <Icon name="plus" />
              Add achievement
            </button>
          </div>
          <p className="profile-section-note">
            Game achievements and personal milestones, big or small.
          </p>
          {achievements.length ? (
            <div className="achievement-grid">
              {achievements.map((achievement) => {
                const game = findGame(achievement.game, games);
                return (
                  <article
                    className="achievement-card"
                    key={achievement.id}
                    aria-label={achievement.title}
                  >
                    <div
                      className={`achievement-symbol ${achievement.kind === "Personal milestone" ? "personal" : ""}`}
                    >
                      <Icon
                        name={
                          achievement.kind === "Personal milestone"
                            ? "spark"
                            : "trophy"
                        }
                      />
                    </div>
                    <div className="achievement-copy">
                      <span className="achievement-kind">
                        {achievement.kind}
                      </span>
                      <h3>{achievement.title}</h3>
                      <div className="achievement-game">
                        <span>{game.name}</span>
                        <GameSectionBadge id={achievement.game} />
                      </div>
                      {achievement.description && (
                        <p>{achievement.description}</p>
                      )}
                      <div className="achievement-date">
                        {achievement.earnedOn && (
                          <time dateTime={achievement.earnedOn}>
                            {new Intl.DateTimeFormat("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "UTC",
                            }).format(new Date(achievement.earnedOn))}{" "}
                            ·{" "}
                          </time>
                        )}
                        Self-reported
                      </div>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit ${achievement.title}`}
                      onClick={() =>
                        setEditor({
                          type: "achievement",
                          existing: achievement,
                        })
                      }
                    >
                      <Icon name="edit" />
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="profile-empty">
              <Icon name="trophy" />
              <h3>
                {profile.achievements.length
                  ? "No achievements in this selection."
                  : "Your wins deserve a place."}
              </h3>
              <p>
                {profile.achievements.length
                  ? "Choose another section or game to find your milestones."
                  : "First victory? A thousand assists? A challenge you set yourself? Add your first achievement."}
              </p>
            </div>
          )}
        </section>
        <div className="host-callout">
          <div className="callout-icon">
            <Icon name="gamepad" />
          </div>
          <div>
            <h3>Play something off the list?</h3>
            <p>
              Add it to Unofficial games, then track your stats and
              achievements.
            </p>
          </div>
          <button
            type="button"
            className="button button-outline"
            onClick={() => setEditor({ type: "game" })}
          >
            Add game
            <Icon name="plus" />
          </button>
        </div>

      </div>
      {editor?.type === "profile" && (
        <ProfileEditor
          profile={profile}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      )}
      {editor?.type === "stats" && (
        <StatsEditor
          games={
            editor.existing
              ? games
              : games.filter(
                  (game) =>
                    !profile.stats.some((stat) => stat.game === game.id),
                )
          }
          existing={editor.existing}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      )}
      {editor?.type === "achievement" && (
        <AchievementEditor
          games={games}
          existing={editor.existing}
          onClose={() => setEditor(null)}
          onSaved={onSaved}
        />
      )}
      {editor?.type === "game" && (
        <GameEditor
          games={games}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setNotice(
              "Your unofficial game is ready for stats, achievements, and sessions.",
            );
          }}
        />
      )}
    </>
  );
}
