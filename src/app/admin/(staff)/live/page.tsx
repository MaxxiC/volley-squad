import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Live" };

export default function Page() {
  return <ComingSoon title="Live" step={4} />;
}
