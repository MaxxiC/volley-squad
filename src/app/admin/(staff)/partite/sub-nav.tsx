"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { SEGMENTED, segmentClass } from "@/components/ui/segmented";

const LINKS = [
  { href: "/admin/partite", label: "Calendario" },
  { href: "/admin/partite/classifica", label: "Classifica" },
  { href: "/admin/partite/ufficiale", label: "Ufficiale" },
];

/** Segmentato Calendario / Classifica / Ufficiale (sito ufficiale) dentro la sezione Partite. */
export function PartiteSubNav() {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  // La voce attiva sempre in vista, anche quando la barra scorre (telefoni stretti).
  useEffect(() => {
    const current = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav.current && current) nav.current.scrollLeft = current.offsetLeft - nav.current.offsetLeft - 4;
  }, [pathname]);

  return (
    // Sugli schermi stretti scorre la barra, non la pagina.
    <nav ref={nav} aria-label="Partite" className={`${SEGMENTED} overflow-x-auto`}>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`${segmentClass(active)} shrink-0`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
