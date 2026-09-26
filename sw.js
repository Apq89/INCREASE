// Service worker: permite instalar a app e abrir o jogo sem internet.
// Quando mudares os ficheiros, sobe a versão para os jogadores receberem a nova.
const CACHE = 'increase-v6';
const ASSETS = ['./', './index.html', './config.js', './cloud.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return; // Supabase, fontes e CDN vão sempre à rede
  // Página: tenta a rede primeiro (para ter a versão mais recente); sem rede, usa a cópia
  if(req.mode === 'navigate'){
    e.respondWith(fetch(req).then(r=>{ const copy = r.clone(); caches.open(CACHE).then(c=>c.put('./index.html', copy)); return r; }).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>hit || fetch(req)));
});
