"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SEGMENTED, segmentClass } from "@/components/ui/segmented";

const LINKS = [
  { href: "/admin/partite", label: "Calendario" },
  { href: "/admin/partite/classifica", label: "Classifica" },
];

/** Segmentato Calendario / Classifica dentro la sezione Partite. */
export function PartiteSubNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Partite" className={SEGMENTED}>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={segmentClass(active)}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
