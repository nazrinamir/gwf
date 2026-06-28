"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExitButton from "../ui/exit-button";
import PlayerManager, { resolveNames } from "../ui/player-manager";
import {
  type NightInput,
  type NightResult,
  type Player,
  type WolfDisguise,
  type Winner,
  DOCTOR_HELP_NEEDED,
  WOLF_RATE_MAX,
  WOLF_RATE_MIN,
  aliveWolves,
  checkWinner,
  living,
  makePlayers,
  name as nameOf,
  randomDisguiseTarget,
  resolveNight,
  shuffle,
} from "./engine";
import { buildNightPrompts, type NightPrompt } from "./night-prompts";
import {
  ALL_TRAITS,
  CONFIGURABLE_ROLES,
  ROLES,
  TRAITS,
  type RoleId,
  type Trait,
} from "./roles";

type Phase =
  | "setup"
  | "reveal"
  | "day-intro"
  | "lead-news"
  | "morning"
  | "lead-reveal"
  | "discussion"
  | "afternoon-vote"
  | "lead-result"
  | "trial"
  | "night"
  | "wolf-blood"
  | "wolf-failed"
  | "wolf-killed"
  | "gameover";

type LeadRevealStep = "private" | "public";
type LeadMode = "promote" | "replace";

interface AfternoonOutcome {
  execTally: Record<number, number>;
  good: number;
  bad: number;
  jailTarget: number | null;
}

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 18;
const STORAGE_KEY = "werewolf:setup";

const DEFAULT_COUNTS: Record<RoleId, number> = {
  werewolf: 1,
  doctor: 1,
  knight: 1,
  jester: 1,
  villager: 0,
};

interface StoredSetup {
  players: string[];
  villageName: string;
  counts: Record<RoleId, number>;
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

    const counts = { ...DEFAULT_COUNTS };
    if (parsed.counts && typeof parsed.counts === "object") {
      for (const id of Object.keys(DEFAULT_COUNTS) as RoleId[]) {
        const v = (parsed.counts as Record<string, unknown>)[id];
        if (typeof v === "number" && v >= 0) counts[id] = v;
      }
    }

    return {
      players,
      villageName:
        typeof parsed.villageName === "string" ? parsed.villageName : "",
      counts,
    };
  } catch {
    return null;
  }
}

