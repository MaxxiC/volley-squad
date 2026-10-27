import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Giocatori" };

export default function Page() {
  return <ComingSoon title="Giocatori" step={3} />;
}
