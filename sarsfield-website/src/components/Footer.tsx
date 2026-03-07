const footerLinks = [
  { label: "About", href: "#about" },
  { label: "Menu", href: "#menu" },
  { label: "Reservations", href: "#reservations" },
  { label: "Contact", href: "#contact" },
];

export default function Footer() {
  return (
    <footer className="border-t border-dark-border bg-dark px-8 py-12">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
        <div className="font-serif text-[1.1rem] font-bold tracking-[2px] uppercase text-amber">
          The Sarsfield Group
        </div>
        <p className="text-[0.8rem] text-text-dim">
          &copy; {new Date().getFullYear()} The Sarsfield Group. All rights reserved.
        </p>
        <ul className="flex list-none gap-6">
          {footerLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-[0.8rem] text-text-secondary no-underline transition-colors hover:text-amber"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
