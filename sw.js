// Service Worker for docs.vienthietke.com
// Strategy: network-first cho HTML (lấy bản mới nếu có mạng, fallback cache khi offline)
//           cache-first cho asset tĩnh (icon, manifest)
// Bump CACHE_VERSION khi đổi chiến lược / format cache.

const CACHE_VERSION = 'v1';
const CACHE_NAME = `docs-vtt-${CACHE_VERSION}`;

// Precache — tự cập nhật bởi scripts/build-index.mjs
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/vivo/vivo_x200_ultra_camera_handbook_v3.html',
  '/vivo/vivo_x200_ultra_camera_handbook_v2.html',
  '/vivo/vivo_x200_ultra_camera_handbook.html',
  '/tiet-kiem-dau-tu/phan_bo_5_trieu_ui_ux_landing_page.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {
        // Cho phép precache fail từng file (vd icon chưa upload) — không block install
        return Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)));
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.');

  if (isHTML) {
    // Network-first cho HTML
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Cache-first cho asset
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
