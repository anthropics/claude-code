export default function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-screen items-center justify-center overflow-hidden text-center"
      style={{
        background:
          "linear-gradient(to bottom, rgba(13,13,13,0.3) 0%, rgba(13,13,13,0.6) 50%, rgba(13,13,13,0.95) 100%), linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #1a1a2e 100%)",
      }}
    >
      {/* Subtle radial highlights */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(200,164,92,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(15,52,96,0.2) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 max-w-[800px] px-8">
        <div className="mb-8 inline-block border border-amber px-5 py-1.5 text-[0.75rem] font-medium tracking-[3px] uppercase text-amber">
          Port Williams, Nova Scotia
        </div>
        <h1 className="mb-6 font-serif text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[1.1] text-cream">
          Come Taste the Difference{" "}
          <em className="text-amber">Local</em> Makes
        </h1>
        <p className="mx-auto mb-10 max-w-[550px] text-[1.1rem] font-light leading-[1.8] text-text-secondary">
          Sit, relax, and enjoy the friendly atmosphere in our Dining Room,
          Taproom, and on our Deck overlooking the Minas Basin tides.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="#reservations"
            className="inline-block rounded bg-amber px-8 py-3.5 text-[0.85rem] font-semibold tracking-[1.5px] uppercase text-dark no-underline transition-all hover:bg-amber-light hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(200,164,92,0.3)]"
          >
            Make a Reservation
          </a>
          <a
            href="#menu"
            className="inline-block rounded border border-cream-muted px-8 py-3.5 text-[0.85rem] font-semibold tracking-[1.5px] uppercase text-cream no-underline transition-all hover:border-amber hover:text-amber hover:-translate-y-0.5"
          >
            View Our Menu
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <a
          href="#about"
          className="flex flex-col items-center gap-2 text-[0.7rem] tracking-[2px] uppercase text-text-dim no-underline transition-colors hover:text-amber"
        >
          <span>Scroll</span>
          <div
            className="h-10 w-px"
            style={{
              background: "linear-gradient(to bottom, #c8a45c, transparent)",
              animation: "scrollPulse 2s ease-in-out infinite",
            }}
          />
        </a>
      </div>
    </section>
  );
}