export default function WerewolfPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<string[]>(() =>
    Array.from({ length: 7 }, () => ""),
  );
  const [villageName, setVillageName] = useState("");
  const playerCount = players.length;
  const [counts, setCounts] =
    useState<Record<RoleId, number>>(DEFAULT_COUNTS);
  const [hydrated, setHydrated] = useState(false);

  // Restore saved setup once on mount (client only) to survive reloads.
  useEffect(() => {
    const stored = loadStoredSetup();
    if (stored) {
      setPlayers(stored.players);
      setVillageName(stored.villageName);
      setCounts(stored.counts);
    }
    setHydrated(true);
  }, []);

  // Persist setup whenever it changes (after the initial restore).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const data: StoredSetup = { players, villageName, counts };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore write errors (e.g. storage disabled or full).
    }
  }, [hydrated, players, villageName, counts]);

  const [game, setGame] = useState<Player[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);

  const [dayNumber, setDayNumber] = useState(1);
  const [wolfRate, setWolfRate] = useState(80);
  const [doctorHelp, setDoctorHelp] = useState(0);
  const [bloodMarks, setBloodMarks] = useState<number[]>([]);

  const [nightPrompts, setNightPrompts] = useState<NightPrompt[]>([]);
  const [nightPos, setNightPos] = useState(0);
  const [nightInputs, setNightInputs] = useState<NightInput[]>([]);
  const [guardedHouse, setGuardedHouse] = useState<number | null>(null);
  const [attackHouse, setAttackHouse] = useState<number | null>(null);
  const [killedTarget, setKilledTarget] = useState<number | null>(null);
  const [pendingResult, setPendingResult] = useState<NightResult | null>(null);

  const [result, setResult] = useState<NightResult | null>(null);
  const [morningPos, setMorningPos] = useState(0);

  const [leadId, setLeadId] = useState<number | null>(null);
  const [leadRevealStep, setLeadRevealStep] = useState<LeadRevealStep>("private");
  const [leadMode, setLeadMode] = useState<LeadMode>("promote");
  const [leadRevealNext, setLeadRevealNext] = useState<"news" | "discussion">(
    "discussion",
  );
  const [pendingDemotion, setPendingDemotion] = useState(false);

  const [execTally, setExecTally] = useState<Record<number, number>>({});
  const [jailNews, setJailNews] = useState<number | null>(null);
  const [accused, setAccused] = useState<number | null>(null);

  const [winner, setWinner] = useState<Winner | null>(null);

  const villageLabel = villageName.trim() || "the village";

  const specialTotal = CONFIGURABLE_ROLES.reduce((s, id) => s + counts[id], 0);
  const villagerCount = playerCount - specialTotal;
  const tooManySpecials = villagerCount < 0;
  const tooFewPlayers = playerCount < MIN_PLAYERS;
  const noWerewolf = counts.werewolf < 1;
  const canStart = !tooManySpecials && !tooFewPlayers && !noWerewolf;

  function adjustCount(id: RoleId, delta: number) {
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, prev[id] + delta) }));
  }

  function startGame() {
    const entries: { role: (typeof ROLES)[RoleId]; trait: Trait | null }[] = [];
    for (const id of CONFIGURABLE_ROLES) {
      for (let i = 0; i < counts[id]; i++)
        entries.push({ role: ROLES[id], trait: null });
    }
    for (let i = 0; i < villagerCount; i++) {
      entries.push({
        role: ROLES.villager,
        trait: ALL_TRAITS[Math.floor(Math.random() * ALL_TRAITS.length)],
      });
    }

    const names = resolveNames(players);
    setGame(makePlayers(names, shuffle(entries)));
    setRevealIndex(0);
    setDayNumber(1);
    setWolfRate(80);
    setDoctorHelp(0);
    setBloodMarks([]);
    setResult(null);
    setLeadId(null);
    setPendingDemotion(false);
    setExecTally({});
    setJailNews(null);
    setAccused(null);
    setWinner(null);
    setPhase("reveal");
  }

  function nextReveal() {
    if (revealIndex + 1 >= game.length) {
      setPhase("day-intro");
      return;
    }
    setRevealIndex((i) => i + 1);
  }

  /* ----------------------------- Morning ----------------------------- */

  function onDayIntroContinue() {
    if (dayNumber === 1) {
      promoteLead();
      return;
    }
    const leadAlive = game.some((p) => p.id === leadId && p.alive);
    if (!leadAlive) {
      pickNewLead("news");
      return;
    }
    setPhase("lead-news");
  }

  function promoteLead() {
    const alive = living(game);
    const lead = alive[Math.floor(Math.random() * alive.length)];
    setLeadId(lead.id);
    setGame((g) => g.map((p) => ({ ...p, isLead: p.id === lead.id })));
    setLeadMode("promote");
    setLeadRevealNext("discussion");
    setLeadRevealStep("private");
    setPhase("lead-reveal");
  }

  function pickNewLead(next: "news" | "discussion") {
    const pool = living(game).filter((p) => p.id !== leadId);
    const fallback = living(game);
    const choices = pool.length ? pool : fallback;
    setPendingDemotion(false);
    if (!choices.length) {
      setPhase(next === "news" ? "lead-news" : "discussion");
      return;
    }
    const lead = choices[Math.floor(Math.random() * choices.length)];
    setLeadId(lead.id);
    setGame((g) => g.map((p) => ({ ...p, isLead: p.id === lead.id })));
    setLeadMode("replace");
    setLeadRevealNext(next);
    setLeadRevealStep("private");
    setPhase("lead-reveal");
  }

  function afterMorningReports() {
    if (pendingDemotion) {
      pickNewLead("discussion");
      return;
    }
    setPhase("discussion");
  }

  function onLeadRevealDone() {
    setPhase(leadRevealNext === "news" ? "lead-news" : "discussion");
  }

  /* ----------------------------- Afternoon ----------------------------- */

  function onAfternoonComplete(outcome: AfternoonOutcome) {
    setExecTally(outcome.execTally);
    setPendingDemotion(outcome.bad > outcome.good);
    setJailNews(outcome.jailTarget);
    if (outcome.jailTarget != null) {
      const t = outcome.jailTarget;
      setGame((g) => g.map((p) => (p.id === t ? { ...p, jailed: true } : p)));
    }
    setPhase("lead-result");
  }

  function releaseJailed(id: number) {
    setGame((g) => g.map((p) => (p.id === id ? { ...p, jailed: false } : p)));
    setJailNews((j) => (j === id ? null : j));
  }

  function onPickTrial(id: number) {
    setAccused(id);
    setPhase("trial");
  }

  /* ----------------------------- Trial ----------------------------- */

  function endDayToNight(updated: Player[]) {
    const w = checkWinner(updated);
    if (w) {
      setWinner(w);
      setPhase("gameover");
      return;
    }
    beginNight(updated);
  }

  function execute(id: number) {
    const target = game.find((p) => p.id === id);
    if (!target) return;
    if (target.role.id === "jester") {
      setGame((g) => g.map((p) => (p.id === id ? { ...p, alive: false } : p)));
      setWinner("jester");
      setPhase("gameover");
      return;
    }
    const updated = game.map((p) =>
      p.id === id ? { ...p, alive: false } : p,
    );
    setGame(updated);
    setAccused(null);
    endDayToNight(updated);
  }

  function forgive() {
    setAccused(null);
    endDayToNight(game);
  }

  function spareEveryone() {
    setAccused(null);
    endDayToNight(game);
  }

  /* ----------------------------- Night ----------------------------- */

  function beginNight(g: Player[]) {
    setNightPrompts(buildNightPrompts(g));
    setNightPos(0);
    setNightInputs([]);
    setGuardedHouse(null);
    setAttackHouse(null);
    setKilledTarget(null);
    setPendingResult(null);
    setPhase("night");
  }

  function finishNightResult(res: NightResult) {
    setGame(res.players);
    setWolfRate(res.wolfRate);
    setDoctorHelp(res.doctorHelp);
    setBloodMarks(res.bloodMarks);
    setResult(res);
    setMorningPos(0);
    setGuardedHouse(null);
    setAttackHouse(null);
    setKilledTarget(null);
    setPendingResult(null);
    const w = checkWinner(res.players);
    if (w) {
      setWinner(w);
      setPhase("gameover");
    } else {
      setDayNumber((n) => n + 1);
      setPhase("day-intro");
    }
  }

  function resolveAfterNight(
    inputs: NightInput[],
    extra: { bloodPlantTarget?: number; wolfDisguise?: WolfDisguise } = {},
  ) {
    const resolution = resolveNight(game, inputs, wolfRate, doctorHelp, {
      bloodMarks,
      ...extra,
    });
    if (resolution.status === "wolf_blood") {
      setNightInputs(inputs);
      setGuardedHouse(resolution.guardedHouse);
      setPhase("wolf-blood");
      return;
    }
    if (resolution.status === "wolf_failed") {
      setNightInputs(inputs);
      setAttackHouse(resolution.attackHouse);
      setPhase("wolf-failed");
      return;
    }
    if (resolution.status === "wolf_killed") {
      setPendingResult(resolution.result);
      setKilledTarget(resolution.target);
      setPhase("wolf-killed");
      return;
    }
    finishNightResult(resolution.result);
  }

  function submitNightAction(input: NightInput) {
    const updatedInputs = [...nightInputs, input];
    if (nightPos + 1 >= nightPrompts.length) {
      resolveAfterNight(updatedInputs);
      return;
    }
    setNightInputs(updatedInputs);
    setNightPos((p) => p + 1);
  }

  function resetToSetup() {
    setPhase("setup");
    setGame([]);
    setWinner(null);
  }

  return (
    <main className="flex flex-1 flex-col bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
        <ExitButton />

        <div className="mt-4 flex items-center gap-3">
          <span className="text-3xl">🐺</span>
          <h1 className="text-2xl font-bold tracking-tight">Werewolf</h1>
        </div>

        {phase === "setup" && (
          <Setup
            players={players}
            onPlayersChange={setPlayers}
            villageName={villageName}
            onVillageNameChange={setVillageName}
            playerCount={playerCount}
            counts={counts}
            villagerCount={villagerCount}
            specialTotal={specialTotal}
            tooManySpecials={tooManySpecials}
            tooFewPlayers={tooFewPlayers}
            noWerewolf={noWerewolf}
            canStart={canStart}
            onAdjustCount={adjustCount}
            onStart={startGame}
          />
        )}

        {phase === "reveal" && game[revealIndex] && (
          <Reveal
            player={game[revealIndex]}
            index={revealIndex}
            total={game.length}
            nextName={game[revealIndex + 1]?.name}
            onNext={nextReveal}
          />
        )}

        {phase === "day-intro" && (
          <DayIntro
            dayNumber={dayNumber}
            village={villageLabel}
            onContinue={onDayIntroContinue}
          />
        )}

        {phase === "lead-news" && result && (
          <LeadNews
            result={result}
            game={game}
            leadId={leadId}
            onContinue={() => setPhase("morning")}
          />
        )}

        {phase === "morning" && result && (
          <Morning
            result={result}
            game={game}
            dayNumber={dayNumber}
            pos={morningPos}
            onAdvance={() => {
              if (morningPos + 1 >= result.reports.length) afterMorningReports();
              else setMorningPos((p) => p + 1);
            }}
          />
        )}

        {phase === "lead-reveal" && leadId != null && (
          <LeadReveal
            game={game}
            leadId={leadId}
            dayNumber={dayNumber}
            mode={leadMode}
            step={leadRevealStep}
            onPrivateDone={() => setLeadRevealStep("public")}
            onPublicDone={onLeadRevealDone}
          />
        )}

        {phase === "discussion" && (
          <Discussion
            game={game}
            leadId={leadId}
            dayNumber={dayNumber}
            village={villageLabel}
            onEnd={() => setPhase("afternoon-vote")}
          />
        )}

        {phase === "afternoon-vote" && (
          <AfternoonVote
            game={game}
            leadId={leadId}
            onComplete={onAfternoonComplete}
          />
        )}

        {phase === "lead-result" && (
          <LeadResult
            game={game}
            leadId={leadId}
            execTally={execTally}
            jailNews={jailNews}
            onRelease={releaseJailed}
            onTrial={onPickTrial}
            onSpare={spareEveryone}
          />
        )}

        {phase === "trial" && accused != null && (
          <Trial
            game={game}
            leadId={leadId}
            accused={accused}
            voteCount={execTally[accused] ?? 0}
            onExecute={() => execute(accused)}
            onForgive={forgive}
          />
        )}

        {phase === "night" && nightPrompts[nightPos] != null && (
          <NightTurn
            key={`${nightPos}-${nightPrompts[nightPos].playerId}`}
            prompt={nightPrompts[nightPos]}
            player={game.find((p) => p.id === nightPrompts[nightPos].playerId)!}
            game={game}
            dayNumber={dayNumber}
            step={nightPos + 1}
            total={nightPrompts.length}
            wolfRate={wolfRate}
            doctorHelp={doctorHelp}
            nightInputs={nightInputs}
            onSubmit={submitNightAction}
          />
        )}

        {phase === "wolf-blood" && guardedHouse != null && (
          <WolfBlood
            game={game}
            guardedHouse={guardedHouse}
            onSubmit={(t) => resolveAfterNight(nightInputs, { bloodPlantTarget: t })}
          />
        )}

        {phase === "wolf-failed" && attackHouse != null && (
          <WolfFailed
            game={game}
            attackHouse={attackHouse}
            onSubmit={(d) => resolveAfterNight(nightInputs, { wolfDisguise: d })}
          />
        )}

        {phase === "wolf-killed" && killedTarget != null && (
          <WolfKilled
            game={game}
            target={killedTarget}
            onContinue={() => pendingResult && finishNightResult(pendingResult)}
          />
        )}

        {phase === "gameover" && winner && (
          <GameOver
            winner={winner}
            game={game}
            village={villageLabel}
            onPlayAgain={startGame}
            onExit={resetToSetup}
          />
        )}
      </div>
    </main>
  );
}

