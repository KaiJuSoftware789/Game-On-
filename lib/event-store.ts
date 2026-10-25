"use client";
import {
  parseLocalEvent,
  readEvents,
  type LocalEvent,
  type SavedEvent,
} from "./local-events";
import { STORAGE_UNAVAILABLE } from "./session-store";
export const EVENT_STORAGE_KEY = "game-on:events:v1";
const CHANGED = "game-on:events-changed";
export function getEventSnapshot() {
  try {
    return localStorage.getItem(EVENT_STORAGE_KEY);
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}
export function subscribeToEvents(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === EVENT_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGED, onChange);
  };
}
function changeEvents(update: (events: SavedEvent[]) => SavedEvent[]) {
  const raw = getEventSnapshot();
  if (raw === STORAGE_UNAVAILABLE)
    throw new Error(
      "Allow browser storage to save events. Your details are still here.",
    );
  const saved = readEvents(raw);
  if (saved.error) throw new Error(saved.error);
  const events = update(saved.events);
  if (events.length > 500)
    throw new Error(
      "Your event library is full. Remove an old saved event first.",
    );
  try {
    localStorage.setItem(
      EVENT_STORAGE_KEY,
      JSON.stringify({ version: 1, events }),
    );
  } catch {
    throw new Error(
      "Your event couldn't be saved. Browser storage may be full or disabled. Your details are still here so you can retry.",
    );
  }
  window.dispatchEvent(new Event(CHANGED));
}
export function saveLocalEvent(
  event: LocalEvent,
  source: SavedEvent["source"] = "local",
) {
  const parsed = parseLocalEvent(event);
  changeEvents((events) => {
    if (events.some((item) => item.event.id === parsed.id))
      throw new Error(
        "This event is already saved. The existing copy has been kept.",
      );
    return [{ event: parsed, source }, ...events];
  });
}
export function removeLocalEvent(id: string) {
  changeEvents((events) => events.filter((item) => item.event.id !== id));
}
export function cancelLocalEvent(id: string) {
  changeEvents((events) =>
    events.map((item) =>
      item.event.id === id && item.source === "local"
        ? { ...item, event: { ...item.event, status: "cancelled" } }
        : item,
    ),
  );
}
