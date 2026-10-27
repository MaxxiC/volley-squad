import Image from "next/image";
import Link from "next/link";

const MAX_WIDTH = {
  wide: "max-w-[1200px]",
  narrow: "max-w-[1000px]",
};

type PublicShellProps = {
  width: keyof typeof MAX_WIDTH;
  navLink: { href: string; label: string };
  watermark?: boolean;
  children: React.ReactNode;
};

export function PublicShell({ width, navLink, watermark = false, children }: PublicShellProps) {
  const maxWidth = MAX_WIDTH[width];

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {watermark && (
        <Image
          src="/logo.png"
          alt=""
          width={582}
          height={582}
          sizes="900px"
          className="pointer-events-none absolute -top-[10vw] -right-[18vw] z-0 h-auto w-[clamp(420px,70vw,900px)] opacity-6 grayscale"
        />
      )}

      <nav className={`relative z-1 mx-auto flex items-center gap-4 px-gutter py-4.5 ${maxWidth}`}>
        <Link href="/" className="mr-auto flex items-center gap-3 text-ink hover:text-ink">
          <Image src="/logo.png" alt="Logo CUSBros" width={40} height={40} priority className="block size-10" />
          <span className="font-display text-xl font-bold tracking-[.08em] uppercase">CUSBros</span>
        </Link>
        <Link
          href={navLink.href}
          className="inline-flex min-h-11 items-center rounded-chip border border-line-strong px-4.5 py-2.5 font-display text-base font-semibold tracking-[.1em] text-ink uppercase hover:border-gold hover:text-gold"
        >
          {navLink.label}
        </Link>
      </nav>

      {children}

      <footer className={`relative z-1 mx-auto border-t border-line-soft px-gutter pt-6 pb-10 text-[13px] text-faint ${maxWidth}`}>
        CUSBros Volleyball Team · CUSB
      </footer>
    </div>
  );
}
