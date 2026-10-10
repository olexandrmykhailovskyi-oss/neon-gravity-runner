/**
 * AppConfig.js — конфігурація застосунку (винесена з index.html).
 *
 * Раніше конфіг був inline-скриптом у index.html; винесено окремим файлом,
 * щоб працювала сувора Content-Security-Policy без 'unsafe-inline'.
 *
 * Поля supabaseUrl/supabaseKey — це ПУБЛІЧНИЙ (publishable/anon) ключ,
 * він призначений для використання в браузері. Якщо поля порожні —
 * гра працює суто локально.
 */
(function () {
    'use strict';

    window.NGR_CLOUD_CONFIG = {
        supabaseUrl: 'https://obndgiyemhbdxbaqipbw.supabase.co',
        supabaseKey: 'sb_publishable_9iCCuk5Cq02sY_ZoLdAGCQ_qieoz9Fo'
    };

    // Версія застосунку (використовується на екрані «Про гру»)
    window.NGR_VERSION = '1.2.0';
})();
