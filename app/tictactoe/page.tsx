"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExitButton from "../ui/exit-button";
import WinModal from "./win-modal";

type Mark = "X" | "O";
type Cell = Mark | null;
type MarkStyle = "classic" | "emoji";
type WinReason = "line" | "timeout";

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

/** Max marks each player keeps (A→C). Placing a 4th removes the oldest. */
const MAX_MARKS = 3;

const MATCH_SECONDS_OPTIONS = [5, 10, 15, 30] as const;

const EMOJI_PAIRS = [
  { id: "xo", X: "❌", O: "⭕", label: "X / O" },
  { id: "fire-ice", X: "🔥", O: "❄️", label: "Fire / Ice" },
  { id: "cat-dog", X: "🐱", O: "🐶", label: "Cat / Dog" },
  { id: "sun-moon", X: "☀️", O: "🌙", label: "Sun / Moon" },
  { id: "hearts", X: "❤️", O: "💙", label: "Hearts" },
] as const;

type EmojiPairId = (typeof EMOJI_PAIRS)[number]["id"];

function findWin(
  board: Cell[],
): { mark: Mark; line: readonly [number, number, number] } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return { mark: v, line };
  }
  return null;
}

/** Percent coords for an SVG overlay across cell centers. */
const WIN_LINE_COORDS: Record<string, { x1: number; y1: number; x2: number; y2: number }> =
  {
    "0,1,2": { x1: 6, y1: 16.7, x2: 94, y2: 16.7 },
    "3,4,5": { x1: 6, y1: 50, x2: 94, y2: 50 },
    "6,7,8": { x1: 6, y1: 83.3, x2: 94, y2: 83.3 },
    "0,3,6": { x1: 16.7, y1: 6, x2: 16.7, y2: 94 },
    "1,4,7": { x1: 50, y1: 6, x2: 50, y2: 94 },
    "2,5,8": { x1: 83.3, y1: 6, x2: 83.3, y2: 94 },
    "0,4,8": { x1: 8, y1: 8, x2: 92, y2: 92 },
    "2,4,6": { x1: 92, y1: 8, x2: 8, y2: 92 },
  };

function emptyBoard(): Cell[] {
  return Array.from({ length: 9 }, () => null);
}

function markGlyph(
  mark: Mark,
  style: MarkStyle,
  pairId: EmojiPairId,
): string {
  if (style === "classic") return mark;
  const pair = EMOJI_PAIRS.find((p) => p.id === pairId) ?? EMOJI_PAIRS[0];
  return pair[mark];
}

