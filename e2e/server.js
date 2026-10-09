/**
 * e2e/server.js — мінімальний статичний сервер для e2e-тестів.
 * Роздає корінь репозиторію (каталог вище e2e/) на 127.0.0.1:4173.
 * Жодних зовнішніх залежностей — тільки вбудовані модулі Node.
 * Логується лише помилки (успішний старт і запити не логуються).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 4173;
const ROOT = path.resolve(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webmanifest': 'application/manifest+json; charset=utf-8'
};

function sendPlain(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(body);
}

const server = http.createServer(function (req, res) {
    let urlPath;
    try {
        urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
        sendPlain(res, 400, 'Bad Request');
        return;
    }

    // Нормалізація шляху + захист від виходу за межі кореню (path traversal)
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (filePath !== ROOT && filePath.indexOf(ROOT + path.sep) !== 0) {
        sendPlain(res, 403, 'Forbidden');
        return;
    }

    fs.stat(filePath, function (err, stats) {
        // Для каталогу віддаємо index.html (інакше — сам файл)
        const target = (!err && stats.isDirectory())
            ? path.join(filePath, 'index.html')
            : filePath;

        fs.readFile(target, function (readErr, data) {
            if (readErr) {
                sendPlain(res, 404, 'Not Found');
                return;
            }
            const ext = path.extname(target).toLowerCase();
            const type = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': type });
            res.end(data);
        });
    });
});

// Логуємо лише помилки (порт зайнято, тощо)
server.on('error', function (err) {
    console.error('[e2e/server] ' + (err && err.message ? err.message : String(err)));
});

server.listen(PORT, HOST, function () {
    // Успішний старт свідомо не логуємо — тільки помилки
});
