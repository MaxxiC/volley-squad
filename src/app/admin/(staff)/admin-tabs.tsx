"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/partite", label: "Partite" },
  { href: "/admin/giocatori", label: "Giocatori" },
  { href: "/admin/live", label: "Live" },
  { href: "/admin/storico", label: "Storico live" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sezioni staff" className="-mx-2 flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-2.5 py-3 font-display text-base tracking-[.1em] whitespace-nowrap uppercase ${active ? "border-gold font-bold text-gold hover:text-gold" : "border-transparent font-semibold text-muted hover:text-ink"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
