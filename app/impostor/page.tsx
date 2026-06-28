"use client";

import { useEffect, useState } from "react";
import ExitButton from "../ui/exit-button";
import PlayerManager, { resolveNames } from "../ui/player-manager";
import {
  CATEGORIES,
  randomHint,
  randomWord,
  type Category,
  type WordEntry,
} from "./words";

type Phase = "setup" | "reveal" | "play" | "result";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 20;
const STORAGE_KEY = "impostor:setup";

interface StoredSetup {
  players: string[];
  impostorCount: number;
  categoryId: string;
}

function loadStoredSetup(): StoredSetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSetup>;
    if (!Array.isArray(parsed.players)) return null;
    const players = parsed.players
      .filter((p): p is string => typeof p === "string")
      .slice(0, MAX_PLAYERS);
    if (players.length < MIN_PLAYERS) return null;
    return {
      players,
      impostorCount:
        typeof parsed.impostorCount === "number" && parsed.impostorCount >= 1
          ? parsed.impostorCount
          : 1,
      categoryId:
        typeof parsed.categoryId === "string" ? parsed.categoryId : "any",
    };
  } catch {
    return null;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ImpostorPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<string[]>(() =>
    Array.from({ length: 5 }, () => ""),
  );
  const playerCount = players.length;
  const [impostorCount, setImpostorCount] = useState(1);
  const [categoryId, setCategoryId] = useState<string>("any");
  const [hydrated, setHydrated] = useState(false);

  // Restore saved setup once on mount (client only) to survive reloads.
  useEffect(() => {
    const stored = loadStoredSetup();
    if (stored) {
      setPlayers(stored.players);
      setImpostorCount(stored.impostorCount);
      setCategoryId(stored.categoryId);
    }
    setHydrated(true);
  }, []);

  // Persist setup whenever it changes (after the initial restore).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const data: StoredSetup = { players, impostorCount, categoryId };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore write errors (e.g. storage disabled or full).
    }
  }, [hydrated, players, impostorCount, categoryId]);

  const [entry, setEntry] = useState<WordEntry | null>(null);
  const [impostorHint, setImpostorHint] = useState("");
  const [chosenCategory, setChosenCategory] = useState<Category | null>(null);
  const [revealNames, setRevealNames] = useState<string[]>([]);
  const [impostorSet, setImpostorSet] = useState<Set<number>>(new Set());
  const [revealIndex, setRevealIndex] = useState(0);
  const [showingCard, setShowingCard] = useState(false);

  const maxImpostors = Math.max(1, playerCount - 2);
  const effectiveImpostors = Math.min(impostorCount, maxImpostors);

  function adjustImpostors(delta: number) {
    setImpostorCount((prev) => Math.max(1, prev + delta));
  }

  function startGame() {
    const category =
      categoryId === "any"
        ? CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
        : (CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0]);

    const word = randomWord(category);

    const indices = shuffle(
      Array.from({ length: playerCount }, (_, i) => i),
    ).slice(0, effectiveImpostors);

    setChosenCategory(category);
    setEntry(word);
    setImpostorHint(randomHint(word));
    setRevealNames(resolveNames(players));
    setImpostorSet(new Set(indices));
    setRevealIndex(0);
    setShowingCard(false);
    setPhase("reveal");
  }

  function nextReveal() {
    if (revealIndex + 1 >= playerCount) {
      setPhase("play");
      return;
    }
    setRevealIndex((i) => i + 1);
    setShowingCard(false);
  }

  function resetToSetup() {
    setPhase("setup");
    setEntry(null);
    setImpostorHint("");
    setChosenCategory(null);
    setRevealNames([]);
    setImpostorSet(new Set());
    setRevealIndex(0);
    setShowingCard(false);
  }

  function playAgainSameSettings() {
    startGame();
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
        <ExitButton />

        <div className="mt-4 flex items-center gap-3">
          <span className="text-3xl">🕵️</span>
          <h1 className="text-2xl font-bold tracking-tight">
            Who is the Impostor?
          </h1>
        </div>

        {phase === "setup" && (
          <Setup
            players={players}
            onPlayersChange={setPlayers}
            impostorCount={effectiveImpostors}
            maxImpostors={maxImpostors}
            categoryId={categoryId}
            onAdjustImpostors={adjustImpostors}
            onSelectCategory={setCategoryId}
            onStart={startGame}
          />
        )}

        {phase === "reveal" && entry && (
          <Reveal
            playerName={revealNames[revealIndex] ?? `Player ${revealIndex + 1}`}
            position={revealIndex + 1}
            total={playerCount}
            isImpostor={impostorSet.has(revealIndex)}
            impostorCount={impostorSet.size}
            entry={entry}
            impostorHint={impostorHint}
            showingCard={showingCard}
            onShow={() => setShowingCard(true)}
            onNext={nextReveal}
          />
        )}

        {phase === "play" && (
          <PlayPhase
            playerCount={playerCount}
            impostorCount={impostorSet.size}
            category={chosenCategory}
            names={revealNames}
            onReveal={() => setPhase("result")}
          />
        )}

        {phase === "result" && entry && (
          <Result
            entry={entry}
            impostorHint={impostorHint}
            category={chosenCategory}
            impostorSet={impostorSet}
            names={revealNames}
            playerCount={playerCount}
            onPlayAgain={playAgainSameSettings}
            onNewSettings={resetToSetup}
          />
        )}
      </div>
    </main>
  );
}

