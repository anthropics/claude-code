"use client";

import clsx from "clsx";
import { LoadingSpinner } from "./LoadingSpinner";
import { GOALS, TARGET_AIS, type Goal, type Mode, type TargetAI } from "@/lib/types";

type Props = {
  prompt: string;
  onPromptChange: (v: string) => void;
  targetAI: TargetAI;
  onTargetAIChange: (v: TargetAI) => void;
  goal: Goal;
  onGoalChange: (v: Goal) => void;
  mode: Mode;
  onSubmit: () => void;
  loading: boolean;
  disabled?: boolean;
};

export function InputForm({
  prompt,
  onPromptChange,
  targetAI,
  onTargetAIChange,
  goal,
  onGoalChange,
  mode,
  onSubmit,
  loading,
  disabled,
}: Props) {
  const submitLabel = mode === "quick" ? "Optimise My Prompt" : "Start Deep Build";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="w-full"
    >
      <div className="group relative rounded-2xl border border-line bg-white shadow-soft transition focus-within:border-amber/60 focus-within:shadow-card">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Paste your rough prompt here..."
          rows={6}
          disabled={loading}
          className={clsx(
            "block w-full resize-y rounded-2xl bg-transparent px-5 py-5",
            "font-sans text-base text-ink placeholder:text-muted/70",
            "focus:outline-none",
            "disabled:opacity-60",
          )}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Dropdown
          id="targetAI"
          label="Target AI"
          value={targetAI}
          options={TARGET_AIS}
          onChange={(v) => onTargetAIChange(v as TargetAI)}
          disabled={loading}
        />
        <Dropdown
          id="goal"
          label="Your Goal"
          value={goal}
          options={GOALS}
          onChange={(v) => onGoalChange(v as Goal)}
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading || disabled}
        className={clsx(
          "mt-6 flex w-full items-center justify-center gap-3 rounded-2xl",
          "bg-amber px-6 py-4 font-sans text-base font-semibold text-white",
          "shadow-soft transition-all duration-200",
          "hover:bg-amber-hover hover:shadow-card hover:-translate-y-[1px]",
          "active:translate-y-0",
          "disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0",
        )}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            <span>Working on it...</span>
          </>
        ) : (
          <span>{submitLabel}</span>
        )}
      </button>
    </form>
  );
}

function Dropdown({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="group block rounded-2xl border border-line bg-white px-4 py-3 shadow-soft transition hover:border-amber/50 focus-within:border-amber/60"
    >
      <span className="block font-sans text-[0.7rem] uppercase tracking-[0.18em] text-muted">
        {label}
      </span>
      <div className="relative mt-0.5">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={clsx(
            "block w-full appearance-none bg-transparent pr-8",
            "font-sans text-base font-medium text-ink",
            "focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </label>
  );
}
