"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  PLATFORMS,
  REGIONS,
  VIBES,
  makeSession,
  validateSession,
  type Session,
  type SessionErrors,
  type SessionInput,
  type Game,
} from "@/lib/sessions";
import { saveSession } from "@/lib/session-store";
import { Icon } from "./icon";
import { Modal } from "./modal";
import { GameEditor } from "./game-editor";
import { GameOptions } from "./game-section";
import { getProfileSnapshot, subscribeToProfile } from "@/lib/profile-store";
import { readProfile } from "@/lib/profile";

const getServerProfile = () => null;

export function CreateSession({
  onClose,
  onCreated,
  games,
  initialGame = "",
}: {
  onClose: () => void;
  onCreated: (session: Session) => void;
  games: readonly Game[];
  initialGame?: string;
}) {
  const profileSnapshot = useSyncExternalStore(
    subscribeToProfile,
    getProfileSnapshot,
    getServerProfile,
  );
  const profileName = readProfile(profileSnapshot).profile.name;
  const [scheduled, setScheduled] = useState(false);
  const [errors, setErrors] = useState<SessionErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [selectedGame, setSelectedGame] = useState(initialGame);
  const [showGameEditor, setShowGameEditor] = useState(false);

  function fieldError(name: keyof SessionInput) {
    return errors[name] ? (
      <span id={`${name}-error`} className="field-error">
        {errors[name]}
      </span>
    ) : null;
  }
  function accessibleError(name: keyof SessionInput) {
    return {
      "aria-invalid": !!errors[name],
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    };
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: SessionInput = {
      title: String(data.get("title") ?? ""),
      host: String(data.get("host") ?? ""),
      game: String(data.get("game") ?? ""),
      platform: String(data.get("platform") ?? ""),
      region: String(data.get("region") ?? ""),
      vibe: String(data.get("vibe") ?? ""),
      capacity: String(data.get("capacity") ?? ""),
      description: String(data.get("description") ?? ""),
      startsAt: scheduled ? String(data.get("startsAt") ?? "") : "",
      voice: data.get("voice") === "on",
    };
    const validation = validateSession(input, Date.now(), games);
    if (scheduled && !input.startsAt)
      validation.startsAt = "Choose when your session starts.";
    setErrors(validation);
    setSaveError(null);
    const firstError = Object.keys(validation)[0];
    if (firstError) {
      (form.elements.namedItem(firstError) as HTMLElement | null)?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const session = makeSession(
        input,
        crypto.randomUUID(),
        Date.now(),
        games,
      );
      saveSession(session);
      onCreated(session);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Couldn't save your session. Please try again.",
      );
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <Modal titleId="create-title" onClose={onClose} className="create-modal">
        <div className="modal-heading">
          <span className="eyebrow">
            <Icon name="plus" /> MAKE ROOM FOR YOUR NEXT SQUAD
          </span>
          <h2 id="create-title">Host a session.</h2>
          <p>A game, a plan, and some good company.</p>
        </div>
        <div className="local-note">
          <Icon name="monitor" />
          <p>
            This session is saved in this browser only. It won’t be visible to
            other players yet.
          </p>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <label className="field full">
              Session title
              <input
                name="title"
                placeholder="A few chill games after work"
                maxLength={80}
                required
                {...accessibleError("title")}
              />
              {fieldError("title")}
            </label>
            <label className="field">
              Your player name
              <input
                name="host"
                defaultValue={profileName}
                placeholder="What should we call you?"
                maxLength={32}
                autoComplete="nickname"
                required
                {...accessibleError("host")}
              />
              {fieldError("host")}
            </label>
            <div className="field">
              <label htmlFor="session-game">Game</label>
              <select
                id="session-game"
                name="game"
                value={selectedGame}
                onChange={(event) => setSelectedGame(event.target.value)}
                required
                {...accessibleError("game")}
              >
                <option value="" disabled>
                  Choose your game
                </option>
                <GameOptions games={games} />
              </select>
              {fieldError("game")}
              <button
                type="button"
                className="add-game-inline"
                onClick={() => setShowGameEditor(true)}
              >
                <Icon name="plus" />
                Add or customize a game
              </button>
            </div>
            <label className="field">
              Platform
              <select
                name="platform"
                defaultValue="Cross-play"
                {...accessibleError("platform")}
              >
                {PLATFORMS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              {fieldError("platform")}
            </label>
            <label className="field">
              Region
              <select
                name="region"
                defaultValue="North America"
                {...accessibleError("region")}
              >
                {REGIONS.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              {fieldError("region")}
            </label>
            <label className="field">
              Play style
              <select
                name="vibe"
                defaultValue="Casual"
                {...accessibleError("vibe")}
              >
                {VIBES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              {fieldError("vibe")}
            </label>
            <label className="field">
              Total players <span className="field-hint">Including you</span>
              <input
                name="capacity"
                type="number"
                min={2}
                max={16}
                step={1}
                defaultValue={4}
                required
                {...accessibleError("capacity")}
              />
              {fieldError("capacity")}
            </label>
            <label className="field">
              Start time
              <select
                name="timing"
                value={scheduled ? "scheduled" : "now"}
                onChange={(event) =>
                  setScheduled(event.target.value === "scheduled")
                }
              >
                <option value="now">Ready to play</option>
                <option value="scheduled">Schedule for later</option>
              </select>
            </label>
            {scheduled && (
              <label className="field">
                Date and time{" "}
                <span className="field-hint">Your local time</span>
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  {...accessibleError("startsAt")}
                />
                {fieldError("startsAt")}
              </label>
            )}
            <label className="field full">
              The plan{" "}
              <span className="field-hint">Optional · 500 characters max</span>
              <textarea
                name="description"
                rows={3}
                maxLength={500}
                placeholder="What are you playing? What kind of teammates are you looking for?"
                {...accessibleError("description")}
              />
              {fieldError("description")}
            </label>
          </div>
          <label className="checkbox-label voice-field">
            <input type="checkbox" name="voice" defaultChecked />
            <Icon name="mic" /> Voice chat preferred
          </label>
          {saveError && (
            <p role="alert" className="error-banner">
              {saveError}
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
            <button
              type="submit"
              className="button button-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Create session"}
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      </Modal>
      {showGameEditor && (
        <GameEditor
          games={games}
          onClose={() => setShowGameEditor(false)}
          onSaved={(game) => {
            setSelectedGame(game.id);
            setShowGameEditor(false);
            setErrors((previous) => ({ ...previous, game: undefined }));
          }}
        />
      )}
    </>
  );
}
