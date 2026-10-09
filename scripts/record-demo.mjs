/**
 * record-demo.mjs — запис короткого геймплею для подальшої конвертації в GIF.
 *
 * Піднімає власний статичний сервер на порту 4180, запускає Chromium
 * через Playwright, грає ~10 секунд і зберігає відео у docs/media/_video.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// ---- Константи ----

const PORT = 4180;
const HOST = '127.0.0.1';
const VIDEO_DIR = path.resolve('docs/media/_video');
const GAME_DURATION_MS = 10_000;      // тривалість запису геймплею
const FLIP_INTERVAL_MS = 350;        // інтервал між фліпами гравця
const BOOT_TIMEOUT_MS = 15_000;      // таймаут очікування завантаження гри

// ---- Визначення кореня репозиторію ----

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ---- Типи MIME для статичних файлів ----

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
};

/**
 * Визначає Content-Type за розширенням файлу.
 * @param {string} filePath — шлях до файлу
 * @returns {string} MIME-тип
 */
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Перевіряє, чи шлях не виходить за межі кореня репозиторію (path traversal).
 * @param {string} requestedPath — запитуваний шлях
 * @returns {boolean} true, якщо шлях безпечний
 */
function isPathSafe(requestedPath) {
    // Нормалізуємо шлях: прибираемо початковий слеш та замінюємо слеші на системні
    const normalized = requestedPath.replace(/^\/+/, '').replace(/\//g, path.sep);
    const resolved = path.resolve(ROOT, normalized);
    return resolved === ROOT || resolved.startsWith(ROOT + path.sep);
}

// ---- Статичний сервер ----

/**
 * Створює HTTP-сервер, що роздає статичні файли з кореня репозиторію.
 * @returns {http.Server} сервер
 */
function createServer() {
    return http.createServer((req, res) => {
        // Декодуємо URL та видаляємо query-рядок
        let urlPath;
        try {
            urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
        } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('400 Bad Request');
            return;
        }

        // Захист від path traversal
        if (!isPathSafe(urlPath)) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('403 Forbidden');
            return;
        }

        // Якщо запит на корінь — віддаємо index.html
        let filePath = path.join(ROOT, urlPath);
        if (urlPath === '/' || urlPath === '') {
            filePath = path.join(ROOT, 'index.html');
        }

        // Перевіряємо, чи файл існує і є файлом (не директорією)
        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Not Found');
                return;
            }

            const contentType = getContentType(filePath);
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': stats.size,
                'Cache-Control': 'no-cache',
            });
            fs.createReadStream(filePath).pipe(res);
        });
    });
}

// ---- Допоміжні функції ----

/**
 * Знаходить файл .webm у вказаній директорії.
 * @param {string} dir — директорія для пошуку
 * @returns {string|null} шлях до файлу або null
 */
function findVideoFile(dir) {
    try {
        const files = fs.readdirSync(dir);
        const webmFiles = files.filter(f => f.endsWith('.webm'));
        if (webmFiles.length === 0) return null;
        // Повертаємо найновіший файл
        webmFiles.sort((a, b) => {
            const statA = fs.statSync(path.join(dir, a));
            const statB = fs.statSync(path.join(dir, b));
            return statB.mtimeMs - statA.mtimeMs;
        });
        return path.join(dir, webmFiles[0]);
    } catch {
        return null;
    }
}

// ---- Головна функція ----

