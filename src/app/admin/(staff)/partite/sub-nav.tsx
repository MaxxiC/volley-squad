"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/partite", label: "Calendario" },
  { href: "/admin/partite/classifica", label: "Classifica" },
];

/** Segmentato Calendario / Classifica dentro la sezione Partite. */
export function PartiteSubNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Partite" className="flex gap-1 self-start rounded-tile border border-line p-1">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-seg px-4.5 font-display text-base font-semibold tracking-[.08em] uppercase ${active ? "bg-gold text-bg hover:text-bg" : "text-ink hover:text-gold"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
