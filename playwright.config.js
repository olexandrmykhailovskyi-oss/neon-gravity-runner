/**
 * playwright.config.js — конфігурація e2e-тестів для Neon Gravity Runner.
 * Тестовий сервер (e2e/server.js) роздає статику репозиторію на 127.0.0.1:4173.
 */
'use strict';

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:4173',
        headless: true,
        viewport: { width: 1280, height: 720 },
        // Блокуємо Service Worker, щоб кеш не завадив детермінованості
        serviceWorkers: 'block',
        trace: 'retain-on-failure'
    },
    webServer: {
        command: 'node e2e/server.js',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 60000
    }
});
