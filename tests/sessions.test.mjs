import assert from "node:assert/strict";
import test from "node:test";
import {
  SAMPLE_SESSIONS,
  filterSessions,
  makeSession,
  readSessions,
  validateSession,
  GAMES,
  makeGame,
  validateGame,
} from "../lib/sessions.ts";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const input = {
  title: " Weekend squad ",
  host: " Nova ",
  game: "valorant",
  platform: "PC",
  region: "Europe",
  vibe: "Casual",
  capacity: "5",
  description: " A few relaxed games. ",
  startsAt: "",
  voice: true,
};
const filters = {
  query: "",
  game: "",
  platform: "",
  region: "",
  vibe: "",
  openOnly: false,
  sort: "recommended",
};

test("official and unofficial sections compose with game search and platform filters", () => {
  const game = makeGame(
    { name: "Stardew Valley", genre: "Farming", mark: "SV", theme: "sage" },
    "custom-farm",
  );
  const custom = makeSession({ ...input, game: game.id }, "farm", now, [
    ...GAMES,
    game,
  ]);
  const sessions = [...SAMPLE_SESSIONS, custom];
  const games = [...GAMES, game];
  assert.equal(
    filterSessions(sessions, { ...filters, section: "official" }, games).length,
    SAMPLE_SESSIONS.length,
  );
  assert.deepEqual(
    filterSessions(
      sessions,
      { ...filters, section: "unofficial", query: "stardew", platform: "PC" },
      games,
    ),
    [custom],
  );
  assert.equal(
    filterSessions(
      sessions,
      { ...filters, section: "official", game: game.id },
      games,
    ).length,
    0,
  );
  assert.equal(
    filterSessions(sessions, { ...filters, section: "all" }, games).length,
    sessions.length,
  );
});

test("search finds game names, hosts, and descriptions regardless of case or surrounding spaces", () => {
  assert.equal(
    filterSessions(SAMPLE_SESSIONS, { ...filters, query: "  VALORANT  " })[0]
      .id,
    "sample-valorant",
  );
  assert.equal(
    filterSessions(SAMPLE_SESSIONS, { ...filters, query: "moss" })[0].id,
    "sample-minecraft",
  );
  assert.equal(
    filterSessions(SAMPLE_SESSIONS, { ...filters, query: "redstone" })[0].id,
    "sample-minecraft",
  );
});

test("filters combine and full lobbies disappear when open spots are required", () => {
  const found = filterSessions(SAMPLE_SESSIONS, {
    ...filters,
    platform: "PC",
    region: "Europe",
    vibe: "Beginner friendly",
    openOnly: true,
  });
  assert.deepEqual(
    found.map((session) => session.id),
    ["sample-minecraft"],
  );
  assert.equal(
    filterSessions(SAMPLE_SESSIONS, {
      ...filters,
      game: "apex",
      openOnly: true,
    }).length,
    0,
  );
  assert.equal(
    filterSessions(SAMPLE_SESSIONS, { ...filters, game: "apex" }).length,
    1,
  );
});

test("creating a session trims user text, counts the host, and distinguishes it from samples", () => {
  const session = makeSession(input, "my-session", now);
  assert.equal(session.title, "Weekend squad");
  assert.equal(session.host, "Nova");
  assert.equal(session.description, "A few relaxed games.");
  assert.equal(session.players, 1);
  assert.equal(session.capacity, 5);
  assert.equal(session.sample, false);
  assert.equal(session.startsAt, null);
});

test("blank titles, invalid games, and fractional or out-of-range capacities are rejected", () => {
  assert.ok(validateSession({ ...input, title: "   " }, now).title);
  assert.ok(validateSession({ ...input, host: " " }, now).host);
  assert.ok(validateSession({ ...input, game: "unsupported" }, now).game);
  for (const capacity of ["", "1", "17", "2.5", "NaN"]) {
    assert.ok(validateSession({ ...input, capacity }, now).capacity, capacity);
  }
  assert.throws(() => makeSession({ ...input, capacity: "0" }, "invalid", now));
});

