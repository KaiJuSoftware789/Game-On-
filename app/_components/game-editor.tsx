"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  GAME_THEMES,
  gameBadge,
  validateGame,
  type Game,
  type GameErrors,
} from "@/lib/sessions";
import { saveGame } from "@/lib/session-store";
import { Icon } from "./icon";
import { Modal } from "./modal";

export function GameEditor({
  games,
  onSaved,
  onClose,
}: {
  games: readonly Game[];
  onSaved: (game: Game) => void;
  onClose: () => void;
}) {
  const [editingId, setEditingId] = useState("");
  const customGames = games.filter((game) => game.id.startsWith("custom-"));
  const existing = customGames.find((game) => game.id === editingId);

  return (
    <Modal
      titleId="game-editor-title"
      onClose={onClose}
      className="game-editor-modal"
    >
      <div className="modal-heading">
        <span className="eyebrow">
          <Icon name="gamepad" /> YOUR GAMES BELONG HERE
        </span>
        <h2 id="game-editor-title">
          {editingId ? "Customize your game." : "Add a multiplayer game."}
        </h2>
        <p>
          Player-added games belong to the Unofficial section. Customize yours
          for sessions and your profile.
        </p>
      </div>
      {customGames.length > 0 && (
        <label className="field library-select">
          Your game library
          <select
            aria-label="Your game library"
            value={editingId}
            onChange={(event) => setEditingId(event.target.value)}
          >
            <option value="">Add a new game</option>
            {customGames.map((game) => (
              <option key={game.id} value={game.id}>
                Edit {game.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <GameForm
        key={editingId}
        games={games}
        existing={existing}
        editingId={editingId}
        onSaved={onSaved}
        onClose={onClose}
      />
    </Modal>
  );
}

function GameForm({
  games,
  existing,
  editingId,
  onSaved,
  onClose,
}: {
  games: readonly Game[];
  existing?: Game;
  editingId: string;
  onSaved: (game: Game) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [genre, setGenre] = useState(existing?.genre || "");
  const [mark, setMark] = useState(existing?.mark || "");
  const [theme, setTheme] = useState<Game["theme"]>(existing?.theme || "sage");
  const [errors, setErrors] = useState<GameErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const input = { name, genre, mark, theme };
    const validation = validateGame(input, games, editingId || undefined);
    setErrors(validation);
    setSaveError(null);
    const firstError = Object.keys(validation)[0];
    if (firstError) {
      (
        event.currentTarget.elements.namedItem(firstError) as HTMLElement | null
      )?.focus();
      return;
    }
    submitting.current = true;
    try {
      onSaved(saveGame(input, editingId || undefined));
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Couldn't save this game. Please try again.",
      );
      submitting.current = false;
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="game-editor-layout">
        <div className="game-editor-fields">
          <div className="field">
            <label htmlFor="custom-game-name">Game name</label>
            <input
              id="custom-game-name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((previous) => ({ ...previous, name: undefined }));
                setSaveError(null);
              }}
              maxLength={60}
              placeholder="e.g. Stardew Valley"
              required
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "custom-name-error" : undefined}
            />
            {errors.name && (
              <span id="custom-name-error" className="field-error">
                {errors.name}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="custom-game-genre">
              Category <span className="field-hint">Optional</span>
            </label>
            <input
              id="custom-game-genre"
              name="genre"
              value={genre}
              onChange={(event) => {
                setGenre(event.target.value);
                setErrors((previous) => ({ ...previous, genre: undefined }));
              }}
              maxLength={40}
              placeholder="e.g. Farming & co-op"
              aria-invalid={!!errors.genre}
              aria-describedby={errors.genre ? "custom-genre-error" : undefined}
            />
            {errors.genre && (
              <span id="custom-genre-error" className="field-error">
                {errors.genre}
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="custom-game-mark">
              Badge{" "}
              <span className="field-hint">
                Optional · up to 3 letters or numbers
              </span>
            </label>
            <input
              id="custom-game-mark"
              name="mark"
              value={mark}
              onChange={(event) => {
                setMark(event.target.value);
                setErrors((previous) => ({ ...previous, mark: undefined }));
              }}
              maxLength={3}
              placeholder={gameBadge(name)}
              aria-invalid={!!errors.mark}
              aria-describedby={errors.mark ? "custom-mark-error" : undefined}
            />
            {errors.mark && (
              <span id="custom-mark-error" className="field-error">
                {errors.mark}
              </span>
            )}
          </div>
        </div>
        <div className="game-preview" aria-label="Game card preview">
          <div
            className={`game-art game-custom game-theme-${theme}`}
            aria-hidden="true"
          >
            <div className="art-grid" />
            <span className="art-ring ring-one" />
            <span className="game-monogram">{gameBadge(name, mark)}</span>
            <span className="game-art-caption">
              {genre.trim() || "Multiplayer"}
            </span>
            <Icon name="gamepad" className="art-gamepad" />
          </div>
          <div className="game-preview-name">
            <strong>{name.trim() || "Your next favorite game"}</strong>
            <span>Custom game</span>
          </div>
        </div>
      </div>
      <fieldset className="game-color-picker">
        <legend>Card color</legend>
        {GAME_THEMES.map((option) => (
          <label key={option.id} className="color-option">
            <input
              type="radio"
              name="theme"
              value={option.id}
              checked={theme === option.id}
              onChange={() => setTheme(option.id)}
            />
            <span className={`color-swatch dot-theme-${option.id}`} />
            <span>{option.name}</span>
          </label>
        ))}
      </fieldset>
      {errors.theme && <p className="field-error">{errors.theme}</p>}
      <p className="game-library-note">
        <Icon name="monitor" />
        Saved in this browser. Available in your filters and session form.
      </p>
      {saveError && (
        <p role="alert" className="error-banner">
          {saveError}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button button-quiet" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="button button-primary">
          {editingId ? "Save changes" : "Add game"}
          <Icon name="check" />
        </button>
      </div>
    </form>
  );
}
