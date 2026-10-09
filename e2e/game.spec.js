/**
 * e2e/game.spec.js — базові e2e-тести гри Neon Gravity Runner.
 *
 * Тести не вимагають інтернету: гра може намагатися завантажити Supabase SDK
 * з CDN (CloudStorage), але це не впливає на локальну логіку, яку перевіряємо.
 * Глобальний лідерборд не перевіряємо — тільки локальний рушій гри.
 */
'use strict';

const { test, expect } = require('@playwright/test');

// Загальна підготовка: відкриваємо гру та чекаємо завершення boot
async function openGame(page) {
    await page.goto('/');
    await expect(page.locator('#screen-boot')).toBeHidden();
    await expect(page.locator('#screen-main')).toBeVisible({ timeout: 15000 });
}

// Виставляємо tutorialDone, щоб старти не кидали гравця на екран туторіала
async function markTutorialDone(page) {
    await page.evaluate(() => {
        window.State.data.tutorialDone = true;
        window.State.save();
    });
}

test('загружается и доходит до меню', async ({ page }) => {
    // Збираємо помилки сторінки та консоль (перевіряємо лише pageerror)
    const pageErrors = [];
    const consoleMessages = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push(msg));

    await page.goto('/');

    // Завантажувальний екран має зникнути, головне меню — з'явитися
    await expect(page.locator('#screen-boot')).toBeHidden();
    await expect(page.locator('#screen-main')).toBeVisible({ timeout: 15000 });

    // Жодного неопрацьованого винятку на сторінці бути не має
    expect(pageErrors).toEqual([]);
});

test('запускается бесконечный забег', async ({ page }) => {
    await openGame(page);
    await markTutorialDone(page);

    // Стартуємо нескінченний режим безпосередньо зі сторінки
    await page.evaluate(() => window.Game.startEndless());

    // HUD має стати видимим — це означає, що забіг реально пішов
    await expect(page.locator('#hud')).toBeVisible();

    // Чекаємо ~1.5 c, поки гра гарантовано нарахує якісь очки
    await page.waitForTimeout(1500);
    const firstScore = await page.evaluate(() => window.Scoring.score());
    await page.waitForTimeout(500);
    const secondScore = await page.evaluate(() => window.Scoring.score());

    // Рахунок не падає і строго більше нуля
    expect(secondScore).toBeGreaterThanOrEqual(firstScore);
    expect(secondScore).toBeGreaterThan(0);

    // Перевіряємо, що canvas реально рисує: у центрі є непрозрачні пікселі
    // (фон) та яскраві/не фонові пікселі (сітка, зірки, гравець, перешкоди)
    const pixelStats = await page.evaluate(() => {
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        const regionW = Math.min(400, canvas.width);
        const regionH = Math.min(300, canvas.height);
        const startX = Math.max(0, Math.floor((canvas.width - regionW) / 2));
        const startY = Math.max(0, Math.floor((canvas.height - regionH) / 2));
        const image = ctx.getImageData(startX, startY, regionW, regionH);
        const data = image.data;
        let opaqueCount = 0;
        let brightCount = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) opaqueCount++;
            if (data[i] + data[i + 1] + data[i + 2] > 30) brightCount++;
        }
        return { opaqueCount: opaqueCount, brightCount: brightCount };
    });

    expect(pixelStats.opaqueCount).toBeGreaterThan(100);
    expect(pixelStats.brightCount).toBeGreaterThan(100);
});

test('кампания: уровень 1 запускается', async ({ page }) => {
    await openGame(page);
    await markTutorialDone(page);

    // Стартуємо рівень 1 кампанії безпосередньо зі сторінки
    await page.evaluate(() => window.Game.startCampaignLevel(1));

    // HUD видно, а інфо-блок рівня не має бути схованим
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#hud-level-info')).toBeVisible();
});
