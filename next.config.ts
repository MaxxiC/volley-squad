import type { NextConfig } from "next";

/**
 * Intestazioni di sicurezza per tutte le pagine: niente inclusione in cornici di altri siti (clic
 * "rubati" nell'area staff), niente indovinare il tipo dei file, referrer ridotto, niente
 * fotocamera/microfono/posizione. La CSP non limita script e stili (Next ne usa di inline), solo
 * cornici, form e plugin.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Nessuna intestazione che dica con cosa è fatto il sito.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Il service worker del Live va sempre riletto, così gli aggiornamenti arrivano subito.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
