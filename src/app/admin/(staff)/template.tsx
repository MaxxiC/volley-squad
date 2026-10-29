/**
 * Si rimonta a ogni cambio di sezione dello staff (Partite, Giocatori, Live, Storico): la pagina
 * entra con una breve dissolvenza. Ripete la colonna di <main> nel layout (gap compreso).
 */
export default function StaffTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-fade flex flex-col gap-6">{children}</div>;
}
