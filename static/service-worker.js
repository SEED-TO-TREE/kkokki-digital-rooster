const CACHE_NAME = 'kkokki-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/static/style.css',
    '/static/app.js',
    '/static/assets/icon_kkokki_main_1769947399319.png',
    '/static/assets/char_kkokki_idle_1769947451923.png',
    '/static/assets/char_kkokki_panic_1769947468467.png',
    '/static/assets/bg_home_sunny_1769947415146.png',
    '/static/assets/bg_home_stormy_delay_1769947430952.png',
    '/static/assets/ui_btn_journey_1769947501593.png',
    '/static/assets/icon_set_weather_traffic_1769947517891.png',
    '/static/assets/ui_bubble_frame_1769947484928.png',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Network-first for API calls
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify({ error: 'Offline' }), {
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        );
        return;
    }

    // Cache-first for everything else
    event.respondWith(
        caches.match(event.request).then(cached =>
            cached || fetch(event.request).then(response => {
                // Cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
        )
    );
});
