"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
};

const COLORS = [
  "#34d399",
  "#2dd4bf",
  "#a7f3d0",
  "#fbbf24",
  "#f472b6",
  "#ffffff",
];

function spawn(width: number, height: number): Particle[] {
  const pieces: Particle[] = [];
  for (let i = 0; i < 120; i++) {
    pieces.push({
      x: width * (0.2 + Math.random() * 0.6),
      y: height * (0.15 + Math.random() * 0.2),
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -10 - 4,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      life: 1,
    });
  }
  return pieces;
}

export function ConfettiCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let particles = spawn(1, 1);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = spawn(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.vy += 0.28;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.006;

        if (p.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}

export default function WinModal({
  winnerName,
  markLabel,
  onPlayAgain,
  onClose,
}: {
  winnerName: string;
  markLabel: string;
  onPlayAgain: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onPlayAgain();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPlayAgain]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="win-dialog-title"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <ConfettiCanvas />
      </div>

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-linear-to-br from-emerald-950/80 via-zinc-900 to-zinc-950 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-emerald-400/30 animate-rise">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-950/60 text-lg text-zinc-400 ring-1 ring-white/10 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          ×
        </button>

        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-teal-500/15 blur-3xl" />

        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
            Winner
          </p>
          <p className="mt-3 text-5xl leading-none" aria-hidden>
            {markLabel}
          </p>
          <h2
            id="win-dialog-title"
            className="mt-4 text-3xl font-bold tracking-tight text-zinc-50"
          >
            {winnerName}
          </h2>
          <p className="mt-2 text-sm text-zinc-400">Three in a row!</p>

          <button
            type="button"
            onClick={onPlayAgain}
            className="mt-6 w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_12px_40px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400"
          >
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
