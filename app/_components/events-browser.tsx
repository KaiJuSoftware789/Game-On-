"use client";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { GAMES, readSessions, type GameSection } from "@/lib/sessions";
import {
  getSessionSnapshot,
  STORAGE_UNAVAILABLE,
  subscribeToSessions,
} from "@/lib/session-store";
import { getProfileSnapshot, subscribeToProfile } from "@/lib/profile-store";
import { readProfile } from "@/lib/profile";
import { getEventSnapshot, subscribeToEvents } from "@/lib/event-store";
import {
  EVENT_KINDS,
  EVENT_RADII,
  eventDate,
  eventFromShare,
  matchesEvent,
  nearbyEvents,
  parseLocalEvent,
  readEvents,
  validZip,
  type ZipLocation,
} from "@/lib/local-events";
import { Icon } from "./icon";
import { GameSections, GameSectionBadge } from "./game-section";
import { CreateLocalEvent } from "./create-local-event";
import { LocalEventDetails, type DisplayEvent } from "./local-event-details";
import { useEventConnection } from "./events-connection";
import { EventSignIn } from "./event-sign-in";
const getServerSnapshot = () => null;
type SearchResult = {
  key: string;
  location: ZipLocation | null;
  events: DisplayEvent[];
  total: number;
  error: string;
  available: boolean;
};

