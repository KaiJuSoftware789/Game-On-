import assert from "node:assert/strict";
import test from "node:test";
import { GAMES, makeGame } from "../lib/sessions.ts";
import {
  EMPTY_PROFILE,
  makeStats,
  validateStats,
  makeAchievement,
  validateAchievement,
  validateProfileBasics,
  readProfile,
} from "../lib/profile.ts";

const stats = { game: "valorant", hours: "125.5", assists: "0", kills: "" };
const achievement = {
  game: "valorant",
  title: " First 1,000 assists ",
  description: " A personal goal. ",
  kind: "Personal milestone",
  earnedOn: "2026-01-10",
};

test("stats retain fractional hours, recorded zero and unrecorded totals as different values", () => {
  assert.deepEqual(makeStats(stats, GAMES), {
    game: "valorant",
    hours: 125.5,
    assists: 0,
    kills: null,
  });
  assert.equal(
    makeStats({ ...stats, hours: " 0 ", kills: "42" }, GAMES).kills,
    42,
  );
  assert.ok(validateStats({ ...stats, hours: "", assists: " " }, GAMES).hours);
});

test("stats reject negative, fractional counters, non-finite and excessive numbers", () => {
  for (const value of [
    "-1",
    "Infinity",
    "NaN",
    "1e4",
    "0x12",
    "9,000",
    "999999999999999999999999",
  ]) {
    for (const key of ["hours", "assists", "kills"])
      assert.ok(
        validateStats({ ...stats, [key]: value }, GAMES)[key],
        `${key}: ${value}`,
      );
  }
  assert.ok(validateStats({ ...stats, assists: "1.5" }, GAMES).assists);
  assert.ok(validateStats({ ...stats, hours: "1.25" }, GAMES).hours);
  assert.ok(validateStats({ ...stats, game: "missing" }, GAMES).game);
});

test("official and unofficial games can both have stats and achievements", () => {
  const game = makeGame(
    { name: "Stardew Valley", genre: "Farming", mark: "SV", theme: "sage" },
    "custom-farm",
  );
  const games = [...GAMES, game];
  assert.equal(makeStats({ ...stats, game: game.id }, games).game, game.id);
  const saved = makeAchievement(
    { ...achievement, game: game.id },
    "achievement-farm",
    games,
  );
  assert.equal(saved.game, game.id);
  assert.equal(saved.title, "First 1,000 assists");
  assert.equal(saved.description, "A personal goal.");
});

test("achievements validate real calendar dates, completed milestones, types and text lengths", () => {
  for (const earnedOn of [
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "2026-01-11",
    "tomorrow",
  ]) {
    assert.ok(
      validateAchievement({ ...achievement, earnedOn }, GAMES, "2026-01-10")
        .earnedOn,
    );
  }
  for (const earnedOn of ["", "2024-02-29", "2026-01-10"])
    assert.equal(
      validateAchievement({ ...achievement, earnedOn }, GAMES, "2026-01-10")
        .earnedOn,
      undefined,
    );
  assert.ok(
    validateAchievement({ ...achievement, kind: "verified" }, GAMES).kind,
  );
  assert.ok(validateAchievement({ ...achievement, title: " " }, GAMES).title);
  assert.ok(
    validateAchievement({ ...achievement, description: "x".repeat(501) }, GAMES)
      .description,
  );
  assert.ok(validateProfileBasics({ name: "N", bio: "" }).name);
  assert.ok(validateProfileBasics({ name: "Nova", bio: "x".repeat(241) }).bio);
});

test("profiles round trip without needing a game catalog so missing games don't erase achievements", () => {
  assert.deepEqual(readProfile(null), { profile: EMPTY_PROFILE, error: null });
  const profile = {
    name: "Nova",
    bio: "Co-op fan",
    stats: [makeStats(stats, GAMES)],
    achievements: [makeAchievement(achievement, "ach-1", GAMES)],
  };
  assert.deepEqual(readProfile(JSON.stringify({ version: 1, profile })), {
    profile,
    error: null,
  });
  profile.stats[0].game = "custom-no-longer-in-library";
  assert.equal(
    readProfile(JSON.stringify({ version: 1, profile })).error,
    null,
  );
});

test("corrupt profiles and duplicate entries return an error rather than silently losing data", () => {
  const stat = makeStats(stats, GAMES);
  const item = makeAchievement(achievement, "ach-1", GAMES);
  const profile = { ...EMPTY_PROFILE, stats: [stat], achievements: [item] };
  const malformed = [
    "{",
    "null",
    "{}",
    JSON.stringify({ version: 2, profile }),
  ];
  for (const change of [
    { name: 7 },
    { bio: null },
    { stats: [null] },
    { stats: [stat, stat] },
    { stats: [{ ...stat, assists: -1 }] },
    { stats: [{ ...stat, kills: 0.5 }] },
    { stats: [{ ...stat, hours: null, assists: null, kills: null }] },
    { achievements: [item, item] },
    { achievements: [null] },
    { achievements: [{ ...item, earnedOn: "2026-02-30" }] },
    { achievements: [{ ...item, kind: "anything" }] },
  ])
    malformed.push(
      JSON.stringify({ version: 1, profile: { ...profile, ...change } }),
    );
  for (const raw of malformed) {
    assert.ok(readProfile(raw).error, raw);
    assert.deepEqual(readProfile(raw).profile, EMPTY_PROFILE);
  }
});