/* ----------------------------- Setup ----------------------------- */

function Stepper({
  label,
  sublabel,
  value,
  onDec,
  onInc,
  emoji,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  emoji?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className="font-medium">
          {emoji ? `${emoji} ` : ""}
          {label}
        </p>
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
  villageName,
  onVillageNameChange,
  playerCount,
  counts,
  villagerCount,
  specialTotal,
  tooManySpecials,
  tooFewPlayers,
  noWerewolf,
  canStart,
  onAdjustCount,
  onStart,
}: {
  players: string[];
  onPlayersChange: (players: string[]) => void;
  villageName: string;
  onVillageNameChange: (v: string) => void;
  playerCount: number;
  counts: Record<RoleId, number>;
  villagerCount: number;
  specialTotal: number;
  tooManySpecials: boolean;
  tooFewPlayers: boolean;
  noWerewolf: boolean;
  canStart: boolean;
  onAdjustCount: (id: RoleId, delta: number) => void;
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
          accent="rose"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Village name
        </h2>
        <input
          value={villageName}
          onChange={(e) => onVillageNameChange(e.target.value)}
          placeholder="e.g. Ravenhollow"
          maxLength={40}
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-base text-zinc-100 ring-1 ring-white/10 outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-rose-500/60"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Roles
        </h2>
        <div className="space-y-2">
          {CONFIGURABLE_ROLES.map((id) => {
            const role = ROLES[id];
            return (
              <Stepper
                key={id}
                emoji={role.emoji}
                label={role.name}
                sublabel={role.short}
                value={counts[id]}
                onDec={() => onAdjustCount(id, -1)}
                onInc={() => onAdjustCount(id, 1)}
              />
            );
          })}
          <div className="flex items-center justify-between rounded-xl bg-zinc-900/60 px-4 py-3 ring-1 ring-white/5">
            <div>
              <p className="font-medium">{ROLES.villager.emoji} Villagers</p>
              <p className="text-xs text-zinc-400">
                Fill the rest — each gets a hidden trait
              </p>
            </div>
            <span className="text-lg font-semibold tabular-nums text-zinc-300">
              {Math.max(0, villagerCount)}
            </span>
          </div>
        </div>
      </section>

      <div className="rounded-xl bg-zinc-900/60 px-4 py-3 text-sm ring-1 ring-white/5">
        <span className="text-zinc-400">Special roles: </span>
        <span className="font-medium">{specialTotal}</span>
        <span className="text-zinc-400"> / {playerCount} seats</span>
        {tooFewPlayers && (
          <p className="mt-1 text-rose-400">
            Add at least {MIN_PLAYERS} players to start.
          </p>
        )}
        {!tooFewPlayers && tooManySpecials && (
          <p className="mt-1 text-rose-400">
            Too many roles for {playerCount} players.
          </p>
        )}
        {!tooFewPlayers && !tooManySpecials && noWerewolf && (
          <p className="mt-1 text-amber-400">Add at least one werewolf.</p>
        )}
      </div>

      <button
        onClick={onStart}
        disabled={!canStart}
        className="w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        Deal roles
      </button>
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
  player: Player;
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
  const trait = player.trait ? TRAITS[player.trait] : null;

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
              {trait && (
                <p className="mt-1 text-sm font-semibold text-amber-300">
                  {trait.emoji} {trait.name}
                </p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                {trait ? trait.description : player.role.description}
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
            ? "Everyone's ready — open the village"
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

/* ----------------------------- Day intro ----------------------------- */

function DayIntro({
  dayNumber,
  village,
  onContinue,
}: {
  dayNumber: number;
  village: string;
  onContinue: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl bg-linear-to-br from-amber-900/30 to-zinc-900 p-10 text-center ring-1 ring-amber-500/20">
      <span className="text-5xl">🌄</span>
      <p className="mt-4 text-xs uppercase tracking-[0.3em] text-amber-300/80">
        Day {dayNumber}
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-amber-50">
        {village}
      </h2>
      <p className="mt-3 text-sm text-zinc-400">
        {dayNumber === 1
          ? "A new village wakes for the first time. The night has not yet fallen."
          : "The sun rises again. Gather everyone."}
      </p>
      <button
        onClick={onContinue}
        className="mt-8 w-full rounded-xl bg-amber-500 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-amber-400 active:scale-[0.99]"
      >
        Begin the morning
      </button>
    </div>
  );
}

/* ----------------------------- Lead news ----------------------------- */

function LeadNews({
  result,
  game,
  leadId,
  onContinue,
}: {
  result: NightResult;
  game: Player[];
  leadId: number | null;
  onContinue: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const lead = game.find((p) => p.id === leadId);

  if (!opened) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <span className="text-5xl">📜</span>
        <h2 className="mt-4 text-xl font-semibold">Overnight news</h2>
        <p className="mt-2 text-sm text-zinc-400">
          For the Lead Villager&apos;s eyes only. Pass the phone to{" "}
          <span className="font-semibold text-amber-300">{lead?.name}</span>.
        </p>
        <button
          onClick={() => setOpened(true)}
          className="mt-6 w-full rounded-xl bg-amber-500 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-amber-400 active:scale-[0.99]"
        >
          I&apos;m {lead?.name} — read the news
        </button>
      </div>
    );
  }

  const doctor = game.find((p) => p.role.id === "doctor");
  const clinicClosed = !!doctor && !doctor.alive;
  const medicineProgress = Math.min(result.doctorHelp, DOCTOR_HELP_NEEDED);
  const jailedPlayers = game.filter((p) => p.jailed);
  const freshBlood = result.bloodReport;

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        Lead Villager&apos;s briefing
      </p>

      {/* Medicine — always shown when a clinic exists */}
      {doctor && (
        <div className="rounded-2xl bg-zinc-900 p-5 ring-1 ring-white/10">
          {clinicClosed ? (
            <p className="text-sm text-zinc-300">
              🏥 <span className="font-semibold text-rose-300">Clinic closed.</span>{" "}
              The doctor is dead — no more medicine can be brewed.
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-200">
                ⚗️ <span className="font-semibold">Medicine progress:</span>{" "}
                {medicineProgress}/{DOCTOR_HELP_NEEDED} nights of help.
              </p>
              {result.news.map((n, i) => (
                <p key={`news-${i}`} className="mt-2 text-sm text-zinc-400">
                  {n}
                </p>
              ))}
            </>
          )}
        </div>
      )}

      {/* Jail — players still locked up */}
      {jailedPlayers.length > 0 && (
        <div className="rounded-2xl bg-amber-950/40 p-5 ring-1 ring-amber-500/30">
          <p className="text-sm text-amber-200">
            🔒 <span className="font-semibold">Still in jail:</span>{" "}
            <span className="font-bold">
              {jailedPlayers.map((p) => p.name).join(", ")}
            </span>
            . They stay locked out until you free them.
          </p>
        </div>
      )}

      {/* Blood — only when a mark exists */}
      {freshBlood.length > 0 && (
        <div className="rounded-2xl bg-rose-950/40 p-5 ring-1 ring-rose-500/30">
          <p className="text-sm text-rose-200">
            🩸 A fresh blood mark was found on{" "}
            <span className="font-bold">
              {freshBlood.map((id) => nameOf(game, id)).join(", ")}
            </span>
            &apos;s doorstep.
          </p>
        </div>
      )}

      <button
        onClick={onContinue}
        className="w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99]"
      >
        Hide news & gather the village
      </button>
    </div>
  );
}

/* ----------------------------- Morning reports ----------------------------- */

function Morning({
  result,
  game,
  dayNumber,
  pos,
  onAdvance,
}: {
  result: NightResult;
  game: Player[];
  dayNumber: number;
  pos: number;
  onAdvance: () => void;
}) {
  const [showDeaths, setShowDeaths] = useState(true);
  const report = result.reports[pos];
  const reporter = game.find((p) => p.id === report?.playerId);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [pos]);

  if (showDeaths) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <span className="text-5xl">{result.deaths.length ? "🌅" : "☀️"}</span>
        <h2 className="mt-4 text-2xl font-bold">Dawn of Day {dayNumber}</h2>
        {result.deaths.length > 0 ? (
          <p className="mt-3 text-sm text-zinc-300">
            The village wakes to grief.{" "}
            <span className="font-semibold text-rose-300">
              {result.deaths.map((id) => nameOf(game, id)).join(", ")}
            </span>{" "}
            did not survive the night.
          </p>
        ) : (
          <p className="mt-3 text-sm text-emerald-300">
            Everyone survived the night!
          </p>
        )}
        {result.revived.length > 0 && (
          <p className="mt-2 text-sm text-emerald-300">
            ✨ {result.revived.map((id) => nameOf(game, id)).join(", ")} was
            pulled back from death by the Doctor!
          </p>
        )}
        <button
          onClick={() => setShowDeaths(false)}
          className="mt-6 w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
        >
          Hear everyone&apos;s account
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        Morning report · {pos + 1} of {result.reports.length}
      </p>
      <div className="rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <h2 className="text-xl font-semibold">{reporter?.name}</h2>
        {!revealed ? (
          <>
            <p className="mt-3 text-sm text-zinc-400">
              Pass the phone to {reporter?.name} to read their account aloud.
            </p>
            <button
              onClick={() => setRevealed(true)}
              className="mt-6 w-full rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700"
            >
              Show my account
            </button>
          </>
        ) : (
          <p className="mt-4 text-lg italic leading-relaxed text-zinc-100">
            &ldquo;{report?.line}&rdquo;
          </p>
        )}
      </div>
      {revealed && (
        <button
          onClick={onAdvance}
          className="w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99]"
        >
          {pos + 1 >= result.reports.length ? "On to discussion" : "Next account"}
        </button>
      )}
    </div>
  );
}

