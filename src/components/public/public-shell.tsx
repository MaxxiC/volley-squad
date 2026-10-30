import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { TEAM_NAME } from "@/lib/club";

const MAX_WIDTH = {
  wide: "max-w-[1200px]",
  narrow: "max-w-[1000px]",
};

type PublicShellProps = {
  width: keyof typeof MAX_WIDTH;
  /** Link in alto a destra (le altre pagine del sito). */
  navLinks: { href: string; label: string }[];
  watermark?: boolean;
  children: React.ReactNode;
};

export function PublicShell({ width, navLinks, watermark = false, children }: PublicShellProps) {
  const maxWidth = MAX_WIDTH[width];

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {watermark && (
        <Logo
          decorative
          alt=""
          sizes="900px"
          className="pointer-events-none absolute -top-[10vw] -right-[18vw] z-0 h-auto w-[clamp(420px,70vw,900px)] opacity-6 grayscale"
        />
      )}

      <nav className={`relative z-1 mx-auto flex items-center gap-2 px-gutter py-4.5 sm:gap-3 ${maxWidth}`}>
        <Link href="/" className="mr-auto flex min-h-11 min-w-0 items-center gap-3 text-ink hover:text-ink">
          <Logo size={40} alt={`Logo ${TEAM_NAME}`} priority className="block size-10 shrink-0" />
          {/* Sui telefoni stretti resta solo il logo, così i link stanno sulla stessa riga. */}
          <span className="font-display text-xl font-bold tracking-[.08em] uppercase max-[400px]:sr-only">{TEAM_NAME}</span>
        </Link>
        {navLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex min-h-11 items-center rounded-chip whitespace-nowrap border border-line-strong px-3 py-2.5 font-display text-[15px] font-semibold tracking-[.08em] text-ink uppercase hover:border-gold hover:text-gold sm:px-4.5 sm:text-base sm:tracking-[.1em]"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {children}

      <footer className={`relative z-1 mx-auto border-t border-line-soft px-gutter pt-6 pb-10 text-[13px] text-faint ${maxWidth}`}>
        {TEAM_NAME} Volleyball Team · CUSB
      </footer>
    </div>
  );
}
