import type { Game, GameSection } from "./sessions";

export const EVENT_KINDS = ["Tournament", "Gaming session"] as const;
export const EVENT_RADII = [5, 10, 25, 50] as const;
export const EVENT_TIMEZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Phoenix", "Arizona"],
  ["America/Los_Angeles", "Pacific"],
  ["America/Anchorage", "Alaska"],
  ["Pacific/Honolulu", "Hawaii"],
  ["America/Puerto_Rico", "Puerto Rico"],
  ["Pacific/Guam", "Guam"],
  ["UTC", "UTC"],
] as const;
export type ZipLocation = {
  zip: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};
export type LocalEvent = {
  id: string;
  title: string;
  kind: (typeof EVENT_KINDS)[number];
  game: Game;
  host: string;
  venue: string;
  address: string;
  location: ZipLocation;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  description: string;
  registrationUrl: string;
  createdAt: string;
  status: "scheduled" | "cancelled";
};
export type SavedEvent = { event: LocalEvent; source: "local" | "shared" };
export type EventInput = {
  title: string;
  kind: string;
  game: string;
  host: string;
  venue: string;
  address: string;
  zip: string;
  startsAt: string;
  timezone: string;
  duration: string;
  capacity: string;
  description: string;
  registrationUrl: string;
};
export type EventErrors = Partial<Record<keyof EventInput, string>>;
export type EventFilters = { kind: string; section: GameSection; game: string };
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OFFICIAL_IDS = [
  "valorant",
  "fortnite",
  "helldivers",
  "minecraft",
  "apex",
  "rocket-league",
];
const THEMES = ["coral", "violet", "gold", "sage", "copper", "sky"];
const validText = (value: unknown, min: number, max: number): value is string =>
  typeof value === "string" &&
  value.trim().length >= min &&
  value.length <= max;
const validInstant = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value));
export const validZip = (zip: string) => /^\d{5}$/.test(zip);
export function registrationLink(value: string) {
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    value.length > 500
  )
    throw new Error(
      "Use a full HTTPS registration link without login details.",
    );
  return url.href;
}