test("scheduled sessions require a valid future time and store an unambiguous UTC date", () => {
  for (const startsAt of [
    "invalid",
    "2026-10-23T12:00:00Z",
    "2026-10-24T12:00:00Z",
  ]) {
    assert.ok(validateSession({ ...input, startsAt }, now).startsAt);
  }
  const session = makeSession(
    { ...input, startsAt: "2026-10-24T16:00:00-05:00" },
    "scheduled",
    now,
  );
  assert.equal(session.startsAt, "2026-10-24T21:00:00.000Z");
});

test("newest and soonest sorting are chronological and do not mutate saved data", () => {
  const earlier = makeSession(
    { ...input, startsAt: "2026-10-25T10:00:00Z" },
    "earlier",
    now,
  );
  const later = makeSession(
    { ...input, startsAt: "2026-10-26T10:00:00Z" },
    "later",
    now + 1000,
  );
  const ready = makeSession(input, "ready", now - 1000);
  const sessions = [later, earlier, ready];
  assert.deepEqual(
    filterSessions(sessions, { ...filters, sort: "soonest" }).map((s) => s.id),
    ["ready", "earlier", "later"],
  );
  assert.deepEqual(
    filterSessions(sessions, { ...filters, sort: "newest" }).map((s) => s.id),
    ["later", "earlier", "ready"],
  );
  assert.deepEqual(
    sessions.map((s) => s.id),
    ["later", "earlier", "ready"],
  );
});

test("recommendations prioritize personal sessions and place full samples last", () => {
  const own = makeSession(input, "mine", now);
  const sessions = filterSessions([...SAMPLE_SESSIONS, own], filters);
  assert.equal(sessions[0].id, "mine");
  assert.equal(sessions.at(-1).id, "sample-apex");
});

test("saved sessions round-trip and stay readable after their scheduled time passes", () => {
  const session = makeSession(
    { ...input, startsAt: "2026-10-24T13:00:00Z" },
    "saved",
    now,
  );
  const restored = readSessions(
    JSON.stringify({ version: 1, sessions: [session] }),
  );
  assert.deepEqual(restored.sessions, [session]);
  assert.equal(restored.error, null);
  assert.deepEqual(readSessions(null), {
    sessions: [],
    games: [],
    error: null,
  });
});

const gameInput = {
  name: "  Stardew   Valley  ",
  genre: " Farming & co-op ",
  mark: "",
  theme: "sage",
};

test("custom games normalize names, create a badge, and retain selected appearance", () => {
  const game = makeGame(gameInput, "custom-stardew");
  assert.equal(game.name, "Stardew Valley");
  assert.equal(game.genre, "Farming & co-op");
  assert.equal(game.mark, "SV");
  assert.equal(game.theme, "sage");
  assert.equal(
    makeGame({ ...gameInput, mark: "sv3", genre: "" }, "custom-game").mark,
    "SV3",
  );
  assert.equal(
    makeGame({ ...gameInput, genre: "" }, "custom-game").genre,
    "Multiplayer",
  );
});

test("duplicate custom and built-in names are rejected regardless of case, spacing, or Unicode width", () => {
  const game = makeGame(gameInput, "custom-stardew");
  const games = [...GAMES, game];
  for (const name of [
    "stardew valley",
    " STARDEW   VALLEY ",
    "Ｓｔａｒｄｅｗ Ｖａｌｌｅｙ",
    "valorant",
    "  Fortnite ",
  ]) {
    assert.ok(validateGame({ ...gameInput, name }, games).name, name);
  }
  assert.deepEqual(validateGame(gameInput, games, game.id), {});
});

test("game names, categories, badge characters and color choices are validated", () => {
  for (const name of [" ", "a", "x".repeat(61)])
    assert.ok(validateGame({ ...gameInput, name }, GAMES).name);
  assert.ok(validateGame({ ...gameInput, genre: "x".repeat(41) }, GAMES).genre);
  for (const mark of ["FOUR", "<>", "A B"])
    assert.ok(validateGame({ ...gameInput, mark }, GAMES).mark);
  assert.ok(validateGame({ ...gameInput, theme: "invalid" }, GAMES).theme);
  assert.throws(() => makeGame(gameInput, "valorant"));
});

