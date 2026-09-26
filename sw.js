const CACHE_NAME = 'lan-taigi-static-v3';
const AUDIO_CACHE = 'lan-taigi-audio-v1';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/components.css',
  './js/app.js',
  './js/storage.js',
  './js/audio-manager.js',
  './js/tone-synth.js',
  './js/lessons.js',
  './js/speech-evaluator.js',
  './js/srs-engine.js',
  './js/level-map.js',
  './js/snack-map.js',
  './js/dict.js',
  './js/quiz.js',
  './js/annesia.js',
  './js/phonology.js',
  './js/jszip.min.js',
  './icons/icon.svg',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/lessons_data.json',
  './data/taiwan_snacks.json',
  './data/phonology_data.json',
  './data/dict_index.json',
  './data/annesia_data.json',
  './data/dialects.json',
  './data/mandarin_comparison.json',
  './data/surnames.json',
  './audio/1.mp3',
  './audio/10059.mp3',
  './audio/1012.mp3',
  './audio/10287.mp3',
  './audio/10581.mp3',
  './audio/1062.mp3',
  './audio/10682.mp3',
  './audio/1093.mp3',
  './audio/10943.mp3',
  './audio/11203.mp3',
  './audio/11380.mp3',
  './audio/11390.mp3',
  './audio/1168.mp3',
  './audio/12031.mp3',
  './audio/12058.mp3',
  './audio/12076.mp3',
  './audio/12368.mp3',
  './audio/12385.mp3',
  './audio/1242.mp3',
  './audio/12472.mp3',
  './audio/12673.mp3',
  './audio/12876.mp3',
  './audio/13052.mp3',
  './audio/13074.mp3',
  './audio/13206.mp3',
  './audio/13225.mp3',
  './audio/1408.mp3',
  './audio/162.mp3',
  './audio/1682.mp3',
  './audio/180.mp3',
  './audio/1826.mp3',
  './audio/1975.mp3',
  './audio/2059.mp3',
  './audio/2142.mp3',
  './audio/22101.mp3',
  './audio/2232.mp3',
  './audio/2272.mp3',
  './audio/2296.mp3',
  './audio/2415.mp3',
  './audio/2489.mp3',
  './audio/2585.mp3',
  './audio/2605.mp3',
  './audio/2633.mp3',
  './audio/2706.mp3',
  './audio/2756.mp3',
  './audio/2868.mp3',
  './audio/320.mp3',
  './audio/3390.mp3',
  './audio/3448.mp3',
  './audio/353.mp3',
  './audio/3656.mp3',
  './audio/3879.mp3',
  './audio/40.mp3',
  './audio/4035.mp3',
  './audio/41.mp3',
  './audio/4208.mp3',
  './audio/44.mp3',
  './audio/4427.mp3',
  './audio/4508.mp3',
  './audio/4520.mp3',
  './audio/4524.mp3',
  './audio/4555.mp3',
  './audio/4558.mp3',
  './audio/4621.mp3',
  './audio/48.mp3',
  './audio/4924.mp3',
  './audio/4968.mp3',
  './audio/5062.mp3',
  './audio/5127.mp3',
  './audio/519.mp3',
  './audio/5307.mp3',
  './audio/54.mp3',
  './audio/5452.mp3',
  './audio/5567.mp3',
  './audio/5570.mp3',
  './audio/565.mp3',
  './audio/5729.mp3',
  './audio/5764.mp3',
  './audio/578.mp3',
  './audio/629.mp3',
  './audio/7018.mp3',
  './audio/7136.mp3',
  './audio/7397.mp3',
  './audio/7580.mp3',
  './audio/7630.mp3',
  './audio/7784.mp3',
  './audio/794.mp3',
  './audio/8174.mp3',
  './audio/8178.mp3',
  './audio/8188.mp3',
  './audio/8287.mp3',
  './audio/8623.mp3',
  './audio/8738.mp3',
  './audio/8764.mp3',
  './audio/9037.mp3',
  './audio/9192.mp3',
  './audio/967.mp3',
  './audio/9727.mp3',
  './audio/9861.mp3',
  './audio/9920.mp3',
];

// Install Event - Precache app shell and bundled audio
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching core assets and audio...');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== AUDIO_CACHE) {
            console.log('[SW] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-while-revalidate for assets, Cache-first for audio
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Audio streaming from official MOE or local audio directory
  if (url.pathname.includes('/media/senn/mp3/') || url.pathname.endsWith('.mp3')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(async (audioCache) => {
        // 1. Check audio cache
        const cachedResponse = await audioCache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. Check static cache for bundled audio
        const staticCache = await caches.open(CACHE_NAME);
        const staticMatch = await staticCache.match(event.request);
        if (staticMatch) {
          return staticMatch;
        }

        // 3. If online, fetch and cache
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            audioCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          console.warn('[SW] Audio fetch failed (offline)', event.request.url);
          // Fallback or empty audio header
          return new Response(null, { status: 503, statusText: 'Offline audio unavailable' });
        }
      })
    );
    return;
  }

  // App Shell & Data: Cache First with network update
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        // Fetch in background to revalidate if online
        fetch(event.request).then((freshResponse) => {
          if (freshResponse && freshResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, freshResponse));
          }
        }).catch(() => {/* Offline, ignore */});
        return response;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
