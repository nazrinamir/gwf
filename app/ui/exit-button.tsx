"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ExitButton({
  label = "Exit",
  destination = "/",
}: {
  label?: string;
  destination?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        ← {label}
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 text-center ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-4xl">🚪</span>
            <h2 className="mt-3 text-lg font-bold">Exit the game?</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Are you sure you want to exit? This will clear your current game
              progress.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => router.push(destination)}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