/* ------------------------ Lead Villager reveal ------------------------ */

function LeadReveal({
  game,
  leadId,
  dayNumber,
  mode,
  step,
  onPrivateDone,
  onPublicDone,
}: {
  game: Player[];
  leadId: number;
  dayNumber: number;
  mode: LeadMode;
  step: LeadRevealStep;
  onPrivateDone: () => void;
  onPublicDone: () => void;
}) {
  const lead = game.find((p) => p.id === leadId)!;

  if (step === "private") {
    return (
      <div className="mt-10 flex min-h-[60vh] flex-col items-center justify-center text-center">
        <span className="text-6xl">👑</span>
        <p className="mt-6 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Pass the phone to
        </p>
        <h2 className="mt-3 text-5xl font-extrabold tracking-tight text-amber-100">
          {lead.name}
        </h2>
        <button
          onClick={onPrivateDone}
          className="mt-12 w-full rounded-xl bg-amber-500 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-amber-400 active:scale-[0.99]"
        >
          Start the day
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl bg-amber-500/10 p-8 text-center ring-1 ring-amber-500/30">
      <span className="text-6xl">👑</span>
      <p className="mt-2 text-xs uppercase tracking-[0.25em] text-amber-300/80">
        {mode === "replace" ? "New Lead Villager" : "Public announcement"}
      </p>
      <h2 className="mt-4 text-3xl font-bold text-amber-100">{lead.name}</h2>
      <p className="mt-2 text-lg text-amber-200">
        {mode === "replace"
          ? "takes over as Lead Villager"
          : "is the Lead Villager"}
      </p>
      <p className="mt-4 text-sm text-zinc-300">
        Read this aloud. {lead.name} runs Day {dayNumber}&apos;s discussion and
        trials.
      </p>
      <button
        onClick={onPublicDone}
        className="mt-8 w-full rounded-xl bg-amber-500 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-amber-400 active:scale-[0.99]"
      >
        Open the discussion
      </button>
    </div>
  );
}

/* ----------------------------- Discussion ----------------------------- */

function Discussion({
  game,
  leadId,
  dayNumber,
  village,
  onEnd,
}: {
  game: Player[];
  leadId: number | null;
  dayNumber: number;
  village: string;
  onEnd: () => void;
}) {
  const lead = game.find((p) => p.id === leadId);
  const wolves = aliveWolves(game).length;
  const others = game.filter((p) => p.alive && p.role.team !== "werewolf").length;

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        Afternoon · Day {dayNumber} · {village}
      </p>
      <div className="rounded-2xl bg-amber-500/10 p-4 text-center ring-1 ring-amber-500/30">
        <p className="text-sm text-amber-200">
          👑 <span className="font-bold">{lead?.name}</span> leads the discussion.
        </p>
      </div>
      <div className="rounded-2xl bg-zinc-900 p-6 text-center ring-1 ring-white/10">
        <span className="text-4xl">💬</span>
        <h2 className="mt-3 text-lg font-bold">Open discussion</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Argue, accuse, defend. {wolves} wolf{wolves === 1 ? "" : "ves"} still
          hide among {others} others. Only the Lead Villager may end the talk and
          call a vote.
        </p>
      </div>
      <button
        onClick={onEnd}
        className="w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
      >
        {lead?.name}: end discussion & call the vote
      </button>
    </div>
  );
}

