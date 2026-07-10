"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExitButton from "../ui/exit-button";
import TapButton from "../ui/tap-button";
import { CATEGORIES, type Category } from "../impostor/words";

type Phase =
  | "setup"
  | "calibrate"
  | "countdown"
  | "play"
  | "results";
type Flash = "correct" | "skip" | null;
type CalibStep = "down" | "up" | "done";

const ROUND_OPTIONS = [30, 60, 90] as const;
const CALIB_NEED = 3;
/** How far from rest (°) before a nod starts counting during calibration. */
const CALIB_MOVE = 16;
/** How close to rest (°) to finish a nod during calibration. */
const CALIB_RETURN = 14;
/** Play uses this fraction of the calibrated nod depth (less twitchy). */
const PLAY_EASE = 0.7;

type TiltDir = "neutral" | "correct" | "skip";

type Calibration = {
  rest: number;
  down: number;
  up: number;
};

type Monitor = {
  beta: number | null;
  gamma: number | null;
  pitch: number | null;
  zone: "rest" | "down" | "up" | "—";
};

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

function mean(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function screenAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation?.angle != null) {
    return screen.orientation.angle;
  }
  if (typeof window.orientation === "number") return window.orientation;
  return 0;
}

/**
 * Map deviceorientation → forehead pitch:
 *   lower / higher relative to rest depends on the device — calibration learns it.
 */
function foreheadPitch(e: DeviceOrientationEvent): number | null {
  if (e.beta == null) return null;
  const beta = e.beta;
  const gamma = e.gamma ?? 0;
  const angle = ((screenAngle() % 360) + 360) % 360;
  const landscape = angle === 90 || angle === 270;

  if (landscape && Math.abs(beta) < 20 && Math.abs(gamma) > 55) {
    return Math.abs(gamma);
  }
  return beta;
}

function tiltFromCalibration(
  pitch: number,
  calib: Calibration,
): TiltDir {
  const { rest, down, up } = calib;
  const downGate = rest + (down - rest) * PLAY_EASE;
  const upGate = rest + (up - rest) * PLAY_EASE;

  const towardDown =
    down < rest ? pitch <= downGate : pitch >= downGate;
  const towardUp = up > rest ? pitch >= upGate : pitch <= upGate;

  if (towardDown && !towardUp) return "correct";
  if (towardUp && !towardDown) return "skip";
  if (towardDown && towardUp) {
    return Math.abs(pitch - down) <= Math.abs(pitch - up)
      ? "correct"
      : "skip";
  }
  return "neutral";
}

