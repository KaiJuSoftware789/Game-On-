"use client";
import { useState } from "react";
import { eventDate, eventShareUrl, type LocalEvent } from "@/lib/local-events";
import {
  cancelLocalEvent,
  removeLocalEvent,
  saveLocalEvent,
} from "@/lib/event-store";
import { Modal } from "./modal";
import { Icon } from "./icon";
import { GameSectionBadge } from "./game-section";
export type DisplayEvent = {
  event: LocalEvent;
  source: "local" | "shared" | "public";
  owner?: boolean;
  distance?: number;
};
export function LocalEventDetails({
  item,
  saved,
  signedIn,
  now,
  onClose,
  onChanged,
}: {
  item: DisplayEvent;
  saved: boolean;
  signedIn: boolean;
  now: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [event, setEvent] = useState(item.event),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [shareLink, setShareLink] = useState(""),
    [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const ended = Date.parse(event.endsAt) <= now;
  const owner =
    item.source === "local" ||
    (item.source === "public" && item.owner && signedIn);
  async function share() {
    setError("");
    setNotice("");
    const url =
      item.source === "public"
        ? `${window.location.origin}/events?event=${event.id}`
        : eventShareUrl(event, window.location.origin);
    setShareLink(url);
    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: `${event.kind} · ${eventDate(event)}`,
          url,
        });
        setNotice("Event shared.");
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("Event link copied.");
      }
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError"))
        setNotice("Select and copy the link below to share this event.");
    }
  }
  async function cancel() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (item.source === "public") {
        const response = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel", id: event.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
      } else cancelLocalEvent(event.id);
      setEvent({ ...event, status: "cancelled" });
      setShareLink("");
      setConfirmCancel(false);
      setNotice("Event cancelled.");
      onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't cancel this event. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      titleId="event-detail-title"
      onClose={onClose}
      className="event-detail-modal"
    >
      <div className={`event-detail-art game-theme-${event.game.theme}`}>
        <span className="event-type-label">
          <Icon name={event.kind === "Tournament" ? "trophy" : "gamepad"} />
          {event.kind}
        </span>
        <span className="event-detail-mark" aria-hidden="true">
          {event.game.mark}
        </span>
      </div>
      <div className="event-detail-body">
        <div className="event-detail-game">
          <span>{event.game.name}</span>
          <GameSectionBadge id={event.game.id} />
        </div>
        <h2 id="event-detail-title">{event.title}</h2>
        <span
          className={`event-status ${event.status === "cancelled" ? "cancelled" : ""}`}
        >
          {event.status === "cancelled"
            ? "Cancelled"
            : ended
              ? "Event ended"
              : "Upcoming event"}
        </span>
        <dl className="event-detail-facts">
          <div>
            <dt>
              <Icon name="calendar" />
              When
            </dt>
            <dd>
              {eventDate(event)}
              <small>
                {(Date.parse(event.endsAt) - Date.parse(event.startsAt)) /
                  3600000}{" "}
                hours · Venue time
              </small>
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="pin" />
              Where
            </dt>
            <dd>
              {event.venue}
              <small>
                {event.address}
                <br />
                {event.location.city}, {event.location.state}{" "}
                {event.location.zip}
              </small>
            </dd>
          </div>
          <div>
            <dt>
              <Icon name="players" />
              Organizer
            </dt>
            <dd>
              {event.host}
              <small>Up to {event.capacity} players</small>
            </dd>
          </div>
        </dl>
        {event.description && (
          <p className="event-description">{event.description}</p>
        )}
        <div className="event-external-links">
          <a
            className="text-link"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${event.address}, ${event.location.city}, ${event.location.state} ${event.location.zip}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            View venue on map <Icon name="arrow" />
          </a>
          {event.registrationUrl && event.status !== "cancelled" && !ended && (
            <a
              className="text-link"
              href={event.registrationUrl}
              target="_blank"
              rel="noreferrer"
            >
              Organizer’s registration page <Icon name="arrow" />
            </a>
          )}
        </div>
        <p className="event-source-note">
          {item.source === "public"
            ? "Public event · This link shows the latest event status."
            : item.source === "shared"
              ? "Shared event copy · Check details with the organizer; copies don’t update automatically."
              : "Saved in this browser · Share links contain a copy of these details. Send a new link if the event changes."}
        </p>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="success-banner" role="status">
            {notice}
          </p>
        )}
        {shareLink && (
          <label className="field event-share-link">
            Event share link
            <textarea
              readOnly
              value={shareLink}
              rows={2}
              onFocus={(e) => e.target.select()}
            />
            <span className="field-hint">
              Includes the organizer name and venue address.
            </span>
          </label>
        )}
        <div className="event-detail-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={() => void share()}
          >
            <Icon name="share" />
            Share event
          </button>
          {item.source === "shared" && !saved && (
            <button
              className="button button-outline"
              type="button"
              onClick={() => {
                try {
                  saveLocalEvent(event, "shared");
                  setNotice("Saved to your events in this browser.");
                  onChanged();
                } catch (cause) {
                  setError((cause as Error).message);
                }
              }}
            >
              Save to my events
            </button>
          )}
          {owner && event.status !== "cancelled" && !ended && (
            <button
              className="button button-quiet"
              type="button"
              disabled={busy}
              onClick={() => setConfirmCancel(true)}
            >
              Cancel event
            </button>
          )}
          {saved &&
            (item.source === "shared" ||
              event.status === "cancelled" ||
              ended) && (
              <button
                className="button button-quiet"
                type="button"
                onClick={() => {
                  try {
                    removeLocalEvent(event.id);
                    onChanged();
                    onClose();
                  } catch (cause) {
                    setError((cause as Error).message);
                  }
                }}
              >
                Remove saved copy
              </button>
            )}
        </div>
        {confirmCancel && (
          <div className="event-cancel-confirm">
            <p>
              Cancel this event?{" "}
              {item.source === "public"
                ? "It will leave nearby results, and its link will show it as cancelled."
                : "Previously shared copies won’t update automatically."}
            </p>
            <button
              className="button button-outline"
              type="button"
              disabled={busy}
              onClick={() => void cancel()}
            >
              {busy ? "Cancelling…" : "Confirm cancellation"}
            </button>
            <button
              className="button button-quiet"
              type="button"
              onClick={() => setConfirmCancel(false)}
            >
              Keep event
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
