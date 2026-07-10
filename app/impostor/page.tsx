"use client";

import Image from "next/image";
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
  giveHint: boolean;
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
      giveHint: parsed.giveHint !== false,
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
  const [giveHint, setGiveHint] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Restore saved setup once on mount (client only) to survive reloads.
  useEffect(() => {
    const stored = loadStoredSetup();
    if (stored) {
      setPlayers(stored.players);
      setImpostorCount(stored.impostorCount);
      setCategoryId(stored.categoryId);
      setGiveHint(stored.giveHint);
    }
    setHydrated(true);
  }, []);

  // Persist setup whenever it changes (after the initial restore).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const data: StoredSetup = {
        players,
        impostorCount,
        categoryId,
        giveHint,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore write errors (e.g. storage disabled or full).
    }
  }, [hydrated, players, impostorCount, categoryId, giveHint]);

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
    setImpostorHint(giveHint ? randomHint(word) : "");
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
    <main className="relative flex flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {phase === "setup" && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-sky-600/20 blur-3xl" />
          <div className="absolute -right-16 top-48 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black/70 to-transparent" />
        </div>
      )}

      <div className="relative mx-auto w-full max-w-xl flex-1 px-5 py-8">
        <ExitButton />

        {phase === "setup" ? (
          <div className="relative mt-4 animate-rise overflow-hidden rounded-3xl bg-linear-to-br from-sky-950/60 via-zinc-900 to-zinc-950 p-5 ring-1 ring-sky-500/25">
            <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-sky-500/20 blur-2xl" />
            <div className="relative flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-1 ring-sky-400/35 shadow-[0_0_28px_rgba(14,165,233,0.3)]">
                <Image
                  src="/impostor-card.png"
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                  priority
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-300/80">
                  Pass &amp; play
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
                  Who is the Impostor?
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  One word. One lie. Find the fake.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-3xl">🕵️</span>
            <h1 className="text-2xl font-bold tracking-tight">
              Who is the Impostor?
            </h1>
          </div>
        )}

        {phase === "setup" && (
          <Setup
            players={players}
            onPlayersChange={setPlayers}
            impostorCount={effectiveImpostors}
            maxImpostors={maxImpostors}
            categoryId={categoryId}
            giveHint={giveHint}
            onAdjustImpostors={adjustImpostors}
            onSelectCategory={setCategoryId}
            onToggleHint={setGiveHint}
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
            giveHint={giveHint}
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
            giveHint={giveHint}
            onReveal={() => setPhase("result")}
          />
        )}

        {phase === "result" && entry && (
          <Result
            entry={entry}
            impostorHint={impostorHint}
            giveHint={giveHint}
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
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-sky-950/30 px-4 py-3.5 ring-1 ring-sky-500/25">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-xl ring-1 ring-sky-400/25">
          🎭
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-sky-50">{label}</p>
          {sublabel && (
            <p className="text-xs text-sky-200/55">{sublabel}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onDec}
          className="h-9 w-9 rounded-full bg-zinc-800 text-lg font-bold text-zinc-200 transition hover:bg-zinc-700 active:scale-95"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="w-7 text-center text-xl font-bold tabular-nums text-zinc-50">
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
  giveHint,
  onAdjustImpostors,
  onSelectCategory,
  onToggleHint,
  onStart,
}: {
  players: string[];
  onPlayersChange: (players: string[]) => void;
  impostorCount: number;
  maxImpostors: number;
  categoryId: string;
  giveHint: boolean;
  onAdjustImpostors: (delta: number) => void;
  onSelectCategory: (id: string) => void;
  onToggleHint: (value: boolean) => void;
  onStart: () => void;
}) {
  const selectedCategory =
    categoryId === "any"
      ? null
      : CATEGORIES.find((c) => c.id === categoryId) ?? null;
  const crewCount = Math.max(0, players.length - impostorCount);

  return (
    <div className="mt-5 space-y-5 pb-28">
      <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Players
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Names stay saved for the next round.
            </p>
          </div>
          <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold tabular-nums text-zinc-300 ring-1 ring-white/10">
            {players.length}/{MAX_PLAYERS}
          </span>
        </div>
        <PlayerManager
          players={players}
          onChange={onPlayersChange}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          accent="sky"
        />
      </section>

      <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Round setup
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            How many impostors hide in the crew.
          </p>
        </div>
        <Stepper
          label="Impostors"
          sublabel={`Up to ${maxImpostors} for this group`}
          value={impostorCount}
          onDec={() => onAdjustImpostors(-1)}
          onInc={() => onAdjustImpostors(1)}
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-zinc-950/60 px-3.5 py-3 ring-1 ring-white/6">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Crew
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
              {crewCount}
            </p>
          </div>
          <div className="rounded-2xl bg-zinc-950/60 px-3.5 py-3 ring-1 ring-white/6">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              Impostors
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-sky-300">
              {impostorCount}
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={giveHint}
          onClick={() => onToggleHint(!giveHint)}
          className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left ring-1 transition ${
            giveHint
              ? "bg-sky-950/40 ring-sky-500/30"
              : "bg-zinc-950/60 ring-white/8"
          }`}
        >
          <div className="min-w-0">
            <p className="font-semibold text-zinc-100">Give impostor a hint</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {giveHint
                ? "Impostors see a one-word clue."
                : "Impostors get no clue — harder mode."}
            </p>
          </div>
          <span
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              giveHint ? "bg-sky-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                giveHint ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </span>
        </button>
      </section>

      <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Category
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Pick a theme — or leave it to chance.
            </p>
          </div>
          <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/25">
            {selectedCategory
              ? `${selectedCategory.emoji} ${selectedCategory.name}`
              : "🎲 Surprise"}
          </span>
        </div>
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

      <div className="rounded-2xl bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400 ring-1 ring-white/8">
        Crew sees the secret word.
        {giveHint
          ? " Impostors only get a hint."
          : " Impostors get no hint."}{" "}
        Pass the phone one player at a time.
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-zinc-950/90 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={onStart}
            className="w-full rounded-2xl bg-sky-600 py-4 text-lg font-semibold text-white shadow-[0_12px_40px_rgba(2,132,199,0.35)] transition hover:bg-sky-500 active:scale-[0.99]"
          >
            Start round
          </button>
        </div>
      </div>
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
      className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3.5 text-left text-sm font-medium ring-1 transition active:scale-[0.98] ${
        active
          ? "bg-sky-600 text-white ring-sky-300/50 shadow-[0_0_20px_rgba(2,132,199,0.28)]"
          : "bg-zinc-950/60 text-zinc-300 ring-white/8 hover:bg-zinc-800 hover:text-zinc-100"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${
          active ? "bg-white/15" : "bg-zinc-900"
        }`}
      >
        {emoji}
      </span>
      <span className="leading-snug">{name}</span>
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
  giveHint,
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
  giveHint: boolean;
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
                    {giveHint ? (
                      <>
                        <p className="mt-4 text-xs uppercase tracking-widest text-zinc-500">
                          Your clue
                        </p>
                        <p className="mt-1 rounded-xl bg-black/30 px-4 py-2 text-lg font-semibold text-zinc-100">
                          {impostorHint}
                        </p>
                      </>
                    ) : (
                      <p className="mt-4 px-2 text-sm text-zinc-400">
                        No clue this round. Listen hard and blend in.
                      </p>
                    )}
                    {impostorCount > 1 && (
                      <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-xs leading-relaxed text-zinc-300 ring-1 ring-white/10">
                        {impostorCount === 2
                          ? "1 other player is also an impostor."
                          : `${impostorCount - 1} other players are also impostors.`}{" "}
                        {giveHint
                          ? "Use the clue first before them. Good luck."
                          : "Work together carefully. Good luck."}
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
  giveHint,
  onReveal,
}: {
  playerCount: number;
  impostorCount: number;
  category: Category | null;
  names: string[];
  giveHint: boolean;
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
          <li>
            • Impostor:{" "}
            {giveHint
              ? "blend in using only your hint."
              : "you have no clue — listen and bluff."}
          </li>
          <li>• Then discuss and accuse before revealing.</li>
        </ul>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-zinc-900/60 px-5 py-4 text-sm ring-1 ring-white/5">
        <span className="text-zinc-400">This round</span>
        <span className="font-medium">
          {category ? `${category.emoji} ${category.name} · ` : ""}
          {playerCount} players · {impostorCount}{" "}
          {impostorCount === 1 ? "impostor" : "impostors"}
          {giveHint ? "" : " · no hint"}
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
  giveHint,
  category,
  impostorSet,
  names,
  playerCount,
  onPlayAgain,
  onNewSettings,
}: {
  entry: WordEntry;
  impostorHint: string;
  giveHint: boolean;
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
          {giveHint && impostorHint ? (
            <p className="mt-4 text-sm text-zinc-400">
              Their hint was &ldquo;{impostorHint}&rdquo;
            </p>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">
              This round had no impostor hint.
            </p>
          )}
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
