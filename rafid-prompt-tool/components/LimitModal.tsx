"use client";

import { useEffect } from "react";

export function LimitModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="limit-modal-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-3xl border-2 border-amber bg-bg p-8 shadow-card md:p-10">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />
          <span className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-amber">
            Daily limit reached
          </span>
        </div>
        <h2
          id="limit-modal-title"
          className="font-display text-3xl text-ink md:text-[2.25rem] md:leading-[1.15]"
        >
          You&apos;re out of free prompts
        </h2>
        <p className="mt-4 font-sans text-base leading-relaxed text-ink/75">
          You&apos;ve used your 3 free optimisations for today. Pro access coming
          soon — check back tomorrow or join the waitlist.
        </p>
        <div className="mt-7 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line bg-white px-5 py-2.5 font-sans text-sm font-medium text-ink transition hover:border-ink/40"
          >
            Close
          </button>
          <a
            href="#"
            className="rounded-full bg-amber px-6 py-2.5 text-center font-sans text-sm font-semibold text-white shadow-soft transition hover:bg-amber-hover"
          >
            Join Waitlist
          </a>
        </div>
      </div>
    </div>
  );
}