// Resolve the event's wall-clock time in its selected zone, rejecting DST gaps
// and repeated hours instead of silently scheduling an hour early/late.
export function eventInstant(value: string, timezone: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    !EVENT_TIMEZONES.some(([zone]) => zone === timezone)
  )
    throw new Error("Choose a date, time, and event time zone.");
  const nominal = Date.parse(`${value}:00Z`);
  if (
    !Number.isFinite(nominal) ||
    new Date(nominal).toISOString().slice(0, 16) !== value
  )
    throw new Error("Choose a valid event date and time.");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const wallTime = (at: number) => {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(at))
        .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  const offsets = new Set(
    [-36, 0, 36].map((hours) => {
      const at = nominal + hours * 3600000;
      return Date.parse(`${wallTime(at)}:00Z`) - at;
    }),
  );
  const candidates = [...offsets]
    .map((offset) => nominal - offset)
    .filter((at) => wallTime(at) === value);
  if (candidates.length !== 1)
    throw new Error(
      "This time is skipped or repeated by daylight saving. Choose a time outside that hour.",
    );
  return new Date(candidates[0]).toISOString();
}
export function validateEvent(
  input: EventInput,
  games: readonly Game[],
  now = Date.now(),
): EventErrors {
  const errors: EventErrors = {};
  for (const [field, min, max] of [
    ["title", 4, 80],
    ["host", 2, 32],
    ["venue", 2, 80],
    ["address", 3, 160],
    ["description", 0, 1000],
  ] as const)
    if (!validText(input[field].trim(), min, max))
      errors[field] = `Use ${min}–${max} characters.`;
  if (!EVENT_KINDS.some((kind) => kind === input.kind))
    errors.kind = "Choose an event type.";
  if (!games.some((game) => game.id === input.game))
    errors.game = "Choose a game from your library.";
  if (!validZip(input.zip.trim()))
    errors.zip = "Enter a five-digit U.S. ZIP code.";
  if (!EVENT_TIMEZONES.some(([zone]) => zone === input.timezone))
    errors.timezone = "Choose the venue’s time zone.";
  try {
    const start = Date.parse(eventInstant(input.startsAt, input.timezone));
    if (start <= now || start > now + 730 * 86400000)
      errors.startsAt = "Choose a future time within the next two years.";
  } catch (error) {
    errors.startsAt = (error as Error).message;
  }
  if (
    !/^\d+$/.test(input.capacity) ||
    Number(input.capacity) < 2 ||
    Number(input.capacity) > 1000
  )
    errors.capacity = "Choose a player limit from 2 to 1,000.";
  if (
    !/^(?:\d+)(?:\.5)?$/.test(input.duration) ||
    Number(input.duration) < 0.5 ||
    Number(input.duration) > 24
  )
    errors.duration = "Use 0.5–24 hours in half-hour steps.";
  try {
    registrationLink(input.registrationUrl);
  } catch {
    errors.registrationUrl = "Use a full HTTPS registration link.";
  }
  return errors;
}
export function makeLocalEvent(
  input: EventInput,
  games: readonly Game[],
  location: ZipLocation,
  id: string,
  now = Date.now(),
): LocalEvent {
  if (
    !UUID.test(id) ||
    location.zip !== input.zip.trim() ||
    Object.keys(validateEvent(input, games, now)).length
  )
    throw new Error("Please check the event details.");
  const startsAt = eventInstant(input.startsAt, input.timezone);
  return {
    id,
    title: input.title.trim(),
    kind: input.kind as LocalEvent["kind"],
    game: { ...games.find((game) => game.id === input.game)! },
    host: input.host.trim(),
    venue: input.venue.trim(),
    address: input.address.trim(),
    location,
    startsAt,
    endsAt: new Date(
      Date.parse(startsAt) + Number(input.duration) * 3600000,
    ).toISOString(),
    timezone: input.timezone,
    capacity: Number(input.capacity),
    description: input.description.trim(),
    registrationUrl: registrationLink(input.registrationUrl),
    createdAt: new Date(now).toISOString(),
    status: "scheduled",
  };
}

