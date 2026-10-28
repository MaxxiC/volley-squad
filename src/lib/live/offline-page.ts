// Registrazione del service worker (public/sw.js) dalla pagina del Live, solo nella build di
// produzione: in sviluppo la cache dei file di Next darebbe versioni vecchie dopo ogni modifica.

/** Cancella le pagine del Live salvate dal service worker (all'uscita dall'area staff). */
export async function clearLivePages() {
  try {
    for (const key of await caches.keys()) if (key.startsWith("cusbros-pages-")) await caches.delete(key);
  } catch {
    // Cache non disponibile.
  }
}

/** Registra il service worker e gli chiede di salvare questa pagina e i file che ha caricato. */
export async function keepLivePageOffline() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  try {
    // Già controllata: pagina e file sono passati dal service worker e sono in cache.
    const controlled = Boolean(navigator.serviceWorker.controller);
    await navigator.serviceWorker.register("/sw.js");
    if (controlled) return;
    const reg = await navigator.serviceWorker.ready;
    const assets = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((href) => new URL(href).pathname.startsWith("/_next/static/"));
    reg.active?.postMessage({ type: "cache-live", url: location.href, assets });
  } catch {
    // Senza service worker il Live funziona lo stesso, solo non si riapre offline.
  }
}
