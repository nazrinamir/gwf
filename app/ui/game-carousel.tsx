"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMenuItem } from "../games";

const ACCENT = {
  rose: {
    glow: "shadow-[0_0_50px_rgba(225,29,72,0.28)]",
    ring: "ring-rose-400/40",
    cta: "bg-rose-600 text-white group-hover:bg-rose-500",
    tag: "bg-rose-500/15 text-rose-200 ring-rose-400/30",
    dot: "bg-rose-400",
  },
  sky: {
    glow: "shadow-[0_0_50px_rgba(2,132,199,0.28)]",
    ring: "ring-sky-400/40",
    cta: "bg-sky-600 text-white group-hover:bg-sky-500",
    tag: "bg-sky-500/15 text-sky-200 ring-sky-400/30",
    dot: "bg-sky-400",
  },
  emerald: {
    glow: "shadow-[0_0_50px_rgba(16,185,129,0.28)]",
    ring: "ring-emerald-400/40",
    cta: "bg-emerald-500 text-zinc-950 group-hover:bg-emerald-400",
    tag: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30",
    dot: "bg-emerald-400",
  },
  amber: {
    glow: "shadow-[0_0_50px_rgba(245,158,11,0.28)]",
    ring: "ring-amber-400/40",
    cta: "bg-amber-500 text-zinc-950 group-hover:bg-amber-400",
    tag: "bg-amber-500/15 text-amber-200 ring-amber-400/30",
    dot: "bg-amber-400",
  },
} as const;

export default function GameCarousel({ games }: { games: GameMenuItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(games.length - 1, index));
      const child = track.children[clamped] as HTMLElement | undefined;
      child?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    },
    [games.length],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const center = track.scrollLeft + track.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        Array.from(track.children).forEach((c, i) => {
          const el = c as HTMLElement;
          const elCenter = el.offsetLeft + el.offsetWidth / 2;
          const dist = Math.abs(elCenter - center);
          if (dist < bestDist) {
            bestDist = dist;
            best = i;
          }
        });
        setActive(best);
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const activeGame = games[active];

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="hide-scrollbar flex snap-x snap-mandatory items-center gap-3 overflow-x-auto scroll-smooth px-[8%] py-6 sm:gap-4 sm:px-[18%]"
      >
        {games.map((game, i) => {
          const isActive = i === active;
          const accent = ACCENT[game.accent];
          return (
            <Link
              key={game.href}
              href={game.href}
              className={`group relative aspect-3/4 w-[82%] shrink-0 snap-center overflow-hidden rounded-[1.75rem] bg-zinc-900 ring-1 transition-all duration-500 ease-out sm:w-[58%] ${
                game.hoverRing
              } ${
                isActive
                  ? `scale-100 opacity-100 ${accent.glow} ${accent.ring}`
                  : "scale-[0.84] opacity-45 ring-white/10"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={game.image}
                alt={game.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                style={{ objectPosition: game.imagePosition ?? "center" }}
                draggable={false}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/45 to-transparent" />
              <div className="absolute inset-0 bg-linear-to-br from-white/5 via-transparent to-transparent opacity-60" />

              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ring-1 ${accent.tag}`}
                >
                  {game.tag}
                </span>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white drop-shadow-lg sm:text-4xl">
                  {game.title}
                </h2>
                <p className="mt-1.5 text-sm text-zinc-300">{game.blurb}</p>
                <div
                  className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${accent.cta}`}
                >
                  Play
                  <span aria-hidden>→</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Previous game"
        onClick={() => scrollTo(active - 1)}
        disabled={active === 0}
        className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-950/70 text-xl text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-zinc-900 disabled:pointer-events-none disabled:opacity-0 sm:left-1"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next game"
        onClick={() => scrollTo(active + 1)}
        disabled={active === games.length - 1}
        className="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-950/70 text-xl text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-zinc-900 disabled:pointer-events-none disabled:opacity-0 sm:right-1"
      >
        ›
      </button>

      <div className="mt-2 flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-2">
          {games.map((game, i) => (
            <button
              key={game.href}
              type="button"
              aria-label={`Go to ${game.title}`}
              onClick={() => scrollTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === active
                  ? `w-7 ${ACCENT[game.accent].dot}`
                  : "w-2 bg-white/25 hover:bg-white/45"
              }`}
            />
          ))}
        </div>
        {activeGame && (
          <p className="text-center text-xs text-zinc-500">
            <span className="font-semibold text-zinc-300">
              {activeGame.title}
            </span>
            <span className="mx-2 text-zinc-700">·</span>
            Swipe or tap Play
          </p>
        )}
      </div>
    </div>
  );
}
