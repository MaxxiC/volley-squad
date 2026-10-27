import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Partite" };

export default function Page() {
  return <ComingSoon title="Partite" step={3} />;
}
