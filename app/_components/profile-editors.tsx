"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Game } from "@/lib/sessions";
import {
  ACHIEVEMENT_TYPES,
  STAT_FIELDS,
  todayDate,
  validateAchievement,
  validateProfileBasics,
  validateStats,
  type Achievement,
  type AchievementInput,
  type PlayerProfile,
  type PlayerStats,
  type ProfileErrors,
  type StatsInput,
} from "@/lib/profile";
import {
  removeAchievement,
  removeStats,
  saveAchievement,
  saveProfileBasics,
  saveStats,
} from "@/lib/profile-store";
import { Modal } from "./modal";
import { GameOptions } from "./game-section";

// Keep drafts mounted on validation or storage failures so a retry loses no input.
function useProfileForm(onSaved: () => void) {
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saveError, setSaveError] = useState("");
  function commit(save: () => void) {
    setSaveError("");
    try {
      save();
      onSaved();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Couldn't save your changes. Please try again.",
      );
    }
  }
  function submit(
    event: FormEvent<HTMLFormElement>,
    validate: (data: FormData) => { errors: ProfileErrors; save: () => void },
  ) {
    event.preventDefault();
    const result = validate(new FormData(event.currentTarget));
    setErrors(result.errors);
    setSaveError("");
    const first = Object.keys(result.errors)[0];
    if (first) {
      (
        event.currentTarget.elements.namedItem(first) as HTMLElement | null
      )?.focus();
      return;
    }
    commit(result.save);
  }
  return {
    errors,
    saveError,
    submit,
    commit,
    clearError: (name: string) =>
      setErrors((previous) => {
        const next = { ...previous };
        delete next[name];
        return next;
      }),
  };
}

function Field({
  name,
  label,
  errors,
  children,
  hint,
}: {
  name: string;
  label: string;
  errors: ProfileErrors;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={`profile-field-${name}`}>{label}</label>
      {children}
      {hint && (
        <span className="field-hint" id={`profile-${name}-hint`}>
          {hint}
        </span>
      )}
      {errors[name] && (
        <span className="field-error" id={`profile-${name}-error`}>
          {errors[name]}
        </span>
      )}
    </div>
  );
}