/* ----------------------------- Afternoon vote ----------------------------- */

function AfternoonVote({
  game,
  leadId,
  onComplete,
}: {
  game: Player[];
  leadId: number | null;
  onComplete: (outcome: AfternoonOutcome) => void;
}) {
  const voters = useMemo(
    () =>
      shuffle(
        game
          .filter((p) => p.alive && !p.jailed && p.id !== leadId)
          .map((p) => p.id),
      ),
    [game, leadId],
  );

  const jailAvailable = useMemo(() => !game.some((p) => p.jailed), [game]);

  const tally = useRef<Record<number, number>>({});
  const good = useRef(0);
  const bad = useRef(0);
  const jail = useRef<number | null>(null);

  const [pos, setPos] = useState(0);
  const [opened, setOpened] = useState(false);
  const [execSel, setExecSel] = useState<number | null>(null);
  const [behaviour, setBehaviour] = useState<boolean | null>(null);
  const [jailSel, setJailSel] = useState<number | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);

  const voterId = voters[pos];
  const voter = game.find((p) => p.id === voterId);
  const lead = game.find((p) => p.id === leadId);
  const isKnight = voter?.role.id === "knight";
  const canJail = isKnight && jailAvailable && jail.current === null;

  const execOptions = game.filter(
    (p) => p.alive && !p.jailed && p.id !== voterId,
  );
  const jailOptions = game.filter(
    (p) => p.alive && !p.jailed && p.id !== voterId && p.id !== leadId,
  );

  function resetSelections() {
    setExecSel(null);
    setBehaviour(null);
    setJailSel(null);
    setSecretOpen(false);
  }

  function lockIn() {
    if (behaviour === null) return;
    if (execSel != null) tally.current[execSel] = (tally.current[execSel] ?? 0) + 1;
    if (behaviour) good.current += 1;
    else bad.current += 1;
    if (jailSel != null) jail.current = jailSel;

    setOpened(false);
    resetSelections();

    if (pos + 1 >= voters.length) {
      onComplete({
        execTally: { ...tally.current },
        good: good.current,
        bad: bad.current,
        jailTarget: jail.current,
      });
    } else {
      setPos((p) => p + 1);
    }
  }

  useEffect(() => {
    if (voters.length === 0) {
      onComplete({ execTally: {}, good: 0, bad: 0, jailTarget: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voters.length]);

  if (voters.length === 0) return null;

  if (!opened) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Secret vote · {pos + 1} of {voters.length}
        </p>
        <span className="mt-4 text-5xl">🗳️</span>
        <h2 className="mt-4 text-xl font-semibold">Pass the phone to {voter?.name}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Everyone else, look away. Your votes stay secret.
        </p>
        <button
          onClick={() => setOpened(true)}
          className="mt-6 w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
        >
          I&apos;m {voter?.name} — vote in secret
        </button>
      </div>
    );
  }

  const totalCast = Object.values(tally.current).reduce((s, n) => s + n, 0);

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        {voter?.name}&apos;s vote
      </p>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-base font-bold">Who should stand trial?</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {totalCast} vote{totalCast === 1 ? "" : "s"} cast so far.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {execOptions.map((p) => {
            const count = tally.current[p.id] ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => setExecSel(p.id)}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 transition ${
                  execSel === p.id
                    ? "bg-rose-600 text-white ring-rose-400"
                    : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
                }`}
              >
                <span>
                  {p.name}
                  {p.id === leadId ? " 👑" : ""}
                </span>
                {count > 0 && (
                  <span className="ml-2 rounded-full bg-black/30 px-2 text-xs tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setExecSel(null)}
          className={`mt-2 w-full rounded-xl px-4 py-2 text-sm font-medium ring-1 transition ${
            execSel === null
              ? "bg-zinc-700 text-white ring-zinc-500"
              : "bg-zinc-900 text-zinc-400 ring-white/10 hover:bg-zinc-800"
          }`}
        >
          Abstain
        </button>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-base font-bold">
          Is {lead?.name} a good Lead Villager?
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          A majority of &quot;bad&quot; passes leadership tomorrow morning.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setBehaviour(true)}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold ring-1 transition ${
              behaviour === true
                ? "bg-emerald-600 text-white ring-emerald-400"
                : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
            }`}
          >
            👍 Good
          </button>
          <button
            onClick={() => setBehaviour(false)}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold ring-1 transition ${
              behaviour === false
                ? "bg-rose-600 text-white ring-rose-400"
                : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
            }`}
          >
            👎 Bad
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10">
        <button
          onClick={() => setSecretOpen((o) => !o)}
          aria-expanded={secretOpen}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition hover:bg-zinc-800/60"
        >
          <span className="text-base font-bold">🤫 Secret role action</span>
          <span
            className={`text-zinc-400 transition-transform ${
              secretOpen ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </button>
        {secretOpen && (
          <div className="border-t border-white/10 px-6 py-4">
            {isKnight ? (
              canJail ? (
                <>
                  <p className="text-sm font-semibold text-amber-200">
                    🛡️ Knight — jail a suspect?
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    A jailed player is locked out of all actions until the Lead
                    releases them. Only one cell.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {jailOptions.map((p) => (
                      <button
                        key={p.id}
                        onClick={() =>
                          setJailSel((j) => (j === p.id ? null : p.id))
                        }
                        className={`rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 transition ${
                          jailSel === p.id
                            ? "bg-amber-600 text-white ring-amber-400"
                            : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
                        }`}
                      >
                        🔒 {p.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-400">
                  🛡️ The cell is already occupied — no jailing tonight.
                </p>
              )
            ) : (
              <p className="text-sm text-zinc-400">
                Nothing here for you. Close this and lock in your vote.
              </p>
            )}
          </div>
        )}
      </div>

      <button
        onClick={lockIn}
        disabled={behaviour === null}
        className="w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {behaviour === null
          ? "Rate the Lead to continue"
          : pos + 1 >= voters.length
            ? "Lock in & close the vote"
            : "Lock in & pass on"}
      </button>
    </div>
  );
}

/* ----------------------------- Lead result ----------------------------- */

function LeadResult({
  game,
  leadId,
  execTally,
  jailNews,
  onRelease,
  onTrial,
  onSpare,
}: {
  game: Player[];
  leadId: number | null;
  execTally: Record<number, number>;
  jailNews: number | null;
  onRelease: (id: number) => void;
  onTrial: (id: number) => void;
  onSpare: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const lead = game.find((p) => p.id === leadId);
  const jailedPlayers = game.filter((p) => p.jailed);

  const ranked = Object.entries(execTally)
    .map(([id, count]) => ({ id: Number(id), count }))
    .filter((e) => game.find((p) => p.id === e.id && p.alive))
    .sort((a, b) => b.count - a.count);

  const candidates = game.filter((p) => p.alive);

  if (!opened) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <span className="text-5xl">⚖️</span>
        <h2 className="mt-4 text-xl font-semibold">The vote is in</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Only the Lead Villager may see the tally. Pass the phone to{" "}
          <span className="font-semibold text-amber-300">{lead?.name}</span>.
        </p>
        <button
          onClick={() => setOpened(true)}
          className="mt-6 w-full rounded-xl bg-amber-500 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-amber-400 active:scale-[0.99]"
        >
          I&apos;m {lead?.name} — read the result
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        Lead Villager&apos;s verdict
      </p>

      {jailedPlayers.length > 0 && (
        <div className="rounded-2xl bg-amber-950/40 p-4 ring-1 ring-amber-500/30">
          <p className="text-sm text-amber-200">
            🔒 <span className="font-semibold">In the cell.</span> Locked out of
            everything until you free them.
          </p>
          <div className="mt-3 space-y-2">
            {jailedPlayers.map((jp) => (
              <div
                key={jp.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950/60 px-3 py-2"
              >
                <span className="text-sm font-medium text-zinc-100">
                  {jp.name}
                  {jp.id === jailNews ? (
                    <span className="ml-2 text-xs text-amber-300/80">
                      jailed this session
                    </span>
                  ) : null}
                </span>
                <button
                  onClick={() => onRelease(jp.id)}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700"
                >
                  Release
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-base font-bold">Vote tally</h2>
        {ranked.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">
            No accusations were cast. You may still pick someone, or spare
            everyone.
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {ranked.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-lg bg-zinc-950/60 px-3 py-2 text-sm"
              >
                <span>
                  {nameOf(game, e.id)}
                  {e.id === leadId ? " 👑" : ""}
                </span>
                <span className="font-semibold tabular-nums text-rose-300">
                  {e.count} vote{e.count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-base font-bold">Send someone to trial</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Follow the vote, or choose anyone yourself.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {candidates.map((p) => (
            <button
              key={p.id}
              onClick={() => onTrial(p.id)}
              className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 text-left text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-rose-600 hover:text-white hover:ring-rose-400"
            >
              <span>
                {p.name}
                {p.jailed ? " 🔒" : ""}
                {p.id === leadId ? " 👑" : ""}
              </span>
              {(execTally[p.id] ?? 0) > 0 && (
                <span className="ml-2 rounded-full bg-black/30 px-2 text-xs tabular-nums">
                  {execTally[p.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onSpare}
        className="w-full rounded-xl bg-zinc-800 py-4 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
      >
        Spare everyone — no trial today
      </button>
    </div>
  );
}

/* ----------------------------- Trial ----------------------------- */

function Trial({
  game,
  leadId,
  accused,
  voteCount,
  onExecute,
  onForgive,
}: {
  game: Player[];
  leadId: number | null;
  accused: number;
  voteCount: number;
  onExecute: () => void;
  onForgive: () => void;
}) {
  const lead = game.find((p) => p.id === leadId);
  const accusedPlayer = game.find((p) => p.id === accused);

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        The trial
      </p>
      <div className="rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <span className="text-5xl">⚖️</span>
        <h2 className="mt-4 text-2xl font-bold">{accusedPlayer?.name} stands accused</h2>
        <p className="mt-2 text-sm text-zinc-400">
          {voteCount > 0
            ? `${voteCount} vote${voteCount === 1 ? "" : "s"} against them.`
            : "Chosen by the Lead Villager."}
        </p>
        <p className="mt-4 rounded-xl bg-zinc-950/60 px-4 py-3 text-sm italic text-zinc-300">
          {accusedPlayer?.name}, plead your case aloud. Beg {lead?.name} for
          forgiveness.
        </p>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <p className="text-center text-sm text-zinc-400">
          👑 {lead?.name} casts the final word.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onForgive}
            className="flex-1 rounded-xl bg-emerald-600 py-4 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            🕊️ Forgive
          </button>
          <button
            onClick={onExecute}
            className="flex-1 rounded-xl bg-rose-600 py-4 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            🪓 Execute
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Night turn ------------------------- */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 transition ${
        active
          ? "bg-rose-600 text-white ring-rose-400"
          : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function NightTurn({
  prompt,
  player,
  game,
  dayNumber,
  step,
  total,
  wolfRate,
  doctorHelp,
  nightInputs,
  onSubmit,
}: {
  prompt: NightPrompt;
  player: Player;
  game: Player[];
  dayNumber: number;
  step: number;
  total: number;
  wolfRate: number;
  doctorHelp: number;
  nightInputs: NightInput[];
  onSubmit: (input: NightInput) => void;
}) {
  const isDecoy = prompt.kind === "decoy" && prompt.decoyRole != null;
  const screenRole = isDecoy ? ROLES[prompt.decoyRole!] : player.role;
  const screenTrait = isDecoy ? null : player.trait;

  const [opened, setOpened] = useState(false);
  const [choice, setChoice] = useState<string>("sleep");
  const [target, setTarget] = useState<number | null>(null);
  const [guard, setGuard] = useState<number[]>([]);
  const [reviveId, setReviveId] = useState<number | null>(null);

  const others = game.filter((p) => p.alive && !p.jailed && p.id !== player.id);
  const dead = game.filter((p) => !p.alive);

  const wolves = aliveWolves(game).filter((p) => !p.jailed);
  const packVotes = nightInputs
    .filter((i) => i.type === "wolf_attack" && i.targets.length > 0)
    .map((i) => ({
      wolf: game.find((p) => p.id === i.playerId)!,
      targetId: i.targets[0],
    }))
    .filter((v) => v.wolf);

  function toggleGuard(id: number) {
    setGuard((g) =>
      g.includes(id) ? g.filter((x) => x !== id) : g.length < 2 ? [...g, id] : g,
    );
  }

  function build(): NightInput | null {
    if (isDecoy) return { playerId: player.id, type: "sleep", targets: [] };

    const role = player.role.id;
    if (choice === "sleep") return { playerId: player.id, type: "sleep", targets: [] };
    if (role === "werewolf" && choice === "attack")
      return target == null
        ? null
        : { playerId: player.id, type: "wolf_attack", targets: [target] };
    if (role === "jester" && choice === "break")
      return target == null
        ? null
        : { playerId: player.id, type: "jester_break", targets: [target] };
    if (role === "doctor" && choice === "brew")
      return { playerId: player.id, type: "doctor_brew", targets: [] };
    if (role === "doctor" && choice === "revive")
      return reviveId == null
        ? null
        : { playerId: player.id, type: "doctor_revive", targets: [], reviveId };
    if (role === "knight" && choice === "guard")
      return guard.length === 0
        ? null
        : { playerId: player.id, type: "knight_guard", targets: guard };
    if (role === "villager" && choice === "help")
      return { playerId: player.id, type: "villager_help", targets: [] };
    if (role === "villager" && choice === "visit")
      return target == null
        ? null
        : { playerId: player.id, type: "insomniac_visit", targets: [target] };
    return null;
  }

  const ready = isDecoy || build() !== null;

  if (!opened) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Night {dayNumber} · {step} of {total}
        </p>
        <span className="mt-4 text-5xl">🌙</span>
        <h2 className="mt-4 text-xl font-semibold">Pass the phone to {player.name}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Everyone else, look away. Tap when you&apos;re ready to take your turn
          in secret.
        </p>
        <button
          onClick={() => setOpened(true)}
          className="mt-6 w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
        >
          I&apos;m {player.name} — my turn
        </button>
      </div>
    );
  }

  const role = screenRole.id;
  const trait = screenTrait;

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        Night {dayNumber} · {player.name}
        {isDecoy && (
          <span className="block text-[10px] text-zinc-600">Routine check</span>
        )}
      </p>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{screenRole.emoji}</span>
          <div>
            <h2 className="text-lg font-bold">{screenRole.name}</h2>
            {trait && (
              <p className="text-xs text-amber-300">
                {TRAITS[trait].emoji} {TRAITS[trait].name}
              </p>
            )}
          </div>
        </div>

        {!isDecoy &&
          player.role.id === "werewolf" &&
          wolves.length > 1 &&
          packVotes.length > 0 && (
            <div className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 ring-1 ring-rose-500/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-200">
                Pack votes so far
              </p>
              <ul className="mt-2 space-y-1 text-sm text-rose-100">
                {packVotes.map((v) => (
                  <li key={v.wolf.id}>
                    {v.wolf.name} → {nameOf(game, v.targetId)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-rose-200/70">
                Majority target wins. Coordinate with your pack.
              </p>
            </div>
          )}

        <div className="mt-4 space-y-2">
          {role === "werewolf" && (
            <>
              {!isDecoy && (
                <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/20">
                  Pack strike odds: <span className="font-bold">{wolfRate}%</span>{" "}
                  (min {WOLF_RATE_MIN}% · max {WOLF_RATE_MAX}%)
                </p>
              )}
              <Chip active={choice === "attack"} onClick={() => setChoice("attack")}>
                🩸 Attack a house
              </Chip>
              <Chip active={choice === "sleep"} onClick={() => setChoice("sleep")}>
                😴 Sleep (−20% next strike)
              </Chip>
            </>
          )}

          {role === "doctor" && (
            <>
              <Chip active={choice === "brew"} onClick={() => setChoice("brew")}>
                ⚗️ Brew medicine (need a villager&apos;s help)
              </Chip>
              {!isDecoy && dead.length > 0 && doctorHelp >= 2 && (
                <Chip active={choice === "revive"} onClick={() => setChoice("revive")}>
                  ✨ Revive a fallen player
                </Chip>
              )}
              <Chip active={choice === "sleep"} onClick={() => setChoice("sleep")}>
                😴 Sleep
              </Chip>
              {!isDecoy && (
                <p className="px-1 pt-1 text-xs text-zinc-500">
                  Cure progress: {Math.min(doctorHelp, 2)} / 2 nights of help
                </p>
              )}
            </>
          )}

          {role === "knight" && (
            <>
              <Chip active={choice === "guard"} onClick={() => setChoice("guard")}>
                🛡️ Post soldiers (guard up to 2 houses)
              </Chip>
              <Chip active={choice === "sleep"} onClick={() => setChoice("sleep")}>
                😴 Sleep
              </Chip>
            </>
          )}

          {role === "jester" && (
            <>
              <Chip active={choice === "break"} onClick={() => setChoice("break")}>
                🪟 Break into a house &amp; run
              </Chip>
              <Chip active={choice === "sleep"} onClick={() => setChoice("sleep")}>
                😴 Sleep
              </Chip>
            </>
          )}

          {role === "villager" && (
            <>
              <Chip active={choice === "help"} onClick={() => setChoice("help")}>
                🤝 Help the Doctor brew
              </Chip>
              {!isDecoy && trait === "insomniac" && (
                <Chip active={choice === "visit"} onClick={() => setChoice("visit")}>
                  👁️ Sneak out &amp; spy on a house
                </Chip>
              )}
              <Chip active={choice === "sleep"} onClick={() => setChoice("sleep")}>
                😴 Sleep
              </Chip>
            </>
          )}
        </div>

        {((role === "werewolf" && choice === "attack") ||
          (role === "jester" && choice === "break") ||
          (role === "villager" && choice === "visit")) && (
          <TargetGrid options={others} selected={target} onSelect={setTarget} />
        )}

        {role === "doctor" && choice === "revive" && !isDecoy && (
          <TargetGrid options={dead} selected={reviveId} onSelect={setReviveId} />
        )}

        {role === "knight" && choice === "guard" && (
          <>
            <p className="mt-4 text-xs uppercase tracking-wide text-zinc-500">
              Guard up to 2 houses
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {game
                .filter((p) => p.alive && !p.jailed)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleGuard(p.id)}
                    className={`rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 transition ${
                      guard.includes(p.id)
                        ? "bg-emerald-600 text-white ring-emerald-400"
                        : "bg-zinc-900 text-zinc-200 ring-white/10 hover:bg-zinc-800"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          </>
        )}
      </div>

      <button
        onClick={() => {
          const input = build();
          if (input) onSubmit(input);
        }}
        disabled={!ready}
        className="w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {step < total ? "Lock in & pass on" : "Lock in & end the night"}
      </button>
    </div>
  );
}

/* ---------------------- Wolf follow-up turns ---------------------- */

function WolfBlood({
  game,
  guardedHouse,
  onSubmit,
}: {
  game: Player[];
  guardedHouse: number;
  onSubmit: (targetId: number) => void;
}) {
  const [countdown, setCountdown] = useState(2);
  const submitted = useRef(false);
  const wolves = aliveWolves(game).filter((p) => !p.jailed);
  const options = game.filter((p) => p.alive && !p.jailed);

  const plant = useCallback(
    (targetId: number) => {
      if (submitted.current) return;
      submitted.current = true;
      onSubmit(targetId);
    },
    [onSubmit],
  );

  useEffect(() => {
    setCountdown(2);
    const tick = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    const timeout = setTimeout(() => {
      const ownHouse =
        wolves.length > 0
          ? wolves[Math.floor(Math.random() * wolves.length)].id
          : options[0]?.id;
      if (ownHouse != null) plant(ownHouse);
    }, 2000);
    return () => {
      clearInterval(tick);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        Wolf pack · {wolves.map((w) => w.name).join(", ")}
      </p>
      <div className="rounded-2xl bg-rose-950/40 p-6 ring-1 ring-rose-500/30">
        <h2 className="text-lg font-bold text-rose-200">Turned back by a guard!</h2>
        <p className="mt-1 text-sm text-zinc-300">
          A soldier died blocking {nameOf(game, guardedHouse)}&apos;s door — and
          you&apos;re covered in blood. Smear it onto someone&apos;s doorstep,
          fast. If you freeze, it dries on{" "}
          <span className="font-semibold text-rose-300">your own house</span>.
        </p>
        <p className="mt-3 text-center text-4xl font-bold tabular-nums text-rose-400">
          {countdown}
        </p>
        <TargetGrid options={options} selected={null} onSelect={plant} />
      </div>
    </div>
  );
}

function WolfFailed({
  game,
  attackHouse,
  onSubmit,
}: {
  game: Player[];
  attackHouse: number;
  onSubmit: (disguise: WolfDisguise) => void;
}) {
  function disguiseAsPerson() {
    const id = randomDisguiseTarget(game, [attackHouse]);
    onSubmit({ mode: "player", disguiseAsId: id ?? undefined });
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-center text-xs uppercase tracking-widest text-zinc-500">
        🎭 Strike failed
      </p>
      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-lg font-bold">Cover your tracks</h2>
        <p className="mt-1 text-sm text-zinc-400">
          You broke into {nameOf(game, attackHouse)}&apos;s house but couldn&apos;t
          finish the kill. Leave behind a false impression of who fled.
        </p>
        <div className="mt-4 space-y-2">
          <button
            onClick={disguiseAsPerson}
            className="w-full rounded-xl bg-zinc-100 py-4 text-base font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99]"
          >
            🧑 Disguise as a random villager
          </button>
          <button
            onClick={() => onSubmit({ mode: "knight" })}
            className="w-full rounded-xl bg-zinc-800 py-4 text-base font-semibold text-zinc-100 transition hover:bg-zinc-700 active:scale-[0.99]"
          >
            🛡️ Disguise as the Knight&apos;s soldier
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          The framed villager is chosen for you — even you won&apos;t be sure who
          takes the blame.
        </p>
      </div>
    </div>
  );
}

function WolfKilled({
  game,
  target,
  onContinue,
}: {
  game: Player[];
  target: number;
  onContinue: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl bg-rose-950/40 p-8 text-center ring-1 ring-rose-500/30">
      <span className="text-5xl">🩸</span>
      <h2 className="mt-4 text-2xl font-bold text-rose-200">Your strike landed</h2>
      <p className="mt-2 text-sm text-zinc-300">
        <span className="font-semibold text-rose-100">{nameOf(game, target)}</span>{" "}
        will not see the morning. Slip away before the village wakes.
      </p>
      <button
        onClick={onContinue}
        className="mt-6 w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
      >
        Vanish into the night
      </button>
    </div>
  );
}

function TargetGrid({
  options,
  selected,
  onSelect,
}: {
  options: Player[];
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

/* ----------------------------- Game over ----------------------------- */

function GameOver({
  winner,
  game,
  village,
  onPlayAgain,
  onExit,
}: {
  winner: Winner;
  game: Player[];
  village: string;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const [confirmExit, setConfirmExit] = useState(false);
  const banner =
    winner === "village"
      ? {
          emoji: "🎉",
          title: "Village wins!",
          sub: "Every werewolf has been driven out.",
          color: "text-emerald-300",
        }
      : winner === "werewolf"
        ? {
            emoji: "🐺",
            title: "Werewolves win!",
            sub: `The pack now rules ${village}.`,
            color: "text-rose-300",
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
        <h2 className={`mt-3 text-3xl font-bold ${banner.color}`}>{banner.title}</h2>
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
                {p.isLead ? " 👑" : ""}
              </span>
              <span className="font-medium">
                {p.role.emoji} {p.role.name}
                {p.trait ? ` · ${TRAITS[p.trait].emoji}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {confirmExit ? (
        <div className="rounded-2xl bg-zinc-900 p-6 text-center ring-1 ring-rose-500/30">
          <p className="text-sm text-zinc-300">
            Exit to setup? Nothing is saved — this game will be gone.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setConfirmExit(false)}
              className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
            >
              Stay
            </button>
            <button
              onClick={onExit}
              className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Exit anyway
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={onPlayAgain}
            className="w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
          >
            Play again — same settings
          </button>
          <button
            onClick={() => setConfirmExit(true)}
            className="w-full rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
          >
            Exit to setup
          </button>
        </div>
      )}
    </div>
  );
}
