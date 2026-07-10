import {
  CLASSIC_ROLES,
  type ClassicRole,
  type ClassicRoleId,
} from "./roles";

export interface ClassicPlayer {
  id: number;
  name: string;
  role: ClassicRole;
  alive: boolean;
  /** Linked lover id, if Cupid paired them. */
  loverId: number | null;
}

export type ClassicWinner =
  | "village"
  | "werewolf"
  | "vampire"
  | "jester"
  | "lovers";

export type ClassicNightActionType =
  | "sleep"
  | "cupid_link"
  | "seeker_check"
  | "knight_protect"
  | "vampire_bite"
  | "wolf_kill"
  | "wolf_convert"
  | "villager_answer"
  | "hunter_revenge";

export interface ClassicNightInput {
  playerId: number;
  type: ClassicNightActionType;
  targets: number[];
}

export interface ClassicNightResult {
  players: ClassicPlayer[];
  deaths: number[];
  hunterPending: number[];
  /** Seeker private results: seekerId → message */
  seekerNotes: { seekerId: number; targetId: number; isWolf: boolean }[];
  conversions: { targetId: number; into: "werewolf" | "vampire" }[];
  protectedId: number | null;
}

export type ClassicNightPromptKind =
  | "cupid"
  | "seeker"
  | "knight"
  | "vampire"
  | "wolves"
  | "villager"
  | "hunter";

