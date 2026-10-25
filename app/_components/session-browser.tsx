"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  GAMES,
  PLATFORMS,
  REGIONS,
  VIBES,
  SAMPLE_SESSIONS,
  filterSessions,
  readSessions,
  findGame,
  matchesGameSection,
  type Game,
  type Session,
  type SessionFilters,
} from "@/lib/sessions";
import {
  getSessionSnapshot,
  subscribeToSessions,
  STORAGE_UNAVAILABLE,
} from "@/lib/session-store";
import { Icon } from "./icon";
import { Modal } from "./modal";
import { CreateSession } from "./create-session";
import { GameEditor } from "./game-editor";
import { GameSectionBadge, GameSections } from "./game-section";

const DEFAULT_FILTERS: SessionFilters = {
  section: "all",
  query: "",
  game: "",
  platform: "",
  region: "",
  vibe: "",
  openOnly: false,
  sort: "recommended",
};
const getServerSnapshot = () => null;

function sessionTime(session: Session) {
  return session.startsAt
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(session.startsAt))
    : "Ready to play";
}

function GameArtwork({ game, large = false }: { game: Game; large?: boolean }) {
  return (
    <div
      className={`game-art game-${game.id} game-theme-${game.theme} ${game.id.startsWith("custom-") ? "game-custom" : ""} ${large ? "game-art-large" : ""}`}
      aria-hidden="true"
    >
      <div className="art-grid" />
      <span className="art-ring ring-one" />
      <span className="art-ring ring-two" />
      <span className="game-monogram">{game.mark}</span>
      <span className="game-art-caption">{game.genre}</span>
      <Icon name="gamepad" className="art-gamepad" />
    </div>
  );
}

function SessionCard({
  session,
  game,
  onOpen,
}: {
  session: Session;
  game: Game;
  onOpen: () => void;
}) {
  const spots = session.capacity - session.players;
  return (
    <article className="session-card">
      <div className="card-art">
        <GameArtwork game={game} />
        <span className="platform-badge">
          <Icon name="monitor" />
          {session.platform}
        </span>
        <span className="sample-badge">
          {session.sample ? "Sample" : "Yours"}
        </span>
      </div>
      <div className="card-body">
        <div className="card-game">
          <span>{game.name}</span>
          <span
            className={spots ? "availability" : "availability full-session"}
          >
            {spots
              ? `${spots} ${spots === 1 ? "spot" : "spots"} open`
              : "Full squad"}
          </span>
        </div>
        <h3>{session.title}</h3>
        <div className="card-tags">
          <GameSectionBadge id={game.id} />
          <span
            className={`vibe-tag ${session.vibe === "Beginner friendly" ? "beginner" : ""}`}
          >
            {session.vibe}
          </span>
          {session.voice && (
            <span className="voice-tag" title="Voice chat preferred">
              <Icon name="mic" />
              <span className="sr-only">Voice chat preferred</span>
            </span>
          )}
        </div>
        <div className="session-meta">
          <span>
            <Icon name="globe" />
            {session.region}
          </span>
          <span>
            <Icon name="clock" />
            {sessionTime(session)}
          </span>
        </div>
        <div className="card-bottom">
          <div className="host">
            <span className={`avatar avatar-${session.game}`}>
              {session.host.slice(0, 2).toUpperCase()}
            </span>
            <span>
              {session.host}
              <small>
                Hosting · {session.players}/{session.capacity} players
              </small>
            </span>
          </div>
          <button
            type="button"
            className="card-open"
            onClick={onOpen}
            aria-label={`View ${session.title}`}
          >
            <Icon name="arrow" />
          </button>
        </div>
      </div>
    </article>
  );
}

