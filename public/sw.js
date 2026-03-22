const CACHE_NAME = 'noah-v2-nextjs';

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Next.js App Router sets up its own client routing and caching.
            // We just cache the manifest and icon to satisfy PWA requirements.
            return cache.addAll([
                '/manifest.json',
                '/img/NOAH.png'
            ]).catch(err => {
                console.error('SW installation caching failed', err);
            });
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (e) => {
    // For Next.js, we mostly let the network handle it, unless offline.
    e.respondWith(
        fetch(e.request).catch(async () => {
            const cache = await caches.match(e.request);
            if (cache) return cache;
        })
    );
});
