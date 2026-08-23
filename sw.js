/**
 * sw.js — Service Worker для офлайн-режиму Neon Gravity Runner.
 * - Network-first з runtime-кешем: свіжі файли коли є мережа,
 *   кеш підхоплює коли офлайн (гру можна грати без інтернету).
 * - Старі кеші чистяться при активації (версія в імені кешу).
 */
const CACHE = 'ngr-v1';

self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) { return k !== CACHE; })
                    .map(function (k) { return caches.delete(k); })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    const req = event.request;
    if (req.method !== 'GET') return;

    // Supabase та інші сторонні API — тільки мережа, не кешуємо
    if (!req.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(req).then(function (res) {
            try {
                if (res && res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE).then(function (c) { c.put(req, clone); });
                }
            } catch (e) {}
            return res;
        }).catch(function () {
            return caches.match(req).then(function (cached) {
                if (cached) return cached;
                // Навігація без кеша — віддаємо index.html з кеша (SPA-стиль офлайн)
                if (req.mode === 'navigate') {
                    return caches.match('index.html');
                }
                return Response.error();
            });
        })
    );
});
