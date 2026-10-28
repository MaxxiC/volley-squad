// Service worker di CUSBros: serve solo ad aprire il Live senza rete (in palestra).
// - Pagina /admin/live/<id>: prima la rete (con un limite di attesa), altrimenti l'ultima copia salvata.
// - File statici di Next (/_next/static, con hash nel nome), logo e icone: dalla cache se ci sono.
// Tutto il resto (sito pubblico, altre pagine admin, API) passa dritto alla rete.
// Le azioni fatte offline non passano di qui: le salva il Live su IndexedDB e le invia al ritorno della rete.
const VERSION = "v1";
const PAGES = `cusbros-pages-${VERSION}`;
const ASSETS = `cusbros-assets-${VERSION}`;
const LIVE_PAGE = /^\/admin\/live\/\d+\/?$/;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== PAGES && key !== ASSETS) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const sameOrigin = (url) => url.origin === self.location.origin;
const isAsset = (url) =>
  sameOrigin(url) && (url.pathname.startsWith("/_next/static/") || /^\/(logo|icon|apple-icon)[^/]*\.png$/.test(url.pathname));
/** Una sola copia per partita, senza query string. */
const pageKey = (url) => new URL(url.pathname.replace(/\/$/, ""), self.location.origin).href;
/** Solo risposte vere della pagina (non redirect al login né errori). */
const cacheable = (res) => res.ok && res.type === "basic" && !res.redirected;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" && sameOrigin(url) && LIVE_PAGE.test(url.pathname)) event.respondWith(livePage(event, url));
  else if (isAsset(url)) event.respondWith(asset(req));
});

async function livePage(event, url) {
  const cache = await caches.open(PAGES);
  const network = fetch(event.request).then(async (res) => {
    if (cacheable(res)) await cache.put(pageKey(url), res.clone());
    return res;
  });
  // Anche se si risponde con la copia, la rete continua e aggiorna la cache.
  event.waitUntil(network.catch(() => {}));
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, null));
  const fast = await Promise.race([network.catch(() => null), timeout]);
  if (fast) return fast;
  const cached = await cache.match(pageKey(url), { ignoreVary: true });
  if (cached) return cached;
  // Nessuna copia: si aspetta la rete fino in fondo, poi la pagina di cortesia.
  return network.catch(() => offlinePage());
}

async function asset(req) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(req, { ignoreVary: true });
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

function offlinePage() {
  const html = `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!-- Colori dei token del tema (bg, ink, gold): qui non arriva il CSS dell'app. -->
<title>Offline · CUSBros</title><body style="margin:0;background:#0b0b0c;color:#f3efe6;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;text-align:center">
<div><h1 style="font-size:22px">Sei offline</h1><p>Questa pagina del Live non è ancora salvata sul telefono.<br>Aprila una volta con la rete, poi funzionerà anche senza.</p>
<p><a href="" style="color:#d4ae62">Riprova</a></p></div></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// La pagina del Live, appena aperta, chiede di salvare sé stessa e i file che ha caricato: alla
// prima visita il service worker non era ancora attivo e non li ha visti passare.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data?.type !== "cache-live" || typeof data.url !== "string") return;
  event.waitUntil(
    (async () => {
      const url = new URL(data.url);
      if (!sameOrigin(url) || !LIVE_PAGE.test(url.pathname)) return;
      const pages = await caches.open(PAGES);
      const res = await fetch(url.pathname, { credentials: "same-origin" }).catch(() => null);
      if (res && cacheable(res)) await pages.put(pageKey(url), res);
      const assets = await caches.open(ASSETS);
      for (const href of Array.isArray(data.assets) ? data.assets : []) {
        const a = new URL(href, self.location.origin);
        if (!isAsset(a) || (await assets.match(a.href))) continue;
        const r = await fetch(a.href).catch(() => null);
        if (r?.ok) await assets.put(a.href, r);
      }
      event.source?.postMessage({ type: "cache-live-done" });
    })(),
  );
});
