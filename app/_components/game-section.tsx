import {
  gameSection,
  matchesGameSection,
  type Game,
  type GameSection,
} from "@/lib/sessions";

export function GameSectionBadge({ id }: { id: string }) {
  const section = gameSection(id);
  return (
    <span className={`game-section-badge ${section}`}>
      {section === "official" ? "Official" : "Unofficial"}
    </span>
  );
}

export function GameSections({
  value,
  onChange,
}: {
  value: GameSection;
  onChange: (value: GameSection) => void;
}) {
  return (
    <div className="game-sections" role="group" aria-label="Game sections">
      {(["all", "official", "unofficial"] as const).map((section) => (
        <button
          key={section}
          type="button"
          aria-pressed={value === section}
          onClick={() => onChange(section)}
        >
          {section === "all"
            ? "All sections"
            : section === "official"
              ? "Official games"
              : "Unofficial games"}
        </button>
      ))}
    </div>
  );
}

export function GameOptions({ games }: { games: readonly Game[] }) {
  return (
    <>
      {(["official", "unofficial"] as const).map((section) => {
        const options = games.filter((game) =>
          matchesGameSection(game.id, section),
        );
        return (
          options.length > 0 && (
            <optgroup
              key={section}
              label={
                section === "official"
                  ? "Official · Supported by Game On"
                  : "Unofficial · Player-added games"
              }
            >
              {options.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </optgroup>
          )
        );
      })}
    </>
  );
}
