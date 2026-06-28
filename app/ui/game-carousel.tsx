"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameMenuItem } from "../games";

export default function GameCarousel({ games }: { games: GameMenuItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(games.length - 1, index));
    const child = track.children[clamped] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [games.length]);

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

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="hide-scrollbar flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scroll-smooth px-[10%] py-4 sm:px-[20%]"
      >
        {games.map((game, i) => {
          const isActive = i === active;
          return (
            <Link
              key={game.href}
              href={game.href}
              className={`group relative aspect-3/4 w-[80%] shrink-0 snap-center overflow-hidden rounded-3xl ring-1 ring-white/10 transition-all duration-500 ease-out hover:ring-2 sm:w-[60%] ${
                game.hoverRing
              } ${
                isActive
                  ? "scale-100 opacity-100"
                  : "scale-[0.82] opacity-50"
              }`}
            >
              <Image
                src={game.image}
                alt={game.title}
                fill
                priority
                sizes="(max-width: 640px) 80vw, 60vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />
              <h2 className="absolute inset-x-0 bottom-0 p-6 text-center text-3xl font-bold tracking-tight drop-shadow-lg">
                {game.title}
              </h2>
            </Link>
          );
        })}
      </div>

      {/* Arrows */}
      <button
        type="button"
        aria-label="Previous game"
        onClick={() => scrollTo(active - 1)}
        disabled={active === 0}
        className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-3 text-xl text-white ring-1 ring-white/10 backdrop-blur transition hover:bg-black/70 disabled:opacity-0 sm:block"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Next game"
        onClick={() => scrollTo(active + 1)}
        disabled={active === games.length - 1}
        className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-3 text-xl text-white ring-1 ring-white/10 backdrop-blur transition hover:bg-black/70 disabled:opacity-0 sm:block"
      >
        ›
      </button>

      {/* Dots */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {games.map((game, i) => (
          <button
            key={game.href}
            type="button"
            aria-label={`Go to ${game.title}`}
            onClick={() => scrollTo(i)}
            className={`h-2 rounded-full transition-all ${
              i === active ? "w-6 bg-white" : "w-2 bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
