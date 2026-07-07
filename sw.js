const CACHE = 'fallgarden-v1';
const ASSETS = ['./', './index.html', './fall-kit.js', './manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
    if (resp && resp.status===200 && e.request.method==='GET'){
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
    }
    return resp;
  }).catch(()=>caches.match('./index.html'))));
});
