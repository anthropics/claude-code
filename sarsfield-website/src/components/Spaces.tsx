"use client";

import FadeIn from "./FadeIn";

const spaces = [
  {
    icon: "&#127860;",
    title: "The Dining Room",
    desc: "Enjoy a full dining experience with locally-sourced dishes in a warm, inviting atmosphere. Perfect for date nights, family dinners, or catching up with friends.",
  },
  {
    icon: "&#127867;",
    title: "The Taproom",
    desc: "The heart of The Sarsfield Group. Sample our rotating selection of craft beers, ciders, and seltzers in a space where history and community come together.",
  },
  {
    icon: "&#127749;",
    title: "The Deck",
    desc: "Soak in the stunning views of the Minas Basin tides from our outdoor deck. The perfect spot on a summer evening with a cold drink in hand.",
  },
];

export default function Spaces() {
  return (
    <section id="spaces" className="bg-dark px-8 py-24">
      <div className="mx-auto max-w-[1200px]">
        <FadeIn>
          <div className="mb-4 text-center text-[0.75rem] font-medium tracking-[3px] uppercase text-amber">
            Our Spaces
          </div>
          <h2 className="mb-6 text-center font-serif text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.2] text-cream">
            Three Ways to Experience Us
          </h2>
          <p className="mx-auto max-w-[600px] text-center text-[1.05rem] font-light leading-[1.8] text-text-secondary">
            Each space offers its own character &mdash; from the warmth of the
            dining room to the breeze on the deck.
          </p>
        </FadeIn>

        <div className="mx-auto mt-12 grid max-w-[500px] gap-8 md:max-w-none md:grid-cols-3">
          {spaces.map((space) => (
            <FadeIn key={space.title}>
              <div className="overflow-hidden rounded-lg border border-dark-border bg-dark-surface transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
                <div
                  className="flex h-[200px] items-center justify-center bg-dark-elevated text-5xl"
                  dangerouslySetInnerHTML={{ __html: space.icon }}
                />
                <div className="p-6">
                  <h3 className="mb-2 font-serif text-[1.4rem] text-cream">
                    {space.title}
                  </h3>
                  <p className="text-[0.9rem] leading-[1.6] text-text-secondary">
                    {space.desc}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
