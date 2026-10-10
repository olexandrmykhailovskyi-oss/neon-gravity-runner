/**
 * sw.js — Service Worker для офлайн-режиму Neon Gravity Runner.
 * - Precache усіх файлів гри при встановленні (надійний офлайн з першого візиту)
 * - Network-first з runtime-кешем: свіжі файли коли є мережа,
 *   кеш підхоплює коли офлайн (гру можна грати без інтернету).
 * - Старі кеші чистяться при активації (версія в імені кешу).
 */
const CACHE = 'ngr-v3';
const ASSETS = [
    './',
    'index.html',
    'style.css',
    'manifest.json',
    'icon.svg',
    'core/app_config.js',
    'core/logger.js',
    'core/safe_storage.js',
    'core/state.js',
    'core/config.js',
    'core/utils.js',
    'core/collision.js',
    'core/i18n.js',
    'core/cloud_storage.js',
    'core/global_scores.js',
    'core/analytics.js',
    'core/boot.js',
    'core/main.js',
    'fx/audio.js',
    'fx/particles.js',
    'fx/floating_text.js',
    'fx/background.js',
    'fx/effects.js',
    'ui/skins.js',
    'ui/achievements.js',
    'ui/ui.js',
    'ui/screens.js',
    'ui/editor.js',
    'ui/hud.js',
    'ui/input.js',
    'gameplay/player.js',
    'gameplay/obstacle.js',
    'gameplay/obstacles.js',
    'gameplay/bonus.js',
    'gameplay/bonuses.js',
    'gameplay/storm.js',
    'gameplay/scoring.js',
    'gameplay/levels.js',
    'gameplay/modes.js',
    'gameplay/game.js'
];

self.addEventListener('install', function (event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE).then(function (cache) {
            // Кожен файл окремо — щоб одна помилка не вбивала весь precache
            return Promise.all(ASSETS.map(function (url) {
                return cache.add(url).catch(function () {});
            }));
        })
    );
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
                // Навігація без кеша — віддаємо index.html (SPA-стиль офлайн)
                if (req.mode === 'navigate') {
                    return caches.match('index.html');
                }
                return Response.error();
            });
        })
    );
});
