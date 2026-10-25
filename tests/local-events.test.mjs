import test from "node:test";
import assert from "node:assert/strict";
import { GAMES } from "../lib/sessions.ts";
import { lookupZip } from "../lib/zip-location.ts";
import {
  eventInstant,
  makeLocalEvent,
  validateEvent,
  parseLocalEvent,
  readEvents,
  distanceMiles,
  nearbyEvents,
  eventShareUrl,
  eventFromShare,
  registrationLink,
} from "../lib/local-events.ts";
const now = Date.parse("2026-10-25T12:00:00Z");
const input = {
  title: "Community tournament",
  kind: "Tournament",
  game: "valorant",
  host: "Nova",
  venue: "Community game lounge",
  address: "100 Example Street",
  zip: "60601",
  startsAt: "2027-01-10T18:00",
  timezone: "America/Chicago",
  duration: "3",
  capacity: "16",
  description: "Bring a controller. Everyone welcome.",
  registrationUrl: "",
};
const make = (changes = {}) =>
  makeLocalEvent(
    { ...input, ...changes },
    GAMES,
    lookupZip(changes.zip || input.zip),
    crypto.randomUUID(),
    now,
  );
test("ZIP directory handles leading zeros, real coordinates and unknown codes", () => {
  assert.equal(lookupZip("00501").zip, "00501");
  assert.equal(lookupZip("02108").city, "Boston");
  for (const zip of ["00000", "6060", "606011", "60601-0001", "abcde"])
    assert.throws(() => lookupZip(zip));
  const miles = distanceMiles(lookupZip("60601"), lookupZip("60201"));
  assert.ok(miles > 10 && miles < 15);
  assert.equal(distanceMiles(lookupZip("60601"), lookupZip("60601")), 0);
});
test("event times use the venue zone and reject ambiguous or nonexistent daylight saving times", () => {
  assert.equal(
    eventInstant("2027-01-10T18:00", "America/Chicago"),
    "2027-01-11T00:00:00.000Z",
  );
  assert.equal(
    eventInstant("2027-06-10T18:00", "America/Chicago"),
    "2027-06-10T23:00:00.000Z",
  );
  for (const time of [
    "2027-03-14T02:30",
    "2027-11-07T01:30",
    "2027-02-30T15:00",
  ])
    assert.throws(() => eventInstant(time, "America/Chicago"));
  assert.throws(() => eventInstant("2027-01-10T18:00", "Unknown/Zone"));
});
test("creation validates event details, future schedules, limits and registration links", () => {
  const event = make({ duration: "0.5" });
  assert.equal(Date.parse(event.endsAt) - Date.parse(event.startsAt), 1800000);
  assert.equal(event.location.city, "Chicago");
  for (const change of [
    { capacity: "1.5" },
    { capacity: "1" },
    { duration: "0" },
    { duration: "1.25" },
    { duration: "25" },
    { kind: "Anything" },
    { game: "missing" },
    { title: " " },
    { zip: "abcde" },
    { startsAt: "2026-10-24T18:00" },
    { registrationUrl: "javascript:alert(1)" },
  ])
    assert.ok(
      Object.keys(validateEvent({ ...input, ...change }, GAMES, now)).length,
    );
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:password@example.com",
    "data:text/html,x",
  ])
    assert.throws(() => registrationLink(url));
  assert.equal(
    registrationLink("https://example.com/register"),
    "https://example.com/register",
  );
});
test("nearby results use true distance, event type, section, game, cancellation and end times", () => {
  const close = make(),
    near = make({ zip: "60201", kind: "Gaming session" }),
    far = make({ zip: "90210" }),
    cancelled = { ...make(), status: "cancelled" },
    past = {
      ...make(),
      startsAt: "2026-01-01T18:00:00Z",
      endsAt: "2026-01-01T21:00:00Z",
    };
  const events = [close, near, far, cancelled, past].map((event) => ({
    event,
    source: "local",
  }));
  const filters = { kind: "", section: "all", game: "" };
  assert.equal(
    nearbyEvents(events, lookupZip("60601"), 25, filters, now).length,
    2,
  );
  assert.equal(
    nearbyEvents(events, lookupZip("60601"), 5, filters, now).length,
    1,
  );
  assert.equal(
    nearbyEvents(
      events,
      lookupZip("60601"),
      25,
      { ...filters, kind: "Gaming session" },
      now,
    )[0].event.id,
    near.id,
  );
  assert.equal(
    nearbyEvents(
      events,
      lookupZip("60601"),
      25,
      { ...filters, section: "unofficial" },
      now,
    ).length,
    0,
  );
  assert.equal(
    nearbyEvents(
      events,
      lookupZip("60601"),
      25,
      { ...filters, game: "Fortnite" },
      now,
    ).length,
    0,
  );
});
test("share links round trip Unicode details and reject malformed or unsafe payloads", () => {
  const event = make({
    title: "Café tournament 🎮",
    description: "Bring friends!",
  });
  const link = eventShareUrl(event, "https://game-on.example");
  assert.deepEqual(eventFromShare(new URL(link).hash), event);
  for (const value of [
    "#event=",
    "garbage",
    "#event=@@@@",
    "#event=" + "a".repeat(12001),
    "#event=e30",
  ])
    assert.throws(() => eventFromShare(value));
  assert.throws(() =>
    eventShareUrl(
      { ...event, registrationUrl: "javascript:alert(1)" },
      "https://game-on.example",
    ),
  );
  assert.throws(() =>
    parseLocalEvent({
      ...event,
      location: { ...event.location, latitude: Infinity },
    }),
  );
});
test("saved events preserve independent game snapshots and report corruption without replacement", () => {
  const event = make();
  const saved = { event, source: "local" };
  assert.deepEqual(readEvents(null), { events: [], error: null });
  assert.deepEqual(
    readEvents(JSON.stringify({ version: 1, events: [saved] })).events,
    [saved],
  );
  for (const raw of [
    "{",
    "null",
    "{}",
    JSON.stringify({ version: 2, events: [saved] }),
    JSON.stringify({ version: 1, events: [saved, saved] }),
    JSON.stringify({ version: 1, events: [{ ...saved, source: "public" }] }),
  ])
    assert.ok(readEvents(raw).error);
  assert.throws(() => parseLocalEvent({ ...event, capacity: 2.5 }));
  assert.throws(() => parseLocalEvent({ ...event, endsAt: event.startsAt }));
});
