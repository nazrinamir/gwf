"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ExitButton({
  label = "Exit",
  destination = "/",
}: {
  label?: string;
  destination?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900/70 px-3 py-1.5 text-sm font-medium text-zinc-400 ring-1 ring-white/8 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <span aria-hidden className="text-base leading-none">
          ←
        </span>
        {label}
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-dialog-title"
        >
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setConfirming(false)}
          />

          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-linear-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/12 animate-rise">
            <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-rose-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-2xl ring-1 ring-rose-400/30">
                🚪
              </span>
              <h2
                id="exit-dialog-title"
                className="mt-4 text-xl font-bold tracking-tight text-zinc-50"
              >
                Leave game night?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Your current round won&apos;t be saved. Everyone will need to
                start over.
              </p>

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-2xl bg-zinc-800/90 py-3.5 text-sm font-semibold text-zinc-200 ring-1 ring-white/8 transition hover:bg-zinc-700"
                >
                  Keep playing
                </button>
                <button
                  type="button"
                  onClick={() => router.push(destination)}
                  className="flex-1 rounded-2xl bg-rose-600 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(225,29,72,0.35)] transition hover:bg-rose-500"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
