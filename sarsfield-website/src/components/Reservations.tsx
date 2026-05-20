"use client";

import FadeIn from "./FadeIn";

export default function Reservations() {
  return (
    <section id="reservations" className="bg-dark px-8 py-24 text-center">
      <div className="mx-auto max-w-[1200px]">
        <FadeIn>
          <div className="mb-4 text-[0.75rem] font-medium tracking-[3px] uppercase text-amber">
            Book a Table
          </div>
          <h2 className="mb-6 font-serif text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.2] text-cream">
            Make a Reservation
          </h2>
          <p className="mx-auto max-w-[600px] text-[1.05rem] font-light leading-[1.8] text-text-secondary">
            Reserve your spot in our Dining Room, Taproom, or on the Deck.
          </p>
        </FadeIn>

        <FadeIn>
          <div className="relative mx-auto mt-12 max-w-[700px] overflow-hidden rounded-xl border border-dark-border bg-dark-surface p-8 sm:p-12">
            {/* Top accent line */}
            <div
              className="absolute top-0 right-0 left-0 h-[3px]"
              style={{
                background:
                  "linear-gradient(to right, transparent, #c8a45c, transparent)",
              }}
            />

            <h3 className="mb-4 font-serif text-[1.8rem] text-cream">
              Reserve Your Table
            </h3>
            <p className="mb-8 leading-[1.7] text-text-secondary">
              Book online through TouchBistro Dine and secure your table in just
              a few clicks. Walk-ins are always welcome too!
            </p>

            {/*
              ============================================
              TOUCHBISTRO INTEGRATION
              ============================================
              To embed your TouchBistro reservation widget:
              1. Log in to your TouchBistro Reservations portal
              2. Go to Settings > Integration
              3. Click "Click here to learn how to integrate Bookenda to your website"
              4. Copy the HTML snippet provided
              5. Replace the placeholder div below with your snippet
              ============================================
            */}
            <div
              id="touchbistro-widget"
              className="mb-6 rounded-lg border-2 border-dashed border-dark-border bg-dark-elevated p-8"
            >
              <p className="text-[0.9rem] text-text-dim">
                &#128197; TouchBistro reservation widget goes here.
                <br />
                <small>
                  Paste your Bookenda/TouchBistro Dine embed code to replace
                  this placeholder.
                </small>
              </p>
            </div>

            <a
              href="tel:9025425555"
              className="inline-block rounded bg-amber px-8 py-3.5 text-[0.85rem] font-semibold tracking-[1.5px] uppercase text-dark no-underline transition-all hover:bg-amber-light hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(200,164,92,0.3)]"
            >
              Call to Reserve: (902) 542-5555
            </a>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <span className="text-[0.85rem] text-text-dim">
                or email us at
              </span>
              <a
                href="mailto:info@theportpub.com"
                className="text-[0.95rem] font-medium text-amber no-underline transition-colors hover:text-amber-light"
              >
                info@theportpub.com
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
