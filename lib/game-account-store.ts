"use client";

import { changeGameUsername, readGameAccounts } from "./rankings";
import { STORAGE_UNAVAILABLE } from "./session-store";

export const ACCOUNT_STORAGE_KEY = "game-on:game-accounts:v1";
const CHANGED_EVENT = "game-on:game-accounts-changed";
export function getGameAccountSnapshot() {
  try {
    return localStorage.getItem(ACCOUNT_STORAGE_KEY);
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}
export function subscribeToGameAccounts(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACCOUNT_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED_EVENT, onChange);
  };
}
export function saveGameUsername(username: string) {
  const raw = getGameAccountSnapshot();
  if (raw === STORAGE_UNAVAILABLE)
    throw new Error(
      "Allow browser storage to save your Riot ID. Your entry is still here.",
    );
  const current = readGameAccounts(raw);
  if (current.error) throw new Error(current.error);
  const account = changeGameUsername(current.accounts[0], username);
  try {
    localStorage.setItem(
      ACCOUNT_STORAGE_KEY,
      JSON.stringify({ version: 1, accounts: [account] }),
    );
  } catch {
    throw new Error(
      "Your Riot ID couldn't be saved. Browser storage may be full or disabled. Try again; your entry is still here.",
    );
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}
