"use client";

import clsx from "clsx";
import type { Mode } from "@/lib/types";

export function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Optimisation mode"
      className="inline-flex items-center gap-2 rounded-full border border-line bg-white p-1.5 shadow-soft"
    >
      <PillButton
        active={mode === "quick"}
        onClick={() => onChange("quick")}
        disabled={disabled}
        label="Quick Optimise"
        icon="⚡"
      />
      <PillButton
        active={mode === "deep"}
        onClick={() => onChange("deep")}
        disabled={disabled}
        label="Deep Build"
        icon="🎯"
      />
    </div>
  );
}

function PillButton({
  active,
  onClick,
  disabled,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "relative flex items-center gap-2 rounded-full px-5 py-2.5",
        "font-sans text-sm font-medium transition-all duration-300",
        "disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "bg-amber text-white shadow-soft"
          : "text-ink/70 hover:text-ink hover:bg-amber/5",
      )}
    >
      <span aria-hidden="true" className="text-base">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