function Stepper({
  label,
  sublabel,
  value,
  onDec,
  onInc,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {sublabel && <p className="text-xs text-zinc-400">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onDec}
          className="h-9 w-9 rounded-full bg-zinc-800 text-lg font-bold text-zinc-200 transition hover:bg-zinc-700 active:scale-95"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="w-6 text-center text-lg font-semibold tabular-nums">
          {value}
        </span>
        <button
          onClick={onInc}
          className="h-9 w-9 rounded-full bg-zinc-800 text-lg font-bold text-zinc-200 transition hover:bg-zinc-700 active:scale-95"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Setup({
  players,
  onPlayersChange,
  impostorCount,
  maxImpostors,
  categoryId,
  onAdjustImpostors,
  onSelectCategory,
  onStart,
}: {
  players: string[];
  onPlayersChange: (players: string[]) => void;
  impostorCount: number;
  maxImpostors: number;
  categoryId: string;
  onAdjustImpostors: (delta: number) => void;
  onSelectCategory: (id: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="mt-6 space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Players
        </h2>
        <PlayerManager
          players={players}
          onChange={onPlayersChange}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          accent="sky"
        />
        <Stepper
          label="Impostors"
          sublabel={`Up to ${maxImpostors} for this group`}
          value={impostorCount}
          onDec={() => onAdjustImpostors(-1)}
          onInc={() => onAdjustImpostors(1)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Category
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <CategoryButton
            active={categoryId === "any"}
            onClick={() => onSelectCategory("any")}
            emoji="🎲"
            name="Surprise me"
          />
          {CATEGORIES.map((c) => (
            <CategoryButton
              key={c.id}
              active={categoryId === c.id}
              onClick={() => onSelectCategory(c.id)}
              emoji={c.emoji}
              name={c.name}
            />
          ))}
        </div>
      </section>

      <button
        onClick={onStart}
        className="w-full rounded-xl bg-sky-600 py-4 text-lg font-semibold text-white transition hover:bg-sky-500 active:scale-[0.99]"
      >
        Start round
      </button>
      <p className="text-center text-xs text-zinc-500">
        Crew members see the word. Impostors only get a hint. Pass the phone
        around one player at a time.
      </p>
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  emoji,
  name,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  name: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 transition ${
        active
          ? "bg-sky-600 text-white ring-sky-400"
          : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
      }`}
    >
      <span className="text-lg">{emoji}</span>
      {name}
    </button>
  );
}

function Reveal({
  playerName,
  position,
  total,
  isImpostor,
  impostorCount,
  entry,
  impostorHint,
  showingCard,
  onShow,
  onNext,
}: {
  playerName: string;
  position: number;
  total: number;
  isImpostor: boolean;
  impostorCount: number;
  entry: WordEntry;
  impostorHint: string;
  showingCard: boolean;
  onShow: () => void;
  onNext: () => void;
}) {
  const isLast = position >= total;
  const [held, setHeld] = useState(false);

  // Always start each player's turn with the card covered.
  useEffect(() => {
    setHeld(false);
  }, [position, showingCard]);

  return (
    <div className="mt-6">
      <p className="text-center text-sm text-zinc-400">
        {position} of {total}
      </p>

      {!showingCard ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
          <span className="text-5xl">📱</span>
          <h2 className="mt-4 text-xl font-semibold">
            Pass the phone to {playerName}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Hide the screen from everyone else, then hold your card to peek.
          </p>
          <button
            onClick={onShow}
            className="mt-6 w-full rounded-xl bg-sky-600 py-4 text-lg font-semibold text-white transition hover:bg-sky-500 active:scale-[0.99]"
          >
            I&apos;m {playerName} — show my card
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center">
          {/* Hold-to-reveal flip card */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Hold to reveal your card"
            onPointerDown={() => setHeld(true)}
            onPointerUp={() => setHeld(false)}
            onPointerLeave={() => setHeld(false)}
            onPointerCancel={() => setHeld(false)}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") setHeld(true);
            }}
            onKeyUp={() => setHeld(false)}
            onBlur={() => setHeld(false)}
            className="flip-card h-112 w-full max-w-xs touch-none select-none outline-none"
          >
            <div className={`flip-card-inner ${held ? "is-flipped" : ""}`}>
              {/* Front face — neutral cover (what others might glimpse) */}
              <div className="flip-face flex flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl bg-linear-to-br from-zinc-800 to-zinc-900 p-8 text-center shadow-xl ring-1 ring-white/10">
                <div className="absolute inset-3 rounded-2xl border border-white/5" />
                <span className="text-6xl drop-shadow">🃏</span>
                <p className="text-xl font-semibold text-zinc-100">
                  Hold to reveal
                </p>
                <p className="px-4 text-sm text-zinc-400">
                  Press and hold the card. Let go to flip it back.
                </p>
              </div>

              {/* Back face — revealed content. Identical neutral styling for
                  everyone so a glance can't tell impostor from crew. */}
              <div className="flip-face flip-face-back flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-linear-to-br from-zinc-800 to-zinc-900 p-7 text-center shadow-xl ring-1 ring-white/10">
                <div className="absolute inset-3 rounded-2xl border border-white/5" />
                {isImpostor ? (
                  <div className="relative flex flex-col items-center">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Your role
                    </span>
                    <h2 className="mt-2 text-4xl font-bold tracking-wide text-red-300">
                      IMPOSTOR
                    </h2>
                    <p className="mt-4 text-xs uppercase tracking-widest text-zinc-500">
                      Your clue
                    </p>
                    <p className="mt-1 rounded-xl bg-black/30 px-4 py-2 text-lg font-semibold text-zinc-100">
                      {impostorHint}
                    </p>
                    {impostorCount > 1 && (
                      <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-xs leading-relaxed text-zinc-300 ring-1 ring-white/10">
                        {impostorCount === 2
                          ? "1 other player shares this clue."
                          : `${impostorCount - 1} other players share this clue.`}{" "}
                        Use it first before them. Good luck.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="relative flex flex-col items-center">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Your word
                    </span>
                    <h2 className="mt-2 text-4xl font-bold tracking-wide text-zinc-50">
                      {entry.word}
                    </h2>
                    <p className="mt-5 px-2 text-sm text-zinc-400">
                      Give a one-word hint that proves you know it — without
                      making it obvious.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onNext}
            className="mt-6 w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99]"
          >
            {isLast ? "Done — start giving hints" : "Hide & pass on"}
          </button>
        </div>
      )}
    </div>
  );
}

function PlayPhase({
  playerCount,
  impostorCount,
  category,
  names,
  onReveal,
}: {
  playerCount: number;
  impostorCount: number;
  category: Category | null;
  names: string[];
  onReveal: () => void;
}) {
  // Pick a random starter and rotation direction once per round.
  const [starter] = useState(() => ({
    index: Math.floor(Math.random() * playerCount),
    direction: Math.random() < 0.5 ? ("left" as const) : ("right" as const),
  }));
  const starterName = names[starter.index] ?? `Player ${starter.index + 1}`;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-sky-300 sm:text-5xl">
          {starterName}
        </h2>
        <p className="mt-2 text-lg font-medium text-zinc-200">
          starts the conversation
        </p>

        <div className="mt-6 flex flex-col items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-24 w-24 text-zinc-100 ${
              starter.direction === "right" ? "" : "-scale-x-100"
            }`}
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
            Pass to the {starter.direction}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-lg font-semibold">Give your hints</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          Going around the circle, each player says{" "}
          <span className="font-medium text-zinc-100">one word</span> related to
          the secret word. Listen closely — the{" "}
          {impostorCount === 1 ? "impostor is" : `${impostorCount} impostors are`}{" "}
          faking it.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-400">
          <li>• Crew: prove you know the word, but don&apos;t make it obvious.</li>
          <li>• Impostor: blend in using only your hint.</li>
          <li>• Then discuss and accuse before revealing.</li>
        </ul>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-zinc-900/60 px-5 py-4 text-sm ring-1 ring-white/5">
        <span className="text-zinc-400">This round</span>
        <span className="font-medium">
          {category ? `${category.emoji} ${category.name} · ` : ""}
          {playerCount} players · {impostorCount}{" "}
          {impostorCount === 1 ? "impostor" : "impostors"}
        </span>
      </div>

      <button
        onClick={onReveal}
        className="w-full rounded-xl bg-sky-600 py-4 text-lg font-semibold text-white transition hover:bg-sky-500 active:scale-[0.99]"
      >
        Reveal the impostor &amp; the word
      </button>
    </div>
  );
}

function Result({
  entry,
  impostorHint,
  category,
  impostorSet,
  names,
  playerCount,
  onPlayAgain,
  onNewSettings,
}: {
  entry: WordEntry;
  impostorHint: string;
  category: Category | null;
  impostorSet: Set<number>;
  names: string[];
  playerCount: number;
  onPlayAgain: () => void;
  onNewSettings: () => void;
}) {
  const impostorNames = Array.from({ length: playerCount }, (_, i) => i)
    .filter((i) => impostorSet.has(i))
    .map((i) => names[i] ?? `Player ${i + 1}`);

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <span className="text-xs uppercase tracking-widest text-zinc-500">
          The word was
        </span>
        <h2 className="mt-2 text-4xl font-bold text-sky-300">{entry.word}</h2>
        {category && (
          <p className="mt-1 text-sm text-zinc-400">
            {category.emoji} {category.name}
          </p>
        )}

        <div className="mt-6 border-t border-white/10 pt-6">
          <span className="text-xs uppercase tracking-widest text-zinc-500">
            {impostorNames.length === 1 ? "The impostor" : "The impostors"}
          </span>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {impostorNames.map((name, idx) => (
              <span
                key={idx}
                className="rounded-full bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white"
              >
                {name}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            Their hint was &ldquo;{impostorHint}&rdquo;
          </p>
        </div>
      </div>

      <button
        onClick={onPlayAgain}
        className="w-full rounded-xl bg-sky-600 py-4 text-lg font-semibold text-white transition hover:bg-sky-500 active:scale-[0.99]"
      >
        Play again (same settings)
      </button>
      <button
        onClick={onNewSettings}
        className="w-full rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
      >
        Change settings
      </button>
    </div>
  );
}
