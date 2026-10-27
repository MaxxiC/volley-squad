import { PartiteSubNav } from "./sub-nav";

export default function PartiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PartiteSubNav />
      {children}
    </>
  );
}
