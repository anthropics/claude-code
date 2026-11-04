"use client";

import { useState } from "react";
import FadeIn from "./FadeIn";

type MenuItem = {
  name: string;
  abv: string;
  desc: string;
};

type MenuCategory = {
  key: string;
  label: string;
  subtitle: string;
  items: MenuItem[];
};

const categories: MenuCategory[] = [
  {
    key: "beer",
    label: "Beer",
    subtitle: "Beer \u00B7 Brig&Barq",
    items: [
      { name: "Lager", abv: "4.5% ABV", desc: "Czech-style pale lager with malt flavours, floral hops, and a clean, dry finish." },
      { name: "Red Ale", abv: "5.5% ABV", desc: "Malt-forward with caramel sweetness, subtle hop bitterness, and a smooth finish." },
      { name: "Session IPA", abv: "3.5% ABV", desc: "Bright orange peel for a zesty citrus kick, easy-drinking and refreshing." },
      { name: "IPA", abv: "5.7% ABV", desc: "Grapefruit, orange, and tropical fruit flavours with a balanced finish." },
      { name: "Big IPA", abv: "6.8% ABV", desc: "Bold West Coast IPA with citrusy aromas, balanced bitterness, and a crisp finish." },
      { name: "Light Lager", abv: "3.5% ABV", desc: "Crisp and clean with a light body, subtle malt sweetness, and a refreshing finish." },
      { name: "Baltic Porter", abv: "9.0% ABV", desc: "Dark chocolate, roasted coffee, and dried fruit. Smooth and warming." },
      { name: "Stout", abv: "5.5% ABV", desc: "Rich dark chocolate, coffee, and caramel with a velvety texture." },
      { name: "Lemonade Radler", abv: "4.0% ABV", desc: "Zesty citrus with a hint of sweetness. Light and effervescent." },
    ],
  },
  {
    key: "cider",
    label: "Cider",
    subtitle: "Cider \u00B7 Moonrise Ridge",
    items: [
      { name: "Wild Blueberry", abv: "5.3% ABV", desc: "Medium dry with wine-like character, rich blueberry, and a hint of plum." },
      { name: "Perfect Pear", abv: "5.3% ABV", desc: "Delicate pear, apple, and citrus notes. Refreshing and versatile." },
      { name: "Juicy Peach", abv: "5.3% ABV", desc: "Fruit-forward with vibrant peach aroma. Smooth and refreshing." },
      { name: "Honey Crisp Apple", abv: "6.0% ABV", desc: "Bold apple flavour with crisp vinous notes and a rounded mouthfeel." },
    ],
  },
  {
    key: "seltzer",
    label: "Seltzer",
    subtitle: "Seltzer \u00B7 Luna",
    items: [
      { name: "Blackberry", abv: "5.5% ABV", desc: "Only 1g sugar. Bold, ripe blackberry with a crisp, clean finish." },
      { name: "Gin Fizz", abv: "5.5% ABV", desc: "Only 1g sugar. Classic gin fizz inspired, crisp and effervescent." },
      { name: "Hard Iced Tea", abv: "5.5% ABV", desc: "Made with vodka and real lemon tea. Smooth and refreshing." },
    ],
  },
];

export default function Menu() {
  const [activeTab, setActiveTab] = useState("beer");
  const active = categories.find((c) => c.key === activeTab)!;

  return (
    <section id="menu" className="bg-dark-surface px-8 py-24">
      <div className="mx-auto max-w-[1200px]">
        <FadeIn>
          <div className="mb-12 text-center">
            <div className="mb-4 text-[0.75rem] font-medium tracking-[3px] uppercase text-amber">
              What We Pour
            </div>
            <h2 className="mb-6 font-serif text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.2] text-cream">
              On Tap
            </h2>
            <p className="mx-auto max-w-[600px] text-[1.05rem] font-light leading-[1.8] text-text-secondary">
              All of our craft beverages are brewed locally. Come taste the
              difference.
            </p>
          </div>
        </FadeIn>

        {/* Tabs */}
        <div className="mb-12 flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={`cursor-pointer rounded px-6 py-2.5 text-[0.8rem] font-semibold tracking-[1.5px] uppercase transition-all ${
                activeTab === cat.key
                  ? "border border-amber bg-amber text-dark"
                  : "border border-dark-border bg-transparent text-text-secondary hover:border-amber hover:bg-amber hover:text-dark"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Active category */}
        <div>
          <h3 className="mb-8 border-b border-dark-border pb-2 text-center font-serif text-[1.5rem] text-amber">
            {active.subtitle}
          </h3>

          <div className="mb-8 flex flex-col items-center gap-2 rounded bg-dark-elevated px-6 py-3 text-[0.9rem] font-semibold tracking-[1px] text-amber sm:flex-row sm:justify-center sm:gap-8">
            <span>12oz &mdash; $6</span>
            <span>16oz &mdash; $7</span>
            <span>20oz &mdash; $8</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.items.map((item) => (
              <div
                key={item.name}
                className="rounded-lg border border-dark-border bg-dark-elevated p-5 transition-colors hover:border-amber"
              >
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-serif text-[1.1rem] font-semibold text-cream">
                    {item.name}
                  </span>
                  <span className="ml-2 text-[0.8rem] font-semibold whitespace-nowrap text-amber">
                    {item.abv}
                  </span>
                </div>
                <p className="text-[0.85rem] leading-[1.5] text-text-secondary">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
