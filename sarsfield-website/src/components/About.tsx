"use client";

import FadeIn from "./FadeIn";

const features = [
  { title: "Locally Crafted", desc: "Beer, cider & seltzers brewed with care" },
  { title: "Historic Building", desc: "The Mason Apples building, rich in apple history" },
  { title: "Waterfront Views", desc: "Deck overlooking the Minas Basin tides" },
  { title: "Community Hub", desc: "A gathering spot for locals and visitors alike" },
];

export default function About() {
  return (
    <section id="about" className="bg-dark-surface px-8 py-24">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid items-center gap-16 md:grid-cols-2">
          <FadeIn>
            <div className="mb-4 text-[0.75rem] font-medium tracking-[3px] uppercase text-amber">
              Our Story
            </div>
            <h2 className="mb-6 font-serif text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.2] text-cream">
              Where History &amp; Community Come Together
            </h2>
            <div className="mb-8 h-0.5 w-[60px] bg-amber" />
            <p className="mb-4 max-w-[600px] text-[1.05rem] font-light leading-[1.8] text-text-secondary">
              Nestled in Port Williams, Nova Scotia, The Sarsfield Group is more
              than a restaurant &mdash; it&apos;s a gathering place steeped in
              the rich heritage of the Annapolis Valley. Housed in the historic
              Mason Apples building, our taproom is a destination for
              exceptional, crafted beverages and a taste of local culture.
            </p>
            <p className="max-w-[600px] text-[1.05rem] font-light leading-[1.8] text-text-secondary">
              Whether you&apos;re a local or a visitor, we invite you to
              experience the lively atmosphere and the history of Port Williams
              wharf. From our deck overlooking the Minas Basin tides to our cozy
              taproom, every visit is a chance to connect with community.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-lg border-l-[3px] border-amber bg-dark-elevated p-5"
                >
                  <h4 className="mb-1 font-serif text-base text-cream">
                    {f.title}
                  </h4>
                  <p className="text-[0.85rem] leading-[1.5] text-text-secondary">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn>
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-dark-elevated">
              <div className="p-8 text-center text-text-dim">
                <div className="mb-4 text-5xl opacity-50">&#127866;</div>
                <p className="text-[0.85rem]">
                  Replace with a photo of
                  <br />
                  The Port Taproom
                </p>
              </div>
              <div className="pointer-events-none absolute -right-2.5 -bottom-2.5 -z-10 h-full w-full rounded-lg border border-amber/30" />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