function inRearmBand(pitch: number, calib: Calibration): boolean {
  const span = Math.max(
    12,
    Math.abs(calib.up - calib.down) * 0.14,
  );
  return pitch >= calib.rest - span && pitch <= calib.rest + span;
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

function DotRow({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-full ring-1 ${
            i < filled ? color : "bg-zinc-800 ring-white/10"
          }`}
        />
      ))}
      <span className="ml-1 font-mono text-xs text-zinc-400 tabular-nums">
        {filled}/{total}
      </span>
    </div>
  );
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

  // Calibration UI state
  const [calibStep, setCalibStep] = useState<CalibStep>("down");
  const [downCount, setDownCount] = useState(0);
  const [upCount, setUpCount] = useState(0);
  const [monitor, setMonitor] = useState<Monitor>({
    beta: null,
    gamma: null,
    pitch: null,
    zone: "—",
  });
  const [calibFlash, setCalibFlash] = useState<"down" | "up" | null>(null);
  const [sensorsOn, setSensorsOn] = useState(false);

  const armedRef = useRef(true);
  const cooldownRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const currentWordRef = useRef("");
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calibRef = useRef<Calibration | null>(null);

  // Calibration tracking refs
  const restRef = useRef<number | null>(null);
  const restSamplesRef = useRef<number[]>([]);
  const trackingRef = useRef<"none" | "nod">("none");
  const nodMinRef = useRef(0);
  const nodMaxRef = useRef(0);
  const downPeaksRef = useRef<number[]>([]);
  const upPeaksRef = useRef<number[]>([]);
  const calibStepRef = useRef<CalibStep>("down");
  calibStepRef.current = calibStep;

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
      if (typeof DME.requestPermission === "function") {
        const result = await DME.requestPermission();
        if (result !== "granted") return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function resetCalibration() {
    restRef.current = null;
    restSamplesRef.current = [];
    trackingRef.current = "none";
    downPeaksRef.current = [];
    upPeaksRef.current = [];
    calibRef.current = null;
    setCalibStep("down");
    setDownCount(0);
    setUpCount(0);
    setCalibFlash(null);
    setMonitor({ beta: null, gamma: null, pitch: null, zone: "—" });
  }

  function finishCalibration() {
    const rest = restRef.current;
    const downs = downPeaksRef.current;
    const ups = upPeaksRef.current;
    if (rest == null || downs.length < CALIB_NEED || ups.length < CALIB_NEED) {
      return;
    }
    calibRef.current = {
      rest,
      down: mean(downs.slice(0, CALIB_NEED)),
      up: mean(ups.slice(0, CALIB_NEED)),
    };
    setCalibStep("done");
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
    setSensorsOn(false);
    setMotionOk(false);
    resetCalibration();
    setPhase("calibrate");
  }

  async function beginCalibration() {
    const ok = await requestMotionPermission();
    setMotionOk(ok);
    setSensorsOn(true);
    resetCalibration();
  }

  function beginGame() {
    if (!calibRef.current) finishCalibration();
    if (!calibRef.current) return;
    setCountdown(3);
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

  // Match timer
  useEffect(() => {
    if (phase !== "play") return;
    const deadline = Date.now() + roundSeconds * 1000;
    setTimeLeft(roundSeconds);
    const id = setInterval(() => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) setPhase("results");
    }, 100);
    return () => clearInterval(id);
  }, [phase, roundSeconds]);

  // Calibration + live monitor
  useEffect(() => {
    if (phase !== "calibrate" || !sensorsOn) return;

    let sawEvent = false;

    const onOrient = (e: DeviceOrientationEvent) => {
      const pitch = foreheadPitch(e);
      const beta = e.beta;
      const gamma = e.gamma;

      if (pitch == null) {
        setMonitor({
          beta,
          gamma,
          pitch: null,
          zone: "—",
        });
        return;
      }
      sawEvent = true;

      // Establish resting forehead angle from the first stable samples.
      if (restRef.current == null) {
        restSamplesRef.current.push(pitch);
        setMonitor({ beta, gamma, pitch, zone: "rest" });
        if (restSamplesRef.current.length >= 12) {
          restRef.current = mean(restSamplesRef.current);
        }
        return;
      }

      const rest = restRef.current;
      const delta = pitch - rest;
      let zone: Monitor["zone"] = "rest";
      if (delta < -CALIB_MOVE / 2) zone = "down";
      else if (delta > CALIB_MOVE / 2) zone = "up";

      setMonitor({ beta, gamma, pitch, zone });

      if (calibStepRef.current === "done") return;

      if (trackingRef.current === "none") {
        if (Math.abs(delta) >= CALIB_MOVE) {
          trackingRef.current = "nod";
          nodMinRef.current = pitch;
          nodMaxRef.current = pitch;
        } else {
          // Slow rest drift while holding still.
          restRef.current = rest * 0.98 + pitch * 0.02;
        }
        return;
      }

      // Tracking a nod — record extrema until return to rest.
      nodMinRef.current = Math.min(nodMinRef.current, pitch);
      nodMaxRef.current = Math.max(nodMaxRef.current, pitch);

      if (Math.abs(pitch - rest) > CALIB_RETURN) return;

      const far =
        Math.abs(nodMinRef.current - rest) >= Math.abs(nodMaxRef.current - rest)
          ? nodMinRef.current
          : nodMaxRef.current;
      trackingRef.current = "none";

      const step = calibStepRef.current;
      if (step === "down") {
        downPeaksRef.current = [...downPeaksRef.current, far];
        const n = downPeaksRef.current.length;
        setDownCount(n);
        setCalibFlash("down");
        window.setTimeout(() => setCalibFlash(null), 400);
        if (n >= CALIB_NEED) setCalibStep("up");
      } else if (step === "up") {
        upPeaksRef.current = [...upPeaksRef.current, far];
        const n = upPeaksRef.current.length;
        setUpCount(n);
        setCalibFlash("up");
        window.setTimeout(() => setCalibFlash(null), 400);
        if (n >= CALIB_NEED) {
          // Finalize thresholds.
          const downs = downPeaksRef.current;
          const ups = upPeaksRef.current;
          calibRef.current = {
            rest: restRef.current ?? rest,
            down: mean(downs.slice(0, CALIB_NEED)),
            up: mean(ups.slice(0, CALIB_NEED)),
          };
          setCalibStep("done");
        }
      }
    };

    window.addEventListener("deviceorientation", onOrient, true);
    const probe = window.setTimeout(() => {
      if (!sawEvent) setMotionOk(false);
    }, 2500);

    return () => {
      window.clearTimeout(probe);
      window.removeEventListener("deviceorientation", onOrient, true);
    };
  }, [phase, sensorsOn]);

  // Play tilt using calibrated thresholds
  useEffect(() => {
    if (phase !== "play" || !motionOk) return;
    const calib = calibRef.current;
    if (!calib) return;

    armedRef.current = true;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (phaseRef.current !== "play" || cooldownRef.current) return;
      const pitch = foreheadPitch(e);
      if (pitch == null) return;

      if (!armedRef.current) {
        if (inRearmBand(pitch, calib)) armedRef.current = true;
        return;
      }

      const dir = tiltFromCalibration(pitch, calib);
      if (dir === "correct") resolveAnswer("correct");
      else if (dir === "skip") resolveAnswer("skip");
    };

    window.addEventListener("deviceorientation", onOrient, true);
    return () => window.removeEventListener("deviceorientation", onOrient, true);
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
                <li>1. Calibrate tilt (3 downs, 3 ups) for your phone.</li>
                <li>2. Hold the phone on your forehead in landscape.</li>
                <li>3. Friends give clues — you don&apos;t look at the screen.</li>
                <li>4. Tilt down = correct · tilt up = skip.</li>
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
          <div className="absolute -right-16 bottom-10 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-xl px-5 py-8">
          <ExitButton />
          <div className="mt-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
              Round over
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {correct.length}
              <span className="text-zinc-500"> / </span>
              {correct.length + skipped.length}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">words correct</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <section className="rounded-3xl bg-emerald-500/10 p-4 ring-1 ring-emerald-400/25">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                Got it ({correct.length})
              </h2>
              {correct.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">None</p>
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

  // —— Calibrate / countdown / play ——
  const showRotateGate = !landscape && phase !== "calibrate";
  const pitch = monitor.pitch;
  const rest = restRef.current;
  const gaugePct =
    pitch == null ? 50 : Math.max(0, Math.min(100, (pitch / 180) * 100));

  return (
    <main
      className={`relative flex flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100 ${
        flash === "correct"
          ? "bg-emerald-950"
          : flash === "skip"
            ? "bg-amber-950"
            : calibFlash === "down"
              ? "bg-emerald-950"
              : calibFlash === "up"
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

      {phase === "calibrate" && (
        <div className="relative flex flex-1 flex-col overflow-y-auto px-5 py-4">
          <ExitButton />

          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
              Calibrate
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Teach your phone the nods
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Hold it on your forehead like you will in the game. We&apos;ll
              learn your down and up angles.
            </p>

            {!sensorsOn ? (
              <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <p className="max-w-sm text-sm text-zinc-400">
                  Allow motion access, then tilt down three times and up three
                  times.
                </p>
                <TapButton
                  onPress={beginCalibration}
                  ariaLabel="Start calibration"
                  className="rounded-2xl bg-amber-500 px-10 py-4 text-center text-lg font-semibold text-zinc-950 shadow-[0_12px_40px_rgba(245,158,11,0.3)]"
                >
                  Start calibration
                </TapButton>
                <TapButton
                  onPress={() => {
                    setMotionOk(false);
                    setCountdown(3);
                    setPhase("countdown");
                  }}
                  ariaLabel="Skip and use buttons only"
                  className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-300"
                >
                  Skip — use buttons only
                </TapButton>
              </div>
            ) : (
              <>
                {/* Live monitor */}
                <section className="mt-5 rounded-3xl bg-zinc-900/80 p-4 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Tilt monitor
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        monitor.zone === "down"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : monitor.zone === "up"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {monitor.zone}
                    </span>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Pitch
                      </p>
                      <p className="font-mono text-4xl font-bold tabular-nums text-zinc-50">
                        {pitch == null ? "—" : `${pitch.toFixed(0)}°`}
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs text-zinc-500 tabular-nums">
                      <p>
                        β{" "}
                        {monitor.beta == null ? "—" : monitor.beta.toFixed(0)}
                      </p>
                      <p>
                        γ{" "}
                        {monitor.gamma == null
                          ? "—"
                          : monitor.gamma.toFixed(0)}
                      </p>
                      <p>
                        rest{" "}
                        {rest == null ? "…" : `${rest.toFixed(0)}°`}
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-white/8">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-emerald-500 via-zinc-500 to-amber-400 transition-[width] duration-75"
                      style={{ width: `${gaugePct}%` }}
                    />
                    {rest != null && (
                      <span
                        className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-white/80"
                        style={{
                          left: `${Math.max(0, Math.min(100, (rest / 180) * 100))}%`,
                        }}
                      />
                    )}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-zinc-600">
                    <span>↓ floor</span>
                    <span>rest</span>
                    <span>ceiling ↑</span>
                  </div>

                  {!motionOk && (
                    <p className="mt-3 text-xs text-rose-300">
                      No sensor data yet — try HTTPS, or skip and use buttons.
                    </p>
                  )}
                </section>

                {/* Progress */}
                <section className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div
                    className={`rounded-3xl p-4 ring-1 ${
                      calibStep === "down"
                        ? "bg-emerald-500/10 ring-emerald-400/40"
                        : "bg-zinc-900/70 ring-white/8"
                    }`}
                  >
                    <p className="text-sm font-semibold text-emerald-300">
                      ↓ Tilt down
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Toward the floor (correct)
                    </p>
                    <div className="mt-3">
                      <DotRow
                        filled={downCount}
                        total={CALIB_NEED}
                        color="bg-emerald-400 ring-emerald-300/50"
                      />
                    </div>
                  </div>
                  <div
                    className={`rounded-3xl p-4 ring-1 ${
                      calibStep === "up"
                        ? "bg-amber-500/10 ring-amber-400/40"
                        : "bg-zinc-900/70 ring-white/8"
                    }`}
                  >
                    <p className="text-sm font-semibold text-amber-300">
                      ↑ Tilt up
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Toward the ceiling (skip)
                    </p>
                    <div className="mt-3">
                      <DotRow
                        filled={upCount}
                        total={CALIB_NEED}
                        color="bg-amber-400 ring-amber-300/50"
                      />
                    </div>
                  </div>
                </section>

                <div className="mt-5 flex flex-1 flex-col items-center justify-center text-center">
                  {calibStep === "down" && (
                    <>
                      <p className="text-5xl" aria-hidden>
                        ↓
                      </p>
                      <h2 className="mt-2 text-xl font-bold">
                        Tilt down {CALIB_NEED} times
                      </h2>
                      <p className="mt-2 max-w-sm text-sm text-zinc-400">
                        Nod toward the floor, then return to center. Repeat.
                      </p>
                    </>
                  )}
                  {calibStep === "up" && (
                    <>
                      <p className="text-5xl" aria-hidden>
                        ↑
                      </p>
                      <h2 className="mt-2 text-xl font-bold">
                        Tilt up {CALIB_NEED} times
                      </h2>
                      <p className="mt-2 max-w-sm text-sm text-zinc-400">
                        Nod toward the ceiling, then return to center. Repeat.
                      </p>
                    </>
                  )}
                  {calibStep === "done" && calibRef.current && (
                    <>
                      <p className="text-4xl" aria-hidden>
                        ✓
                      </p>
                      <h2 className="mt-2 text-xl font-bold">Calibrated</h2>
                      <p className="mt-2 font-mono text-xs text-zinc-500 tabular-nums">
                        rest {calibRef.current.rest.toFixed(0)}° · down{" "}
                        {calibRef.current.down.toFixed(0)}° · up{" "}
                        {calibRef.current.up.toFixed(0)}°
                      </p>
                      <TapButton
                        onPress={beginGame}
                        ariaLabel="I'm ready"
                        className="mt-6 rounded-2xl bg-amber-500 px-10 py-4 text-center text-lg font-semibold text-zinc-950 shadow-[0_12px_40px_rgba(245,158,11,0.3)]"
                      >
                        I&apos;m ready
                      </TapButton>
                      <TapButton
                        onPress={() => {
                          resetCalibration();
                          setSensorsOn(true);
                        }}
                        ariaLabel="Recalibrate"
                        className="mt-3 text-sm text-zinc-500"
                      >
                        Recalibrate
                      </TapButton>
                    </>
                  )}
                </div>
              </>
            )}
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
              {motionOk && calibRef.current
                ? " · using your calibration"
                : " · use buttons"}
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