function SessionDetails({
  session,
  game,
  onClose,
}: {
  session: Session;
  game: Game;
  onClose: () => void;
}) {
  return (
    <Modal titleId="session-title" onClose={onClose} className="details-modal">
      <GameArtwork game={game} large />
      <div className="detail-body">
        <span className="eyebrow">
          {game.name} · {session.sample ? "SAMPLE SESSION" : "YOUR SESSION"}
        </span>
        <h2 id="session-title">{session.title}</h2>
        <GameSectionBadge id={game.id} />
        <p className="detail-description">
          {session.description ||
            "The host hasn't added a plan yet. Good company is a good start."}
        </p>
        <dl className="detail-grid">
          <div>
            <dt>Hosted by</dt>
            <dd>{session.host}</dd>
          </div>
          <div>
            <dt>Players</dt>
            <dd>
              {session.players} / {session.capacity}
              {session.players === session.capacity
                ? " · Full"
                : " · Open spots"}
            </dd>
          </div>
          <div>
            <dt>Platform</dt>
            <dd>{session.platform}</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>{session.region}</dd>
          </div>
          <div>
            <dt>Play style</dt>
            <dd>{session.vibe}</dd>
          </div>
          <div>
            <dt>Starts</dt>
            <dd>{sessionTime(session)}</dd>
          </div>
        </dl>
        <p className="detail-voice">
          <Icon name="mic" />
          {session.voice ? "Voice chat preferred" : "No microphone needed"}
        </p>
        <div className="local-note">
          <Icon name="monitor" />
          <p>
            {session.sample
              ? "This is a sample session to explore. It isn't a live lobby and can't be joined."
              : "Saved in this browser. Other players can't see or join this session yet."}
          </p>
        </div>
        <button
          type="button"
          className="button button-primary detail-done"
          onClick={onClose}
        >
          Back to sessions
          <Icon name="arrow" />
        </button>
      </div>
    </Modal>
  );
}

