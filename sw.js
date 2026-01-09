const CACHE_NAME = 'maimoon-pro-v3';
const ASSETS = [
    './',
    './index.html',
    './script.js',
    './style.css',  // <--- ADD THIS LINE
    './manifest.json',
    './logo.png'
];

// --- INSTALL: Pre-cache the App Shell ---
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Maimoon Pro: Pre-caching System Files');
            return cache.addAll(ASSETS);
        })
    );
});

// --- ACTIVATE: Clean up old caches ---
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

// --- FETCH: Serve from cache, fallback to network ---
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            
            return fetch(event.request).catch(() => {
                // If network fails and no cache, show a basic offline message if needed
                console.log('Maimoon Pro: Connection Lost - Running Offline');
            });
        })
    );

});