export function parseLocalEvent(value: unknown): LocalEvent {
  if (!value || typeof value !== "object") throw new Error("Invalid event.");
  const e = value as LocalEvent,
    g = e.game,
    l = e.location;
  if (
    typeof e.id !== "string" ||
    !UUID.test(e.id) ||
    !validText(e.title, 4, 80) ||
    !EVENT_KINDS.includes(e.kind) ||
    !validText(e.host, 2, 32) ||
    !validText(e.venue, 2, 80) ||
    !validText(e.address, 3, 160) ||
    !validText(e.description, 0, 1000) ||
    !validText(e.registrationUrl, 0, 500)
  )
    throw new Error("Invalid event details.");
  if (
    !g ||
    !validText(g.id, 1, 100) ||
    !/^[a-zA-Z0-9-]+$/.test(g.id) ||
    !validText(g.name, 2, 60) ||
    !validText(g.genre, 0, 40) ||
    !validText(g.mark, 1, 3) ||
    !THEMES.includes(g.theme)
  )
    throw new Error("Invalid event game.");
  if (
    !l ||
    typeof l.zip !== "string" ||
    !validZip(l.zip) ||
    !validText(l.city, 1, 100) ||
    !validText(l.state, 2, 2) ||
    !Number.isFinite(l.latitude) ||
    Math.abs(l.latitude) > 90 ||
    !Number.isFinite(l.longitude) ||
    Math.abs(l.longitude) > 180
  )
    throw new Error("Invalid event location.");
  if (
    ![e.startsAt, e.endsAt, e.createdAt].every(validInstant) ||
    Date.parse(e.endsAt) <= Date.parse(e.startsAt) ||
    Date.parse(e.endsAt) - Date.parse(e.startsAt) > 86400000 ||
    !EVENT_TIMEZONES.some(([zone]) => zone === e.timezone) ||
    !Number.isInteger(e.capacity) ||
    e.capacity < 2 ||
    e.capacity > 1000 ||
    !["scheduled", "cancelled"].includes(e.status)
  )
    throw new Error("Invalid event time or player limit.");
  return {
    id: e.id,
    title: e.title,
    kind: e.kind,
    game: {
      id: g.id,
      name: g.name,
      genre: g.genre,
      mark: g.mark,
      theme: g.theme,
    },
    host: e.host,
    venue: e.venue,
    address: e.address,
    location: {
      zip: l.zip,
      city: l.city,
      state: l.state,
      latitude: l.latitude,
      longitude: l.longitude,
    },
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    timezone: e.timezone,
    capacity: e.capacity,
    description: e.description,
    registrationUrl: registrationLink(e.registrationUrl),
    createdAt: e.createdAt,
    status: e.status,
  };
}
export function readEvents(raw: string | null): {
  events: SavedEvent[];
  error: string | null;
} {
  if (raw === null) return { events: [], error: null };
  try {
    const data = JSON.parse(raw);
    if (
      data?.version !== 1 ||
      !Array.isArray(data.events) ||
      data.events.length > 500
    )
      throw new Error();
    const seen = new Set<string>();
    const events = data.events.map((item: SavedEvent) => {
      if (!item || !["local", "shared"].includes(item.source))
        throw new Error();
      const event = parseLocalEvent(item.event);
      if (seen.has(event.id)) throw new Error();
      seen.add(event.id);
      return { event, source: item.source };
    });
    return { events, error: null };
  } catch {
    return {
      events: [],
      error:
        "Your saved events couldn't be read. Existing data has been kept; restore it before saving changes.",
    };
  }
}
export function distanceMiles(
  a: Pick<ZipLocation, "latitude" | "longitude">,
  b: Pick<ZipLocation, "latitude" | "longitude">,
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function matchesEvent(event: LocalEvent, filters: EventFilters) {
  const official = OFFICIAL_IDS.includes(event.game.id);
  return (
    (!filters.kind || event.kind === filters.kind) &&
    (!filters.game || event.game.name === filters.game) &&
    (filters.section === "all" || official === (filters.section === "official"))
  );
}
export function nearbyEvents(
  events: SavedEvent[],
  location: ZipLocation,
  radius: number,
  filters: EventFilters,
  now: number,
) {
  return events
    .filter(
      ({ event }) =>
        event.status === "scheduled" &&
        Date.parse(event.endsAt) > now &&
        matchesEvent(event, filters),
    )
    .map((item) => ({
      ...item,
      distance: distanceMiles(location, item.event.location),
    }))
    .filter((item) => item.distance <= radius)
    .sort(
      (a, b) =>
        Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) ||
        a.distance - b.distance ||
        a.event.id.localeCompare(b.event.id),
    );
}
export function eventShareUrl(event: LocalEvent, origin: string) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ version: 1, event: parseLocalEvent(event) }),
  );
  const encoded = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  if (encoded.length > 12000)
    throw new Error("This event is too large to share by link.");
  return `${origin}/events#event=${encoded}`;
}
export function eventFromShare(hash: string): LocalEvent {
  const encoded = hash.replace(/^#event=/, "");
  if (!hash.startsWith("#event=") || !/^[A-Za-z0-9_-]{1,12000}$/.test(encoded))
    throw new Error("This event link is invalid or incomplete.");
  try {
    const bytes = Uint8Array.from(
      atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const data = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (data.version !== 1) throw new Error();
    return parseLocalEvent(data.event);
  } catch {
    throw new Error("This event link is invalid or incomplete.");
  }
}
export function eventDate(event: LocalEvent) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: event.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(event.startsAt));
}
