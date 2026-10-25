export const GAME_THEMES = [
  { id: "coral", name: "Coral" },
  { id: "violet", name: "Violet" },
  { id: "gold", name: "Gold" },
  { id: "sage", name: "Sage" },
  { id: "copper", name: "Copper" },
  { id: "sky", name: "Sky" },
] as const;

export type Game = {
  id: string;
  name: string;
  genre: string;
  mark: string;
  theme: (typeof GAME_THEMES)[number]["id"];
};

export type GameSection = "all" | "official" | "unofficial";

export function gameSection(id: string): Exclude<GameSection, "all"> {
  return GAMES.some((game) => game.id === id) ? "official" : "unofficial";
}

export function matchesGameSection(id: string, section: GameSection = "all") {
  return section === "all" || gameSection(id) === section;
}

export const GAMES: readonly Game[] = [
  {
    id: "valorant",
    name: "VALORANT",
    genre: "Tactical shooter",
    mark: "V",
    theme: "coral",
  },
  {
    id: "fortnite",
    name: "Fortnite",
    genre: "Battle royale",
    mark: "F",
    theme: "violet",
  },
  {
    id: "helldivers",
    name: "Helldivers 2",
    genre: "Co-op action",
    mark: "H",
    theme: "gold",
  },
  {
    id: "minecraft",
    name: "Minecraft",
    genre: "Survival & sandbox",
    mark: "M",
    theme: "sage",
  },
  {
    id: "apex",
    name: "Apex Legends",
    genre: "Battle royale",
    mark: "A",
    theme: "copper",
  },
  {
    id: "rocket-league",
    name: "Rocket League",
    genre: "Sports & racing",
    mark: "RL",
    theme: "sky",
  },
] as const;

export type GameInput = {
  name: string;
  genre: string;
  mark: string;
  theme: string;
};
export type GameErrors = Partial<Record<keyof GameInput, string>>;
const cleanGameText = (text: string) =>
  text.normalize("NFKC").trim().replace(/\s+/gu, " ");
const gameNameKey = (text: string) => cleanGameText(text).toLowerCase();

export function validateGame(
  input: GameInput,
  games: readonly Game[],
  editingId?: string,
): GameErrors {
  const errors: GameErrors = {};
  const name = cleanGameText(input.name);
  if (name.length < 2 || name.length > 60)
    errors.name = "Use a game name between 2 and 60 characters.";
  else if (
    games.some(
      (game) =>
        game.id !== editingId && gameNameKey(game.name) === gameNameKey(name),
    )
  )
    errors.name =
      "This game is already in your list. Choose it when creating a session.";
  if (cleanGameText(input.genre).length > 40)
    errors.genre = "Keep the category under 40 characters.";
  if (input.mark.trim() && !/^[\p{L}\p{N}]{1,3}$/u.test(input.mark.trim()))
    errors.mark = "Use up to 3 letters or numbers for the badge.";
  if (!GAME_THEMES.some((theme) => theme.id === input.theme))
    errors.theme = "Choose a game color.";
  return errors;
}

export function makeGame(
  input: GameInput,
  id: string,
  games: readonly Game[] = GAMES,
  editingId?: string,
): Game {
  if (
    !/^custom-[a-zA-Z0-9-]+$/.test(id) ||
    Object.keys(validateGame(input, games, editingId)).length
  )
    throw new Error("Please check the game details.");
  const name = cleanGameText(input.name);
  return {
    id,
    name,
    genre: cleanGameText(input.genre) || "Multiplayer",
    mark: gameBadge(name, input.mark),
    theme: input.theme as Game["theme"],
  };
}

export function gameBadge(name: string, mark = ""): string {
  const initials =
    name
      .match(/[\p{L}\p{N}]+/gu)
      ?.slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("") || "GO";
  return Array.from((mark.trim() || initials).toUpperCase())
    .slice(0, 3)
    .join("");
}

export function findGame(id: string, games: readonly Game[]): Game {
  return (
    games.find((game) => game.id === id) ?? {
      id: "unavailable",
      name: "Unavailable game",
      genre: "Multiplayer",
      mark: "?",
      theme: "sage",
    }
  );
}

export const PLATFORMS = [
  "Cross-play",
  "PC",
  "PlayStation",
  "Xbox",
  "Switch",
] as const;
export const REGIONS = [
  "North America",
  "Europe",
  "Asia Pacific",
  "South America",
] as const;
export const VIBES = ["Casual", "Competitive", "Beginner friendly"] as const;

export type Session = {
  id: string;
  title: string;
  host: string;
  game: (typeof GAMES)[number]["id"];
  platform: (typeof PLATFORMS)[number];
  region: (typeof REGIONS)[number];
  vibe: (typeof VIBES)[number];
  players: number;
  capacity: number;
  description: string;
  startsAt: string | null;
  createdAt: string;
  voice: boolean;
  sample: boolean;
};

