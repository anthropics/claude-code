"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export function CopyButton({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — flash a brief fail state by doing nothing.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5",
        "font-sans text-xs font-medium uppercase tracking-wider text-ink",
        "transition hover:border-amber hover:text-amber",
        copied && "border-amber text-amber",
        className,
      )}
    >
      <CopyIcon copied={copied} />
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
