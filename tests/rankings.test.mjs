import assert from "node:assert/strict";
import test from "node:test";
import {
  VALORANT_RANKS,
  rankEntries,
  nextUsernameChange,
  changeGameUsername,
  readGameAccounts,
  normalizeRiotId,
} from "../lib/rankings.ts";

test("native VALORANT ranks sort correctly with shared positions and no generated ratings", () => {
  const entry = (name, rank) => ({
    player_id: name,
    username: name,
    rank_name: rank,
    rank_order: VALORANT_RANKS.indexOf(rank),
    updated_at: "2026-10-25T00:00:00Z",
  });
  const input = [
    entry("Nova#NA1", "Gold 2"),
    entry("Orbit#EU1", "Immortal 1"),
    entry("Atlas#NA1", "Immortal 1"),
    entry("New#NA1", "Unranked"),
  ];
  const result = rankEntries(input);
  assert.deepEqual(
    result.map((x) => x.position),
    [1, 1, 3, 4],
  );
  assert.deepEqual(
    result.map((x) => x.rank_name),
    ["Immortal 1", "Immortal 1", "Gold 2", "Unranked"],
  );
  assert.equal(input[0].username, "Nova#NA1");
  assert.equal(rankEntries([{ ...input[0], rank_order: Infinity }]).length, 0);
});
test("Riot IDs require name and tag and preserve the display name", () => {
  assert.equal(normalizeRiotId("  Player One#NA1  "), "Player One#NA1");
  for (const value of [
    "Player",
    "x#NA1",
    "Name#n",
    "Name#A!1",
    "Name##NA1",
    "Name\nHere#NA1",
    "Name\u200bHere#NA1",
    "Name #NA1",
  ])
    assert.throws(() => normalizeRiotId(value));
});
test("three calendar months clamp month ends and retain UTC time", () => {
  assert.equal(
    nextUsernameChange("2026-11-30T12:34:56.000Z"),
    "2027-02-28T12:34:56.000Z",
  );
  assert.equal(
    nextUsernameChange("2023-11-30T12:34:56.000Z"),
    "2024-02-29T12:34:56.000Z",
  );
  assert.equal(
    nextUsernameChange("2026-10-25T18:00:00.000Z"),
    "2027-01-25T18:00:00.000Z",
  );
});
test("identity changes are locked until the exact boundary and erase previous synced ranks", () => {
  const original = changeGameUsername(
    undefined,
    "Nova#NA1",
    new Date("2026-10-25T12:00:00Z"),
  );
  original.ranks = [
    { queue: "competitive", rank: "Radiant", updatedAt: original.changedAt },
  ];
  assert.throws(() =>
    changeGameUsername(
      original,
      "Other#NA1",
      new Date("2027-01-25T11:59:59.999Z"),
    ),
  );
  assert.equal(
    changeGameUsername(original, "nova#na1", new Date("2026-10-26T00:00:00Z")),
    original,
  );
  const changed = changeGameUsername(
    original,
    "Other#NA1",
    new Date("2027-01-25T12:00:00Z"),
  );
  assert.equal(changed.nextChangeAt, "2027-04-25T12:00:00.000Z");
  assert.deepEqual(changed.ranks, []);
});
test("local storage preserves locks, rejects corruption and cannot supply synced ranks", () => {
  const account = changeGameUsername(undefined, "Nova#NA1");
  assert.equal(readGameAccounts(null).accounts.length, 0);
  assert.equal(
    readGameAccounts(JSON.stringify({ version: 1, accounts: [account] }))
      .accounts[0].nextChangeAt,
    account.nextChangeAt,
  );
  account.ranks = [
    { queue: "competitive", rank: "Radiant", updatedAt: account.changedAt },
  ];
  assert.deepEqual(
    readGameAccounts(JSON.stringify({ version: 1, accounts: [account] }))
      .accounts[0].ranks,
    [],
  );
  for (const raw of [
    "{",
    "null",
    "{}",
    JSON.stringify({ version: 2, accounts: [account] }),
    JSON.stringify({
      version: 1,
      accounts: [{ ...account, nextChangeAt: "2000-01-01" }],
    }),
    JSON.stringify({ version: 1, accounts: [account, account] }),
  ])
    assert.ok(readGameAccounts(raw).error);
});