test("a custom game can be selected, searched by its name, and filtered independently", () => {
  const game = makeGame(gameInput, "custom-stardew");
  const games = [...GAMES, game];
  const customInput = { ...input, game: game.id };
  assert.ok(validateSession(customInput, now).game);
  assert.deepEqual(validateSession(customInput, now, games), {});
  const session = makeSession(customInput, "farm-session", now, games);
  assert.deepEqual(
    filterSessions(
      [session, ...SAMPLE_SESSIONS],
      { ...filters, query: "stardew valley" },
      games,
    ),
    [session],
  );
  assert.deepEqual(
    filterSessions(
      [session, ...SAMPLE_SESSIONS],
      { ...filters, game: game.id },
      games,
    ),
    [session],
  );
});

test("custom games and their sessions round-trip alongside existing saved sessions", () => {
  const game = makeGame(gameInput, "custom-stardew");
  const existing = makeSession(input, "existing", now);
  const session = makeSession(
    { ...input, game: game.id },
    "farm-session",
    now,
    [...GAMES, game],
  );
  const restored = readSessions(
    JSON.stringify({
      version: 1,
      games: [game],
      sessions: [session, existing],
    }),
  );
  assert.equal(restored.error, null);
  assert.deepEqual(restored.games, [game]);
  assert.deepEqual(restored.sessions, [session, existing]);
  assert.deepEqual(
    readSessions(JSON.stringify({ version: 1, sessions: [existing] })).games,
    [],
  );
});

test("editing a game's name and appearance keeps its sessions linked by stable ID", () => {
  const game = makeGame(gameInput, "custom-stardew");
  const session = makeSession(
    { ...input, game: game.id },
    "farm-session",
    now,
    [...GAMES, game],
  );
  const edited = makeGame(
    {
      ...gameInput,
      name: "Stardew Valley Expanded",
      mark: "SVE",
      theme: "gold",
    },
    game.id,
    [...GAMES, game],
    game.id,
  );
  const restored = readSessions(
    JSON.stringify({ version: 1, games: [edited], sessions: [session] }),
  );
  assert.equal(restored.error, null);
  assert.equal(restored.sessions[0].game, edited.id);
  assert.deepEqual(
    filterSessions(restored.sessions, { ...filters, query: "expanded" }, [
      ...GAMES,
      ...restored.games,
    ]),
    [session],
  );
});

test("malformed catalogs, duplicate names or IDs, and missing game references are rejected", () => {
  const game = makeGame(gameInput, "custom-stardew");
  const session = makeSession(
    { ...input, game: game.id },
    "farm-session",
    now,
    [...GAMES, game],
  );
  for (const games of [
    null,
    {},
    [null],
    [{ ...game, theme: "unknown" }],
    [{ ...game, id: "valorant" }],
    [game, game],
    [game, { ...game, id: "custom-copy" }],
    [{ ...game, name: "Minecraft" }],
    [],
  ]) {
    const result = readSessions(
      JSON.stringify({ version: 1, sessions: [session], games }),
    );
    assert.ok(result.error);
    assert.deepEqual(result.sessions, []);
    assert.deepEqual(result.games, []);
  }
});

test("malformed storage, unknown versions, and hostile-shaped entries produce a recoverable error", () => {
  const session = makeSession(input, "saved", now);
  const invalid = [
    "{broken",
    "null",
    JSON.stringify({ version: 2, sessions: [] }),
    JSON.stringify({ version: 1, sessions: [null] }),
    JSON.stringify({ version: 1, sessions: [{ ...session, game: "unknown" }] }),
    JSON.stringify({
      version: 1,
      sessions: [{ ...session, startsAt: "bad date" }],
    }),
    JSON.stringify({ version: 1, sessions: [{ ...session, players: 99 }] }),
    JSON.stringify({ version: 1, sessions: [session, session] }),
  ];
  for (const raw of invalid) {
    const result = readSessions(raw);
    assert.ok(result.error);
    assert.deepEqual(result.sessions, []);
  }
});
