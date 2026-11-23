// Service worker: permite abrir la app sin conexión. Sube VERSION cuando cambies archivos.
const VERSION = 'finanzas-v2';
const ARCHIVOS = [
  './', 'index.html', 'styles.css', 'config.js', 'manifest.webmanifest',
  'vendor/preact-htm.js', 'vendor/supabase.js',
  'js/app.js', 'js/ui.js', 'js/store.js', 'js/sync.js', 'js/fechas.js', 'js/proyeccion.js', 'js/calculos.js', 'js/defaults.js', 'js/recordatorios.js',
  'js/pantallas/inicio.js', 'js/pantallas/movimientos.js', 'js/pantallas/plan.js', 'js/pantallas/registrar.js', 'js/pantallas/ajustes.js',
  'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Red primero (para recibir actualizaciones); si no hay conexión, usa la copia guardada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