function EventCard({
  item,
  onOpen,
}: {
  item: DisplayEvent;
  onOpen: () => void;
}) {
  const { event } = item;
  const stamp = new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone,
    month: "short",
    day: "numeric",
  })
    .format(new Date(event.startsAt))
    .split(" ");
  return (
    <article className="local-event-card">
      <div className={`local-event-art game-theme-${event.game.theme}`}>
        <span className="event-type-label">
          <Icon name={event.kind === "Tournament" ? "trophy" : "gamepad"} />
          {event.kind}
        </span>
        <span className="local-event-monogram" aria-hidden="true">
          {event.game.mark}
        </span>
        <div className="event-date-stamp">
          <span>{stamp[0]}</span>
          <strong>{stamp[1]}</strong>
        </div>
      </div>
      <div className="local-event-card-body">
        <div className="event-card-game">
          <span>{event.game.name}</span>
          <GameSectionBadge id={event.game.id} />
        </div>
        <h3>{event.title}</h3>
        <p className="event-card-when">
          <Icon name="calendar" />
          {eventDate(event)}
        </p>
        <p className="event-card-venue">
          <Icon name="pin" />
          <span>
            {event.venue}
            <small>
              {event.location.city}, {event.location.state}
              {item.distance !== undefined
                ? ` · ~${item.distance < 1 ? "<1" : Math.round(item.distance)} mi away`
                : ""}
            </small>
          </span>
        </p>
        <div className="event-card-footer">
          <span>
            {event.status === "cancelled"
              ? "Cancelled"
              : item.source === "public"
                ? "Public event"
                : item.source === "local"
                  ? "Your local event"
                  : "Saved invitation"}
            <small>Hosted by {event.host}</small>
          </span>
          <button
            type="button"
            className="button button-outline"
            onClick={onOpen}
            aria-label={`View ${event.title}`}
          >
            Details
            <Icon name="arrow" />
          </button>
        </div>
      </div>
    </article>
  );
}
export default function EventsBrowser() {
  const service = useEventConnection();
  const raw = useSyncExternalStore(
    subscribeToEvents,
    getEventSnapshot,
    getServerSnapshot,
  );
  const libraryRaw = useSyncExternalStore(
    subscribeToSessions,
    getSessionSnapshot,
    getServerSnapshot,
  );
  const profileRaw = useSyncExternalStore(
    subscribeToProfile,
    getProfileSnapshot,
    getServerSnapshot,
  );
  const saved = useMemo(
    () => readEvents(raw === STORAGE_UNAVAILABLE ? null : raw),
    [raw],
  );
  const library = useMemo(
    () => readSessions(libraryRaw === STORAGE_UNAVAILABLE ? null : libraryRaw),
    [libraryRaw],
  );
  const profile = useMemo(
    () => readProfile(profileRaw === STORAGE_UNAVAILABLE ? null : profileRaw),
    [profileRaw],
  );
  const games = useMemo(() => [...GAMES, ...library.games], [library.games]);
  const [view, setView] = useState<"nearby" | "mine">("nearby"),
    [zip, setZip] = useState(""),
    [radius, setRadius] = useState(25);
  const [search, setSearch] = useState<{ zip: string; radius: number } | null>(
      null,
    ),
    [zipError, setZipError] = useState("");
  const [kind, setKind] = useState(""),
    [section, setSection] = useState<GameSection>("all"),
    [game, setGame] = useState("");
  const [revision, setRevision] = useState(0),
    [offset, setOffset] = useState(0),
    [now, setNow] = useState(0);
  const [result, setResult] = useState<SearchResult>(),
    [mine, setMine] = useState<SearchResult>();
  const [creating, setCreating] = useState(false),
    [signingIn, setSigningIn] = useState(false),
    [selected, setSelected] = useState<DisplayEvent | null>(null),
    [notice, setNotice] = useState(""),
    [linkError, setLinkError] = useState("");
  const userKey = service.user?.id || "";
  const queryKey = `${search?.zip}:${search?.radius}:${kind}:${section}:${game}:${offset}:${revision}:${userKey}`;
  const mineKey = `${revision}:${userKey}`;
  const current = result?.key === queryKey ? result : null;
  const own = mine?.key === mineKey ? mine : null;
  const filters = { kind, section, game };
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    if (!search) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      zip: search.zip,
      radius: String(search.radius),
      kind,
      section,
      game,
      offset: String(offset),
    });
    void fetch(`/api/events?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!controller.signal.aborted)
          setResult({
            key: queryKey,
            location: data.location || null,
            events: (data.events || []).map((item: DisplayEvent) => ({
              ...item,
              event: parseLocalEvent(item.event),
              source: "public",
            })),
            total: data.total || 0,
            available: !!data.available,
            error: data.error || "",
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({
            key: queryKey,
            location: null,
            events: [],
            total: 0,
            available: !!service.client,
            error:
              "Events couldn't be loaded. Check your connection and try again.",
          });
      });
    return () => controller.abort();
  }, [search, kind, section, game, offset, queryKey, service.client]);
  useEffect(() => {
    if (!service.user) return;
    const controller = new AbortController();
    void fetch("/api/events?mine=1", { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (!controller.signal.aborted)
          setMine({
            key: mineKey,
            location: null,
            events: (data.events || []).map((item: DisplayEvent) => ({
              ...item,
              event: parseLocalEvent(item.event),
              source: "public",
            })),
            total: data.total || 0,
            available: true,
            error: data.error || "",
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMine({
            key: mineKey,
            location: null,
            events: [],
            total: 0,
            available: true,
            error: "Your published events couldn't be loaded. Please retry.",
          });
      });
    return () => controller.abort();
  }, [service.user, mineKey]);
  useEffect(() => {
    let active = true;
    let linkRevision = 0;
    async function openLink() {
      const attempt = ++linkRevision;
      setLinkError("");
      try {
        if (window.location.hash.startsWith("#event=")) {
          const event = eventFromShare(window.location.hash);
          const response = await fetch(
              `/api/locations/zip?zip=${event.location.zip}`,
            ),
            location = await response.json();
          if (!response.ok) throw new Error(location.error);
          event.location = location;
          const official = GAMES.find((game) => game.id === event.game.id);
          if (official) event.game = { ...official };
          if (active && attempt === linkRevision)
            setSelected({ event, source: "shared" });
        } else {
          const id = new URL(window.location.href).searchParams.get("event");
          if (!id) return;
          const response = await fetch(
              `/api/events?event=${encodeURIComponent(id)}`,
            ),
            data = await response.json();
          if (!response.ok || data.error)
            throw new Error(data.error || "This event couldn't be loaded.");
          if (!data.available)
            throw new Error(
              "Public event sharing is coming soon. Ask the organizer for a shared event copy.",
            );
          if (!data.events?.length)
            throw new Error("This event was not found.");
          if (active && attempt === linkRevision)
            setSelected({
              ...data.events[0],
              event: parseLocalEvent(data.events[0].event),
              source: "public",
            });
        }
      } catch (cause) {
        if (active && attempt === linkRevision)
          setLinkError(
            cause instanceof Error
              ? cause.message
              : "This event link couldn't be opened.",
          );
      }
    }
    void openLink();
    window.addEventListener("hashchange", openLink);
    return () => {
      active = false;
      window.removeEventListener("hashchange", openLink);
    };
  }, []);
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = zip.trim();
    if (!validZip(value)) {
      setZipError("Enter a five-digit U.S. ZIP code.");
      return;
    }
    setZipError("");
    setOffset(0);
    setView("nearby");
    setSearch({ zip: value, radius });
  }
  const localNearby =
    current?.location && search
      ? nearbyEvents(
          saved.events,
          current.location,
          search.radius,
          filters,
          now,
        )
      : [];
  const localMine: DisplayEvent[] = saved.events.filter((item) =>
    matchesEvent(item.event, filters),
  );
  const publicItems = (view === "mine" ? own?.events : current?.events) || [];
  const localItems =
    view === "mine" ? localMine : offset === 0 ? localNearby : [];
  const items: DisplayEvent[] = [
    ...publicItems,
    ...localItems.filter(
      (item) =>
        !publicItems.some((remote) => remote.event.id === item.event.id),
    ),
  ]
    .filter((item) =>
      view === "mine"
        ? matchesEvent(item.event, filters)
        : Date.parse(item.event.endsAt) > now,
    )
    .sort(
      (a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt),
    );
  const storageError = [raw, libraryRaw, profileRaw].includes(
    STORAGE_UNAVAILABLE,
  )
    ? "Browser storage is unavailable. You can still browse public events."
    : saved.error || library.error || profile.error;
  const searching = view === "nearby" && search && !current;
  const error = view === "mine" ? own?.error : current?.error;
  const gameNames = [
    ...new Set([
      ...games.map((game) => game.name),
      ...saved.events.map((item) => item.event.game.name),
    ]),
  ].sort();
  return (
    <>

      <div id="local-events" className="page-shell local-events-page">
        <section className="events-hero">
          <button className="button button-primary discovery-create" onClick={() => setCreating(true)}><Icon name="plus" /> Create an event</button>
          <div>
            <span className="eyebrow">
              <Icon name="pin" />
              YOUR COMMUNITY. YOUR NEXT GAME.
            </span>
            <h1>
              Good games.
              <br />
              <span className="accent">Closer to home.</span>
            </h1>
            <p>
              Find local tournaments, LAN nights, and in-person sessions. Put in
              your ZIP code and find your people.
            </p>
          </div>
          <div className="events-hero-art" aria-hidden="true">
            <div className="event-radar-ring ring-a" />
            <div className="event-radar-ring ring-b" />
            <div className="event-radar-ring ring-c" />
            <span className="radar-center">
              <Icon name="gamepad" />
            </span>
            <span className="radar-pin pin-a">
              <Icon name="trophy" />
            </span>
            <span className="radar-pin pin-b">
              <Icon name="players" />
            </span>
            <span className="radar-pin pin-c">
              <Icon name="pin" />
            </span>
            <span className="radar-caption">MEET. PLAY. REPEAT.</span>
          </div>
        </section>
        <form
          className="event-location-search"
          onSubmit={submitSearch}
          noValidate
        >
          <label className="field">
            <span>
              <Icon name="pin" />
              Your ZIP code
            </span>
            <input
              name="searchZip"
              aria-label="Your ZIP code"
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              placeholder="Enter ZIP code"
              maxLength={5}
              inputMode="numeric"
              autoComplete="postal-code"
              aria-invalid={!!zipError}
              aria-describedby={zipError ? "zip-search-error" : undefined}
            />
          </label>
          <label className="field">
            Search within
            <select
              aria-label="Search within"
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
            >
              {EVENT_RADII.map((value) => (
                <option key={value} value={value}>
                  {value} miles
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button button-primary">
            <Icon name="search" />
            Find nearby events
          </button>
          <p>U.S. ZIP codes · Approximate distance between ZIP centers</p>
          {zipError && (
            <span id="zip-search-error" className="field-error" role="alert">
              {zipError}
            </span>
          )}
        </form>
        <div className="events-service-note">
          <span>
            <Icon name="share" />
            Save an event and share its details by link.
          </span>
          {!service.client && <span>Public event feed · Coming soon</span>}
          {service.client && !service.user && (
            <button
              type="button"
              className="text-link"
              onClick={() => setSigningIn(true)}
            >
              Sign in to publish
            </button>
          )}
          {service.user && (
            <button
              type="button"
              className="text-link"
              onClick={async () => {
                const result = await service.client!.auth.signOut();
                if (result.error) setNotice("Couldn't sign out. Try again.");
              }}
            >
              Sign out
            </button>
          )}
        </div>
        {notice && (
          <p className="success-banner" role="status">
            {notice}
          </p>
        )}
        {(storageError || service.error || linkError) && (
          <p className="error-banner" role="alert">
            {storageError || service.error || linkError}
          </p>
        )}
        <section className="events-results" aria-labelledby="events-heading">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MAKE A LITTLE ROOM FOR LOCAL PLAY</span>
              <h2 id="events-heading">
                {view === "mine"
                  ? "Your events"
                  : current?.location
                    ? `Near ${current.location.city}`
                    : "Local events"}
                <span className="accent">.</span>
              </h2>
            </div>
            <div className="view-tabs" role="group" aria-label="Event view">
              <button
                type="button"
                aria-pressed={view === "nearby"}
                onClick={() => setView("nearby")}
              >
                Nearby
              </button>
              <button
                type="button"
                aria-pressed={view === "mine"}
                onClick={() => {
                  setView("mine");
                  setOffset(0);
                }}
              >
                Your events
              </button>
            </div>
          </div>
          {current?.location && view === "nearby" && (
            <p className="events-area-label">
              {current.location.city}, {current.location.state}{" "}
              {current.location.zip} · Within {search?.radius} miles
            </p>
          )}
          <div className="event-filters">
            <GameSections
              value={section}
              onChange={(value) => {
                setSection(value);
                setGame("");
                setOffset(0);
              }}
            />
            <label className="field">
              <span className="sr-only">Event type filter</span>
              <select
                aria-label="Event type filter"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All event types</option>
                {EVENT_KINDS.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="sr-only">Event game filter</span>
              <select
                aria-label="Event game filter"
                value={game}
                onChange={(event) => {
                  setGame(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All games</option>
                {gameNames.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            {(kind || section !== "all" || game) && (
              <button
                type="button"
                className="button button-quiet"
                onClick={() => {
                  setKind("");
                  setSection("all");
                  setGame("");
                  setOffset(0);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button className="text-link" type="button" onClick={refresh}>
                Retry events
              </button>
            </div>
          )}
          {searching || (view === "mine" && service.user && !own) ? (
            <p className="ranking-loading" role="status">
              Finding events…
            </p>
          ) : items.length ? (
            <div className="local-events-grid">
              {items.map((item) => (
                <EventCard
                  key={item.event.id}
                  item={item}
                  onOpen={() => setSelected(item)}
                />
              ))}
            </div>
          ) : (
            <div className="events-empty">
              <span className="events-empty-icon">
                <Icon
                  name={view === "nearby" && !search ? "pin" : "calendar"}
                />
              </span>
              <h3>
                {view === "nearby" && !search
                  ? "Your next game could be around the corner."
                  : view === "mine"
                    ? "Make the first move."
                    : "No events in this search yet."}
              </h3>
              <p>
                {view === "nearby" && !search
                  ? "Enter your ZIP code to find nearby tournaments and gaming sessions."
                  : view === "mine"
                    ? "Host an event or save a shared invitation. Your saved events appear here."
                    : "Try a wider distance, clear your filters, or host something for your community."}
              </p>
              <button
                className="button button-outline"
                type="button"
                onClick={() => setCreating(true)}
              >
                Host a local event
                <Icon name="plus" />
              </button>
            </div>
          )}
          {view === "nearby" && current && current.total > 25 && (
            <div className="event-pagination">
              <span>
                Public events {offset + 1}–
                {Math.min(offset + 25, current.total)} of {current.total}
              </span>
              <button
                className="button button-quiet"
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(offset - 25)}
              >
                Previous
              </button>
              <button
                className="button button-quiet"
                type="button"
                disabled={offset + 25 >= current.total}
                onClick={() => setOffset(offset + 25)}
              >
                Next
              </button>
            </div>
          )}
        </section>

      </div>
      {creating && (
        <CreateLocalEvent
          games={games}
          hostName={profile.profile.name}
          initialZip={search?.zip || zip}
          service={service}
          onClose={() => setCreating(false)}
          onCreated={(event, published) => {
            setCreating(false);
            setView("mine");
            setSelected({
              event,
              source: published ? "public" : "local",
              owner: true,
            });
            setNotice(
              published
                ? "Your event is public and can be found by ZIP code."
                : "Event saved. Share its link to invite people.",
            );
            refresh();
          }}
        />
      )}
      {selected && (
        <LocalEventDetails
          key={`${selected.event.id}:${selected.source}`}
          item={selected}
          saved={saved.events.some(
            (item) => item.event.id === selected.event.id,
          )}
          signedIn={!!service.user}
          now={now}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
      {signingIn && (
        <EventSignIn service={service} onClose={() => setSigningIn(false)} />
      )}
    </>
  );
}