export default function TicTacToePage() {
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  /** Placement order per player — oldest first. Max MAX_MARKS after each turn. */
  const [history, setHistory] = useState<Record<Mark, number[]>>({
    X: [],
    O: [],
  });
  const [turn, setTurn] = useState<Mark>("X");
  const [winner, setWinner] = useState<Mark | null>(null);
  const [winLine, setWinLine] = useState<readonly [number, number, number] | null>(
    null,
  );
  const [winReason, setWinReason] = useState<WinReason | null>(null);
  const [names, setNames] = useState({ X: "Player X", O: "Player O" });
  const [markStyle, setMarkStyle] = useState<MarkStyle>("classic");
  const [emojiPair, setEmojiPair] = useState<EmojiPairId>("xo");
  /** Shared match length — one continuous clock for the whole round. */
  const [matchSeconds, setMatchSeconds] = useState(10);
  const [timeLeft, setTimeLeft] = useState(10);
  /** Bumps on each new round so the match clock restarts. */
  const [roundId, setRoundId] = useState(0);
  const [started, setStarted] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const winModalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ended = winReason != null;
  const endedRef = useRef(ended);
  endedRef.current = ended;

  const fading = useMemo(() => {
    const map: Partial<Record<number, Mark>> = {};
    (["X", "O"] as Mark[]).forEach((m) => {
      // Oldest mark flickers once that player has MAX_MARKS on the board —
      // it will vanish on their next placement.
      if (history[m].length === MAX_MARKS) {
        map[history[m][0]!] = m;
      }
    });
    return map;
  }, [history]);

  // One match clock — runs straight through, ignores whose turn it is.
  useEffect(() => {
    if (!started || ended) return;

    const deadline = Date.now() + matchSeconds * 1000;
    setTimeLeft(matchSeconds);

    const id = setInterval(() => {
      if (endedRef.current) return;
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        setWinner(null);
        setWinReason("timeout");
      }
    }, 100);

    return () => clearInterval(id);
  }, [started, ended, matchSeconds, roundId]);

  function resetBoard() {
    if (winModalTimer.current) {
      clearTimeout(winModalTimer.current);
      winModalTimer.current = null;
    }
    setBoard(emptyBoard());
    setHistory({ X: [], O: [] });
    setTurn("X");
    setWinner(null);
    setWinLine(null);
    setWinReason(null);
    setShowWinModal(false);
    setTimeLeft(matchSeconds);
    setRoundId((n) => n + 1);
  }

  function startGame() {
    resetBoard();
    setStarted(true);
  }

  function playAgain() {
    resetBoard();
  }

  function place(index: number) {
    if (ended || board[index] != null) return;

    const nextBoard = [...board];
    const nextHistory = {
      X: [...history.X],
      O: [...history.O],
    };
    const mine = nextHistory[turn];

    // Place first so a new 3-in-a-row can still use the flickering mark.
    nextBoard[index] = turn;
    mine.push(index);

    const win = findWin(nextBoard);
    if (win) {
      setBoard(nextBoard);
      setHistory(nextHistory);
      setWinner(win.mark);
      setWinLine(win.line);
      setWinReason("line");
      winModalTimer.current = setTimeout(() => setShowWinModal(true), 700);
      return;
    }

    // No win — if over the cap, remove the oldest (the one that was flickering).
    if (mine.length > MAX_MARKS) {
      const oldest = mine.shift()!;
      nextBoard[oldest] = null;
    }

    setBoard(nextBoard);
    setHistory(nextHistory);
    setTurn(turn === "X" ? "O" : "X");
  }

  function renderMark(mark: Mark, isFading: boolean) {
    const glyph = markGlyph(mark, markStyle, emojiPair);
    const isEmoji = markStyle === "emoji";
    return (
      <span
        className={`inline-block ${
          isEmoji
            ? "text-[2.35rem] leading-none sm:text-[2.75rem]"
            : `text-4xl font-bold sm:text-5xl ${
                mark === "X" ? "text-emerald-300" : "text-teal-300"
              }`
        } ${isFading ? "animate-mark-blink" : ""}`}
      >
        {glyph}
      </span>
    );
  }

  if (!started) {
    return (
      <main className="relative flex flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute -right-16 top-48 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full max-w-xl flex-1 px-5 py-8">
          <ExitButton />
          <div className="relative mt-4 overflow-hidden rounded-3xl bg-linear-to-br from-emerald-950/50 via-zinc-900 to-zinc-950 p-5 ring-1 ring-emerald-500/25">
            <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
                2 players
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-50">
                Infinity TTT
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Keep up to three marks. When you place a fourth, your oldest
                vanishes — get three in a row before it slips away.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Players
              </h2>
              <label className="block">
                <span className="mb-1.5 block text-xs text-zinc-500">
                  Player X
                </span>
                <input
                  value={names.X}
                  onChange={(e) =>
                    setNames((n) => ({ ...n, X: e.target.value || "Player X" }))
                  }
                  maxLength={20}
                  className="w-full rounded-2xl bg-zinc-950/70 px-4 py-3 text-base text-zinc-100 ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-zinc-500">
                  Player O
                </span>
                <input
                  value={names.O}
                  onChange={(e) =>
                    setNames((n) => ({ ...n, O: e.target.value || "Player O" }))
                  }
                  maxLength={20}
                  className="w-full rounded-2xl bg-zinc-950/70 px-4 py-3 text-base text-zinc-100 ring-1 ring-white/10 outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </label>
            </section>

            <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Match timer
              </h2>
              <p className="text-sm text-zinc-400">
                One shared clock for the whole match. Get three in a row before
                it hits zero — otherwise it&apos;s a draw.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {MATCH_SECONDS_OPTIONS.map((sec) => {
                  const selected = matchSeconds === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setMatchSeconds(sec)}
                      className={`rounded-2xl py-3 text-sm font-semibold ring-1 transition ${
                        selected
                          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/50"
                          : "bg-zinc-950/50 text-zinc-300 ring-white/10 hover:ring-white/20"
                      }`}
                    >
                      {sec}s
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3 rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Marks
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMarkStyle("classic")}
                  className={`rounded-2xl px-3 py-3 text-left ring-1 transition ${
                    markStyle === "classic"
                      ? "bg-emerald-500/15 ring-emerald-400/50"
                      : "bg-zinc-950/50 ring-white/10 hover:ring-white/20"
                  }`}
                >
                  <p className="text-lg font-bold tracking-wide text-zinc-100">
                    <span className="text-emerald-300">X</span>
                    <span className="mx-1.5 text-zinc-600">·</span>
                    <span className="text-teal-300">O</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Classic</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMarkStyle("emoji")}
                  className={`rounded-2xl px-3 py-3 text-left ring-1 transition ${
                    markStyle === "emoji"
                      ? "bg-emerald-500/15 ring-emerald-400/50"
                      : "bg-zinc-950/50 ring-white/10 hover:ring-white/20"
                  }`}
                >
                  <p className="text-lg leading-none">
                    {EMOJI_PAIRS.find((p) => p.id === emojiPair)?.X}{" "}
                    {EMOJI_PAIRS.find((p) => p.id === emojiPair)?.O}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">Emoji</p>
                </button>
              </div>

              {markStyle === "emoji" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {EMOJI_PAIRS.map((pair) => {
                    const selected = emojiPair === pair.id;
                    return (
                      <button
                        key={pair.id}
                        type="button"
                        onClick={() => setEmojiPair(pair.id)}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition ${
                          selected
                            ? "bg-emerald-500/15 ring-emerald-400/50"
                            : "bg-zinc-950/40 ring-white/8 hover:ring-white/20"
                        }`}
                      >
                        <span className="text-xl leading-none">
                          {pair.X} {pair.O}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {pair.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-zinc-900/70 p-4 ring-1 ring-white/8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                How it works
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li>1. Place marks like normal tic tac toe.</li>
                <li>
                  2. When you have three marks, your oldest one flickers.
                </li>
                <li>
                  3. On your fourth placement, that oldest mark disappears —
                  anyone can take the spot.
                </li>
                <li>
                  4. Beat the match timer — three in a row before time runs out,
                  or it&apos;s a draw.
                </li>
              </ul>
            </section>

            <button
              type="button"
              onClick={startGame}
              className="w-full rounded-2xl bg-emerald-500 py-4 text-lg font-semibold text-zinc-950 shadow-[0_12px_40px_rgba(16,185,129,0.3)] transition hover:bg-emerald-400 active:scale-[0.99]"
            >
              Start game
            </button>
          </div>
        </div>
      </main>
    );
  }

  const currentName = names[turn];
  const xLabel = markGlyph("X", markStyle, emojiPair);
  const oLabel = markGlyph("O", markStyle, emojiPair);
  const displayTime = timeLeft.toFixed(1);
  const timerUrgent = !ended && timeLeft <= 3;
  const timerProgress = Math.max(0, timeLeft / matchSeconds);

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -right-16 bottom-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-xl flex-1 px-5 py-8">
        <ExitButton />

        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
              Fading marks
            </p>
            <h1 className="text-2xl font-bold tracking-tight">Infinity TTT</h1>
          </div>
          <button
            type="button"
            onClick={playAgain}
            className="rounded-full bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/10 transition hover:bg-zinc-800"
          >
            Reset board
          </button>
        </div>

        <div
          className={`mt-5 overflow-hidden rounded-2xl ring-1 ${
            timerUrgent
              ? "bg-rose-500/10 ring-rose-400/40"
              : "bg-zinc-900/70 ring-white/8"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Match timer
              </p>
              <p className="text-sm text-zinc-300">
                {ended ? "Time stopped" : "Get 3 in a row before time runs out"}
              </p>
            </div>
            <p
              className={`font-mono text-4xl font-bold tabular-nums ${
                timerUrgent ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {ended && winReason === "timeout" ? "0.0" : ended ? "—" : displayTime}
            </p>
          </div>
          {!ended && (
            <div className="h-1 bg-zinc-950/60">
              <div
                className={`h-full transition-[width] duration-100 linear ${
                  timerUrgent ? "bg-rose-400" : "bg-emerald-400"
                }`}
                style={{ width: `${timerProgress * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["X", "O"] as Mark[]).map((m) => {
            const isTurn = !ended && turn === m;
            const label = m === "X" ? xLabel : oLabel;
            return (
              <div
                key={m}
                className={`rounded-2xl px-4 py-3 ring-1 transition ${
                  isTurn
                    ? m === "X"
                      ? "bg-emerald-500/15 ring-emerald-400/40"
                      : "bg-teal-500/15 ring-teal-400/40"
                    : "bg-zinc-900/60 ring-white/8"
                }`}
              >
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                  {markStyle === "classic" ? m : label}
                </p>
                <p className="truncate font-semibold text-zinc-100">
                  {names[m]}
                </p>
                {isTurn && (
                  <p className="mt-1 text-xs font-medium text-emerald-300">
                    Your turn
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="relative mx-auto mt-6 w-full max-w-sm">
          <div className="grid grid-cols-3 gap-2">
            {board.map((cell, i) => {
              const isFading = fading[i] != null;
              const mark = cell;
              const disabled = ended || mark != null;
              const inWin =
                winLine != null &&
                (winLine[0] === i || winLine[1] === i || winLine[2] === i);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => place(i)}
                  className={`flex aspect-square items-center justify-center rounded-2xl ring-1 transition active:scale-[0.97] disabled:cursor-default ${
                    mark
                      ? inWin
                        ? "bg-zinc-900 ring-amber-400/50"
                        : isFading
                          ? "animate-cell-blink bg-zinc-900 ring-emerald-400/50"
                          : "bg-zinc-900 ring-white/10"
                      : "bg-zinc-900/50 ring-white/8 hover:bg-zinc-800 hover:ring-emerald-400/40"
                  }`}
                >
                  {mark && renderMark(mark, isFading && !inWin)}
                </button>
              );
            })}
          </div>

          {winLine &&
            (() => {
              const coords = WIN_LINE_COORDS[winLine.join(",")];
              if (!coords) return null;
              return (
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <defs>
                    <linearGradient
                      id="fire-stroke"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor="#ef4444">
                        <animate
                          attributeName="stop-color"
                          values="#ef4444;#f97316;#fbbf24;#f97316;#ef4444"
                          dur="0.7s"
                          repeatCount="indefinite"
                        />
                      </stop>
                      <stop offset="50%" stopColor="#fbbf24">
                        <animate
                          attributeName="stop-color"
                          values="#fbbf24;#fff7ed;#f97316;#fbbf24"
                          dur="0.55s"
                          repeatCount="indefinite"
                        />
                      </stop>
                      <stop offset="100%" stopColor="#f97316">
                        <animate
                          attributeName="stop-color"
                          values="#f97316;#ef4444;#fbbf24;#f97316"
                          dur="0.65s"
                          repeatCount="indefinite"
                        />
                      </stop>
                    </linearGradient>
                    <filter
                      id="fire-glow"
                      x="-50%"
                      y="-50%"
                      width="200%"
                      height="200%"
                    >
                      <feGaussianBlur stdDeviation="1.2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {/* Soft outer glow */}
                  <line
                    x1={coords.x1}
                    y1={coords.y1}
                    x2={coords.x2}
                    y2={coords.y2}
                    stroke="#f97316"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.45"
                    className="animate-fire-line-pulse"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Core fire line */}
                  <line
                    x1={coords.x1}
                    y1={coords.y1}
                    x2={coords.x2}
                    y2={coords.y2}
                    stroke="url(#fire-stroke)"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    filter="url(#fire-glow)"
                    className="animate-fire-line-draw"
                    vectorEffect="non-scaling-stroke"
                    pathLength={1}
                  />
                  {/* Hot white core */}
                  <line
                    x1={coords.x1}
                    y1={coords.y1}
                    x2={coords.x2}
                    y2={coords.y2}
                    stroke="#fff7ed"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                    opacity="0.85"
                    className="animate-fire-line-core"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              );
            })()}
        </div>

        <div className="mt-6 rounded-2xl bg-zinc-900/70 px-4 py-4 text-center ring-1 ring-white/8">
          {ended && winReason === "timeout" ? (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Time&apos;s up
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-100">Draw</p>
              <p className="mt-1 text-sm text-zinc-400">
                No three in a row before the match timer ended
              </p>
              <button
                type="button"
                onClick={playAgain}
                className="mt-4 w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
              >
                Play again
              </button>
            </>
          ) : ended && winReason === "line" && winner ? (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Winner
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-300">
                {names[winner]}
              </p>
              <p className="mt-1 text-sm text-zinc-400">Three in a row</p>
              <div className="mt-4 flex gap-2">
                {!showWinModal && (
                  <button
                    type="button"
                    onClick={() => setShowWinModal(true)}
                    className="flex-1 rounded-2xl bg-zinc-800 py-3.5 text-sm font-semibold text-zinc-200 ring-1 ring-white/8 transition hover:bg-zinc-700"
                  >
                    Celebrate
                  </button>
                )}
                <button
                  type="button"
                  onClick={playAgain}
                  className="flex-1 rounded-2xl bg-emerald-500 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
                >
                  Play again
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-400">
                Pass the phone to{" "}
                <span className="font-semibold text-zinc-100">
                  {currentName}
                </span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Race the match clock — three in a row before it hits zero.
              </p>
            </>
          )}
        </div>
      </div>

      {showWinModal && ended && winReason === "line" && winner && (
        <WinModal
          winnerName={names[winner]}
          markLabel={markGlyph(winner, markStyle, emojiPair)}
          onPlayAgain={playAgain}
          onClose={() => setShowWinModal(false)}
        />
      )}
    </main>
  );
}
