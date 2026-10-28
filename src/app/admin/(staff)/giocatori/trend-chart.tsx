"use client";

// Grafico Andamento (README → Andamento): efficienza partita per partita del fondamentale scelto,
// linea oro con punti, griglia ogni 50%, bande della finestra di 3 partite migliore (oro) e
// peggiore (rossa). Sul telefono non c'è il passaggio del mouse: si tocca un punto e sotto compare
// la lettura; "Vedi i numeri" apre l'elenco dei valori.
import { useState } from "react";
import { bestWorstWindows, formatPct } from "@/lib/stats";

export type TrendPoint = { label: string; title: string; value: number; total: number };

// Area di disegno piccola apposta: su un telefono da 320px le scritte restano sopra i 10px.
const W = 340;
const H = 200;
const LEFT = 46;
const RIGHT = 10;
const TOP = 12;
const BOTTOM = 166;

export function TrendChart({ points, skillLabel }: { points: TrendPoint[]; skillLabel: string }) {
  const [selected, setSelected] = useState(points.length - 1);
  const current = points[Math.min(selected, points.length - 1)];
  const values = points.map((p) => p.value);
  // L'efficienza può essere negativa (es. attacco con più errori che punti): l'asse scende a passi di 50.
  const min = Math.min(0, Math.floor(Math.min(...values) / 50) * 50);
  const grid = Array.from({ length: (100 - min) / 50 + 1 }, (_, i) => min + i * 50);
  const x = (i: number) => (points.length === 1 ? (LEFT + W - RIGHT) / 2 : LEFT + 10 + (i * (W - RIGHT - LEFT - 20)) / (points.length - 1));
  const y = (v: number) => BOTTOM - ((v - min) / (100 - min)) * (BOTTOM - TOP);
  const step = points.length > 1 ? x(1) - x(0) : 40;
  const windows = bestWorstWindows(values);
  const band = (start: number, size: number) => ({ x: x(start) - step / 2, width: x(start + size - 1) - x(start) + step });
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const range = (start: number, size: number) => `${points[start].label}–${points[start + size - 1].label}`;

  return (
    <div className="flex flex-col gap-2.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Andamento ${skillLabel}: ${points.map((p) => `${p.label} ${formatPct(p.value)}`).join(", ")}`}>
        {windows && (
          <>
            <rect {...band(windows.best.start, windows.size)} y={TOP} height={BOTTOM - TOP} rx={6} className="fill-gold" fillOpacity={0.12} />
            <rect {...band(windows.worst.start, windows.size)} y={TOP} height={BOTTOM - TOP} rx={6} className="fill-red" fillOpacity={0.12} />
          </>
        )}
        {grid.map((v) => (
          <g key={v}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(v)} y2={y(v)} className="stroke-line-soft" strokeWidth={1} />
            <text x={LEFT - 6} y={y(v) + 5} textAnchor="end" className="fill-faint font-sans text-[14px]">
              {formatPct(v)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-gold" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r={i === selected ? 6 : 5} className={`stroke-gold ${i === selected ? "fill-gold" : "fill-bg"}`} strokeWidth={2.5} />
            <text x={x(i)} y={H - 10} textAnchor="middle" className={`font-sans text-[13px] ${i === selected ? "fill-gold" : "fill-faint"}`}>
              {p.label}
            </text>
            {/* Bersaglio più grande del punto, per il dito. */}
            <rect
              x={x(i) - step / 2}
              y={0}
              width={step}
              height={H}
              fill="transparent"
              className="cursor-pointer"
              role="button"
              aria-label={`${p.title}: ${formatPct(p.value)}`}
              onClick={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
            />
          </g>
        ))}
      </svg>

      <p aria-live="polite" className="text-sm text-ink-2">
        <span className="font-semibold text-gold">{formatPct(current.value)}</span> · {current.title} ·{" "}
        {current.total === 1 ? "1 azione" : `${current.total} azioni`}
      </p>
      {windows && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-2">
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-3.5 rounded-[4px] bg-gold/35" />
            Periodo migliore: {range(windows.best.start, windows.size)} ({formatPct(windows.best.avg)})
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-3.5 rounded-[4px] bg-red/35" />
            Periodo peggiore: {range(windows.worst.start, windows.size)} ({formatPct(windows.worst.avg)})
          </span>
        </div>
      )}
      <details className="text-[13px] text-muted">
        <summary className="min-h-11 cursor-pointer content-center">Vedi i numeri</summary>
        <ul className="flex flex-col gap-1 pt-1">
          {points.map((p, i) => (
            <li key={i} className="flex justify-between gap-3 border-b border-line-soft py-1">
              <span className="min-w-0 truncate">{p.title}</span>
              <span className="whitespace-nowrap text-ink">
                {formatPct(p.value)} · {p.total} az.
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
