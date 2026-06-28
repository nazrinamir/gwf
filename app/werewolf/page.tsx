"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PlayerManager, { resolveNames } from "../ui/player-manager";
import {
  CONFIGURABLE_ROLES,
  NIGHT_ORDER,
  ROLES,
  type Role,
  type RoleId,
} from "./roles";

type Phase = "setup" | "reveal" | "play";

interface Assignment {
  name: string;
  role: Role;
}

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 18;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function WerewolfPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<string[]>(() =>
    Array.from({ length: 6 }, () => ""),
  );
  const playerCount = players.length;
  const [counts, setCounts] = useState<Record<RoleId, number>>({
    werewolf: 1,
    doctor: 1,
    seeker: 1,
    knight: 0,
    jester: 0,
    villager: 0,
  });

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [showingRole, setShowingRole] = useState(false);
  const [showAllRoles, setShowAllRoles] = useState(false);

  const specialTotal = CONFIGURABLE_ROLES.reduce((sum, id) => sum + counts[id], 0);
  const villagerCount = playerCount - specialTotal;
  const tooManySpecials = villagerCount < 0;
  const tooFewPlayers = playerCount < MIN_PLAYERS;
  const noWerewolf = counts.werewolf < 1;
  const canStart = !tooManySpecials && !tooFewPlayers && !noWerewolf;

  function adjustCount(id: RoleId, delta: number) {
    setCounts((prev) => {
      const next = Math.max(0, prev[id] + delta);
      return { ...prev, [id]: next };
    });
  }

  function startGame() {
    const roleIds: RoleId[] = [];
    for (const id of CONFIGURABLE_ROLES) {
      for (let i = 0; i < counts[id]; i++) roleIds.push(id);
    }
    for (let i = 0; i < villagerCount; i++) roleIds.push("villager");

    const names = resolveNames(players);
    const shuffledRoles = shuffle(roleIds);
    const next: Assignment[] = shuffledRoles.map((id, i) => ({
      name: names[i],
      role: ROLES[id],
    }));

    setAssignments(next);
    setRevealIndex(0);
    setShowingRole(false);
    setShowAllRoles(false);
    setPhase("reveal");
  }

  function nextReveal() {
    if (revealIndex + 1 >= assignments.length) {
      setPhase("play");
      return;
    }
    setRevealIndex((i) => i + 1);
    setShowingRole(false);
  }

  function resetToSetup() {
    setPhase("setup");
    setAssignments([]);
    setRevealIndex(0);
    setShowingRole(false);
    setShowAllRoles(false);
  }

  const activeRolesInGame = useMemo(() => {
    const ids = new Set(assignments.map((a) => a.role.id));
    return (Object.keys(ROLES) as RoleId[])
      .filter((id) => ids.has(id))
      .map((id) => ROLES[id]);
  }, [assignments]);

  return (
    <main className="flex flex-1 flex-col bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          ← All games
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-3xl">🐺</span>
          <h1 className="text-2xl font-bold tracking-tight">Werewolf</h1>
        </div>

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
            onAdjustCount={adjustCount}
            onStart={startGame}
          />
        )}

        {phase === "reveal" && assignments[revealIndex] && (
          <Reveal
            assignment={assignments[revealIndex]}
            index={revealIndex}
            total={assignments.length}
            showingRole={showingRole}
            onShow={() => setShowingRole(true)}
            onNext={nextReveal}
          />
        )}

        {phase === "play" && (
          <Play
            roles={activeRolesInGame}
            assignments={assignments}
            showAllRoles={showAllRoles}
            onToggleRoles={() => setShowAllRoles((s) => !s)}
            onRestart={resetToSetup}
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
              <p className="font-medium">
                {ROLES.villager.emoji} Villagers
              </p>
              <p className="text-xs text-zinc-400">Fills the remaining seats</p>
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
            Too many roles for {playerCount} players. Remove some or add players.
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
      <p className="text-center text-xs text-zinc-500">
        Roles are dealt secretly. Pass the phone to each player in turn.
      </p>
    </div>
  );
}

