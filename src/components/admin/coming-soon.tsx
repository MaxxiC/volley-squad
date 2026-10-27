import { PageHeader } from "./page-header";

/** Segnaposto per le sezioni staff non ancora costruite. */
export function ComingSoon({ title, step }: { title: string; step: number }) {
  return <PageHeader title={title} description={`In arrivo nello step ${step} della roadmap.`} />;
}
