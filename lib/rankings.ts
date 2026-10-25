import type { Game } from "./sessions";

export type RankQueue = {
  id: string;
  game: string;
  name: string;
  ranks: readonly string[];
};
export const VALORANT_RANKS = [
  "Unranked",
  ...[
    "Iron",
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Ascendant",
    "Immortal",
  ].flatMap((tier) => [1, 2, 3].map((division) => `${tier} ${division}`)),
  "Radiant",
];
export const RANK_QUEUES: readonly RankQueue[] = [
  {
    id: "competitive",
    game: "valorant",
    name: "Competitive",
    ranks: VALORANT_RANKS,
  },
];
export function queuesForGame(game: Game | undefined) {
  return RANK_QUEUES.filter((queue) => queue.game === game?.id);
}
export type SyncedRank = { queue: string; rank: string; updatedAt: string };
export type GameAccount = {
  game: "valorant";
  username: string;
  changedAt: string;
  nextChangeAt: string;
  visible: boolean;
  ranks: SyncedRank[];
};
export type RankingEntry = {
  player_id: string;
  username: string;
  rank_name: string;
  rank_order: number;
  updated_at: string;
  position: number;
};
export type RankingBoard = {
  entries: RankingEntry[];
  total: number;
  mine: RankingEntry | null;
};
export type RankingAccount = { game_accounts: GameAccount[] };

// Highest native tier first. Equal in-game tiers share a position on this board.
export function rankEntries(
  entries: Omit<RankingEntry, "position">[],
): RankingEntry[] {
  const sorted = entries
    .filter(
      (entry) =>
        Number.isSafeInteger(entry.rank_order) &&
        entry.rank_order >= 0 &&
        entry.rank_order < VALORANT_RANKS.length,
    )
    .sort(
      (a, b) =>
        b.rank_order - a.rank_order ||
        a.username.localeCompare(b.username) ||
        a.player_id.localeCompare(b.player_id),
    );
  let position = 1;
  return sorted.map((entry, index) => {
    if (index === 0 || sorted[index - 1].rank_order !== entry.rank_order)
      position = index + 1;
    return { ...entry, position };
  });
}

export function normalizeRiotId(input: string): string {
  const username = input.normalize("NFKC").trim();
  const parts = username.split("#");
  if (
    parts.length !== 2 ||
    Array.from(parts[0]).length < 3 ||
    Array.from(parts[0]).length > 16 ||
    parts[0] !== parts[0].trim() ||
    /[\p{Cc}\p{Cf}]/u.test(parts[0]) ||
    !/^[a-zA-Z0-9]{3,5}$/.test(parts[1])
  )
    throw new Error(
      "Enter your full Riot ID as Name#Tag: a 3–16 character name and a 3–5 letter or number tag.",
    );
  return username;
}

// Three calendar months, clamped at month end (Nov 30 → Feb 28/29), in UTC.
export function nextUsernameChange(changedAt: string): string {
  const date = new Date(changedAt);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid account change date.");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 3);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}

export function changeGameUsername(
  current: GameAccount | undefined,
  input: string,
  now = new Date(),
): GameAccount {
  const username = normalizeRiotId(input);
  if (current && current.username.toLowerCase() === username.toLowerCase())
    return current;
  if (current && now.getTime() < Date.parse(current.nextChangeAt))
    throw new Error(
      `You can change this Riot ID after ${new Date(current.nextChangeAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC.`,
    );
  const changedAt = now.toISOString();
  return {
    game: "valorant",
    username,
    changedAt,
    nextChangeAt: nextUsernameChange(changedAt),
    visible: true,
    ranks: [],
  };
}

export function readGameAccounts(raw: string | null): {
  accounts: GameAccount[];
  error: string | null;
} {
  if (raw === null) return { accounts: [], error: null };
  try {
    const data = JSON.parse(raw);
    if (
      data?.version !== 1 ||
      !Array.isArray(data.accounts) ||
      data.accounts.length > 1
    )
      throw new Error();
    const accounts = data.accounts.map((item: GameAccount) => {
      if (
        !item ||
        item.game !== "valorant" ||
        normalizeRiotId(item.username) !== item.username ||
        item.nextChangeAt !== nextUsernameChange(item.changedAt)
      )
        throw new Error();
      // Browser data can never establish a synced rank or verified identity.
      return {
        game: "valorant" as const,
        username: item.username,
        changedAt: item.changedAt,
        nextChangeAt: item.nextChangeAt,
        visible: true,
        ranks: [],
      };
    });
    return { accounts, error: null };
  } catch {
    return {
      accounts: [],
      error:
        "Your saved game account couldn't be read. Existing data has been kept; restore it before making changes.",
    };
  }
}
