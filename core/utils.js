/**
 * Utils.js — математичні та загальні утиліти.
 * Чисті функції без стану + генератор випадкових чисел із сідом для Daily Challenge.
 */
(function () {
    'use strict';

    function clamp(v, min, max) {
        if (typeof v !== 'number' || isNaN(v)) v = 0;
        if (typeof min !== 'number' || isNaN(min)) min = 0;
        if (typeof max !== 'number' || isNaN(max)) max = v;
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function rand(min, max) {
        if (min === undefined) return Math.random();
        if (max === undefined) { max = min; min = 0; }
        if (min > max) { const t = min; min = max; max = t; }
        return Math.random() * (max - min) + min;
    }

    function randInt(min, max) {
        return Math.floor(rand(min, max + 1));
    }

    function chance(p) {
        if (typeof p !== 'number' || isNaN(p)) return false;
        if (p <= 0) return false;
        if (p >= 1) return true;
        return Math.random() < p;
    }

    function randItem(arr) {
        if (!arr || !arr.length) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function hexToRgba(hex, alpha) {
        if (typeof alpha !== 'number' || isNaN(alpha)) alpha = 1;
        if (typeof hex !== 'string') return 'rgba(255,255,255,' + alpha + ')';
        let h = hex.replace('#', '').trim();
        if (h.length === 3) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        if (h.length !== 6) return 'rgba(255,255,255,' + alpha + ')';
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            return 'rgba(255,255,255,' + alpha + ')';
        }
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function formatNumber(n) {
        if (typeof n !== 'number' || isNaN(n)) return '0';
        n = Math.floor(n);
        if (n < 1000) return String(n);
        if (n < 1000000) {
            return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return (n / 1000000).toFixed(2).replace(/\.00$/, '').replace(/\.0$/, '') + 'M';
    }

    function formatTime(seconds) {
        if (typeof seconds !== 'number' || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function uid() {
        return 'id_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    }

    // Отримання рядка поточної дати (YYYY-MM-DD)
    function getTodayString() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    // Детермінований PRNG (Mulberry32) за числовим сідом
    function createRng(seed) {
        let s = Math.abs(typeof seed === 'number' ? seed : 123456789);
        return function () {
            let t = (s += 0x6D2B79F5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Створення сіда з рядка дати
    function seedFromString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    window.Utils = {
        clamp: clamp,
        lerp: lerp,
        rand: rand,
        randInt: randInt,
        chance: chance,
        randItem: randItem,
        distance: distance,
        hexToRgba: hexToRgba,
        formatNumber: formatNumber,
        formatTime: formatTime,
        uid: uid,
        getTodayString: getTodayString,
        createRng: createRng,
        seedFromString: seedFromString
    };
})();
