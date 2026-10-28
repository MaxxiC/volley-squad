"use client";

// Logo della squadra con riserva: se l'immagine non arriva (es. limiti del piano gratuito di Vercel
// sulle immagini) al suo posto compare 🏐 della stessa misura, così l'intestazione non resta vuota.
import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = Omit<ImageProps, "src" | "width" | "height" | "onError"> & {
  /** Lato in px dell'immagine richiesta (il logo è quadrato). */
  size?: number;
  /** Filigrana decorativa: se manca l'immagine non si mostra nulla. */
  decorative?: boolean;
};

export function Logo({ size = 582, decorative = false, alt, className, ...props }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Errore arrivato prima che React fosse pronto ad ascoltarlo.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    if (decorative) return null;
    return (
      <svg viewBox="0 0 100 100" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={className}>
        <text x="50" y="54" fontSize="78" textAnchor="middle" dominantBaseline="middle">
          🏐
        </text>
      </svg>
    );
  }
  return <Image ref={ref} src="/logo.png" alt={alt} width={size} height={size} onError={() => setFailed(true)} className={className} {...props} />;
}