export interface ClassicNightPrompt {
  kind: ClassicNightPromptKind;
  /** Primary actor (or first wolf for pack turns). */
  playerId: number;
  /** All wolf ids acting together on a pack turn. */
  packIds?: number[];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function living(players: ClassicPlayer[]): ClassicPlayer[] {
  return players.filter((p) => p.alive);
}

export function nameOf(players: ClassicPlayer[], id: number): string {
  return players.find((p) => p.id === id)?.name ?? "someone";
}

export function isWolf(p: ClassicPlayer): boolean {
  return p.role.team === "werewolf";
}

export function isVampire(p: ClassicPlayer): boolean {
  return p.role.team === "vampire";
}

export function makeClassicPlayers(
  names: string[],
  roles: ClassicRole[],
): ClassicPlayer[] {
  return roles.map((role, i) => ({
    id: i,
    name: names[i]!,
    role,
    alive: true,
    loverId: null,
  }));
}

/** Deal roles from counts; villagers fill remaining seats. Auto-promotes Alpha when 2+ wolves and no Alpha. */
export function dealClassicRoles(
  playerCount: number,
  counts: Record<ClassicRoleId, number>,
): ClassicRole[] {
  const entries: ClassicRole[] = [];
  for (const id of Object.keys(counts) as ClassicRoleId[]) {
    if (id === "villager") continue;
    for (let i = 0; i < counts[id]; i++) entries.push(CLASSIC_ROLES[id]);
  }

  let hasAlpha = entries.some((r) => r.id === "alpha");
  const wolfCount = entries.filter((r) => r.team === "werewolf").length;
  if (wolfCount >= 2 && !hasAlpha) {
    const idx = entries.findIndex((r) => r.id === "werewolf");
    if (idx >= 0) entries[idx] = CLASSIC_ROLES.alpha;
  }

  const specials = entries.length;
  const villagers = Math.max(0, playerCount - specials);
  for (let i = 0; i < villagers; i++) entries.push(CLASSIC_ROLES.villager);

  return shuffle(entries).slice(0, playerCount);
}

/**
 * Night wake order:
 * Cupid (night 1) → Seeker → Knight → Vampire → Wolves → Villagers
 */
export function buildClassicNightPrompts(
  players: ClassicPlayer[],
  nightNumber: number,
): ClassicNightPrompt[] {
  const alive = living(players);
  const prompts: ClassicNightPrompt[] = [];

  if (nightNumber === 1) {
    const cupid = alive.find((p) => p.role.id === "cupid");
    if (cupid) prompts.push({ kind: "cupid", playerId: cupid.id });
  }

  for (const p of shuffle(alive.filter((p) => p.role.id === "seeker"))) {
    prompts.push({ kind: "seeker", playerId: p.id });
  }

  for (const p of shuffle(alive.filter((p) => p.role.id === "knight"))) {
    prompts.push({ kind: "knight", playerId: p.id });
  }

  const vampires = shuffle(alive.filter((p) => p.role.id === "vampire"));
  for (const p of vampires) {
    prompts.push({ kind: "vampire", playerId: p.id });
  }

  const wolves = alive.filter((p) => isWolf(p));
  if (wolves.length > 0) {
    const alpha = wolves.find((p) => p.role.id === "alpha");
    const leader = alpha ?? wolves[0]!;
    prompts.push({
      kind: "wolves",
      playerId: leader.id,
      packIds: wolves.map((w) => w.id),
    });
  }

  for (const p of shuffle(alive.filter((p) => p.role.id === "villager"))) {
    prompts.push({ kind: "villager", playerId: p.id });
  }

  return prompts;
}

export function checkClassicWinner(
  players: ClassicPlayer[],
): ClassicWinner | null {
  const alive = living(players);
  if (alive.length === 0) return "village";

  // Lovers win if they are the only two left (or the only living pair).
  if (alive.length === 2) {
    const [a, b] = alive;
    if (
      a &&
      b &&
      a.loverId === b.id &&
      b.loverId === a.id
    ) {
      return "lovers";
    }
  }
  if (alive.length === 1) {
    const only = alive[0]!;
    if (only.loverId != null) {
      const partner = players.find((p) => p.id === only.loverId);
      if (partner && !partner.alive) {
        // Lone survivor whose lover already died — not a lovers win.
      }
    }
  }

  const wolves = alive.filter(isWolf).length;
  const vampires = alive.filter(isVampire).length;
  const villageSide = alive.filter(
    (p) => p.role.team === "village" || p.role.team === "neutral",
  ).length;

  if (wolves === 0 && vampires === 0) return "village";
  if (wolves > 0 && wolves >= alive.length - wolves && vampires === 0) {
    return "werewolf";
  }
  if (vampires > 0 && vampires >= alive.length - vampires && wolves === 0) {
    return "vampire";
  }
  // Mixed wolf/vampire endgame: majority faction wins if village is gone.
  if (villageSide === 0) {
    if (wolves >= vampires) return "werewolf";
    return "vampire";
  }
  return null;
}

/** Kill a player and cascade lover + collect hunter revenge needs. */
export function applyDeaths(
  players: ClassicPlayer[],
  deathIds: number[],
): {
  players: ClassicPlayer[];
  deaths: number[];
  hunterPending: number[];
} {
  let next = players.map((p) => ({ ...p }));
  const deaths: number[] = [];
  const hunterPending: number[] = [];
  const queue = [...deathIds];

  while (queue.length) {
    const id = queue.shift()!;
    const p = next.find((x) => x.id === id);
    if (!p || !p.alive) continue;
    next = next.map((x) => (x.id === id ? { ...x, alive: false } : x));
    deaths.push(id);

    if (p.role.id === "hunter") hunterPending.push(id);

    if (p.loverId != null) {
      const lover = next.find((x) => x.id === p.loverId);
      if (lover?.alive) queue.push(lover.id);
    }
  }

  return { players: next, deaths, hunterPending };
}

export function resolveClassicNight(
  players: ClassicPlayer[],
  inputs: ClassicNightInput[],
): ClassicNightResult {
  let next = players.map((p) => ({ ...p }));
  const seekerNotes: ClassicNightResult["seekerNotes"] = [];
  const conversions: ClassicNightResult["conversions"] = [];
  let protectedId: number | null = null;
  const deathIds: number[] = [];

  const byType = (type: ClassicNightActionType) =>
    inputs.filter((i) => i.type === type);

  // Cupid links
  for (const inp of byType("cupid_link")) {
    if (inp.targets.length >= 2) {
      const [a, b] = inp.targets;
      next = next.map((p) => {
        if (p.id === a) return { ...p, loverId: b! };
        if (p.id === b) return { ...p, loverId: a! };
        return p;
      });
    }
  }

  // Seeker checks (info only)
  for (const inp of byType("seeker_check")) {
    const targetId = inp.targets[0];
    if (targetId == null) continue;
    const target = next.find((p) => p.id === targetId);
    seekerNotes.push({
      seekerId: inp.playerId,
      targetId,
      isWolf: !!target && isWolf(target),
    });
  }

  // Knight protect
  for (const inp of byType("knight_protect")) {
    if (inp.targets[0] != null) protectedId = inp.targets[0];
  }

  const blocked = (id: number) => protectedId === id;

  // Vampire bites (convert, not kill)
  for (const inp of byType("vampire_bite")) {
    const targetId = inp.targets[0];
    if (targetId == null || blocked(targetId)) continue;
    const target = next.find((p) => p.id === targetId);
    if (!target?.alive) continue;
    if (isVampire(target) || isWolf(target)) continue;
    next = next.map((p) =>
      p.id === targetId
        ? { ...p, role: CLASSIC_ROLES.vampire }
        : p,
    );
    conversions.push({ targetId, into: "vampire" });
  }

  // Wolf kill or convert (one pack action)
  const wolfConvert = byType("wolf_convert")[0];
  const wolfKill = byType("wolf_kill")[0];
  const wolfAction = wolfConvert ?? wolfKill;
  if (wolfAction) {
    const targetId = wolfAction.targets[0];
    if (targetId != null && !blocked(targetId)) {
      const target = next.find((p) => p.id === targetId);
      if (target?.alive) {
        if (wolfAction.type === "wolf_convert" && !isWolf(target)) {
          next = next.map((p) =>
            p.id === targetId
              ? { ...p, role: CLASSIC_ROLES.werewolf }
              : p,
          );
          conversions.push({ targetId, into: "werewolf" });
        } else if (wolfAction.type === "wolf_kill") {
          deathIds.push(targetId);
        }
      }
    }
  }

  const applied = applyDeaths(next, deathIds);
  return {
    players: applied.players,
    deaths: applied.deaths,
    hunterPending: applied.hunterPending,
    seekerNotes,
    conversions,
    protectedId,
  };
}

export { CLASSIC_ROLES };