function fieldProps(name: string, errors: ProfileErrors, hint = false) {
  return {
    id: `profile-field-${name}`,
    name,
    "aria-invalid": !!errors[name],
    "aria-describedby":
      [
        errors[name] ? `profile-${name}-error` : "",
        hint ? `profile-${name}-hint` : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
  };
}

function EditorActions({
  onClose,
  saveLabel,
  onRemove,
  removeLabel,
  error,
}: {
  onClose: () => void;
  saveLabel: string;
  onRemove?: () => void;
  removeLabel?: string;
  error: string;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <div className="form-actions profile-form-actions">
        {onRemove && (
          <button
            type="button"
            className="button button-danger"
            onClick={onRemove}
          >
            {removeLabel}
          </button>
        )}
        <button type="button" className="button button-quiet" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="button button-primary">
          {saveLabel}
        </button>
      </div>
    </>
  );
}

type EditorProps = { onClose: () => void; onSaved: () => void };

export function ProfileEditor({
  profile,
  onClose,
  onSaved,
}: EditorProps & { profile: PlayerProfile }) {
  const form = useProfileForm(onSaved);
  return (
    <Modal titleId="profile-editor-title" onClose={onClose}>
      <div className="modal-heading">
        <span className="eyebrow">THE PLAYER BEHIND THE STATS</span>
        <h2 id="profile-editor-title">Edit your profile.</h2>
        <p>Introduce yourself to your next squad.</p>
      </div>
      <form
        className="profile-editor-form"
        noValidate
        onChange={(event) =>
          form.clearError(event.target.getAttribute("name") || "")
        }
        onSubmit={(event) =>
          form.submit(event, (data) => {
            const input = {
              name: String(data.get("name") || ""),
              bio: String(data.get("bio") || ""),
            };
            return {
              errors: validateProfileBasics(input),
              save: () => saveProfileBasics(input),
            };
          })
        }
      >
        <Field name="name" label="Player name" errors={form.errors}>
          <input
            {...fieldProps("name", form.errors)}
            defaultValue={profile.name}
            maxLength={32}
            autoComplete="nickname"
            required
            placeholder="Your gaming name"
          />
        </Field>
        <Field name="bio" label="About you" errors={form.errors}>
          <textarea
            {...fieldProps("bio", form.errors)}
            defaultValue={profile.bio}
            maxLength={240}
            rows={3}
            placeholder="Your favorite games, play style, and what makes a great squad."
          />
        </Field>
        <EditorActions
          onClose={onClose}
          saveLabel="Save profile"
          error={form.saveError}
        />
      </form>
    </Modal>
  );
}

export function StatsEditor({
  games,
  existing,
  onClose,
  onSaved,
}: EditorProps & { games: readonly Game[]; existing?: PlayerStats }) {
  const form = useProfileForm(onSaved);
  return (
    <Modal titleId="stats-editor-title" onClose={onClose}>
      <div className="modal-heading">
        <span className="eyebrow">EVERY SESSION ADDS UP</span>
        <h2 id="stats-editor-title">
          {existing ? "Edit game stats." : "Add game stats."}
        </h2>
        <p>
          Enter your totals. Leave a stat blank if it doesn’t apply to this
          game.
        </p>
      </div>
      <form
        className="profile-editor-form"
        noValidate
        onChange={(event) =>
          form.clearError(event.target.getAttribute("name") || "")
        }
        onSubmit={(event) =>
          form.submit(event, (data) => {
            const input: StatsInput = {
              game: existing?.game || String(data.get("game") || ""),
              hours: String(data.get("hours") || ""),
              assists: String(data.get("assists") || ""),
              kills: String(data.get("kills") || ""),
            };
            return {
              errors: validateStats(input, games),
              save: () => saveStats(input, existing?.game),
            };
          })
        }
      >
        <Field name="game" label="Game" errors={form.errors}>
          <select
            {...fieldProps("game", form.errors)}
            defaultValue={existing?.game || ""}
            disabled={!!existing}
            required
          >
            <option value="" disabled>
              Choose your game
            </option>
            <GameOptions games={games} />
            {existing && !games.some((game) => game.id === existing.game) && (
              <option value={existing.game}>Unavailable game</option>
            )}
          </select>
        </Field>
        {!games.length && (
          <p className="profile-form-note">
            You’ve added stats for every game in your library. Close this form
            to edit a game’s existing stats, or add another unofficial game.
          </p>
        )}
        <div className="stats-inputs">
          {STAT_FIELDS.map(({ id, label, max }) => (
            <Field key={id} name={id} label={label} errors={form.errors}>
              <input
                {...fieldProps(id, form.errors)}
                type="text"
                inputMode={id === "hours" ? "decimal" : "numeric"}
                defaultValue={existing?.[id] ?? ""}
                placeholder={id === "hours" ? "e.g. 120.5" : "e.g. 250"}
                maxLength={String(max).length + 2}
              />
            </Field>
          ))}
        </div>
        <p className="profile-form-note">
          Self-reported totals, saved in this browser. Game accounts aren’t
          connected.
        </p>
        <EditorActions
          onClose={onClose}
          saveLabel="Save stats"
          error={form.saveError}
          onRemove={
            existing
              ? () => form.commit(() => removeStats(existing.game))
              : undefined
          }
          removeLabel="Remove stats"
        />
      </form>
    </Modal>
  );
}

export function AchievementEditor({
  games,
  existing,
  onClose,
  onSaved,
}: EditorProps & { games: readonly Game[]; existing?: Achievement }) {
  const form = useProfileForm(onSaved);
  return (
    <Modal titleId="achievement-editor-title" onClose={onClose}>
      <div className="modal-heading">
        <span className="eyebrow">A MOMENT WORTH KEEPING</span>
        <h2 id="achievement-editor-title">
          {existing ? "Edit achievement." : "Add an achievement."}
        </h2>
        <p>A hard-earned unlock, a clutch play, or a personal best.</p>
      </div>
      <form
        className="profile-editor-form"
        noValidate
        onChange={(event) =>
          form.clearError(event.target.getAttribute("name") || "")
        }
        onSubmit={(event) =>
          form.submit(event, (data) => {
            const input: AchievementInput = {
              game: String(data.get("game") || ""),
              title: String(data.get("title") || ""),
              description: String(data.get("description") || ""),
              kind: String(data.get("kind") || ""),
              earnedOn: String(data.get("earnedOn") || ""),
            };
            return {
              errors: validateAchievement(input, games),
              save: () => saveAchievement(input, existing?.id),
            };
          })
        }
      >
        <div className="form-grid">
          <Field name="game" label="Game" errors={form.errors}>
            <select
              {...fieldProps("game", form.errors)}
              defaultValue={existing?.game || ""}
              required
            >
              <option value="" disabled>
                Choose your game
              </option>
              <GameOptions games={games} />
              {existing && !games.some((game) => game.id === existing.game) && (
                <option value={existing.game}>Unavailable game</option>
              )}
            </select>
          </Field>
          <Field name="kind" label="Achievement type" errors={form.errors}>
            <select
              {...fieldProps("kind", form.errors)}
              defaultValue={existing?.kind || "Game achievement"}
            >
              {ACHIEVEMENT_TYPES.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field name="title" label="Achievement title" errors={form.errors}>
          <input
            {...fieldProps("title", form.errors)}
            defaultValue={existing?.title || ""}
            maxLength={80}
            required
            placeholder="e.g. My first 1,000 assists"
          />
        </Field>
        <Field name="description" label="The story" errors={form.errors}>
          <textarea
            {...fieldProps("description", form.errors)}
            defaultValue={existing?.description || ""}
            maxLength={500}
            rows={3}
            placeholder="What did you accomplish, and what made it memorable?"
          />
        </Field>
        <Field
          name="earnedOn"
          label="Date achieved"
          errors={form.errors}
          hint="Optional. Pick today or an earlier date."
        >
          <input
            {...fieldProps("earnedOn", form.errors, true)}
            type="date"
            defaultValue={existing?.earnedOn || ""}
            max={todayDate()}
          />
        </Field>
        <p className="profile-form-note">
          Achievements are self-reported and saved in this browser.
        </p>
        <EditorActions
          onClose={onClose}
          saveLabel="Save achievement"
          error={form.saveError}
          onRemove={
            existing
              ? () => form.commit(() => removeAchievement(existing.id))
              : undefined
          }
          removeLabel="Remove achievement"
        />
      </form>
    </Modal>
  );
}
