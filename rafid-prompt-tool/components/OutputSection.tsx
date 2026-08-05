"use client";

import { CopyButton } from "./CopyButton";

type Props = {
  original: string;
  optimised: string;
  explanation: string;
};

export function OutputSection({ original, optimised, explanation }: Props) {
  return (
    <section className="mt-14 animate-fadeIn">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl text-ink md:text-3xl">
          The result
        </h2>
        <span className="hidden font-sans text-xs uppercase tracking-[0.18em] text-muted sm:inline">
          Before / After
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          label="Your original"
          muted
          text={original}
        />

        <Card
          label="Optimised version"
          text={optimised}
          accent
          topRight={<CopyButton value={optimised} />}
        />
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-white/60 p-6 shadow-soft md:p-8">
        <h3 className="font-display text-xl text-ink md:text-2xl">
          What changed &amp; why
        </h3>
        <p className="mt-3 font-sans text-base leading-relaxed text-ink/85">
          {explanation}
        </p>
      </div>
    </section>
  );
}

function Card({
  label,
  text,
  muted,
  accent,
  topRight,
}: {
  label: string;
  text: string;
  muted?: boolean;
  accent?: boolean;
  topRight?: React.ReactNode;
}) {
  return (
    <div
      className={
        muted
          ? "rounded-2xl border border-line bg-white/50 p-6 shadow-soft"
          : "rounded-2xl border border-amber/40 bg-white p-6 shadow-card ring-1 ring-amber/10 md:p-7"
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className={
            accent
              ? "font-sans text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-amber"
              : "font-sans text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"
          }
        >
          {label}
        </span>
        {topRight}
      </div>
      <pre
        className={
          muted
            ? "whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-muted"
            : "whitespace-pre-wrap break-words font-sans text-[0.95rem] leading-relaxed text-ink"
        }
      >
        {text}
      </pre>
    </div>
  );
}
