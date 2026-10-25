"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  EVENT_KINDS,
  EVENT_TIMEZONES,
  makeLocalEvent,
  validateEvent,
  type EventErrors,
  type EventInput,
  type LocalEvent,
} from "@/lib/local-events";
import { saveLocalEvent } from "@/lib/event-store";
import type { Game } from "@/lib/sessions";
import type { EventConnection } from "./events-connection";
import { Modal } from "./modal";
import { GameOptions } from "./game-section";
import { Icon } from "./icon";
export function CreateLocalEvent({
  games,
  hostName,
  initialZip,
  service,
  onCreated,
  onClose,
}: {
  games: readonly Game[];
  hostName: string;
  initialZip: string;
  service: EventConnection;
  onCreated: (event: LocalEvent, published: boolean) => void;
  onClose: () => void;
}) {
  const [errors, setErrors] = useState<EventErrors>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [publish, setPublish] = useState(false);
  const submitting = useRef(false),
    eventId = useRef("");
  const fieldError = (name: keyof EventInput) =>
    errors[name] && (
      <span className="field-error" id={`event-${name}-error`}>
        {errors[name]}
      </span>
    );
  const accessible = (name: keyof EventInput) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `event-${name}-error` : undefined,
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget,
      data = new FormData(form);
    const input = Object.fromEntries(
      [
        "title",
        "kind",
        "game",
        "host",
        "venue",
        "address",
        "zip",
        "startsAt",
        "timezone",
        "duration",
        "capacity",
        "description",
        "registrationUrl",
      ].map((key) => [key, String(data.get(key) || "")]),
    ) as EventInput;
    const validation = validateEvent(input, games);
    setErrors(validation);
    setError("");
    const first = Object.keys(validation)[0];
    if (first) {
      (form.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/locations/zip?zip=${encodeURIComponent(input.zip.trim())}`,
      );
      const location = await response.json();
      if (!response.ok) {
        setErrors({ zip: location.error });
        throw new Error(location.error);
      }
      if (!eventId.current) eventId.current = crypto.randomUUID();
      const created = makeLocalEvent(input, games, location, eventId.current);
      if (publish) {
        const result = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: created }),
        });
        const body = await result.json();
        if (!result.ok)
          throw new Error(
            body.error || "Couldn't publish your event. Try again.",
          );
        onCreated(body.event, true);
      } else {
        saveLocalEvent(created);
        onCreated(created, false);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't save your event. Your details are still here.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      titleId="create-event-title"
      onClose={busy ? () => {} : onClose}
      className="create-modal event-create-modal"
    >
      <div className="modal-heading">
        <span className="eyebrow">
          <Icon name="pin" /> GOOD GAMES, CLOSE TO HOME
        </span>
        <h2 id="create-event-title">Host a local event.</h2>
        <p>A tournament, a LAN night, or a few games with the neighborhood.</p>
      </div>
      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy} className="event-form-fieldset">
          <div className="form-grid">
            <label className="field full">
              Event title
              <input
                name="title"
                aria-label="Event title"
                maxLength={80}
                placeholder="Saturday community tournament"
                required
                {...accessible("title")}
              />
              {fieldError("title")}
            </label>
            <label className="field">
              Event type
              <select
                name="kind"
                aria-label="Event type"
                defaultValue="Gaming session"
                {...accessible("kind")}
              >
                {EVENT_KINDS.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
              {fieldError("kind")}
            </label>
            <label className="field">
              Game
              <select
                name="game"
                aria-label="Game"
                defaultValue=""
                required
                {...accessible("game")}
              >
                <option value="" disabled>
                  Choose a game
                </option>
                <GameOptions games={games} />
              </select>
              {fieldError("game")}
            </label>
            <label className="field">
              Organizer name
              <input
                name="host"
                aria-label="Organizer name"
                defaultValue={hostName}
                maxLength={32}
                autoComplete="nickname"
                required
                {...accessible("host")}
              />
              {fieldError("host")}
            </label>
            <label className="field">
              Player limit
              <input
                name="capacity"
                aria-label="Player limit"
                type="number"
                min={2}
                max={1000}
                step={1}
                defaultValue={16}
                required
                {...accessible("capacity")}
              />
              {fieldError("capacity")}
            </label>
            <label className="field full">
              Venue name
              <input
                name="venue"
                aria-label="Venue name"
                maxLength={80}
                placeholder="Game lounge, community center, or venue"
                required
                {...accessible("venue")}
              />
              {fieldError("venue")}
            </label>
            <label className="field full">
              Venue street address
              <input
                name="address"
                aria-label="Venue street address"
                maxLength={160}
                placeholder="Street address and suite"
                required
                {...accessible("address")}
              />
              {fieldError("address")}
            </label>
            <label className="field">
              Venue ZIP code
              <input
                name="zip"
                aria-label="Venue ZIP code"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                defaultValue={initialZip}
                placeholder="60601"
                required
                {...accessible("zip")}
              />
              {fieldError("zip")}
            </label>
            <label className="field">
              Venue time zone
              <select
                name="timezone"
                aria-label="Venue time zone"
                defaultValue="America/Chicago"
                {...accessible("timezone")}
              >
                {EVENT_TIMEZONES.map(([zone, name]) => (
                  <option key={zone} value={zone}>
                    {name}
                  </option>
                ))}
              </select>
              {fieldError("timezone")}
            </label>
            <label className="field">
              Event date and time
              <input
                name="startsAt"
                aria-label="Event date and time"
                type="datetime-local"
                required
                {...accessible("startsAt")}
              />
              {fieldError("startsAt")}
            </label>
            <label className="field">
              Duration (hours)
              <input
                name="duration"
                aria-label="Duration (hours)"
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                defaultValue={3}
                required
                {...accessible("duration")}
              />
              {fieldError("duration")}
            </label>
            <label className="field full">
              What’s the plan?
              <textarea
                name="description"
                aria-label="What’s the plan?"
                maxLength={1000}
                rows={3}
                placeholder="Format, equipment to bring, entry requirements, or how to reach the organizer."
                {...accessible("description")}
              />
              {fieldError("description")}
            </label>
            <label className="field full">
              Registration link (optional)
              <input
                name="registrationUrl"
                aria-label="Registration link (optional)"
                type="url"
                maxLength={500}
                placeholder="https://…"
                {...accessible("registrationUrl")}
              />
              {fieldError("registrationUrl")}
            </label>
          </div>
          <div className="event-sharing-choice">
            <label>
              <input
                type="checkbox"
                checked={publish}
                disabled={!service.user}
                onChange={(event) => setPublish(event.target.checked)}
              />
              Publish so players can find this event by ZIP code
            </label>
            <p>
              {!service.client
                ? "Public publishing is coming soon. Save locally and share an event link now."
                : !service.user
                  ? "Sign in from Local events to enable public publishing. You can save locally now."
                  : publish
                    ? "Your event details, organizer name, and venue address will be public."
                    : "Saved in this browser. You can share the event details by link afterward."}
            </p>
            <p>Share links include the venue address and organizer name.</p>
          </div>
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="button button-quiet"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="button button-primary">
              {busy ? "Saving…" : publish ? "Publish event" : "Save event"}
              <Icon name="arrow" />
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
