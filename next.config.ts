import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il service worker del Live va sempre riletto, così gli aggiornamenti arrivano subito.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};

export default nextConfig;
