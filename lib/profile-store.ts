"use client";

import { GAMES, readSessions } from "./sessions";
import { getSessionSnapshot, STORAGE_UNAVAILABLE } from "./session-store";
import {
  makeAchievement,
  makeStats,
  readProfile,
  validateProfileBasics,
  type AchievementInput,
  type PlayerProfile,
  type StatsInput,
} from "./profile";

export const PROFILE_STORAGE_KEY = "game-on:profile:v1";
const CHANGED_EVENT = "game-on:profile-changed";

export function getProfileSnapshot(): string | null {
  try {
    return localStorage.getItem(PROFILE_STORAGE_KEY);
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}

export function subscribeToProfile(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROFILE_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED_EVENT, onChange);
  };
}

function changeProfile(update: (profile: PlayerProfile) => PlayerProfile) {
  const raw = getProfileSnapshot();
  if (raw === STORAGE_UNAVAILABLE)
    throw new Error(
      "Browser storage is unavailable. Allow site storage and try again; your changes are still here.",
    );
  const current = readProfile(raw);
  if (current.error) throw new Error(current.error);
  const profile = update(current.profile);
  try {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ version: 1, profile }),
    );
  } catch {
    throw new Error(
      "Your profile couldn't be saved. Browser storage may be full or disabled. Your changes are still here so you can try again.",
    );
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

function currentGames() {
  const raw = getSessionSnapshot();
  if (raw === STORAGE_UNAVAILABLE)
    throw new Error("Allow browser storage to access your game library.");
  const current = readSessions(raw);
  if (current.error) throw new Error(current.error);
  return [...GAMES, ...current.games];
}

export function saveProfileBasics(input: { name: string; bio: string }) {
  if (Object.keys(validateProfileBasics(input)).length)
    throw new Error("Please check your profile details.");
  changeProfile((profile) => ({
    ...profile,
    name: input.name.trim(),
    bio: input.bio.trim(),
  }));
}

export function saveStats(input: StatsInput, editingGame?: string) {
  const stats = makeStats(input, currentGames());
  changeProfile((profile) => {
    if (
      editingGame &&
      (editingGame !== stats.game ||
        !profile.stats.some((stat) => stat.game === editingGame))
    )
      throw new Error(
        "These stats have changed in another tab. Close the form and reopen them.",
      );
    if (!editingGame && profile.stats.some((stat) => stat.game === stats.game))
      throw new Error(
        "You already have stats for this game. Close this form and edit that game's stats.",
      );
    return {
      ...profile,
      stats: editingGame
        ? profile.stats.map((stat) =>
            stat.game === editingGame ? stats : stat,
          )
        : [...profile.stats, stats],
    };
  });
}

export function removeStats(game: string) {
  changeProfile((profile) => ({
    ...profile,
    stats: profile.stats.filter((stat) => stat.game !== game),
  }));
}

export function saveAchievement(input: AchievementInput, editingId?: string) {
  const achievement = makeAchievement(
    input,
    editingId || crypto.randomUUID(),
    currentGames(),
  );
  changeProfile((profile) => {
    if (
      editingId &&
      !profile.achievements.some((item) => item.id === editingId)
    )
      throw new Error(
        "This achievement was removed in another tab. Close this form and add it again.",
      );
    return {
      ...profile,
      achievements: editingId
        ? profile.achievements.map((item) =>
            item.id === editingId ? achievement : item,
          )
        : [achievement, ...profile.achievements],
    };
  });
}

export function removeAchievement(id: string) {
  changeProfile((profile) => ({
    ...profile,
    achievements: profile.achievements.filter((item) => item.id !== id),
  }));
}
