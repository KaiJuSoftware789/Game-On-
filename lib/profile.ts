import type { Game } from "./sessions";

export type PlayerStats = {
  game: string;
  hours: number | null;
  assists: number | null;
  kills: number | null;
};
export const ACHIEVEMENT_TYPES = [
  "Game achievement",
  "Personal milestone",
] as const;
export type Achievement = {
  id: string;
  game: string;
  title: string;
  description: string;
  kind: (typeof ACHIEVEMENT_TYPES)[number];
  earnedOn: string;
};
export type PlayerProfile = {
  name: string;
  bio: string;
  stats: PlayerStats[];
  achievements: Achievement[];
};
export type StatsInput = {
  game: string;
  hours: string;
  assists: string;
  kills: string;
};
export type AchievementInput = Omit<Achievement, "id" | "kind"> & {
  kind: string;
};
export type ProfileErrors = Record<string, string>;

export const EMPTY_PROFILE: PlayerProfile = {
  name: "",
  bio: "",
  stats: [],
  achievements: [],
};
export const STAT_FIELDS = [
  { id: "hours", label: "Hours played", max: 1_000_000 },
  { id: "assists", label: "Assists", max: 9_999_999_999 },
  { id: "kills", label: "Kills", max: 9_999_999_999 },
] as const;

export function validateProfileBasics(input: {
  name: string;
  bio: string;
}): ProfileErrors {
  const errors: ProfileErrors = {};
  if (input.name.trim().length < 2 || input.name.trim().length > 32)
    errors.name = "Use a player name between 2 and 32 characters.";
  if (input.bio.trim().length > 240)
    errors.bio = "Keep your bio under 240 characters.";
  return errors;
}

export function validateStats(
  input: StatsInput,
  games: readonly Game[],
): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!games.some((game) => game.id === input.game))
    errors.game = "Choose a game from your library.";
  for (const { id, label, max } of STAT_FIELDS) {
    const text = input[id].trim();
    if (!text) continue;
    const value = Number(text);
    if (
      !/^\d+(?:\.\d+)?$/.test(text) ||
      !Number.isFinite(value) ||
      value > max ||
      (id !== "hours" && !Number.isInteger(value)) ||
      (id === "hours" && !/^\d+(?:\.\d)?$/.test(text))
    ) {
      errors[id] =
        `${label}: enter 0–${max.toLocaleString("en-US")}${id === "hours" ? ", with up to one decimal place" : " as a whole number"}.`;
    }
  }
  if (STAT_FIELDS.every(({ id }) => !input[id].trim()))
    errors.hours =
      "Add at least one stat. Leave other fields blank if they don't apply.";
  return errors;
}

export function makeStats(
  input: StatsInput,
  games: readonly Game[],
): PlayerStats {
  if (Object.keys(validateStats(input, games)).length)
    throw new Error("Please check your game stats.");
  return {
    game: input.game,
    hours: input.hours.trim() ? Number(input.hours) : null,
    assists: input.assists.trim() ? Number(input.assists) : null,
    kills: input.kills.trim() ? Number(input.kills) : null,
  };
}

export function todayDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function validDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}

export function validateAchievement(
  input: AchievementInput,
  games: readonly Game[],
  today = todayDate(),
): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!games.some((game) => game.id === input.game))
    errors.game = "Choose a game from your library.";
  if (input.title.trim().length < 2 || input.title.trim().length > 80)
    errors.title = "Use an achievement title between 2 and 80 characters.";
  if (input.description.trim().length > 500)
    errors.description = "Keep the story under 500 characters.";
  if (!ACHIEVEMENT_TYPES.some((kind) => kind === input.kind))
    errors.kind = "Choose an achievement type.";
  if (input.earnedOn && (!validDate(input.earnedOn) || input.earnedOn > today))
    errors.earnedOn = "Choose a valid date today or earlier.";
  return errors;
}

export function makeAchievement(
  input: AchievementInput,
  id: string,
  games: readonly Game[],
): Achievement {
  if (!id || Object.keys(validateAchievement(input, games)).length)
    throw new Error("Please check your achievement.");
  return {
    ...input,
    id,
    title: input.title.trim(),
    description: input.description.trim(),
    kind: input.kind as Achievement["kind"],
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, min: number, max: number): value is string =>
  typeof value === "string" &&
  value.trim().length >= min &&
  value.length <= max;

function isStats(value: unknown): value is PlayerStats {
  if (!record(value) || !text(value.game, 1, 120)) return false;
  return (
    STAT_FIELDS.some(({ id }) => value[id] !== null) &&
    STAT_FIELDS.every(({ id, max }) => {
      const number = value[id];
      return (
        number === null ||
        (typeof number === "number" &&
          Number.isFinite(number) &&
          number >= 0 &&
          number <= max &&
          (id === "hours"
            ? /^\d+(?:\.\d)?$/.test(String(number))
            : Number.isInteger(number)))
      );
    })
  );
}

function isAchievement(value: unknown): value is Achievement {
  return (
    record(value) &&
    text(value.id, 1, 120) &&
    text(value.game, 1, 120) &&
    text(value.title, 2, 80) &&
    text(value.description, 0, 500) &&
    ACHIEVEMENT_TYPES.some((kind) => kind === value.kind) &&
    typeof value.earnedOn === "string" &&
    (!value.earnedOn || validDate(value.earnedOn))
  );
}

export function readProfile(raw: string | null): {
  profile: PlayerProfile;
  error: string | null;
} {
  if (raw === null) return { profile: EMPTY_PROFILE, error: null };
  try {
    const data: unknown = JSON.parse(raw);
    if (!record(data) || data.version !== 1 || !record(data.profile))
      throw new Error();
    const profile = data.profile;
    if (
      !text(profile.name, 0, 32) ||
      !text(profile.bio, 0, 240) ||
      !Array.isArray(profile.stats) ||
      !profile.stats.every(isStats) ||
      !Array.isArray(profile.achievements) ||
      !profile.achievements.every(isAchievement) ||
      new Set(profile.stats.map((stat) => stat.game)).size !==
        profile.stats.length ||
      new Set(profile.achievements.map((achievement) => achievement.id))
        .size !== profile.achievements.length
    )
      throw new Error();
    return { profile: profile as PlayerProfile, error: null };
  } catch {
    return {
      profile: EMPTY_PROFILE,
      error:
        "Your saved profile couldn't be read. It has been left untouched. Restore a valid backup or clear this site's profile storage to start again.",
    };
  }
}
