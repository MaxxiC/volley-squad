import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CUSBros — Volleyball Team",
  description: "Sito della squadra di pallavolo CUSBros · CUSB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  );
}