function Reveal({
  assignment,
  index,
  total,
  showingRole,
  onShow,
  onNext,
}: {
  assignment: Assignment;
  index: number;
  total: number;
  showingRole: boolean;
  onShow: () => void;
  onNext: () => void;
}) {
  const isLast = index + 1 >= total;
  const teamColor =
    assignment.role.team === "werewolf"
      ? "text-rose-400"
      : assignment.role.team === "neutral"
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div className="mt-6">
      <p className="text-center text-sm text-zinc-400">
        {index + 1} of {total}
      </p>

      {!showingRole ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
          <span className="text-5xl">📱</span>
          <h2 className="mt-4 text-xl font-semibold">
            Pass the phone to {assignment.name}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Make sure nobody else can see the screen, then tap below to view your
            secret role.
          </p>
          <button
            onClick={onShow}
            className="mt-6 w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
          >
            I&apos;m {assignment.name} — reveal my role
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center rounded-2xl bg-zinc-900 p-8 text-center ring-1 ring-white/10">
          <span className="text-xs uppercase tracking-widest text-zinc-500">
            {assignment.name}, you are
          </span>
          <span className="mt-3 text-6xl">{assignment.role.emoji}</span>
          <h2 className={`mt-3 text-3xl font-bold ${teamColor}`}>
            {assignment.role.name}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-300">
            {assignment.role.description}
          </p>
          <button
            onClick={onNext}
            className="mt-6 w-full rounded-xl bg-zinc-100 py-4 text-lg font-semibold text-zinc-900 transition hover:bg-white active:scale-[0.99]"
          >
            {isLast ? "Everyone's ready — start the night" : "Hide & pass on"}
          </button>
        </div>
      )}
    </div>
  );
}

function Play({
  roles,
  assignments,
  showAllRoles,
  onToggleRoles,
  onRestart,
}: {
  roles: Role[];
  assignments: Assignment[];
  showAllRoles: boolean;
  onToggleRoles: () => void;
  onRestart: () => void;
}) {
  const nightRoles = NIGHT_ORDER.filter((id) =>
    roles.some((r) => r.id === id),
  ).map((id) => ROLES[id]);

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-lg font-semibold">Moderator guide</h2>
        <p className="mt-1 text-sm text-zinc-400">
          One person reads this aloud. &ldquo;Everyone, close your eyes.&rdquo;
          Then call each role in order:
        </p>
        <ol className="mt-4 space-y-3">
          {nightRoles.map((role, i) => (
            <li key={role.id} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">
                  {role.emoji} {role.name}
                </p>
                <p className="text-sm text-zinc-400">{role.short}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-zinc-400">
          Then &ldquo;Everyone wake up.&rdquo; Discuss, accuse, and vote someone
          out. Repeat until one side wins.
        </p>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <h2 className="text-lg font-semibold">Roles in this game</h2>
        <ul className="mt-3 space-y-2">
          {roles.map((role) => {
            const count = assignments.filter(
              (a) => a.role.id === role.id,
            ).length;
            return (
              <li
                key={role.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {role.emoji} {role.name}
                </span>
                <span className="text-zinc-400">×{count}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-6 ring-1 ring-white/10">
        <button
          onClick={onToggleRoles}
          className="w-full rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
        >
          {showAllRoles ? "Hide everyone's role" : "Reveal everyone's role (game over)"}
        </button>
        {showAllRoles && (
          <ul className="mt-4 space-y-2">
            {assignments.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-zinc-950/60 px-3 py-2 text-sm"
              >
                <span>{a.name}</span>
                <span className="font-medium">
                  {a.role.emoji} {a.role.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={onRestart}
        className="w-full rounded-xl bg-rose-600 py-4 text-lg font-semibold text-white transition hover:bg-rose-500 active:scale-[0.99]"
      >
        New game
      </button>
    </div>
  );
}
