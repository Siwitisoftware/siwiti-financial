// Mfumo wa Fedha - Service Worker
// Huwezesha app kusakinishwa (installable) na kupakiwa hata bila mtandao (offline app-shell).
// Taarifa za wanachama/miamala/viongozi zenyewe zinahifadhiwa tofauti kwenye localStorage
// (ndani ya financial.html), hivyo service worker hii inashughulikia tu faili za app (HTML/CSS/JS/icons).
//
// KUMBUKA KUHUSU MATOLEO (VERSIONS): Ukurasa mkuu (HTML) daima unatumia "mtandao kwanza",
// hivyo mabadiliko yake yanaonekana papo hapo ukiwa na mtandao. Faili tuli (icons/manifest)
// zinatumia "stale-while-revalidate" - zinaonyeshwa haraka kutoka cache, huku toleo jipya
// likipakuliwa kimya kimya nyuma na kuhifadhiwa kwa ajili ya ufunguzi ujao. Kama ukibadilisha
// muundo mkubwa wa faili (mfano kuongeza/kuondoa faili kwenye APP_SHELL), badilisha namba ya
// CACHE_NAME hapa chini (mfano kutoka v1 kwenda v2) ili kulazimisha kusafisha cache za zamani.

const CACHE_NAME = 'mfumo-wa-fedha-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Install: hifadhi app-shell kwenye cache - FAILI MOJA BAADA YA JINGINE (siyo
// "cache.addAll" ya pamoja), ili tuweze kutuma "progress" HALISI kwa ukurasa
// (SW_INSTALL_PROGRESS) - hii inaruhusu "progress bar" ya ukurasa kuonesha hatua
// za kweli za usakinishaji badala ya kuiga tu
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const total = APP_SHELL.length;
      let done = 0;
      for (const url of APP_SHELL) {
        try {
          await cache.add(url);
        } catch (e) {
          // Endapo faili moja halikupatikana (mfano jina tofauti la index),
          // usisimamishe usakinishaji - endelea na yanayofuata
        }
        done++;
        try {
          const clients = await self.clients.matchAll({ type: 'window' });
          clients.forEach((client) => client.postMessage({ type: 'SW_INSTALL_PROGRESS', done, total }));
        } catch (e) {
          // Kutuma ujumbe kumeshindwa - haizuii usakinishaji kuendelea
        }
      }
    })()
  );
  self.skipWaiting();
});

// Activate: futa cache za zamani, kisha waarifu kurasa zote kuwa toleo jipya liko tayari
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }));
      })
  );
});

// Fetch: "network first" kwa ukurasa mkuu; "stale-while-revalidate" kwa faili tuli
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ruka maombi ya API/nje ya app shell (mfano Google Apps Script), yaachie mtandao pekee
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) {
    return;
  }

  // Ukurasa mkuu wa HTML: jaribu mtandao kwanza, kisha rudi kwenye cache ukiwa nje ya mtandao
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('/index.html')))
    );
    return;
  }

  // Faili nyingine (CSS/JS/icons): rudisha cache mara moja (haraka), huku ukipakua
  // toleo jipya nyuma kimya kimya na kuliweka tayari kwa ufunguzi ujao (stale-while-revalidate)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});
