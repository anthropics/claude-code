export function Hero() {
  return (
    <section className="mx-auto max-w-4xl px-5 pt-16 pb-10 text-center md:px-8 md:pt-24 md:pb-14">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-white/60 px-4 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />
        <span className="font-sans text-xs uppercase tracking-[0.18em] text-muted">
          Premium prompt optimiser
        </span>
      </div>
      <h1 className="font-display text-5xl leading-[1.05] text-ink md:text-[5.5rem] md:leading-[0.98] text-balance">
        Your prompts,
        <br />
        <span className="italic text-amber">perfected.</span>
      </h1>
      <p className="mx-auto mt-7 max-w-xl font-sans text-lg leading-relaxed text-muted md:text-xl">
        Paste any prompt. Get something that actually works.
      </p>
    </section>
  );
}