export default function SessionBrowser() {
  const snapshot = useSyncExternalStore(
    subscribeToSessions,
    getSessionSnapshot,
    getServerSnapshot,
  );
  const stored = useMemo(
    () => readSessions(snapshot === STORAGE_UNAVAILABLE ? null : snapshot),
    [snapshot],
  );
  const [filters, setFilters] = useState<SessionFilters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"all" | "mine">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showGameEditor, setShowGameEditor] = useState(false);
  const [selected, setSelected] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  const games = useMemo(() => [...GAMES, ...stored.games], [stored.games]);
  const sessions = useMemo(
    () =>
      filterSessions(
        view === "mine"
          ? stored.sessions
          : [...stored.sessions, ...SAMPLE_SESSIONS],
        filters,
        games,
      ),
    [stored.sessions, filters, view, games],
  );
  const activeFilters = !!(
    filters.section !== "all" ||
    filters.query ||
    filters.game ||
    filters.platform ||
    filters.region ||
    filters.vibe ||
    filters.openOnly
  );
  const storageError =
    snapshot === STORAGE_UNAVAILABLE
      ? "Browser storage is unavailable. You can explore sample sessions, but saving a session requires site storage."
      : stored.error;

  function updateFilter<K extends keyof SessionFilters>(
    name: K,
    value: SessionFilters[K],
  ) {
    setFilters((previous) => ({ ...previous, [name]: value }));
  }
  function selectView(next: "all" | "mine") {
    setView(next);
    setFilters(DEFAULT_FILTERS);
  }
  function onCreated(session: Session) {
    setShowCreate(false);
    setView("mine");
    setFilters(DEFAULT_FILTERS);
    setNotice(
      `“${session.title}” is saved. Find it in Your sessions on this browser.`,
    );
  }

  return (
    <>
      <a className="skip-link" href="#sessions">
        Skip to sessions
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link
            className="brand"
            href="/"
            aria-label="Game On home"
            onClick={() => selectView("all")}
          >
            <span className="brand-mark">
              <Icon name="gamepad" />
            </span>
            game<span className="brand-on">on</span>
            <span className="brand-dot">.</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/events">Local events</Link>
            <a
              href="#sessions"
              onClick={() => selectView("all")}
              className={view === "all" ? "nav-active" : ""}
            >
              Discover
            </a>
            <a
              href="#sessions"
              onClick={() => selectView("mine")}
              className={view === "mine" ? "nav-active" : ""}
            >
              Your sessions
              <span className="nav-count">{stored.sessions.length}</span>
            </a>
            <Link href="/profile">Your profile</Link>
            <Link href="/rankings">Rankings</Link>
          </nav>
          <button
            type="button"
            className="button button-primary header-create"
            onClick={() => setShowCreate(true)}
          >
            <Icon name="plus" />
            <span>Create session</span>
          </button>
        </div>
      </header>
      <main className="page-shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="status-dot" /> LESS SOLO. MORE SQUAD.
            </span>
            <h1 id="hero-title">
              Your people.
              <br />
              Your game.<span className="accent"> Game on.</span>
            </h1>
            <p>
              Find players who match your vibe.
              <br className="desktop-break" /> Make a plan. Turn a good game
              into a great night.
            </p>
            <div className="hero-actions">
              <a href="#sessions" className="button button-primary">
                Find your squad
                <Icon name="arrow" />
              </a>
              <button
                type="button"
                className="button button-text"
                onClick={() => setShowCreate(true)}
              >
                <Icon name="plus" />
                Host a session
              </button>
            </div>
            <div className="hero-footnote">
              <Icon name="spark" />
              <span>All skill levels. All kinds of players.</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-outer" />
            <div className="orbit orbit-inner" />
            <span className="orbit-star star-one">✦</span>
            <span className="orbit-star star-two">+</span>
            <div className="play-tile">
              <div className="tile-top">
                <span>PLAYER 01</span>
                <span>↗</span>
              </div>
              <Icon name="gamepad" />
              <div className="tile-bottom">
                <span>
                  GOOD GAMES.
                  <br />
                  BETTER COMPANY.
                </span>
                <span>✦</span>
              </div>
            </div>
            <div className="squad-sticker">
              <span className="sticker-icon">
                <Icon name="players" />
              </span>
              <span>
                Room for one more.<small>That could be you.</small>
              </span>
            </div>
          </div>
        </section>

        <section
          id="sessions"
          className="sessions-section"
          aria-labelledby="sessions-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIND YOUR NEXT GOOD GAME</span>
              <h2 id="sessions-title">
                {view === "mine" ? "Your sessions" : "Discover sessions"}
                <span className="heading-dot">.</span>
              </h2>
            </div>
            <span className="demo-label">
              <Icon name="monitor" />
              Local preview
            </span>
          </div>
          <p className="preview-note">
            Explore sample squads or create your own. Your sessions stay in this
            browser until online play is connected.
          </p>
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
          {storageError && (
            <p role="alert" className="error-banner">
              {storageError}
            </p>
          )}
          <div className="browse-toolbar">
            <div className="view-tabs" aria-label="Session collection">
              <button
                type="button"
                aria-pressed={view === "all"}
                onClick={() => selectView("all")}
              >
                Explore sessions
              </button>
              <button
                type="button"
                aria-pressed={view === "mine"}
                onClick={() => selectView("mine")}
              >
                Your sessions<span>{stored.sessions.length}</span>
              </button>
            </div>
            <label className="search-field">
              <Icon name="search" />
              <span className="sr-only">Search sessions</span>
              <input
                type="search"
                placeholder="Search games, sessions, or players"
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
              />
            </label>
          </div>
          <div className="game-section-heading">
            <GameSections
              value={filters.section || "all"}
              onChange={(section) =>
                setFilters((previous) => ({ ...previous, section, game: "" }))
              }
            />
            <p>
              Official games are supported by Game On. Unofficial games are
              added by players.
            </p>
          </div>
          <div className="game-library-toolbar">
            <div className="game-filters" aria-label="Filter by game">
              <button
                type="button"
                aria-pressed={!filters.game}
                onClick={() => updateFilter("game", "")}
              >
                <Icon name="gamepad" />
                All games
              </button>
              {games
                .filter((game) => matchesGameSection(game.id, filters.section))
                .map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    aria-pressed={filters.game === game.id}
                    onClick={() => updateFilter("game", game.id)}
                  >
                    <span className={`game-dot dot-theme-${game.theme}`} />
                    <span className="game-filter-name" title={game.name}>
                      {game.name}
                    </span>
                  </button>
                ))}
            </div>
            <button
              type="button"
              className="button button-outline game-library-button"
              onClick={() => setShowGameEditor(true)}
            >
              <Icon name="plus" />
              Add game
            </button>
          </div>
          {filters.section === "unofficial" && stored.games.length === 0 && (
            <div className="unofficial-intro">
              <Icon name="gamepad" />
              <div>
                <strong>Your next game belongs here.</strong>
                <p>
                  Add a multiplayer game to start the Unofficial collection.
                </p>
              </div>
              <button
                type="button"
                className="button button-outline"
                onClick={() => setShowGameEditor(true)}
              >
                Add your first game
              </button>
            </div>
          )}
          <div className="filter-row">
            <div className="select-filters">
              <Icon name="sliders" />
              <label>
                <span className="sr-only">Filter by platform</span>
                <select
                  value={filters.platform}
                  onChange={(event) =>
                    updateFilter("platform", event.target.value)
                  }
                >
                  <option value="">All platforms</option>
                  {PLATFORMS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by region</span>
                <select
                  value={filters.region}
                  onChange={(event) =>
                    updateFilter("region", event.target.value)
                  }
                >
                  <option value="">All regions</option>
                  {REGIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by play style</span>
                <select
                  value={filters.vibe}
                  onChange={(event) => updateFilter("vibe", event.target.value)}
                >
                  <option value="">All play styles</option>
                  {VIBES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.openOnly}
                onChange={(event) =>
                  updateFilter("openOnly", event.target.checked)
                }
              />
              Open spots only
            </label>
          </div>
          <div className="results-toolbar">
            <p role="status" aria-live="polite">
              <strong>{sessions.length}</strong>{" "}
              {sessions.length === 1 ? "session" : "sessions"}
              {view === "mine" ? " on this browser" : " to explore"}
              {activeFilters && (
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  Clear filters
                </button>
              )}
            </p>
            <label className="sort-field">
              Sort by
              <select
                value={filters.sort}
                onChange={(event) =>
                  updateFilter(
                    "sort",
                    event.target.value as SessionFilters["sort"],
                  )
                }
              >
                <option value="recommended">Recommended</option>
                <option value="newest">Newest first</option>
                <option value="soonest">Starting soon</option>
              </select>
            </label>
          </div>
          {sessions.length ? (
            <div className="sessions-grid">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  game={findGame(session.game, games)}
                  onOpen={() => setSelected(session)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                <Icon name={activeFilters ? "search" : "gamepad"} />
              </span>
              <h3>
                {activeFilters
                  ? "No squads found. Yet."
                  : "Your next good game starts here."}
              </h3>
              <p>
                {activeFilters
                  ? "Try a different game or loosen up your filters. Your people are out there."
                  : "Pick a game, set the vibe, and create your first session."}
              </p>
              {activeFilters ? (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setShowCreate(true)}
                >
                  <Icon name="plus" />
                  Create your first session
                </button>
              )}
              {filters.game && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setShowCreate(true)}
                >
                  <Icon name="plus" />
                  Create a session
                </button>
              )}
            </div>
          )}
          <div className="host-callout">
            <div className="callout-icon">
              <Icon name="players" />
            </div>
            <div>
              <h3>Your game. Your kind of squad.</h3>
              <p>Can’t find the session you’re looking for? Start one.</p>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={() => setShowCreate(true)}
            >
              Host a session
              <Icon name="plus" />
            </button>
          </div>
        </section>
        <footer className="site-footer">
          <span className="footer-brand">gameon.</span>
          <span>Good games bring people together.</span>
          <span className="footer-note">Built for the love of playing.</span>
        </footer>
      </main>
      {showCreate && (
        <CreateSession
          games={games}
          initialGame={filters.game}
          onClose={() => setShowCreate(false)}
          onCreated={onCreated}
        />
      )}
      {selected && (
        <SessionDetails
          session={selected}
          game={findGame(selected.game, games)}
          onClose={() => setSelected(null)}
        />
      )}
      {showGameEditor && (
        <GameEditor
          games={games}
          onClose={() => setShowGameEditor(false)}
          onSaved={(game) => {
            setShowGameEditor(false);
            setView("all");
            setFilters({
              ...DEFAULT_FILTERS,
              section: "unofficial",
              game: game.id,
            });
            setNotice(
              `“${game.name}” is saved in your game library and ready for new sessions.`,
            );
          }}
        />
      )}
    </>
  );
}
