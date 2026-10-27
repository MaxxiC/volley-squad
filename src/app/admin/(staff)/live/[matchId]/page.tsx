import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Live" };

// Il Live vero e proprio arriva nel passo 4.2 (tabellone, inserimento azioni, registro eventi).
export default function LiveMatchPage() {
  return <ComingSoon title="Live" step={4} />;
}
