"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import PlayerManager, { resolveNames } from "../../ui/player-manager";
import {
  type ClassicNightInput,
  type ClassicNightPrompt,
  type ClassicNightResult,
  type ClassicPlayer,
  type ClassicWinner,
  applyDeaths,
  buildClassicNightPrompts,
  checkClassicWinner,
  dealClassicRoles,
  living,
  makeClassicPlayers,
  nameOf,
  resolveClassicNight,
  shuffle,
} from "./engine";
import { randomVillagerPrompt, WEIRD_ANSWER_LINE } from "./questions";
import {
  CLASSIC_CONFIGURABLE,
  CLASSIC_ROLES,
  type ClassicRoleId,
} from "./roles";

type Phase =
  | "setup"
  | "reveal"
  | "day"
  | "vote"
  | "trial"
  | "hunter"
  | "night-intro"
  | "night"
  | "dawn"
  | "gameover";

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 18;
const STORAGE_KEY = "werewolf:classic:setup";

const DEFAULT_COUNTS: Record<ClassicRoleId, number> = {
  alpha: 0,
  werewolf: 2,
  villager: 0,
  seeker: 1,
  knight: 1,
  vampire: 0,
  jester: 1,
  cupid: 0,
  hunter: 1,
};

const DAY_MINUTES_OPTIONS = [1, 2, 3, 5, 8, 10];
/** Seconds each player gets after they open their night turn. */
const NIGHT_SECONDS_OPTIONS = [30, 45, 60, 90, 120];

interface StoredSetup {
  players: string[];
  counts: Record<ClassicRoleId, number>;
  dayMinutes: number;
  nightSeconds: number;
}

function loadStoredSetup(): StoredSetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSetup> & {
      discussionMinutes?: number;
    };
    if (!Array.isArray(parsed.players)) return null;
    const players = parsed.players
      .filter((p): p is string => typeof p === "string")
      .slice(0, MAX_PLAYERS);
    if (players.length < MIN_PLAYERS) return null;
    const counts = { ...DEFAULT_COUNTS };
    if (parsed.counts && typeof parsed.counts === "object") {
      for (const id of Object.keys(DEFAULT_COUNTS) as ClassicRoleId[]) {
        const v = (parsed.counts as Record<string, unknown>)[id];
        if (typeof v === "number" && v >= 0) counts[id] = v;
      }
    }
    const legacyDay =
      typeof parsed.discussionMinutes === "number"
        ? parsed.discussionMinutes
        : undefined;
    const dayMinutes =
      typeof parsed.dayMinutes === "number" &&
      DAY_MINUTES_OPTIONS.includes(parsed.dayMinutes)
        ? parsed.dayMinutes
        : legacyDay && DAY_MINUTES_OPTIONS.includes(legacyDay)
          ? legacyDay
          : 3;
    const nightSeconds =
      typeof parsed.nightSeconds === "number" &&
      NIGHT_SECONDS_OPTIONS.includes(parsed.nightSeconds)
        ? parsed.nightSeconds
        : 60;
    return { players, counts, dayMinutes, nightSeconds };
  } catch {
    return null;
  }
}