export const SAMPLE_SESSIONS: Session[] = [
  {
    id: "sample-valorant",
    game: "valorant",
    title: "Good comms, better company",
    host: "Nova",
    platform: "PC",
    region: "North America",
    vibe: "Casual",
    players: 3,
    capacity: 5,
    description:
      "A few unrated games with a friendly squad. Bring good vibes, share your callouts, and don't worry about your rank. Everyone gets a chance to play their favorite agent.",
    voice: true,
  },
  {
    id: "sample-helldivers",
    game: "helldivers",
    title: "For democracy. And the laughs.",
    host: "Orbit",
    platform: "Cross-play",
    region: "Europe",
    vibe: "Casual",
    players: 2,
    capacity: 4,
    description:
      "Looking for a couple of fellow Helldivers for co-op missions. We'll pick the difficulty together. New recruits welcome; friendly fire is forgivable.",
    voice: true,
  },
  {
    id: "sample-fortnite",
    game: "fortnite",
    title: "Zero builds, zero pressure",
    host: "Peach",
    platform: "Cross-play",
    region: "North America",
    vibe: "Beginner friendly",
    players: 2,
    capacity: 4,
    description:
      "A relaxed Zero Build squad. Let's explore, complete a few quests, and see if we can get a victory together. No experience needed.",
    voice: false,
  },
  {
    id: "sample-minecraft",
    game: "minecraft",
    title: "Let's build something great",
    host: "Moss",
    platform: "PC",
    region: "Europe",
    vibe: "Beginner friendly",
    players: 3,
    capacity: 8,
    description:
      "A fresh Java survival world with room for builders, explorers, and redstone enthusiasts. Collaborative builds, no griefing, and plenty of time to learn.",
    voice: false,
  },
  {
    id: "sample-apex",
    game: "apex",
    title: "One more ranked run",
    host: "Echo",
    platform: "PC",
    region: "Asia Pacific",
    vibe: "Competitive",
    players: 3,
    capacity: 3,
    description:
      "A focused ranked trio with clear comms and a team-first attitude. This example squad is full; try another session or create your own.",
    voice: true,
  },
  {
    id: "sample-rocket",
    game: "rocket-league",
    title: "Chasing goals, not ranks",
    host: "Dash",
    platform: "Cross-play",
    region: "South America",
    vibe: "Casual",
    players: 1,
    capacity: 3,
    description:
      "Casual 3v3 matches and the occasional spectacular own goal. All skill levels welcome. Let's warm up and have some fun.",
    voice: false,
  },
].map((session) => ({
  ...session,
  startsAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  sample: true,
})) as Session[];

export type SessionFilters = {
  section?: GameSection;
  query: string;
  game: string;
  platform: string;
  region: string;
  vibe: string;
  openOnly: boolean;
  sort: "recommended" | "newest" | "soonest";
};

export function filterSessions(
  sessions: Session[],
  filters: SessionFilters,
  games: readonly Game[] = GAMES,
): Session[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return sessions
    .filter((session) => {
      const game = findGame(session.game, games);
      return (
        (!query ||
          [session.title, game.name, session.host, session.description].some(
            (text) => text.toLocaleLowerCase().includes(query),
          )) &&
        matchesGameSection(session.game, filters.section) &&
        (!filters.game || session.game === filters.game) &&
        (!filters.platform || session.platform === filters.platform) &&
        (!filters.region || session.region === filters.region) &&
        (!filters.vibe || session.vibe === filters.vibe) &&
        (!filters.openOnly || session.players < session.capacity)
      );
    })
    .sort((a, b) => {
      if (filters.sort === "newest")
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      if (filters.sort === "soonest")
        return (
          (a.startsAt ? Date.parse(a.startsAt) : 0) -
          (b.startsAt ? Date.parse(b.startsAt) : 0)
        );
      return (
        Number(a.players >= a.capacity) - Number(b.players >= b.capacity) ||
        Number(a.sample) - Number(b.sample)
      );
    });
}

export type SessionInput = {
  title: string;
  host: string;
  game: string;
  platform: string;
  region: string;
  vibe: string;
  capacity: string;
  description: string;
  startsAt: string;
  voice: boolean;
};
export type SessionErrors = Partial<Record<keyof SessionInput, string>>;

