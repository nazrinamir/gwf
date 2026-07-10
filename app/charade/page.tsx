"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExitButton from "../ui/exit-button";
import TapButton from "../ui/tap-button";
import { CATEGORIES, type Category } from "../impostor/words";

type Phase = "setup" | "ready" | "countdown" | "play" | "results";
type Flash = "correct" | "skip" | null;

const ROUND_OPTIONS = [30, 60, 90] as const;
/** Degrees away from calibrated forehead rest before a tilt counts. */
const TILT_TRIGGER = 28;
/** Must return this close to rest before the next tilt can fire. */
const TILT_NEUTRAL = 12;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function buildDeck(categoryId: string): string[] {
  const cats: Category[] =
    categoryId === "any"
      ? CATEGORIES
      : CATEGORIES.filter((c) => c.id === categoryId);
  const words = cats.flatMap((c) => c.words.map((w) => w.word));
  return shuffle(words);
}

function screenAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation?.angle != null) {
    return screen.orientation.angle;
  }
  if (typeof window.orientation === "number") return window.orientation;
  return 0;
}

/**
 * Nod axis for forehead play.
 * Landscape: gamma (sign flipped for the other landscape direction).
 * Portrait: beta (0 flat, ~90 upright on forehead).
 */
function nodFromOrientation(e: DeviceOrientationEvent): number | null {
  const angle = ((screenAngle() % 360) + 360) % 360;
  const landscape = angle === 90 || angle === 270;

  if (landscape) {
    if (e.gamma == null) return null;
    // 90° and 270° flip which way is "up".
    return angle === 90 ? e.gamma : -e.gamma;
  }
  if (e.beta == null) return null;
  return e.beta;
}

/** Gravity-based nod — often more reliable than orientation angles. */
function nodFromMotion(e: DeviceMotionEvent): number | null {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null || g.y == null || g.z == null) return null;
  const angle = ((screenAngle() % 360) + 360) % 360;
  // Pick the axis that tracks forehead nod in the current orientation.
  if (angle === 90) return g.x;
  if (angle === 270) return -g.x;
  // Portrait / near-portrait: Y is up the screen.
  return g.y;
}

