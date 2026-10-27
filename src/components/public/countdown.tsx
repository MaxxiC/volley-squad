"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Conto alla rovescia verso `target` (ISO), aggiornato ogni secondo. */
export function Countdown({ target }: { target: string }) {
  // null fino al mount: l'ora del server non coincide con quella del client.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const s = now === null ? null : Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
  const units = [
    { label: "Giorni", value: s === null ? null : Math.floor(s / 86400) },
    { label: "Ore", value: s === null ? null : Math.floor((s % 86400) / 3600) },
    { label: "Min", value: s === null ? null : Math.floor((s % 3600) / 60) },
    { label: "Sec", value: s === null ? null : s % 60 },
  ];

  return (
    <div
      role="timer"
      className="grid max-w-[560px] grid-cols-4 gap-px overflow-hidden rounded-tile border border-line bg-line"
    >
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center gap-1 bg-bg px-2 py-[clamp(12px,3vw,18px)]">
          <span className="font-display text-[clamp(32px,8vw,52px)] leading-none font-bold text-ink tabular-nums">
            {u.value === null ? "--" : pad(u.value)}
          </span>
          <span className="text-xs font-semibold tracking-[.14em] text-muted uppercase">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
