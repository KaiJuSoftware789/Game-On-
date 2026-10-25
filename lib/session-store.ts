"use client";

import {
  GAMES,
  makeGame,
  readSessions,
  type Game,
  type GameInput,
  type Session,
} from "./sessions";

export const STORAGE_KEY = "game-on:sessions:v1";
const CHANGED_EVENT = "game-on:sessions-changed";
export const STORAGE_UNAVAILABLE = "storage-unavailable";

export function getSessionSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}

export function subscribeToSessions(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED_EVENT, onChange);
  };
}

export function saveSession(session: Session) {
  const raw = getSessionSnapshot();
  if (raw === STORAGE_UNAVAILABLE)
    throw new Error(
      "Browser storage is unavailable. Allow site storage and try again; your form is still here.",
    );
  const current = readSessions(raw);
  if (current.error) throw new Error(current.error);
  if (![...GAMES, ...current.games].some((game) => game.id === session.game))
    throw new Error(
      "This game is no longer available. Choose another game before saving.",
    );
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        sessions: [session, ...current.sessions],
        games: current.games,
      }),
    );
  } catch {
    throw new Error(
      "Your session couldn't be saved. Browser storage may be full or disabled. Your form is still here so you can try again.",
    );
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function saveGame(input: GameInput, editingId?: string): Game {
  const raw = getSessionSnapshot();
  if (raw === STORAGE_UNAVAILABLE)
    throw new Error(
      "Browser storage is unavailable. Allow site storage to save games.",
    );
  const current = readSessions(raw);
  if (current.error) throw new Error(current.error);
  if (editingId && !current.games.some((game) => game.id === editingId))
    throw new Error(
      "This custom game is no longer available. Close this form and add it again.",
    );
  const game = makeGame(
    input,
    editingId || `custom-${crypto.randomUUID()}`,
    [...GAMES, ...current.games],
    editingId,
  );
  const games = editingId
    ? current.games.map((saved) => (saved.id === editingId ? game : saved))
    : [...current.games, game];
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, sessions: current.sessions, games }),
    );
  } catch {
    throw new Error(
      "Your game couldn't be saved. Browser storage may be full or disabled. Your changes are still here so you can try again.",
    );
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
  return game;
}
