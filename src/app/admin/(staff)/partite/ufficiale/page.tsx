import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { OFFICIAL_CALENDAR_URL, OFFICIAL_GROUP } from "@/lib/club";
import { OfficialSync } from "./official-sync";

export const metadata: Metadata = { title: "Sito ufficiale" };

export default function UfficialePage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        kicker={`Girone ${OFFICIAL_GROUP}`}
        title="Sito ufficiale"
        description={
          <>
            Legge calendario, risultati e classifica dal{" "}
            <a href={OFFICIAL_CALENDAR_URL} target="_blank" rel="noreferrer">
              sito del comitato
            </a>{" "}
            solo quando premi il bottone, e mostra cosa cambierebbe prima di applicarlo. Le partite registrate con il Live non si
            toccano.
          </>
        }
      />
      <OfficialSync />
    </div>
  );
}
