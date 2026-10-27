import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Storico live" };

export default function Page() {
  return <ComingSoon title="Storico live" step={5} />;
}
