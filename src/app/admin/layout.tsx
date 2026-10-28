import type { Metadata } from "next";

// L'area staff non va indicizzata. Aggiunta alla schermata Home diventa l'app "CUSBros Staff" che si
// apre su /admin (in modalità app non c'è la barra degli indirizzi e il sito pubblico non linka l'admin).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "CUSBros Staff", statusBarStyle: "black" },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
