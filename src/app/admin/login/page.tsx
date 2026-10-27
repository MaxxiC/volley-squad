import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Accesso staff" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="grid min-h-screen place-items-center px-5 py-8">
      <div className="flex w-full max-w-[400px] flex-col gap-8">
        <div className="flex flex-col items-start gap-4.5">
          <Image src="/logo.png" alt="Logo CUSBros" width={72} height={72} priority className="block size-18" />
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-sm font-semibold tracking-[.28em] text-gold uppercase">Area staff</span>
            <h1 className="font-display text-5xl leading-[.9] font-extrabold uppercase">Accedi</h1>
          </div>
        </div>
        <LoginForm callbackUrl={callbackUrl} />
        <p className="text-[13px] leading-normal text-faint">
          Accesso riservato a staff e statistici. I permessi dipendono dal ruolo assegnato.
        </p>
      </div>
    </div>
  );
}
