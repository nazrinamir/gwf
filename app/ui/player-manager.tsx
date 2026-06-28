"use client";

type Accent = "rose" | "sky";

const ACCENTS: Record<Accent, { add: string; ring: string }> = {
  rose: {
    add: "bg-rose-600 hover:bg-rose-500",
    ring: "focus:ring-rose-500/60",
  },
  sky: {
    add: "bg-sky-600 hover:bg-sky-500",
    ring: "focus:ring-sky-500/60",
  },
};

/** Default name for a seat that has been left blank. */
export function defaultName(index: number) {
  return `Player ${index + 1}`;
}

/** Resolve a player list to display names, filling blanks with defaults. */
export function resolveNames(players: string[]): string[] {
  return players.map((p, i) => (p.trim() ? p.trim() : defaultName(i)));
}

export default function PlayerManager({
  players,
  onChange,
  min,
  max,
  accent = "sky",
}: {
  players: string[];
  onChange: (players: string[]) => void;
  min: number;
  max: number;
  accent?: Accent;
}) {
  const styles = ACCENTS[accent];

  function updateName(index: number, value: string) {
    const next = [...players];
    next[index] = value;
    onChange(next);
  }

  function addPlayer() {
    if (players.length >= max) return;
    onChange([...players, ""]);
  }

  function removePlayer(index: number) {
    if (players.length <= min) return;
    onChange(players.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {players.map((name, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 ring-1 ring-white/10"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
              {i + 1}
            </span>
            <input
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
              placeholder={defaultName(i)}
              maxLength={20}
              className={`min-w-0 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 ${styles.ring} rounded-md px-1 py-1`}
            />
            <button
              onClick={() => removePlayer(i)}
              disabled={players.length <= min}
              aria-label={`Remove player ${i + 1}`}
              className="h-8 w-8 shrink-0 rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={addPlayer}
          disabled={players.length >= max}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 ${styles.add}`}
        >
          + Add player
        </button>
        <span className="text-xs text-zinc-500">
          {players.length} / {max} players
        </span>
      </div>
    </div>
  );
}
