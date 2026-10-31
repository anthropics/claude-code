"use client";

import { useState, useEffect } from "react";

const navItems = [
  { label: "Our Story", href: "#about" },
  { label: "Spaces", href: "#spaces" },
  { label: "Menu", href: "#menu" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b border-dark-border transition-all duration-300 ${
        scrolled
          ? "bg-dark/98 shadow-[0_4px_30px_rgba(0,0,0,0.4)]"
          : "bg-dark/92"
      }`}
      style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="mx-auto flex h-[70px] max-w-[1200px] items-center justify-between px-8">
        <a
          href="#"
          className="font-serif text-[1.3rem] font-bold tracking-[2px] uppercase text-amber no-underline"
        >
          The Sarsfield Group
        </a>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-8 list-none md:flex">
          {navItems.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="text-[0.85rem] font-medium tracking-[1.5px] uppercase text-text-secondary no-underline transition-colors hover:text-amber"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href="#reservations"
              className="rounded bg-amber px-5 py-2 text-[0.85rem] font-semibold tracking-[1.5px] uppercase text-dark no-underline transition-all hover:bg-amber-light hover:-translate-y-0.5"
            >
              Make a Reservation
            </a>
          </li>
        </ul>

        {/* Mobile toggle */}
        <button
          className="flex flex-col gap-[5px] bg-transparent border-none cursor-pointer p-2 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          <span
            className={`block h-0.5 w-6 bg-text-primary transition-all ${
              mobileOpen ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-text-primary transition-all ${
              mobileOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-text-primary transition-all ${
              mobileOpen ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <ul className="flex flex-col gap-6 border-b border-dark-border bg-dark/98 p-8 list-none md:hidden">
          {navItems.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-[0.85rem] font-medium tracking-[1.5px] uppercase text-text-secondary no-underline transition-colors hover:text-amber"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href="#reservations"
              onClick={() => setMobileOpen(false)}
              className="inline-block rounded bg-amber px-5 py-2 text-[0.85rem] font-semibold tracking-[1.5px] uppercase text-dark no-underline"
            >
              Make a Reservation
            </a>
          </li>
        </ul>
      )}
    </nav>
  );
}
