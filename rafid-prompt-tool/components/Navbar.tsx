export function Navbar() {
  return (
    <header className="w-full border-b border-line/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8 md:py-6">
        <div className="flex items-baseline gap-2">
          <span className="wordmark text-ink">Rafid</span>
          <span className="font-sans text-xs uppercase tracking-[0.22em] text-muted hidden sm:inline">
            Prompt Tool
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="hidden h-px w-8 bg-line sm:block"
          />
          <span className="font-sans text-sm text-muted italic">
            Built different.
          </span>
        </div>
      </div>
    </header>
  );
}