function useLandscape(): boolean {
  const [landscape, setLandscape] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const update = () => setLandscape(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return landscape;
}

export default function CharadePage() {
  const landscape = useLandscape();
  const [phase, setPhase] = useState<Phase>("setup");
  const [categoryId, setCategoryId] = useState("any");
  const [roundSeconds, setRoundSeconds] = useState(60);
  const [actorName, setActorName] = useState("");
  const [deck, setDeck] = useState<string[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [correct, setCorrect] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [countdown, setCountdown] = useState(3);
  const [flash, setFlash] = useState<Flash>(null);
  const [motionOk, setMotionOk] = useState(false);

  const armedRef = useRef(true);
  const cooldownRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const currentWordRef = useRef("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Calibrated resting nod while phone is on the forehead. */
  const baselineRef = useRef<number | null>(null);
  const baselineSamples = useRef<number[]>([]);
  /** Prefer orientation degrees; fall back to gravity units. */
  const useGravityRef = useRef(false);

  const currentWord = deck[deckIndex] ?? "";
  currentWordRef.current = currentWord;

  const categoryLabel = useMemo(() => {
    if (categoryId === "any") return "Any category";
    return CATEGORIES.find((c) => c.id === categoryId)?.name ?? "Any category";
  }, [categoryId]);

  const nextWord = useCallback(() => {
    setDeckIndex((i) => {
      const next = i + 1;
      if (next >= deck.length) {
        setDeck(buildDeck(categoryId));
        return 0;
      }
      return next;
    });
  }, [deck.length, categoryId]);

  const resolveAnswer = useCallback(
    (kind: "correct" | "skip") => {
      if (phaseRef.current !== "play" || cooldownRef.current) return;
      const word = currentWordRef.current;
      if (!word) return;

      cooldownRef.current = true;
      armedRef.current = false;

      if (kind === "correct") {
        setCorrect((list) => [...list, word]);
      } else {
        setSkipped((list) => [...list, word]);
      }

      setFlash(kind);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        setFlash(null);
        nextWord();
        // Brief pause before next tilt can fire.
        setTimeout(() => {
          cooldownRef.current = false;
        }, 350);
      }, 450);
    },
    [nextWord],
  );

  async function requestMotionPermission(): Promise<boolean> {
    try {
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      const DME = DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };

      if (typeof DOE.requestPermission === "function") {
        const result = await DOE.requestPermission();
        if (result !== "granted") return false;
      }
      // iOS also gates DeviceMotion behind its own prompt.
      if (typeof DME.requestPermission === "function") {
        const result = await DME.requestPermission();
        if (result !== "granted") return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function startRound() {
    const words = buildDeck(categoryId);
    setDeck(words.length ? words : ["Charade"]);
    setDeckIndex(0);
    setCorrect([]);
    setSkipped([]);
    setTimeLeft(roundSeconds);
    setCountdown(3);
    setFlash(null);
    armedRef.current = true;
    cooldownRef.current = false;
    baselineRef.current = null;
    baselineSamples.current = [];
    useGravityRef.current = false;
    setPhase("ready");
  }

  async function beginFromReady() {
    const ok = await requestMotionPermission();
    setMotionOk(ok);
    setPhase("countdown");
  }

  // Countdown 3-2-1
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("play");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Match timer — fresh clock when play starts.
  useEffect(() => {
    if (phase !== "play") return;
    const deadline = Date.now() + roundSeconds * 1000;
    setTimeLeft(roundSeconds);
    const id = setInterval(() => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        setPhase("results");
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, roundSeconds]);

  // Tilt: down = correct, up = skip (calibrated to forehead rest pose)
  useEffect(() => {
    if (phase !== "play" || !motionOk) return;

    baselineRef.current = null;
    baselineSamples.current = [];
    armedRef.current = false; // wait until calibrated + near rest
    useGravityRef.current = false;

    let gotOrientation = false;
    let gotMotion = false;

    const handleNod = (raw: number, mode: "orient" | "gravity") => {
      if (phaseRef.current !== "play" || cooldownRef.current) return;

      // Prefer orientation once we have it; ignore gravity after that.
      if (mode === "gravity" && gotOrientation) return;
      if (mode === "orient") {
        gotOrientation = true;
        useGravityRef.current = false;
      } else {
        gotMotion = true;
        if (!gotOrientation) useGravityRef.current = true;
      }

      const trigger = useGravityRef.current ? 4.5 : TILT_TRIGGER;
      const neutral = useGravityRef.current ? 2 : TILT_NEUTRAL;

      // Calibrate resting forehead pose from the first stable samples.
      if (baselineRef.current == null) {
        baselineSamples.current.push(raw);
        if (baselineSamples.current.length < 8) return;
        const samples = baselineSamples.current;
        const avg = samples.reduce((s, n) => s + n, 0) / samples.length;
        baselineRef.current = avg;
        armedRef.current = true;
        return;
      }

      const delta = raw - baselineRef.current;

      if (!armedRef.current) {
        if (Math.abs(delta) < neutral) {
          armedRef.current = true;
        }
        return;
      }

      // Positive delta = tilt up (skip); negative = tilt down (correct).
      if (delta <= -trigger) {
        resolveAnswer("correct");
      } else if (delta >= trigger) {
        resolveAnswer("skip");
      }
    };

    const onOrient = (e: DeviceOrientationEvent) => {
      const nod = nodFromOrientation(e);
      if (nod == null) return;
      handleNod(nod, "orient");
    };

    const onMotion = (e: DeviceMotionEvent) => {
      const nod = nodFromMotion(e);
      if (nod == null) return;
      handleNod(nod, "gravity");
    };

    window.addEventListener("deviceorientation", onOrient);
    window.addEventListener("devicemotion", onMotion);

    // If nothing arrives (HTTP / denied / desktop), fall back to buttons.
    const probe = window.setTimeout(() => {
      if (!gotOrientation && !gotMotion) {
        setMotionOk(false);
      }
    }, 2000);

    return () => {
      window.clearTimeout(probe);
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("devicemotion", onMotion);
    };
  }, [phase, motionOk, resolveAnswer]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  // —— Setup ——
  if (phase === "setup") {
    return (
      <main className="relative flex flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-8">
          <ExitButton />
          <div className="relative mt-4 rounded-3xl bg-linear-to-br from-amber-950/50 via-zinc-900 to-zinc-950 p-5 ring-1 ring-amber-500/25">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
              Party game
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-50">
              Charade
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Phone on your forehead. Friends give clues. Tilt down when
              you&apos;ve got it — tilt up to skip.
            </p>
          </div>

          <div className="mt-5 space-y-4 pb-4">
            <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Who&apos;s acting
              </h2>
              <input
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                placeholder="Optional name"
                maxLength={20}
                className="w-full rounded-2xl bg-zinc-950/70 px-4 py-3 text-base text-zinc-100 ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </section>

            <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Category
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <TapButton
                  onPress={() => setCategoryId("any")}
                  ariaLabel="Any category"
                  className={`rounded-2xl px-3 py-3 text-left ring-1 ${
                    categoryId === "any"
                      ? "bg-amber-500/15 ring-amber-400/50"
                      : "bg-zinc-950/50 ring-white/10"
                  }`}
                >
                  <span className="block text-base font-semibold">🎲 Any</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    All categories
                  </span>
                </TapButton>
                {CATEGORIES.map((cat) => (
                  <TapButton
                    key={cat.id}
                    onPress={() => setCategoryId(cat.id)}
                    ariaLabel={cat.name}
                    className={`rounded-2xl px-3 py-3 text-left ring-1 ${
                      categoryId === cat.id
                        ? "bg-amber-500/15 ring-amber-400/50"
                        : "bg-zinc-950/50 ring-white/10"
                    }`}
                  >
                    <span className="block text-base font-semibold">
                      {cat.emoji} {cat.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {cat.words.length} words
                    </span>
                  </TapButton>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Round length
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {ROUND_OPTIONS.map((sec) => (
                  <TapButton
                    key={sec}
                    onPress={() => setRoundSeconds(sec)}
                    ariaLabel={`${sec} seconds`}
                    className={`rounded-2xl py-3 text-center text-sm font-semibold ring-1 ${
                      roundSeconds === sec
                        ? "bg-amber-500/15 text-amber-200 ring-amber-400/50"
                        : "bg-zinc-950/50 text-zinc-300 ring-white/10"
                    }`}
                  >
                    {sec}s
                  </TapButton>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                How it works
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li>1. Hold the phone on your forehead in landscape.</li>
                <li>2. Friends give clues — you don&apos;t look at the screen.</li>
                <li>3. Tilt down = correct · tilt up = skip.</li>
                <li>4. See your score and every word at the end.</li>
              </ul>
            </section>
          </div>
        </div>

        <div className="relative z-20 shrink-0 border-t border-white/10 bg-zinc-950 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-xl">
            <TapButton
              onPress={startRound}
              ariaLabel="Start round"
              className="w-full rounded-2xl bg-amber-500 py-4 text-center text-lg font-semibold text-zinc-950 shadow-[0_12px_40px_rgba(245,158,11,0.3)]"
            >
              Start round
            </TapButton>
          </div>
        </div>
      </main>
    );
  }

  // —— Results ——
  if (phase === "results") {
    return (
      <main className="relative flex flex-1 flex-col overflow-y-auto bg-zinc-950 text-zinc-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-xl flex-1 px-5 py-8">
          <ExitButton />
          <div className="mt-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
              Round over
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {correct.length} correct
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {actorName.trim() || "Player"} · {categoryLabel} · {roundSeconds}s
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <section className="rounded-3xl bg-emerald-500/10 p-4 ring-1 ring-emerald-400/25">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                Got it ({correct.length})
              </h2>
              {correct.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">None yet</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {correct.map((w, i) => (
                    <li
                      key={`c-${i}-${w}`}
                      className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100"
                    >
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-3xl bg-amber-500/10 p-4 ring-1 ring-amber-400/25">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/80">
                Skipped ({skipped.length})
              </h2>
              {skipped.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">None</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {skipped.map((w, i) => (
                    <li
                      key={`s-${i}-${w}`}
                      className="rounded-xl bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100"
                    >
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <TapButton
              onPress={startRound}
              ariaLabel="Play again"
              className="flex-1 rounded-2xl bg-amber-500 py-3.5 text-center text-sm font-semibold text-zinc-950"
            >
              Play again
            </TapButton>
            <TapButton
              onPress={() => setPhase("setup")}
              ariaLabel="Change setup"
              className="flex-1 rounded-2xl bg-zinc-800 py-3.5 text-center text-sm font-semibold text-zinc-200 ring-1 ring-white/8"
            >
              Change setup
            </TapButton>
          </div>
        </div>
      </main>
    );
  }

  // —— Ready / countdown / play (landscape preferred) ——
  const showRotateGate = !landscape;

  return (
    <main
      className={`relative flex flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100 ${
        flash === "correct"
          ? "bg-emerald-950"
          : flash === "skip"
            ? "bg-amber-950"
            : ""
      }`}
    >
      {showRotateGate && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-zinc-950 px-6 text-center">
          <p className="text-4xl" aria-hidden>
            📱
          </p>
          <h2 className="text-xl font-bold">Rotate to landscape</h2>
          <p className="max-w-xs text-sm text-zinc-400">
            Hold the phone sideways on your forehead so friends can see the
            word.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      {phase === "ready" && (
        <div className="relative flex flex-1 flex-col px-6 py-4">
          <ExitButton />
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
              Get ready
            </p>
            <h1 className="max-w-lg text-3xl font-bold tracking-tight sm:text-4xl">
              Put the phone on your forehead
            </h1>
            <p className="max-w-md text-sm text-zinc-400">
              {actorName.trim()
                ? `${actorName.trim()} acts — everyone else gives clues.`
                : "Friends give clues. You tilt to answer."}
            </p>
            <p className="text-xs text-zinc-500">
              ↓ tilt down = correct · ↑ tilt up = skip
            </p>
            <p className="max-w-sm text-xs text-zinc-600">
              Hold still on your forehead for a moment so it can calibrate. On
              iPhone, tap Allow for motion access.
            </p>
            <TapButton
              onPress={beginFromReady}
              ariaLabel="I'm ready"
              className="mt-2 rounded-2xl bg-amber-500 px-10 py-4 text-center text-lg font-semibold text-zinc-950 shadow-[0_12px_40px_rgba(245,158,11,0.3)]"
            >
              I&apos;m ready
            </TapButton>
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="relative flex flex-1 flex-col items-center justify-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
            Starting
          </p>
          <p className="mt-4 font-mono text-8xl font-bold text-amber-300 tabular-nums">
            {countdown > 0 ? countdown : "Go"}
          </p>
        </div>
      )}

      {phase === "play" && (
        <div className="relative flex flex-1 flex-col px-4 py-3 sm:px-8 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {categoryLabel}
            </p>
            <p
              className={`font-mono text-3xl font-bold tabular-nums sm:text-4xl ${
                timeLeft <= 5 ? "text-rose-300" : "text-amber-300"
              }`}
            >
              {timeLeft.toFixed(1)}
            </p>
            <p className="text-sm font-semibold text-emerald-300">
              {correct.length} ✓
            </p>
          </div>

          <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-900">
            <div
              className={`h-full transition-[width] duration-100 linear ${
                timeLeft <= 5 ? "bg-rose-400" : "bg-amber-400"
              }`}
              style={{
                width: `${Math.max(0, (timeLeft / roundSeconds) * 100)}%`,
              }}
            />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center">
            {flash ? (
              <p
                className={`text-5xl font-bold uppercase tracking-wide sm:text-6xl ${
                  flash === "correct" ? "text-emerald-300" : "text-amber-300"
                }`}
              >
                {flash === "correct" ? "Correct!" : "Skip"}
              </p>
            ) : (
              <p className="max-w-4xl text-center text-5xl font-bold leading-tight tracking-tight text-zinc-50 sm:text-6xl md:text-7xl">
                {currentWord}
              </p>
            )}
            <p className="mt-6 text-xs text-zinc-500">
              ↓ correct · ↑ skip
              {motionOk
                ? " · hold still briefly to calibrate"
                : " · tilt unavailable — use buttons"}
            </p>
          </div>

          <div className="flex gap-3 pb-2">
            <TapButton
              onPress={() => resolveAnswer("skip")}
              ariaLabel="Skip"
              className="flex-1 rounded-2xl bg-zinc-900 py-4 text-center text-base font-semibold text-amber-200 ring-1 ring-amber-400/30"
            >
              ↑ Skip
            </TapButton>
            <TapButton
              onPress={() => resolveAnswer("correct")}
              ariaLabel="Correct"
              className="flex-1 rounded-2xl bg-emerald-500/90 py-4 text-center text-base font-semibold text-zinc-950"
            >
              ↓ Correct
            </TapButton>
          </div>
        </div>
      )}
    </main>
  );
}
