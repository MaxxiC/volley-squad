import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { LOGIN_PATH } from "@/auth.config";
import { TEAM_NAME } from "@/lib/club";
import { AdminTabs } from "./admin-tabs";
import { LogoutButton } from "./logout-button";

const ROLE_LABEL = { admin: "Admin", coach: "Allenatore" } as const;

/** "Marco Rossi" → "Marco R." */
function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  // Il middleware protegge già /admin; questo controllo copre il caso in cui venga saltato.
  const session = await auth();
  if (!session?.user) redirect(LOGIN_PATH);
  const { name, role } = session.user;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-5 border-b border-line-soft bg-bg">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2.5 px-admin pt-3">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={32} height={32} className="block size-8" />
            <span className="font-display text-lg font-bold tracking-[.08em] uppercase">{TEAM_NAME}</span>
            <span className="mr-auto font-display text-[13px] font-semibold tracking-[.2em] text-gold uppercase">
              Staff
            </span>
            <span className="min-w-0 truncate text-[13px] text-muted">
              {name ? `${shortName(name)} · ` : ""}
              {ROLE_LABEL[role]}
            </span>
            <LogoutButton
              logout={async () => {
                "use server";
                await signOut({ redirectTo: LOGIN_PATH });
              }}
            />
          </div>
          <AdminTabs />
        </div>
      </header>

      <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-admin pt-7 pb-18">{children}</main>
    </div>
  );
}