export default function ClassicGame({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<string[]>(() =>
    Array.from({ length: 8 }, () => ""),
  );
  const [counts, setCounts] =
    useState<Record<ClassicRoleId, number>>(DEFAULT_COUNTS);
  const [dayMinutes, setDayMinutes] = useState(3);
  const [nightSeconds, setNightSeconds] = useState(60);
  const [hydrated, setHydrated] = useState(false);

  const [game, setGame] = useState<ClassicPlayer[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [dayNumber, setDayNumber] = useState(1);
  const [nightNumber, setNightNumber] = useState(1);

  const [voteTally, setVoteTally] = useState<Record<number, number>>({});
  const [accused, setAccused] = useState<number | null>(null);

  const [nightPrompts, setNightPrompts] = useState<ClassicNightPrompt[]>([]);
  const [nightPos, setNightPos] = useState(0);
  const [nightInputs, setNightInputs] = useState<ClassicNightInput[]>([]);
  const [nightResult, setNightResult] = useState<ClassicNightResult | null>(
    null,
  );

  const [hunterQueue, setHunterQueue] = useState<number[]>([]);
  const [hunterAfter, setHunterAfter] = useState<"night" | "trial" | "dawn">(
    "trial",
  );
  const [hunterCause, setHunterCause] = useState<"wolf" | "vote" | "other">(
    "other",
  );
  /** Deaths already applied mid-night (e.g. wolf kills Hunter). */
  const [nightDeaths, setNightDeaths] = useState<number[]>([]);
  const [pendingWinner, setPendingWinner] = useState<ClassicWinner | null>(
    null,
  );
  const [winner, setWinner] = useState<ClassicWinner | null>(null);

  useEffect(() => {
    const stored = loadStoredSetup();
    if (stored) {
      setPlayers(stored.players);
      setCounts(stored.counts);
      setDayMinutes(stored.dayMinutes);
      setNightSeconds(stored.nightSeconds);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const data: StoredSetup = { players, counts, dayMinutes, nightSeconds };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [hydrated, players, counts, dayMinutes, nightSeconds]);

  const playerCount = players.length;
  const specialTotal = CLASSIC_CONFIGURABLE.reduce((s, id) => s + counts[id], 0);
  const villagerCount = playerCount - specialTotal;
  const wolfTotal = counts.alpha + counts.werewolf;
  const tooManySpecials = villagerCount < 0;
  const tooFewPlayers = playerCount < MIN_PLAYERS;
  const noWerewolf = wolfTotal < 1;
  const canStart = !tooManySpecials && !tooFewPlayers && !noWerewolf;

  function adjustCount(id: ClassicRoleId, delta: number) {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, prev[id] + delta) }));
  }

  function startGame() {
    const roles = dealClassicRoles(playerCount, counts);
    const names = resolveNames(players);
    setGame(makeClassicPlayers(names, roles));
    setRevealIndex(0);
    setDayNumber(1);
    setNightNumber(1);
    setVoteTally({});
    setAccused(null);
    setNightResult(null);
    setHunterQueue([]);
    setNightDeaths([]);
    setPendingWinner(null);
    setWinner(null);
    setPhase("reveal");
  }

  function nextReveal() {
    if (revealIndex + 1 >= game.length) {
      setPhase("day");
      return;
    }
    setRevealIndex((i) => i + 1);
  }

  function finishWithWinner(w: ClassicWinner, g: ClassicPlayer[]) {
    setGame(g);
    setWinner(w);
    setPhase("gameover");
  }

  function maybeWin(g: ClassicPlayer[]): boolean {
    const w = checkClassicWinner(g);
    if (w) {
      finishWithWinner(w, g);
      return true;
    }
    return false;
  }

  function enqueueHunters(
    hunters: number[],
    after: "night" | "trial" | "dawn",
    g: ClassicPlayer[],
    win?: ClassicWinner | null,
    cause: "wolf" | "vote" | "other" = "other",
  ) {
    if (hunters.length > 0) {
      setGame(g);
      setHunterQueue(hunters);
      setHunterAfter(after);
      setHunterCause(cause);
      setPendingWinner(win ?? null);
      setPhase("hunter");
      return true;
    }
    if (win) {
      finishWithWinner(win, g);
      return true;
    }
    return maybeWin(g);
  }

  /** Skip prompts for players who already died mid-night. */
  function continueNight(
    g: ClassicPlayer[],
    inputs: ClassicNightInput[],
    fromPos: number,
    extraDeaths: number[] = [],
  ) {
    if (extraDeaths.length) {
      setNightDeaths((d) => [...d, ...extraDeaths]);
    }
    let pos = fromPos + 1;
    while (pos < nightPrompts.length) {
      const prompt = nightPrompts[pos]!;
      if (prompt.kind === "wolves") {
        const packAlive = (prompt.packIds ?? [prompt.playerId]).some(
          (id) => g.find((p) => p.id === id)?.alive,
        );
        if (!packAlive) {
          pos += 1;
          continue;
        }
      } else if (!g.find((p) => p.id === prompt.playerId)?.alive) {
        pos += 1;
        continue;
      }
      setGame(g);
      setNightInputs(inputs);
      setNightPos(pos);
      setPhase("night");
      return;
    }
    finishNight(g, inputs, extraDeaths);
  }

  function protectedIdFromInputs(inputs: ClassicNightInput[]): number | null {
    const guard = inputs.find((i) => i.type === "knight_protect");
    return guard?.targets[0] ?? null;
  }

  function onVoteComplete(tally: Record<number, number>) {
    setVoteTally(tally);
    const ranked = Object.entries(tally)
      .map(([id, count]) => ({ id: Number(id), count }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);

    if (ranked.length === 0) {
      beginNight(game);
      return;
    }

    const top = ranked[0]!.count;
    const tied = ranked.filter((e) => e.count === top);
    const pick = tied[Math.floor(Math.random() * tied.length)]!;
    setAccused(pick.id);
    setPhase("trial");
  }

  function onTrialExecute() {
    if (accused == null) return;
    const target = game.find((p) => p.id === accused);
    if (!target) return;

    if (target.role.id === "jester") {
      const applied = applyDeaths(game, [accused]);
      setGame(applied.players);
      if (applied.hunterPending.length) {
        setHunterQueue(applied.hunterPending);
        setHunterAfter("trial");
        setHunterCause("vote");
        setPendingWinner("jester");
        setPhase("hunter");
        return;
      }
      finishWithWinner("jester", applied.players);
      return;
    }

    const applied = applyDeaths(game, [accused]);
    setAccused(null);
    if (
      enqueueHunters(applied.hunterPending, "trial", applied.players, null, "vote")
    ) {
      return;
    }
    beginNight(applied.players);
  }

  function onTrialForgive() {
    setAccused(null);
    beginNight(game);
  }

  function beginNight(g: ClassicPlayer[]) {
    if (maybeWin(g)) return;
    setGame(g);
    const prompts = buildClassicNightPrompts(g, nightNumber);
    setNightPrompts(prompts);
    setNightPos(0);
    setNightInputs([]);
    setNightDeaths([]);
    if (prompts.length === 0) {
      finishNight(g, []);
      return;
    }
    setPhase("night-intro");
  }

  function submitNightAction(input: ClassicNightInput) {
    const updated = [...nightInputs, input];

    // Werewolves kill the Hunter → interrupt immediately for revenge shot.
    if (input.type === "wolf_kill") {
      const targetId = input.targets[0];
      const shielded = protectedIdFromInputs(updated);
      const target = game.find((p) => p.id === targetId);
      if (
        targetId != null &&
        target?.alive &&
        target.role.id === "hunter" &&
        shielded !== targetId
      ) {
        const applied = applyDeaths(game, [targetId]);
        setNightInputs(updated);
        setNightDeaths((d) => [...d, ...applied.deaths]);
        if (
          enqueueHunters(
            applied.hunterPending,
            "night",
            applied.players,
            null,
            "wolf",
          )
        ) {
          return;
        }
        continueNight(applied.players, updated, nightPos);
        return;
      }
    }

    if (nightPos + 1 >= nightPrompts.length) {
      finishNight(game, updated);
      return;
    }
    setNightInputs(updated);
    setNightPos((p) => p + 1);
  }

  function finishNight(
    g: ClassicPlayer[],
    inputs: ClassicNightInput[],
    extraDeaths: number[] = [],
  ) {
    const result = resolveClassicNight(g, inputs);
    const mergedDeaths = [
      ...new Set([...nightDeaths, ...extraDeaths, ...result.deaths]),
    ];
    const merged: ClassicNightResult = {
      ...result,
      deaths: mergedDeaths,
    };
    setNightResult(merged);
    // Hunters who already shot mid-night won't appear in hunterPending.
    if (
      enqueueHunters(result.hunterPending, "dawn", result.players, null, "other")
    ) {
      return;
    }
    setGame(result.players);
    setDayNumber((d) => d + 1);
    setNightNumber((n) => n + 1);
    setPhase("dawn");
  }

  function onHunterShot(targetId: number) {
    const hunterId = hunterQueue[0];
    if (hunterId == null) return;
    const applied = applyDeaths(game, [targetId]);
    const rest = [
      ...hunterQueue.slice(1),
      ...applied.hunterPending.filter((id) => id !== hunterId),
    ];

    if (rest.length > 0) {
      setGame(applied.players);
      setHunterQueue(rest);
      setNightDeaths((d) => [...d, ...applied.deaths]);
      return;
    }

    setHunterQueue([]);
    setGame(applied.players);

    if (pendingWinner) {
      finishWithWinner(pendingWinner, applied.players);
      setPendingWinner(null);
      return;
    }
    if (maybeWin(applied.players)) return;

    // Mid-night: wolves just killed the Hunter — finish revenge, then resume night.
    if (hunterAfter === "night") {
      continueNight(applied.players, nightInputs, nightPos, applied.deaths);
      return;
    }

    if (hunterAfter === "dawn") {
      setNightResult((prev) =>
        prev
          ? {
              ...prev,
              players: applied.players,
              deaths: [...new Set([...prev.deaths, ...applied.deaths])],
            }
          : prev,
      );
      setDayNumber((d) => d + 1);
      setNightNumber((n) => n + 1);
      setPhase("dawn");
      return;
    }

    // After trial execution
    beginNight(applied.players);
  }

  function onDawnContinue() {
    if (maybeWin(game)) return;
    setPhase("day");
  }

  function resetToSetup() {
    setPhase("setup");
    setGame([]);
    setWinner(null);
  }

  return (
    <div className="mt-4">
      {phase === "setup" ? (
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-rose-950/50 via-zinc-900 to-zinc-950 p-5 ring-1 ring-rose-500/20">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-rose-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-300/80">
                Classic mode
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-zinc-50">
                Werewolf
              </h2>
              <p className="mt-1.5 text-sm text-zinc-400">
                Set the table, then deal the night.
              </p>
            </div>
            <button
              onClick={onBack}
              className="shrink-0 rounded-full bg-zinc-950/60 px-3 py-2 text-xs font-semibold text-zinc-300 ring-1 ring-white/10 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              Change mode
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Classic mode
            </p>
            <h2 className="text-xl font-bold tracking-tight">Werewolf</h2>
          </div>
        </div>
      )}

      {phase === "setup" && (
        <Setup
          players={players}
          onPlayersChange={setPlayers}
          playerCount={playerCount}
          counts={counts}
          villagerCount={villagerCount}
          specialTotal={specialTotal}
          tooManySpecials={tooManySpecials}
          tooFewPlayers={tooFewPlayers}
          noWerewolf={noWerewolf}
          canStart={canStart}
          dayMinutes={dayMinutes}
          nightSeconds={nightSeconds}
          onDayMinutesChange={setDayMinutes}
          onNightSecondsChange={setNightSeconds}
          onAdjustCount={adjustCount}
          onStart={startGame}
        />
      )}

      {phase === "reveal" && game[revealIndex] && (
        <Reveal
          player={game[revealIndex]!}
          index={revealIndex}
          total={game.length}
          nextName={game[revealIndex + 1]?.name}
          onNext={nextReveal}
        />
      )}

      {phase === "day" && (
        <Discussion
          game={game}
          dayNumber={dayNumber}
          minutes={dayMinutes}
          nightResult={dayNumber > 1 ? nightResult : null}
          onEnd={() => setPhase("vote")}
        />
      )}

      {phase === "vote" && (
        <AccusationVote game={game} onComplete={onVoteComplete} />
      )}

      {phase === "trial" && accused != null && (
        <Trial
          game={game}
          accused={accused}
          voteCount={voteTally[accused] ?? 0}
          onExecute={onTrialExecute}
          onForgive={onTrialForgive}
        />
      )}

      {phase === "hunter" && hunterQueue[0] != null && (
        <HunterRevenge
          game={game}
          hunterId={hunterQueue[0]}
          cause={hunterCause}
          onShoot={onHunterShot}
        />
      )}

      {phase === "night-intro" && (
        <NightIntro
          nightNumber={nightNumber}
          turnSeconds={nightSeconds}
          firstName={
            nightPrompts[0]?.kind === "wolves"
              ? (nightPrompts[0].packIds ?? [nightPrompts[0].playerId])
                  .map((id) => nameOf(game, id))
                  .join(", ")
              : nameOf(game, nightPrompts[0]?.playerId ?? -1)
          }
          onContinue={() => setPhase("night")}
        />
      )}

      {phase === "night" && nightPrompts[nightPos] != null && (
        <NightTurn
          key={`${nightNumber}-${nightPos}-${nightPrompts[nightPos]!.playerId}`}
          prompt={nightPrompts[nightPos]!}
          game={game}
          nightNumber={nightNumber}
          step={nightPos + 1}
          total={nightPrompts.length}
          turnSeconds={nightSeconds}
          onSubmit={submitNightAction}
        />
      )}

      {phase === "dawn" && nightResult && (
        <Dawn
          game={game}
          dayNumber={dayNumber}
          result={nightResult}
          onContinue={onDawnContinue}
        />
      )}

      {phase === "gameover" && winner && (
        <GameOver
          winner={winner}
          game={game}
          onPlayAgain={startGame}
          onExit={resetToSetup}
        />
      )}
    </div>
  );
}

/* ----------------------------- Setup ----------------------------- */

const ROLE_GROUPS: { title: string; tint: string; ids: ClassicRoleId[] }[] = [
  {
    title: "Werewolves",
    tint: "text-rose-300",
    ids: ["alpha", "werewolf"],
  },
  {
    title: "Village",
    tint: "text-emerald-300",
    ids: ["seeker", "knight", "cupid", "hunter"],
  },
  {
    title: "Other factions",
    tint: "text-violet-300",
    ids: ["vampire", "jester"],
  },
];

function Stepper({
  label,
  sublabel,
  value,
  onDec,
  onInc,
  emoji,
  active,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  emoji?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 transition ${
        active
          ? "bg-zinc-900 ring-1 ring-rose-500/35"
          : "bg-zinc-950/50 ring-1 ring-white/6"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
            active ? "bg-rose-500/15 ring-1 ring-rose-400/30" : "bg-zinc-900"
          }`}
        >
          {emoji}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-100">{label}</p>
          {sublabel && (
            <p className="truncate text-xs leading-snug text-zinc-500">
              {sublabel}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onDec}
          disabled={value <= 0}
          className="h-9 w-9 rounded-full bg-zinc-800 text-lg font-bold text-zinc-200 transition hover:bg-zinc-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="w-7 text-center text-lg font-bold tabular-nums text-zinc-50">
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

function TimeChip({
  selected,
  onClick,
  children,
  tone,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  tone: "day" | "night";
}) {
  const selectedCls =
    tone === "day"
      ? "bg-amber-500 text-zinc-950 ring-amber-300/60 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
      : "bg-sky-600 text-white ring-sky-300/50 shadow-[0_0_20px_rgba(2,132,199,0.25)]";
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition active:scale-[0.98] ${
        selected
          ? selectedCls
          : "bg-zinc-950/70 text-zinc-400 ring-white/8 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function Setup({
  players,
  onPlayersChange,
  playerCount,
  counts,
  villagerCount,
  specialTotal,
  tooManySpecials,
  tooFewPlayers,
  noWerewolf,
  canStart,
  dayMinutes,
  nightSeconds,
  onDayMinutesChange,
  onNightSecondsChange,
  onAdjustCount,
  onStart,
}: {
  players: string[];
  onPlayersChange: (players: string[]) => void;
  playerCount: number;
  counts: Record<ClassicRoleId, number>;
  villagerCount: number;
  specialTotal: number;
  tooManySpecials: boolean;
  tooFewPlayers: boolean;
  noWerewolf: boolean;
  canStart: boolean;
  dayMinutes: number;
  nightSeconds: number;
  onDayMinutesChange: (m: number) => void;
  onNightSecondsChange: (s: number) => void;
  onAdjustCount: (id: ClassicRoleId, delta: number) => void;
  onStart: () => void;
}) {
  const wolfTotal = counts.alpha + counts.werewolf;
  const filledRatio = Math.min(1, Math.max(0, specialTotal / Math.max(playerCount, 1)));
  const seatLabel = tooManySpecials
    ? "Too many specials"
    : `${specialTotal} special · ${Math.max(0, villagerCount)} villagers`;

  return (
    <div className="mt-5 space-y-5 pb-28">
      <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Players
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Names stay on this device for next game.
            </p>
          </div>
          <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold tabular-nums text-zinc-300 ring-1 ring-white/10">
            {playerCount}/{MAX_PLAYERS}
          </span>
        </div>
        <PlayerManager
          players={players}
          onChange={onPlayersChange}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          accent="rose"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-linear-to-br from-amber-950/40 to-zinc-900 p-4 ring-1 ring-amber-500/20">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-lg">
              ☀️
            </span>
            <div>
              <h3 className="text-sm font-bold text-amber-100">Day</h3>
              <p className="text-[11px] text-amber-200/60">Discussion length</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {DAY_MINUTES_OPTIONS.map((m) => (
              <TimeChip
                key={m}
                tone="day"
                selected={dayMinutes === m}
                onClick={() => onDayMinutesChange(m)}
              >
                {m}m
              </TimeChip>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-linear-to-br from-sky-950/50 to-zinc-900 p-4 ring-1 ring-sky-500/20">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-lg">
              🌙
            </span>
            <div>
              <h3 className="text-sm font-bold text-sky-100">Night</h3>
              <p className="text-[11px] text-sky-200/60">Per-player turn</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {NIGHT_SECONDS_OPTIONS.map((s) => (
              <TimeChip
                key={s}
                tone="night"
                selected={nightSeconds === s}
                onClick={() => onNightSecondsChange(s)}
              >
                {s < 60 ? `${s}s` : `${s / 60}m`}
              </TimeChip>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Roles
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Villagers fill whatever seats are left.
            </p>
          </div>
          <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-zinc-300 ring-1 ring-white/10">
            {wolfTotal} wolf{wolfTotal === 1 ? "" : "ves"}
          </span>
        </div>

        <div className="space-y-4">
          {ROLE_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <p
                className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${group.tint}`}
              >
                {group.title}
              </p>
              <div className="space-y-2">
                {group.ids.map((id) => {
                  const role = CLASSIC_ROLES[id];
                  return (
                    <Stepper
                      key={id}
                      emoji={role.emoji}
                      label={role.name}
                      sublabel={role.short}
                      value={counts[id]}
                      active={counts[id] > 0}
                      onDec={() => onAdjustCount(id, -1)}
                      onInc={() => onAdjustCount(id, 1)}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-950/25 px-3.5 py-3 ring-1 ring-emerald-500/20">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-xl">
                {CLASSIC_ROLES.villager.emoji}
              </span>
              <div>
                <p className="font-semibold text-emerald-50">Villagers</p>
                <p className="text-xs text-emerald-200/60">Auto-filled seats</p>
              </div>
            </div>
            <span className="text-2xl font-bold tabular-nums text-emerald-200">
              {Math.max(0, villagerCount)}
            </span>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-zinc-500">
          2+ wolves with no Alpha → one becomes Alpha. Cupid links Lovers on
          night one.
        </p>
      </section>

      <div
        className={`rounded-2xl px-4 py-3 ring-1 ${
          canStart
            ? "bg-zinc-900/80 ring-white/10"
            : "bg-rose-950/30 ring-rose-500/30"
        }`}
      >
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-400">Seat balance</span>
          <span className="font-medium text-zinc-200">{seatLabel}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-950">
          <div
            className={`h-full rounded-full transition-all ${
              tooManySpecials ? "bg-rose-500" : "bg-rose-500/80"
            }`}
            style={{ width: `${Math.round(filledRatio * 100)}%` }}
          />
        </div>
        {tooFewPlayers && (
          <p className="mt-2 text-sm text-rose-400">
            Need at least {MIN_PLAYERS} players.
          </p>
        )}
        {!tooFewPlayers && tooManySpecials && (
          <p className="mt-2 text-sm text-rose-400">
            Too many roles for {playerCount} players.
          </p>
        )}
        {!tooFewPlayers && !tooManySpecials && noWerewolf && (
          <p className="mt-2 text-sm text-amber-400">Add at least one werewolf.</p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-zinc-950/90 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={onStart}
            disabled={!canStart}
            className="w-full rounded-2xl bg-rose-600 py-4 text-lg font-semibold text-white shadow-[0_12px_40px_rgba(225,29,72,0.35)] transition hover:bg-rose-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
          >
            Deal roles
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Reveal ----------------------------- */

function Reveal({
  player,
  index,
  total,
  nextName,
  onNext,
}: {
  player: ClassicPlayer;
  index: number;
  total: number;
  nextName?: string;
  onNext: () => void;
}) {
  const isLast = index + 1 >= total;
  const [held, setHeld] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    setHeld(false);
    setSeen(false);
  }, [index]);

  function hold() {
    setHeld(true);
    setSeen(true);
  }

  return (
    <div className="mt-6 flex flex-col items-center">
      <p className="text-center text-sm text-zinc-400">
        {index + 1} of {total}
      </p>
      <p className="mt-1 text-center text-lg font-semibold">{player.name}</p>

      <div
        role="button"
        tabIndex={0}
        aria-label="Hold to reveal your role"
        onPointerDown={hold}
        onPointerUp={() => setHeld(false)}
        onPointerLeave={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") hold();
        }}
        onKeyUp={() => setHeld(false)}
        onBlur={() => setHeld(false)}
        className="flip-card mt-4 h-112 w-full max-w-xs touch-none select-none outline-none"
      >
        <div className={`flip-card-inner ${held ? "is-flipped" : ""}`}>
          <div className="flip-face flex flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl bg-linear-to-br from-zinc-800 to-zinc-900 p-8 text-center shadow-xl ring-1 ring-white/10">
            <div className="absolute inset-3 rounded-2xl border border-white/5" />
            <span className="text-6xl drop-shadow">🌙</span>
            <p className="text-xl font-semibold text-zinc-100">Hold to reveal</p>
            <p className="px-4 text-sm text-zinc-400">
              Press and hold to see your role. Let go to flip it back.
            </p>
          </div>

          <div className="flip-face flip-face-back overflow-hidden rounded-3xl shadow-xl ring-1 ring-white/10">
            <Image
              src={player.role.image}
              alt={player.role.name}
              fill
              sizes="320px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/95 via-black/45 to-black/20" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-center">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Your role
              </span>
              <h2 className="mt-1 text-3xl font-bold tracking-wide text-zinc-50">
                {player.role.name}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                {player.role.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {seen ? (
        <button
          onClick={onNext}
          className="mt-6 w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99]"
        >
          {isLast
            ? "Everyone's ready — start Day 1"
            : `Pass to ${nextName ?? "the next player"}`}
        </button>
      ) : (
        <p className="mt-6 h-[60px] text-center text-sm text-zinc-500">
          Hold the card above to see your role first.
        </p>
      )}
    </div>
  );
}

/* ----------------------------- Discussion ----------------------------- */

function Discussion({
  game,
  dayNumber,
  minutes,
  nightResult,
  onEnd,
}: {
  game: ClassicPlayer[];
  dayNumber: number;
  minutes: number;
  nightResult: ClassicNightResult | null;
  onEnd: () => void;
}) {
  const totalSeconds = minutes * 60;
  const [left, setLeft] = useState(totalSeconds);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    setLeft(totalSeconds);
    setRunning(true);
  }, [dayNumber, totalSeconds]);

  useEffect(() => {
    if (!running || left <= 0) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [running, left]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const alive = living(game);

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        Day {dayNumber} · Discussion
      </p>

      {dayNumber > 1 && nightResult && (
        <div className="rounded-2xl bg-zinc-900 p-5 text-center ring-1 ring-white/10">
          <p className="text-sm text-zinc-400">Last night</p>
          {nightResult.deaths.length > 0 ? (
            <p className="mt-1 text-base font-semibold text-rose-300">
              {nightResult.deaths.map((id) => nameOf(game, id)).join(", ")}{" "}
              died.
            </p>
          ) : (
            <p className="mt-1 text-base font-semibold text-emerald-300">
              No one died.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-amber-500/10 p-8 text-center ring-1 ring-amber-500/30">
        <span className="text-4xl">💬</span>
        <h2 className="mt-3 text-lg font-bold">Day discussion</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Accuse, defend, dig for tells. {alive.length} players still alive.
        </p>
        <p className="mt-1 text-xs uppercase tracking-wide text-amber-200/70">
          Day timer
        </p>
        <p
          className={`mt-2 font-mono text-5xl font-bold tabular-nums ${
            left === 0 ? "text-rose-400" : "text-amber-100"
          }`}
        >
          {mm}:{ss}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setRunning((r) => !r)}
            className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700"
          >
            {running ? "Pause" : "Resume"}
          </button>
          <button
            onClick={() => {
              setLeft(totalSeconds);
              setRunning(true);
            }}
            className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700"
          >
            Reset
          </button>
        </div>
      </div>

      <button
        onClick={onEnd}
        className="w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
      >
        End discussion & vote
      </button>
    </div>
  );
}

/* ----------------------------- Accusation vote ----------------------------- */

function AccusationVote({
  game,
  onComplete,
}: {
  game: ClassicPlayer[];
  onComplete: (tally: Record<number, number>) => void;
}) {
  const voters = useMemo(
    () => shuffle(living(game).map((p) => p.id)),
    [game],
  );
  const tally = useRef<Record<number, number>>({});
  const [pos, setPos] = useState(0);
  const [opened, setOpened] = useState(false);
  const [sel, setSel] = useState<number | null>(null);

  const voterId = voters[pos];
  const voter = game.find((p) => p.id === voterId);
  const options = living(game).filter((p) => p.id !== voterId);

  useEffect(() => {
    if (voters.length === 0) onComplete({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voters.length]);

  function lockIn() {
    if (sel != null) tally.current[sel] = (tally.current[sel] ?? 0) + 1;
    setOpened(false);
    setSel(null);
    if (pos + 1 >= voters.length) {
      onComplete({ ...tally.current });
    } else {
      setPos((p) => p + 1);
    }
  }

  if (voters.length === 0) return null;

  if (!opened) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Vote · {pos + 1} of {voters.length}
        </p>
        <span className="mt-4 text-5xl">🗳️</span>
        <h2 className="mt-4 text-xl font-semibold">
          Pass the phone to {voter?.name}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Everyone else, look away. Vote who goes on trial.
        </p>
        <button
          onClick={() => setOpened(true)}
          className="mt-6 w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
        >
          I&apos;m {voter?.name} — vote
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        {voter?.name}&apos;s vote
      </p>
      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-base font-bold">Who should stand trial?</h2>
        <TargetGrid options={options} selected={sel} onSelect={setSel} />
        <button
          onClick={() => setSel(null)}
          className={`mt-2 w-full rounded-xl px-4 py-2 text-sm font-medium ring-1 transition ${
            sel === null
              ? "bg-zinc-700 text-white ring-zinc-500"
              : "bg-zinc-900 text-zinc-400 ring-white/10 hover:bg-zinc-800"
          }`}
        >
          Abstain
        </button>
      </div>
      <button
        onClick={lockIn}
        className="w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99]"
      >
        {pos + 1 >= voters.length ? "Lock in & see trial" : "Lock in & pass on"}
      </button>
    </div>
  );
}

/* ----------------------------- Trial ----------------------------- */

function Trial({
  game,
  accused,
  voteCount,
  onExecute,
  onForgive,
}: {
  game: ClassicPlayer[];
  accused: number;
  voteCount: number;
  onExecute: () => void;
  onForgive: () => void;
}) {
  const voters = useMemo(
    () => shuffle(living(game).filter((p) => p.id !== accused).map((p) => p.id)),
    [game, accused],
  );
  const [pos, setPos] = useState(0);
  const [opened, setOpened] = useState(false);
  const [exec, setExec] = useState(0);
  const [forgive, setForgive] = useState(0);
  const [choice, setChoice] = useState<"execute" | "forgive" | null>(null);
  const [showResult, setShowResult] = useState(false);

  const accusedPlayer = game.find((p) => p.id === accused);
  const voter = game.find((p) => p.id === voters[pos]);

  function lockIn() {
    if (!choice) return;
    const nextExec = exec + (choice === "execute" ? 1 : 0);
    const nextForgive = forgive + (choice === "forgive" ? 1 : 0);
    setExec(nextExec);
    setForgive(nextForgive);
    setChoice(null);
    setOpened(false);

    if (pos + 1 >= voters.length) {
      setShowResult(true);
      // Store final in refs via state — decide after render with effect
      setTimeout(() => {
        if (nextExec > nextForgive) onExecute();
        else onForgive();
      }, 1200);
      return;
    }
    setPos((p) => p + 1);
  }

  if (showResult) {
    const willExecute = exec > forgive;
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <span className="text-5xl">{willExecute ? "🪓" : "🕊️"}</span>
        <h2 className="mt-4 text-2xl font-bold">
          {willExecute ? "Guilty" : "Forgiven"}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Execute {exec} · Forgive {forgive}
        </p>
        <p className="mt-3 text-sm text-zinc-300">
          {willExecute
            ? `${accusedPlayer?.name} will be executed…`
            : `${accusedPlayer?.name} walks free.`}
        </p>
      </div>
    );
  }

  if (!opened) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
          <span className="text-5xl">⚖️</span>
          <h2 className="mt-4 text-2xl font-bold">
            {accusedPlayer?.name} stands accused
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            {voteCount} accusation vote{voteCount === 1 ? "" : "s"}. Let them
            plead — then the village votes.
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-900 p-6 text-center ring-1 ring-white/10">
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Verdict · {pos + 1} of {voters.length}
          </p>
          <h3 className="mt-3 text-lg font-semibold">
            Pass to {voter?.name}
          </h3>
          <button
            onClick={() => setOpened(true)}
            className="mt-6 w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
          >
            I&apos;m {voter?.name} — cast verdict
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        {voter?.name}&apos;s verdict
      </p>
      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-center text-base font-bold">
          Execute or forgive {accusedPlayer?.name}?
        </h2>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setChoice("forgive")}
            className={`flex-1 rounded-xl py-4 text-sm font-semibold ring-1 transition ${
              choice === "forgive"
                ? "bg-emerald-600 text-white ring-emerald-400"
                : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
            }`}
          >
            🕊️ Forgive
          </button>
          <button
            onClick={() => setChoice("execute")}
            className={`flex-1 rounded-xl py-4 text-sm font-semibold ring-1 transition ${
              choice === "execute"
                ? "bg-rose-600 text-white ring-rose-400"
                : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
            }`}
          >
            🪓 Execute
          </button>
        </div>
      </div>
      <button
        onClick={lockIn}
        disabled={!choice}
        className="w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        Lock in
      </button>
    </div>
  );
}

/* ----------------------------- Hunter ----------------------------- */

function HunterRevenge({
  game,
  hunterId,
  cause,
  onShoot,
}: {
  game: ClassicPlayer[];
  hunterId: number;
  cause: "wolf" | "vote" | "other";
  onShoot: (targetId: number) => void;
}) {
  const [opened, setOpened] = useState(false);
  const hunter = game.find((p) => p.id === hunterId);
  const options = living(game);

  if (!opened) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <span className="text-5xl">🏹</span>
        <h2 className="mt-4 text-xl font-semibold">
          {cause === "wolf" ? "Werewolves attacked the Hunter!" : "The Hunter falls"}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Pass the phone to{" "}
          <span className="font-semibold text-amber-300">{hunter?.name}</span>
          {cause === "wolf"
            ? " — take your revenge shot before the night continues."
            : " — they take one last shot."}
        </p>
        <button
          onClick={() => setOpened(true)}
          className="mt-6 w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
        >
          I&apos;m {hunter?.name} — aim
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-lg font-bold">Choose who dies with you</h2>
        <TargetGrid
          options={options}
          selected={null}
          onSelect={onShoot}
        />
      </div>
    </div>
  );
}

/* ----------------------------- Night ----------------------------- */

function NightIntro({
  nightNumber,
  turnSeconds,
  firstName,
  onContinue,
}: {
  nightNumber: number;
  turnSeconds: number;
  firstName: string;
  onContinue: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl bg-indigo-950/40 p-8 text-center ring-1 ring-indigo-500/30">
      <span className="text-5xl">🌙</span>
      <p className="mt-4 text-xs uppercase tracking-[0.3em] text-indigo-300/80">
        Night {nightNumber}
      </p>
      <h2 className="mt-2 text-2xl font-bold text-indigo-50">The village sleeps</h2>
      <p className="mt-3 text-sm text-zinc-400">
        Pass the phone one player at a time. Each turn is private — everyone else
        looks away. You get {turnSeconds}s after you open your turn.
      </p>
      <button
        onClick={onContinue}
        className="mt-8 w-full rounded-xl bg-indigo-500 py-4 text-lg font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.99]"
      >
        Pass to {firstName}
      </button>
    </div>
  );
}

function formatClock(total: number) {
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function NightTurn({
  prompt,
  game,
  nightNumber,
  step,
  total,
  turnSeconds,
  onSubmit,
}: {
  prompt: ClassicNightPrompt;
  game: ClassicPlayer[];
  nightNumber: number;
  step: number;
  total: number;
  turnSeconds: number;
  onSubmit: (input: ClassicNightInput) => void;
}) {
  const player = game.find((p) => p.id === prompt.playerId)!;
  const [handedOff, setHandedOff] = useState(false);
  const [opened, setOpened] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [target2, setTarget2] = useState<number | null>(null);
  const [mode, setMode] = useState<"kill" | "convert">("kill");
  const [promptData] = useState(() => randomVillagerPrompt());
  const [villagerChoice, setVillagerChoice] = useState<string | null>(null);
  const [villagerReacted, setVillagerReacted] = useState(false);
  const [seekerResult, setSeekerResult] = useState<string | null>(null);
  const [left, setLeft] = useState(turnSeconds);
  const submitted = useRef(false);

  const others = living(game).filter((p) => p.id !== player.id);
  const pack = (prompt.packIds ?? [player.id])
    .map((id) => game.find((p) => p.id === id))
    .filter(Boolean) as ClassicPlayer[];
  const hasAlpha = pack.some((p) => p.role.id === "alpha");
  const passLabel =
    prompt.kind === "wolves"
      ? pack.map((p) => p.name).join(", ")
      : player.name;

  function buildInput(forceSkip: boolean): ClassicNightInput | null {
    if (forceSkip) {
      if (prompt.kind === "villager") {
        return {
          playerId: player.id,
          type: "villager_answer",
          targets: [],
        };
      }
      if (
        prompt.kind === "seeker" &&
        target != null &&
        seekerResult != null
      ) {
        return {
          playerId: player.id,
          type: "seeker_check",
          targets: [target],
        };
      }
      return { playerId: player.id, type: "sleep", targets: [] };
    }

    if (prompt.kind === "cupid") {
      if (target == null || target2 == null || target === target2) return null;
      return {
        playerId: player.id,
        type: "cupid_link",
        targets: [target, target2],
      };
    }
    if (prompt.kind === "seeker") {
      if (target == null) return null;
      if (seekerResult == null) return null;
      return {
        playerId: player.id,
        type: "seeker_check",
        targets: [target],
      };
    }
    if (prompt.kind === "knight") {
      if (target == null) return null;
      return {
        playerId: player.id,
        type: "knight_protect",
        targets: [target],
      };
    }
    if (prompt.kind === "vampire") {
      if (target == null) return null;
      return {
        playerId: player.id,
        type: "vampire_bite",
        targets: [target],
      };
    }
    if (prompt.kind === "wolves") {
      if (target == null) return null;
      return {
        playerId: player.id,
        type: mode === "convert" && hasAlpha ? "wolf_convert" : "wolf_kill",
        targets: [target],
      };
    }
    if (prompt.kind === "villager") {
      return {
        playerId: player.id,
        type: "villager_answer",
        targets: [],
      };
    }
    return null;
  }

  function lockIn(forceSkip = false) {
    if (submitted.current) return;
    if (prompt.kind === "seeker" && !forceSkip && seekerResult == null) {
      if (target == null) return;
      const t = game.find((p) => p.id === target);
      const isWolf = t?.role.team === "werewolf";
      setSeekerResult(
        isWolf
          ? `${nameOf(game, target)} is a Werewolf.`
          : `${nameOf(game, target)} is not a Werewolf.`,
      );
      return;
    }
    const input = buildInput(forceSkip);
    if (!input) return;
    submitted.current = true;
    onSubmit(input);
  }

  // Night timer only runs after the player opens their private turn.
  useEffect(() => {
    if (!opened) return;
    setLeft(turnSeconds);
    const tick = setInterval(() => {
      setLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [opened, turnSeconds]);

  useEffect(() => {
    if (!opened || left > 0) return;
    lockIn(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, opened]);

  const ready = (() => {
    switch (prompt.kind) {
      case "villager":
        return villagerReacted;
      case "cupid":
        return target != null && target2 != null && target !== target2;
      case "seeker":
        return target != null && seekerResult != null;
      case "knight":
      case "vampire":
      case "wolves":
        return target != null;
      default:
        return false;
    }
  })();

  // Step 1: hand the phone over (no role info yet).
  if (!handedOff) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Night {nightNumber} · {step} of {total}
        </p>
        <span className="mt-4 text-5xl">📱</span>
        <h2 className="mt-4 text-xl font-semibold">
          Pass the phone to {passLabel}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Do not open the turn until {passLabel} is holding the phone. Everyone
          else look away.
        </p>
        <button
          onClick={() => setHandedOff(true)}
          className="mt-6 w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99]"
        >
          Phone is with {passLabel.split(",")[0]}
        </button>
      </div>
    );
  }

  // Step 2: player confirms identity, then sees their action.
  if (!opened) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-indigo-950/40 p-8 text-center ring-1 ring-indigo-500/30">
        <p className="text-xs uppercase tracking-widest text-indigo-300/80">
          Night {nightNumber} · private turn
        </p>
        <span className="mt-4 text-5xl">🌙</span>
        <h2 className="mt-4 text-xl font-semibold text-indigo-50">
          {passLabel}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Only you should see the next screen. Your night timer ({turnSeconds}s)
          starts when you open your action.
        </p>
        <button
          onClick={() => setOpened(true)}
          className="mt-6 w-full rounded-xl bg-indigo-500 py-4 text-lg font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.99]"
        >
          I&apos;m {passLabel.split(",")[0]} — open my action
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-widest text-zinc-500">
        <span>
          Night {nightNumber} · {player.name}
        </span>
        <span
          className={`font-mono text-sm font-bold tabular-nums ${
            left <= 10 ? "text-rose-400" : "text-indigo-300"
          }`}
        >
          {formatClock(left)}
        </span>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        {prompt.kind === "cupid" && (
          <>
            <h2 className="text-lg font-bold">💘 Cupid</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Choose two players to become Lovers. If one dies, so does the
              other.
            </p>
            <p className="mt-4 text-xs uppercase tracking-wide text-zinc-500">
              First lover
            </p>
            <TargetGrid
              options={living(game)}
              selected={target}
              onSelect={(id) => {
                setTarget(id);
                if (target2 === id) setTarget2(null);
              }}
            />
            <p className="mt-4 text-xs uppercase tracking-wide text-zinc-500">
              Second lover
            </p>
            <TargetGrid
              options={living(game).filter((p) => p.id !== target)}
              selected={target2}
              onSelect={setTarget2}
            />
          </>
        )}

        {prompt.kind === "seeker" && (
          <>
            <h2 className="text-lg font-bold">🔍 Seeker</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Check one player — are they a Werewolf?
            </p>
            {seekerResult ? (
              <p className="mt-4 rounded-xl bg-sky-950/50 px-4 py-3 text-sm font-semibold text-sky-200 ring-1 ring-sky-500/30">
                {seekerResult}
              </p>
            ) : (
              <TargetGrid
                options={others}
                selected={target}
                onSelect={setTarget}
              />
            )}
          </>
        )}

        {prompt.kind === "knight" && (
          <>
            <h2 className="text-lg font-bold">🛡️ Knight</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Protect one player from death or conversion tonight.
            </p>
            <TargetGrid options={others} selected={target} onSelect={setTarget} />
          </>
        )}

        {prompt.kind === "vampire" && (
          <>
            <h2 className="text-lg font-bold">🧛 Vampire</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Bite a player to convert them into a Vampire.
            </p>
            <TargetGrid options={others} selected={target} onSelect={setTarget} />
          </>
        )}

        {prompt.kind === "wolves" && (
          <>
            <h2 className="text-lg font-bold">🐺 Werewolf pack</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Pack: {pack.map((p) => p.name).join(", ")}. Choose tonight&apos;s
              target.
            </p>
            {hasAlpha && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setMode("kill")}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold ring-1 transition ${
                    mode === "kill"
                      ? "bg-rose-600 text-white ring-rose-400"
                      : "bg-zinc-900 text-zinc-200 ring-white/10"
                  }`}
                >
                  Kill
                </button>
                <button
                  onClick={() => setMode("convert")}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold ring-1 transition ${
                    mode === "convert"
                      ? "bg-amber-600 text-white ring-amber-400"
                      : "bg-zinc-900 text-zinc-200 ring-white/10"
                  }`}
                >
                  Convert
                </button>
              </div>
            )}
            <TargetGrid options={others} selected={target} onSelect={setTarget} />
          </>
        )}

        {prompt.kind === "villager" && (
          <>
            <h2 className="text-lg font-bold">🧑‍🌾 Villager</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Answer the question, then lock in.
            </p>
            <p className="mt-4 text-base font-medium text-zinc-100">
              {promptData.question}
            </p>
            {villagerReacted ? (
              <p className="mt-4 rounded-xl bg-amber-950/40 px-4 py-4 text-center text-lg font-semibold text-amber-200 ring-1 ring-amber-500/30">
                {WEIRD_ANSWER_LINE}
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-2">
                {promptData.choices.map((choice) => (
                  <button
                    key={choice}
                    onClick={() => {
                      setVillagerChoice(choice);
                      setVillagerReacted(true);
                    }}
                    className={`rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 transition ${
                      villagerChoice === choice
                        ? "bg-rose-600 text-white ring-rose-400"
                        : "bg-zinc-950/60 text-zinc-200 ring-white/10 hover:bg-zinc-800"
                    }`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <button
        onClick={() => lockIn(false)}
        disabled={
          prompt.kind === "seeker"
            ? seekerResult
              ? false
              : target == null
            : !ready
        }
        className="w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {prompt.kind === "seeker" && !seekerResult
          ? target == null
            ? "Pick someone to check"
            : "Reveal result"
          : prompt.kind === "villager" && !villagerReacted
            ? "Pick an answer first"
            : step < total
              ? "Lock in & pass on"
              : "Lock in & end the night"}
      </button>
    </div>
  );
}

/* ----------------------------- Dawn ----------------------------- */

function Dawn({
  game,
  dayNumber,
  result,
  onContinue,
}: {
  game: ClassicPlayer[];
  dayNumber: number;
  result: ClassicNightResult;
  onContinue: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
      <span className="text-5xl">{result.deaths.length ? "🌅" : "☀️"}</span>
      <h2 className="mt-4 text-2xl font-bold">Dawn of Day {dayNumber}</h2>
      {result.deaths.length > 0 ? (
        <p className="mt-3 text-sm text-zinc-300">
          <span className="font-semibold text-rose-300">
            {result.deaths.map((id) => nameOf(game, id)).join(", ")}
          </span>{" "}
          did not survive the night.
        </p>
      ) : (
        <p className="mt-3 text-sm text-emerald-300">
          Everyone survived the night.
        </p>
      )}
      <button
        onClick={onContinue}
        className="mt-6 w-full rounded-xl bg-amber-500 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-amber-400 active:scale-[0.99]"
      >
        Begin discussion
      </button>
    </div>
  );
}

/* ----------------------------- Game over ----------------------------- */

function GameOver({
  winner,
  game,
  onPlayAgain,
  onExit,
}: {
  winner: ClassicWinner;
  game: ClassicPlayer[];
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const [confirmExit, setConfirmExit] = useState(false);
  const banner =
    winner === "village"
      ? {
          emoji: "🎉",
          title: "Village wins!",
          sub: "Every threat has been driven out.",
          color: "text-emerald-300",
        }
      : winner === "werewolf"
        ? {
            emoji: "🐺",
            title: "Werewolves win!",
            sub: "The pack rules the night.",
            color: "text-rose-300",
          }
        : winner === "vampire"
          ? {
              emoji: "🧛",
              title: "Vampires win!",
              sub: "The bloodline has taken over.",
              color: "text-purple-300",
            }
          : winner === "lovers"
            ? {
                emoji: "💘",
                title: "Lovers win!",
                sub: "Only the linked pair remains.",
                color: "text-pink-300",
              }
            : {
                emoji: "🃏",
                title: "The Jester wins!",
                sub: "Voted out — exactly as planned.",
                color: "text-amber-300",
              };

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <span className="text-6xl">{banner.emoji}</span>
        <h2 className={`mt-3 text-3xl font-bold ${banner.color}`}>
          {banner.title}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">{banner.sub}</p>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-lg font-semibold">Everyone&apos;s role</h2>
        <ul className="mt-3 space-y-2">
          {game.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-zinc-950/60 px-3 py-2 text-sm"
            >
              <span className={p.alive ? "" : "text-zinc-500 line-through"}>
                {p.name}
                {p.loverId != null ? " 💕" : ""}
              </span>
              <span className="font-medium">
                {p.role.emoji} {p.role.name}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {confirmExit ? (
        <div className="rounded-2xl bg-zinc-900 p-6 text-center ring-1 ring-rose-500/30">
          <p className="text-sm text-zinc-300">
            Exit to setup? This game will be gone.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setConfirmExit(false)}
              className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-200"
            >
              Stay
            </button>
            <button
              onClick={onExit}
              className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white"
            >
              Exit
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={onPlayAgain}
            className="w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500"
          >
            Play again — same settings
          </button>
          <button
            onClick={() => setConfirmExit(true)}
            className="w-full rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-200"
          >
            Exit to setup
          </button>
        </div>
      )}
    </div>
  );
}

function TargetGrid({
  options,
  selected,
  onSelect,
}: {
  options: ClassicPlayer[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {options.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          className={`rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 transition ${
            selected === p.id
              ? "bg-rose-600 text-white ring-rose-400"
              : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