async function main() {
    // Створюємо директорію для відео, якщо її немає
    if (!fs.existsSync(VIDEO_DIR)) {
        fs.mkdirSync(VIDEO_DIR, { recursive: true });
        console.log(`[record-demo] Створено директорію: ${VIDEO_DIR}`);
    }

    // Піднімаємо статичний сервер
    const server = createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(PORT, HOST, resolve);
    });
    console.log(`[record-demo] Сервер запущено на http://${HOST}:${PORT}`);

    let browser;
    let context;

    try {
        // Запускаємо Chromium із записом відео
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            recordVideo: {
                dir: VIDEO_DIR,
                size: { width: 1280, height: 720 },
            },
        });

        const page = await context.newPage();

        // Відкриваємо гру
        console.log('[record-demo] Відкриваємо сторінку...');
        const response = await page.goto(`http://${HOST}:${PORT}/`, { waitUntil: 'domcontentloaded' });
        console.log(`[record-demo] HTTP статус: ${response ? response.status() : 'null'}`);

        // Чекаємо трохи для завантаження скриптів
        await page.waitForTimeout(2000);

        // Перевіряємо наявність елементів
        const initialCheck = await page.evaluate(() => {
            return {
                hasBoot: !!document.getElementById('screen-boot'),
                hasMain: !!document.getElementById('screen-main'),
                hasCanvas: !!document.getElementById('game-canvas'),
                bodyChildren: document.body ? document.body.children.length : 0,
                readyState: document.readyState,
            };
        });
        console.log('[record-demo] Початковий стан сторінки:', JSON.stringify(initialCheck));

        // Чекаємо, поки завантажувальний екран сховається і з'явиться головне меню
        try {
            await page.waitForFunction(() => {
                const boot = document.getElementById('screen-boot');
                const main = document.getElementById('screen-main');
                const bootHidden = boot && boot.classList.contains('hidden');
                const mainVisible = main && !main.classList.contains('hidden');
                return bootHidden && mainVisible;
            }, undefined, { timeout: BOOT_TIMEOUT_MS });
        } catch (err) {
            // Діагностика: виводимо стан сторінки
            const state = await page.evaluate(() => {
                const boot = document.getElementById('screen-boot');
                const main = document.getElementById('screen-main');
                return {
                    bootClasses: boot ? boot.className : 'NOT FOUND',
                    mainClasses: main ? main.className : 'NOT FOUND',
                    hasState: typeof window.State !== 'undefined',
                    hasGame: typeof window.Game !== 'undefined',
                    hasPlayer: typeof window.Player !== 'undefined',
                };
            });
            console.error('[record-demo] Діагностика стану сторінки:', JSON.stringify(state, null, 2));
            throw err;
        }
        console.log('[record-demo] Гра завантажена, головне меню видиме');

        // Підготовлюємо гру до красивого кадру
        await page.evaluate(() => {
            window.State.setSetting('difficulty', 'easy');
            window.State.data.tutorialDone = true;
            window.State.save();
        });
        console.log('[record-demo] Налаштування застосовано: difficulty=easy, tutorialDone=true');

        // Запускаємо endless-режим
        await page.evaluate(() => {
            window.Game.startEndless();
        });
        console.log('[record-demo] Гру запущено (endless)');

        // Граємо ~10 секунд: кожні ~350 мс викликаємо flip
        await page.evaluate(({ duration, interval }) => {
            return new Promise((resolve) => {
                const flipInterval = setInterval(() => {
                    if (window.Player && window.Player.alive) {
                        window.Player.flip();
                    }
                }, interval);

                // Зупиняємо інтервал через вказаний час
                setTimeout(() => {
                    clearInterval(flipInterval);
                    resolve();
                }, duration);
            });
        }, { duration: GAME_DURATION_MS, interval: FLIP_INTERVAL_MS });

        console.log(`[record-demo] Геймплей записано (${GAME_DURATION_MS / 1000} сек)`);

        // Закриваємо контекст — це гарантує збереження відео
        await context.close();
        context = null;
        console.log('[record-demo] Контекст закрито, відео збережено');

    } catch (err) {
        console.error('[record-demo] Помилка:', err.message);
        throw err;
    } finally {
        // Закриваємо браузер
        if (browser) {
            await browser.close();
        }

        // Зупиняємо сервер
        await new Promise(resolve => server.close(resolve));
        console.log('[record-demo] Сервер зупинено');
    }

    // Знаходимо збережене відео
    const videoPath = findVideoFile(VIDEO_DIR);
    if (!videoPath) {
        console.error('[record-demo] Файл .webm не знайдено у', VIDEO_DIR);
        process.exit(1);
    }

    const stats = fs.statSync(videoPath);
    const sizeKB = (stats.size / 1024).toFixed(1);

    console.log('');
    console.log('========================================');
    console.log(`  Відео збережено: ${videoPath}`);
    console.log(`  Розмір: ${sizeKB} КБ`);
    console.log('========================================');

    // Перевіряємо, що розмір більше 100 КБ
    if (stats.size < 100 * 1024) {
        console.warn(`[record-demo] Увага: розмір відео менше 100 КБ (${sizeKB} КБ)`);
    }
}

// ---- Запуск ----

main().catch(err => {
    console.error('[record-demo] Критична помилка:', err);
    process.exit(1);
});