export function validateSession(
  input: SessionInput,
  now = Date.now(),
  games: readonly Game[] = GAMES,
): SessionErrors {
  const errors: SessionErrors = {};
  if (input.title.trim().length < 3 || input.title.trim().length > 80)
    errors.title = "Give your session a title between 3 and 80 characters.";
  if (input.host.trim().length < 2 || input.host.trim().length > 32)
    errors.host = "Use a player name between 2 and 32 characters.";
  if (!games.some((game) => game.id === input.game))
    errors.game = "Choose a game.";
  if (!PLATFORMS.some((platform) => platform === input.platform))
    errors.platform = "Choose a platform.";
  if (!REGIONS.some((region) => region === input.region))
    errors.region = "Choose a region.";
  if (!VIBES.some((vibe) => vibe === input.vibe))
    errors.vibe = "Choose a play style.";
  const capacity = Number(input.capacity);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 16)
    errors.capacity = "Choose 2 to 16 players, including you.";
  if (input.description.trim().length > 500)
    errors.description = "Keep your description under 500 characters.";
  if (
    input.startsAt &&
    (!Number.isFinite(Date.parse(input.startsAt)) ||
      Date.parse(input.startsAt) <= now)
  )
    errors.startsAt = "Choose a start time in the future.";
  return errors;
}

export function makeSession(
  input: SessionInput,
  id: string,
  now = Date.now(),
  games: readonly Game[] = GAMES,
): Session {
  if (Object.keys(validateSession(input, now, games)).length)
    throw new Error("Please check the session details.");
  return {
    id,
    title: input.title.trim(),
    host: input.host.trim(),
    game: input.game as Session["game"],
    platform: input.platform as Session["platform"],
    region: input.region as Session["region"],
    vibe: input.vibe as Session["vibe"],
    capacity: Number(input.capacity),
    players: 1,
    description: input.description.trim(),
    startsAt: input.startsAt ? new Date(input.startsAt).toISOString() : null,
    createdAt: new Date(now).toISOString(),
    voice: input.voice,
    sample: false,
  };
}

function isSavedSession(
  value: unknown,
  games: readonly Game[],
): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    s.id.length > 0 &&
    !s.id.startsWith("sample-") &&
    typeof s.title === "string" &&
    s.title.trim().length >= 3 &&
    s.title.length <= 80 &&
    typeof s.host === "string" &&
    s.host.trim().length >= 2 &&
    s.host.length <= 32 &&
    games.some((game) => game.id === s.game) &&
    PLATFORMS.some((platform) => platform === s.platform) &&
    REGIONS.some((region) => region === s.region) &&
    VIBES.some((vibe) => vibe === s.vibe) &&
    typeof s.capacity === "number" &&
    Number.isInteger(s.capacity) &&
    s.capacity >= 2 &&
    s.capacity <= 16 &&
    s.players === 1 &&
    s.sample === false &&
    typeof s.voice === "boolean" &&
    typeof s.description === "string" &&
    s.description.length <= 500 &&
    (s.startsAt === null ||
      (typeof s.startsAt === "string" &&
        Number.isFinite(Date.parse(s.startsAt)))) &&
    typeof s.createdAt === "string" &&
    Number.isFinite(Date.parse(s.createdAt))
  );
}

export function readSessions(raw: string | null): {
  sessions: Session[];
  games: Game[];
  error: string | null;
} {
  if (raw === null) return { sessions: [], games: [], error: null };
  try {
    const saved = JSON.parse(raw);
    // The optional catalog preserves sessions saved before custom games existed.
    const games: unknown = saved?.games === undefined ? [] : saved.games;
    if (!Array.isArray(games) || !games.every(isSavedGame))
      throw new Error("Invalid game catalog");
    const catalog = [...GAMES, ...games];
    if (
      new Set(catalog.map((game) => game.id)).size !== catalog.length ||
      new Set(catalog.map((game) => gameNameKey(game.name))).size !==
        catalog.length
    )
      throw new Error("Duplicate games");
    if (
      saved?.version !== 1 ||
      !Array.isArray(saved.sessions) ||
      !saved.sessions.every((session: unknown) =>
        isSavedSession(session, catalog),
      )
    )
      throw new Error("Invalid saved sessions");
    const sessions: Session[] = saved.sessions;
    if (new Set(sessions.map((session) => session.id)).size !== sessions.length)
      throw new Error("Duplicate session IDs");
    return { sessions, games, error: null };
  } catch {
    return {
      sessions: [],
      games: [],
      error:
        "Your saved sessions or games couldn't be read. They haven't been changed. Try the browser where you created them, or clear this site's saved data to start fresh.",
    };
  }
}

function isSavedGame(value: unknown): value is Game {
  if (typeof value !== "object" || value === null) return false;
  const game = value as Record<string, unknown>;
  return (
    typeof game.id === "string" &&
    /^custom-[a-zA-Z0-9-]+$/.test(game.id) &&
    typeof game.name === "string" &&
    cleanGameText(game.name).length >= 2 &&
    game.name.length <= 60 &&
    typeof game.genre === "string" &&
    game.genre.trim().length > 0 &&
    game.genre.length <= 40 &&
    typeof game.mark === "string" &&
    /^[\p{L}\p{N}]{1,3}$/u.test(game.mark) &&
    GAME_THEMES.some((theme) => theme.id === game.theme)
  );
}
