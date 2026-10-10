/**
 * bench.mjs — измеримый бенчмарк производительности игры.
 *
 * Поднимает локальный статический сервер, запускает самый тяжёлый сценарий
 * (кампания, уровень 35, все типы перешкод, качество ULTRA) и меряет время
 * кадра через requestAnimationFrame: avg / p50 / p95 / FPS.
 *
 * Запуск: node scripts/bench.mjs [секунды]
 * Результат: JSON в stdout + bench-result.json
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4190;
const DURATION_S = Number(process.argv[2]) || 10;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
};

const server = http.createServer(function (req, res) {
    let urlPath;
    try {
        urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
        res.writeHead(400); res.end('Bad Request'); return;
    }
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (filePath !== ROOT && filePath.indexOf(ROOT + path.sep) !== 0) {
        res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.stat(filePath, function (err, stats) {
        const target = (!err && stats.isDirectory()) ? path.join(filePath, 'index.html') : filePath;
        fs.readFile(target, function (readErr, data) {
            if (readErr) { res.writeHead(404); res.end('Not Found'); return; }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' });
            res.end(data);
        });
    });
});

await new Promise(function (resolve) { server.listen(PORT, '127.0.0.1', resolve); });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:' + PORT + '/');
await page.waitForSelector('#screen-main:not(.hidden)', { timeout: 20000 });

// Самый тяжёлый сценарий: уровень 35 (все типы перешкод), ULTRA-качество.
// Игрока держим бессмертным, чтобы сцена не «остывала» после смерти.
await page.evaluate(function () {
    window.State.data.tutorialDone = true;
    window.State.save();
    window.State.setSetting('quality', 3);
    window.Game.startCampaignLevel(35);
    window.__benchKeepAlive = setInterval(function () {
        try { window.Player.alive = true; window.Player.ghost = 60; } catch (e) {}
    }, 100);
});

// Метрика: чисте CPU-час кадру (update + render), БЕЗ requestAnimationFrame.
// rAF у headless-браузері жорстко обмежений ~30 FPS, тому міряти інтервал кадрів
// безглуздо — він показує ліміт браузера, а не вартість гри. Синхронний прогін
// N кадрів дає реальну вартість одного кадру в мілісекундах.
const stats = await page.evaluate(function (iterations) {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    // Форсує растеризацію: Canvas 2D лише ставить команди в чергу, тож без
    // читання пікселя заміряний час не включає реальну вартість малювання.
    const flush = function () { ctx.getImageData(0, 0, 1, 1); };

    // Гравець безсмертний — інакше update() виходить на першому ж кадрі після
    // смерті й ми міряємо порожню сцену замість реальної гри.
    const keepAlive = function () {
        try { window.Player.alive = true; window.Player.ghost = 60; } catch (e) {}
    };

    // Прогрів: наповнюємо сцену перешкодами/частинками (600 кадрів ≈ 9.6 с)
    for (let i = 0; i < 600; i++) { keepAlive(); window.Game.update(0.016); window.Game.render(); }
    flush();

    const times = [];
    for (let i = 0; i < iterations; i++) {
        keepAlive();
        const t0 = performance.now();
        window.Game.update(0.016);
        window.Game.render();
        flush();
        times.push(performance.now() - t0);
    }

    const sorted = times.slice().sort(function (a, b) { return a - b; });
    const pick = function (p) { return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; };
    const avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
    return {
        frames: iterations,
        avgMs: Number(avg.toFixed(3)),
        p50Ms: Number(pick(0.5).toFixed(3)),
        p95Ms: Number(pick(0.95).toFixed(3)),
        fps: Number((1000 / avg).toFixed(1)),
        obstacles: window.Obstacles.getList().length,
        scene: 'campaign L35, quality ULTRA (CPU-час кадру)'
    };
}, Math.max(200, DURATION_S * 60));

await page.evaluate(function () { clearInterval(window.__benchKeepAlive); });
await browser.close();
server.close();

console.log(JSON.stringify(stats, null, 2));
fs.writeFileSync(path.join(ROOT, 'bench-result.json'), JSON.stringify(stats, null, 2) + '\n');
