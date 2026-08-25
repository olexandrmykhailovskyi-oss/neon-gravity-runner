/**
 * Screens.js — побудова та керування всіма екранами гри.
 * - Головне меню (Кампанія, Нескінченність, Виклик дня, Скіни, Досягнення, Рекорди, Налаштування, Статистика)
 * - Кампанія: сітка рівнів (Config.MAX_LEVEL) із зірками та замками
 * - Екран перемоги рівня із зірками (★ / ★★ / ★★★)
 * - Екран ТОП-5 локальних рекордів
 * - Налаштування: складність (Легко/Норм/Хардкор), зменшений рух (reducedMotion), теми, якість, звук
 */
(function () {
    'use strict';

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Screens] ' + msg, data); } catch (e) {}
    }

    function _clickSound() {
        try { if (window.AudioSys) window.AudioSys.playClick(); } catch (e) {}
    }

    // QOL: скопировать текст в буфер с тостом (фоллбэк для кнопки «Поделиться» на ПК)
    function _copyShare(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    window.UI.showToast(_t('share.copied', 'Результат скопійовано!'), 'success');
                }, function () {
                    window.UI.showToast(_t('share.fail', 'Не вдалося поділитися'), 'error');
                });
            } else {
                window.prompt(_t('share.copied', 'Результат:'), text);
            }
        } catch (e) {
            _log('error', '_copyShare', e.message);
        }
    }

    // Переклад з fallback: якщо ключа немає в словнику, повертаємо запасний текст
    function _t(key, fallback) {
        try {
            const v = window.I18n ? window.I18n.t(key) : key;
            return (v === key && fallback !== undefined) ? fallback : v;
        } catch (e) {
            return fallback !== undefined ? fallback : key;
        }
    }

    // QOL-4: плавний відлік чисел (рекорди/рахунки) із easeOutCubic; поважає reducedMotion
    const _numState = {};
    function _nowMs() {
        return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }
    function _animateNumber(sel, to, fmt) {
        const el = window.UI.$(sel);
        if (!el || typeof to !== 'number' || !isFinite(to)) return;
        const shown = _numState[sel];
        if (shown === undefined || Math.abs(shown - to) < 0.5) {
            _numState[sel] = to;
            el.textContent = fmt(to);
            return;
        }
        let reduced = false;
        try { reduced = !!(window.State && window.State.getSetting && window.State.getSetting('reducedMotion')); } catch (e) {}
        if (reduced || typeof requestAnimationFrame !== 'function') {
            _numState[sel] = to;
            el.textContent = fmt(to);
            return;
        }
        if (_numState[sel + '_raf']) {
            try { cancelAnimationFrame(_numState[sel + '_raf']); } catch (e) {}
        }
        const from = shown;
        const t0 = _nowMs();
        function step() {
            let p = Math.min(1, (_nowMs() - t0) / 650);
            p = 1 - Math.pow(1 - p, 3);
            const val = Math.round(from + (to - from) * p);
            _numState[sel] = val;
            el.textContent = fmt(val);
            if (p < 1) {
                _numState[sel + '_raf'] = requestAnimationFrame(step);
            } else {
                _numState[sel + '_raf'] = null;
            }
        }
        _numState[sel + '_raf'] = requestAnimationFrame(step);
    }

    function init() {
        try {
            _buildMainMenu();
            _buildLevelsScreen();
            _buildVictoryScreen();
            _buildLeaderboardScreen();
            _buildSkinsScreen();
            _buildAchievementsScreen();
            _buildSettingsScreen();
            _buildStatsScreen();
            _buildHelpScreen();
            _buildPauseScreen();
            _buildGameOverScreen();
            _buildTutorialScreen();
            _bindButtons();
            _buildQualityThemeDifficultyButtons();

            try {
                if (window.Achievements) {
                    window.Achievements.onToast(function (msg, type) {
                        try { if (window.UI) window.UI.showToast(msg, type); } catch (e) {}
                    });
                }
            } catch (e) {}
            _log('info', 'init OK');
        } catch (e) {
            _log('error', 'init помилка', e.message);
            throw e;
        }
    }

    function _buildMainMenu() {
        const el = window.UI.$('#screen-main');
        if (!el) return;
        el.innerHTML =
            '<div class="panel main-panel">' +
            '<h1 id="menu-title">Neon Gravity Runner</h1>' +
            '<div class="menu-stats-row">' +
            '<span>🏆 <span id="menu-best-label">Рекорд</span>: <b id="menu-best">0</b></span>' +
            '<span>⭐ <span id="menu-stars-label">Зірки</span>: <b id="menu-stars">0/' + ((window.Config && window.Config.MAX_STARS) || 45) + '</b></span>' +
            '<span>🎮 <span id="menu-games-label">Ігор</span>: <b id="menu-games">0</b></span>' +
            '</div>' +
            '<div class="btn-grid main-menu-grid">' +
            '<button id="btn-continue" class="btn accent-btn hidden">▶ Продовжити кампанію</button>' +
            '<button id="btn-campaign" class="btn primary highlight-btn">⭐ Кампанія</button>' +
            '<button id="btn-endless" class="btn primary" data-i18n="menu.endless">♾ Нескінченність</button>' +
            '<button id="btn-daily" class="btn accent-btn" data-i18n="menu.daily">📅 Виклик дня</button>' +
            '<button id="btn-timeattack" class="btn" data-i18n="menu.timeattack">⏱ Time Attack</button>' +
            '<button id="btn-editor" class="btn" data-i18n="menu.editor">🛠 Редактор</button>' +
            '<button id="btn-survival" class="btn" data-i18n="menu.survival">💀 Survival</button>' +
            '<button id="btn-zen" class="btn" data-i18n="menu.zen">🧘 Zen</button>' +
            '<button id="btn-skins" class="btn" data-i18n="menu.skins">🎨 Скіни</button>' +
            '<button id="btn-achievements" class="btn" data-i18n="menu.achievements">🏆 Досягнення</button>' +
            '<button id="btn-leaderboard" class="btn" data-i18n="menu.leaderboard">👑 Рекорди ТОП-5</button>' +
            '<button id="btn-settings" class="btn" data-i18n="menu.settings">⚙ Налаштування</button>' +
            '<button id="btn-stats" class="btn" data-i18n="menu.stats">📊 Статистика</button>' +
            '<button id="btn-help" class="btn" data-i18n="btn.help">❔ Довідка</button>' +
            '</div>' +
            '</div>';
    }

    function _buildLevelsScreen() {
        const el = window.UI.$('#screen-levels');
        if (!el) return;
        el.innerHTML =
            '<div class="panel levels-panel">' +
            '<h2 id="levels-title" data-i18n="levels.title">Вибір рівня кампанії</h2>' +
            '<p id="levels-description" style="text-align:center;" data-i18n="levels.description">Пройдіть усі 25 випробувань та зберіть максимум зірок!</p>' +
            '<div class="levels-progress"><div class="levels-progress-fill" id="levels-progress-fill"></div></div>' +
            '<div class="levels-progress-label" id="levels-progress-label"></div>' +
            '<div class="levels-grid" id="levels-grid"></div>' +
            '<div class="btn-grid" style="margin-top:18px;">' +
            '<button id="btn-levels-back" class="btn" data-i18n="btn.back">← Назад у меню</button>' +
            '</div>' +
            '</div>';
    }

    function _buildVictoryScreen() {
        const el = window.UI.$('#screen-victory');
        if (!el) return;
        el.innerHTML =
            '<div class="panel victory-panel">' +
            '<h2 id="vic-title" style="color:#39ff14; text-shadow: 0 0 16px #39ff14;" data-i18n="victory.title">Рівень пройдено!</h2>' +
            '<div class="victory-stars-box" id="vic-stars-box">' +
            '<span class="star-icon" id="vic-star-1">★</span>' +
            '<span class="star-icon" id="vic-star-2">★</span>' +
            '<span class="star-icon" id="vic-star-3">★</span>' +
            '</div>' +
            '<div class="victory-details" id="vic-details">' +
            '<div class="vic-row" id="vic-req-1"><span data-i18n="victory.req1">★ Вижити до кінця:</span> <b class="ok" data-i18n="survived">ВИКОНАНО</b></div>' +
            '<div class="vic-row" id="vic-req-2"><span>★★ <span data-i18n="score">Рахунок</span>:</span> <b id="vic-score-val">0 / 0</b></div>' +
            '<div class="vic-row" id="vic-req-3"><span data-i18n="victory.req3">★★★ Без втрати щита та ≥5 Near-Miss:</span> <b id="vic-shield-val" data-i18n="shield_used">—</b></div>' +
            '</div>' +
            '<div id="vic-total-stars" style="text-align:center; font-size:14px; color:#fff36b; margin-top:6px;"></div>' +
            '<div style="text-align:center; margin: 12px 0;">' +
            '<div style="font-size:32px; color:#00e5ff; font-weight:700;" id="vic-score">0</div>' +
            '<div style="color:#8a92b2;" id="vic-score-label" data-i18n="victory.scoreEarned">Отримано очок у рівні</div>' +
            '<div id="vic-newrecord" class="hidden" style="color:#fff36b; margin-top:8px; font-weight:700;" data-i18n="new_record">🎉 НОВИЙ РЕКОРД!</div>' +
            '</div>' +
            '<div class="btn-grid">' +
            '<button id="btn-vic-next" class="btn primary" data-i18n="btn.next">Наступний рівень ▶</button>' +
            '<button id="btn-vic-retry" class="btn" data-i18n="btn.retry">↻ Повторити</button>' +
            '<button id="btn-vic-levels" class="btn" data-i18n="btn.levels">☰ Усі рівні</button>' +
            '<button id="btn-vic-menu" class="btn" data-i18n="btn.menu">У меню</button>' +
            '</div>' +
            '</div>';
    }

    function _buildLeaderboardScreen() {
        const el = window.UI.$('#screen-leaderboard');
        if (!el) return;
            el.innerHTML =
            '<div class="panel">' +
            '<h2 data-i18n="leaderboard.title">👑 ТОП-5 Рекордів</h2>' +
            '<div class="lb-tabs" id="leaderboard-tabs"></div>' +
            '<div class="ed-chips lb-modes hidden" id="lb-modes"></div>' +
            '<div id="leaderboard-list" style="margin: 14px 0;"></div>' +
            '<div class="btn-grid">' +
            '<button id="btn-leaderboard-back" class="btn" data-i18n="btn.back">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    function _buildSkinsScreen() {
        const el = window.UI.$('#screen-skins');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2 data-i18n="skins.title">Скіни гравця</h2>' +
            '<p style="text-align:center;" data-i18n="skins.description">Кожен скін має свій колір та унікальну форму трейлу!</p>' +
            '<div class="grid" id="skins-grid"></div>' +
            '<div class="btn-grid">' +
            '<button id="btn-skins-back" class="btn" data-i18n="btn.back">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    function _buildAchievementsScreen() {
        const el = window.UI.$('#screen-achievements');
        if (!el) return;
            el.innerHTML =
            '<div class="panel">' +
            '<h2 data-i18n="achievements.title">Досягнення</h2>' +
            '<div id="ach-progress" style="text-align:center; color:#8a92b2; font-size:13px; margin-bottom:10px;"></div>' +
            '<div class="grid" id="achievements-grid"></div>' +
            '<div class="btn-grid">' +
            '<button id="btn-achievements-back" class="btn" data-i18n="btn.back">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    function _buildSettingsScreen() {
        const el = window.UI.$('#screen-settings');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2 id="settings-title" data-i18n="settings.title">Налаштування</h2>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.difficulty">Складність</span>' +
            '<div id="diff-btns" class="btn-grid" style="margin:0;"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.sfx">Звуки</span>' +
            '<input type="range" id="set-sfx" min="0" max="1" step="0.1">' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.music">Музика</span>' +
            '<input type="range" id="set-music" min="0" max="1" step="0.1">' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.quality">Якість графіки</span>' +
            '<div id="quality-btns" class="btn-grid" style="margin:0;"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.theme">Тема оформлення</span>' +
            '<div id="theme-btns" class="btn-grid" style="margin:0;"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.reducedMotion">Зменшений рух (без тряски)</span>' +
            '<div class="switch" id="set-reduced-motion"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.vibration">Вібрація (мобільні)</span>' +
            '<div class="switch" id="set-vibration"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.gravityGuide">Лінія гравітації</span>' +
            '<div class="switch" id="set-gravity-guide"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.mute">Вимкнути звук повністю</span>' +
            '<div class="switch" id="set-mute"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.language">Мова</span>' +
            '<div id="lang-btns" class="btn-grid" style="margin:0;"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.nickname">Ім’я пілота</span>' +
            '<input type="text" id="set-nickname" maxlength="20" style="max-width:160px;"></div>' +
            '<div class="setting-row">' +
            '<span class="setting-label" data-i18n="settings.analytics">Анонімна статистика</span>' +
            '<div class="switch" id="set-analytics"></div></div>' +
            '<div class="setting-row" style="flex-direction:column; align-items:stretch;">' +
            '<span class="setting-label" data-i18n="settings.data" style="margin-bottom:8px;">Дані прогресу</span>' +
            '<div class="btn-grid" style="margin:0;">' +
            '<button id="btn-data-export" class="btn" data-i18n="settings.export" style="min-width:110px;">⬆ Експорт</button>' +
            '<button id="btn-data-import" class="btn" data-i18n="settings.import" style="min-width:110px;">⬇ Імпорт</button>' +
            '<button id="btn-data-reset" class="btn" data-i18n="settings.reset" style="min-width:110px;">🗑 Скинути</button>' +
            '</div>' +
            '</div>' +
            '<div class="setting-row hidden" id="cloud-row" style="flex-direction:column; align-items:stretch;">' +
            '<span class="setting-label" data-i18n="settings.cloudSync" style="margin-bottom:8px;">☁ Хмарна синхронізація</span>' +
            '<div class="btn-grid" style="margin:0;">' +
            '<button id="btn-cloud-sync" class="btn" data-i18n="settings.cloudSyncBtn" style="min-width:110px;">☁ Синхронізувати</button>' +
            '</div>' +
            '<div id="cloud-status" style="font-size:12px; color:var(--text-dim); margin-top:6px; text-align:center;"></div>' +
            '</div>' +
            '<div class="btn-grid">' +
            '<button id="btn-settings-back" class="btn" data-i18n="btn.back">← Назад у меню</button>' +
            '</div>' +
            '<div style="text-align:center;color:#5a6080;font-size:11px;margin-top:10px;">Neon Gravity Runner v' +
            ((window.Config && window.Config.VERSION) || '1.0.0') + ' · vanilla JS · <a href="https://github.com/olexandrmykhailovskyi-oss/neon-gravity-runner" target="_blank" rel="noopener" style="color:#5a6080;">GitHub</a></div>' +
            '</div>';
    }

    function _buildStatsScreen() {
        const el = window.UI.$('#screen-stats');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2 data-i18n="stats.title">Статистика пілота</h2>' +
            '<div id="stats-list"></div>' +
            '<div class="btn-grid">' +
            '<button id="btn-stats-back" class="btn" data-i18n="btn.back">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    // QOL: екран довідки — легенда бонусів + керування
    function _buildHelpScreen() {
        const el = window.UI.$('#screen-help');
        if (!el) return;
        const types = ['star', 'shield', 'slow', 'double', 'magnet', 'ghost', 'revive', 'phase'];
        const icons = { star: '★', shield: '⛨', slow: '◷', double: '×2', magnet: 'M', ghost: '👻', revive: '♥', phase: '⚡' };
        let rows = '';
        for (let i = 0; i < types.length; i++) {
            const t = types[i];
            rows += '<div class="help-row">' +
                '<span class="help-icon">' + icons[t] + '</span>' +
                '<div class="help-text">' +
                '<b data-i18n="bonus.' + t + '">' + window.I18n.t('bonus.' + t) + '</b>' +
                '<div class="help-desc" data-i18n="hint.' + t + '">' + window.I18n.t('hint.' + t) + '</div>' +
                '</div>' +
                '</div>';
        }
        el.innerHTML =
            '<div class="panel help-panel">' +
            '<h2 data-i18n="help.title">Довідка</h2>' +
            '<h3 data-i18n="help.controls">Керування</h3>' +
            '<p data-i18n-html="help.controlsList"></p>' +
            '<h3 data-i18n="help.bonuses">Бонуси</h3>' +
            '<div class="help-list">' + rows + '</div>' +
            '<div class="btn-grid">' +
            '<button id="btn-help-back" class="btn" data-i18n="btn.back">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    function _buildPauseScreen() {
        const el = window.UI.$('#screen-pause');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2 data-i18n="pause.title">Пауза</h2>' +
            '<div id="pause-info" class="pause-info hidden"></div>' +
            '<div class="pause-keys" data-i18n-html="pause.keys"></div>' +
            '<div class="btn-grid">' +
            '<button id="btn-resume" class="btn primary" data-i18n="btn.resume">▶ Продовжити</button>' +
            '<button id="btn-pause-retry" class="btn" data-i18n="btn.restart">↻ Перезапустити</button>' +
            '<button id="btn-pause-menu" class="btn" data-i18n="btn.menu">У меню</button>' +
            '</div>' +
            '</div>';
    }

    function _buildGameOverScreen() {
        const el = window.UI.$('#screen-gameover');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2 data-i18n="gameover.title">Зіткнення!</h2>' +
            '<div style="text-align:center; margin-bottom:16px;">' +
            '<div style="font-size:42px; color:#ff3860; font-weight:700;" id="go-score">0</div>' +
            '<div style="color:#8a92b2; margin-top:4px;">' +
            '<span data-i18n="record">Рекорд</span>: <span id="go-best">0</span> | ' +
            '<span data-i18n="combo">Комбо</span>: <span id="go-combo">0</span> | ' +
            '<span data-i18n="stars_collected">Зірки</span>: <span id="go-stars">0</span>' +
            '</div>' +
            '<div id="go-newrecord" class="hidden" style="color:#fff36b; margin-top:8px; font-weight:700;" data-i18n="new_record">🎉 НОВИЙ РЕКОРД!</div>' +
            '<div id="go-dailybest" class="hidden" style="color:#00e5ff; margin-top:6px;"><span data-i18n="gameover.dailyBest">Рекорд дня</span>: <b id="go-dailybest-val">0</b></div>' +
            '<div id="go-cause" class="hidden" style="color:#8a92b2; margin-top:6px; font-size:13px;"><span data-i18n="gameover.cause">Причина</span>: <span id="go-cause-val">—</span></div>' +
            '</div>' +
            '<div class="btn-grid">' +
            '<button id="btn-retry" class="btn primary" data-i18n="btn.retry">↻ Повторити</button>' +
            '<button id="btn-share" class="btn" data-i18n="btn.share">📤 Поділитися</button>' +
            '<button id="btn-gameover-levels" class="btn hidden" data-i18n="btn.levels">☰ Рівні</button>' +
            '<button id="btn-gameover-menu" class="btn" data-i18n="btn.menu">У меню</button>' +
            '</div>' +
            '<div class="go-hint" data-i18n="gameover.hint">Підказка: R — миттєвий рестарт</div>' +
            '</div>';
    }

    function _buildTutorialScreen() {
        const el = window.UI.$('#screen-tutorial');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2 data-i18n="tutorial.title">Як грати</h2>' +
            '<p data-i18n-html="tutorial.description">Натискай <b>SPACE</b>, клікай або тапай, щоб перемикати гравітацію.</p>' +
            '<p data-i18n-html="tutorial.description2">Кожен стрибок дає імпульс. Уникай стін, лазерів, вогняних шипів і пульсарів!</p>' +
            '<p data-i18n-html="tutorial.gravity">🌀 <b>Гравітаційні зони</b> тимчасово перевертають гравітацію.</p>' +
            '<p data-i18n-html="tutorial.storm">⚡ Кожні 45 секунд — <b>Neon Storm</b>!</p>' +
            '<div class="btn-grid">' +
            '<button id="btn-tutorial-start" class="btn primary" data-i18n="btn.start">Почати політ!</button>' +
            '</div>' +
            '</div>';
    }

    function _bindButtons() {
        const UI = window.UI;

        // Головне меню
        UI.safeBind(UI.$('#btn-continue'), 'click', function () {
            _clickSound();
            try {
                const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 15;
                const c = window.State.data.campaign || {};
                const target = Math.min(maxLvl, Math.max(1, c.maxLevel || 1));
                buildLevelsGrid();
                if (window.Game) window.Game.startCampaignLevel(target);
            } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-campaign'), 'click', function () {
            _clickSound();
            buildLevelsGrid();
            UI.showScreen('levels');
        });
        UI.safeBind(UI.$('#btn-endless'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.startEndless(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-daily'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.startDaily(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-timeattack'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.startTimeAttack(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-editor'), 'click', function () {
            _clickSound();
            UI.showScreen('editor');
            try { if (window.Editor) window.Editor.build(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-survival'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.startSurvival(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-zen'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.startZen(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-skins'), 'click', function () {
            _clickSound();
            UI.showScreen('skins');
            buildSkins();
        });
        UI.safeBind(UI.$('#btn-achievements'), 'click', function () {
            _clickSound();
            UI.showScreen('achievements');
            buildAchievements();
        });
        UI.safeBind(UI.$('#btn-leaderboard'), 'click', function () {
            _clickSound();
            UI.showScreen('leaderboard');
            buildLeaderboard();
        });
        UI.safeBind(UI.$('#btn-settings'), 'click', function () {
            _clickSound();
            UI.showScreen('settings');
            _refreshSettings();
        });
        UI.safeBind(UI.$('#btn-stats'), 'click', function () {
            _clickSound();
            UI.showScreen('stats');
            buildStats();
        });
        UI.safeBind(UI.$('#btn-help'), 'click', function () {
            _clickSound();
            UI.showScreen('help');
        });

        // Назад
        UI.safeBind(UI.$('#btn-levels-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-skins-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-achievements-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-leaderboard-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-settings-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-stats-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-help-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });

        // Пауза
        UI.safeBind(UI.$('#btn-resume'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.resume(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-pause-retry'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.retryCurrent(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-pause-menu'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.goMenu(); } catch (e) {}
        });

        // Game Over
        UI.safeBind(UI.$('#btn-retry'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.retryCurrent(); } catch (e) {}
        });
        // QOL: поделиться результатом (Web Share только на мобильных; на ПК — сразу в буфер обмена,
        // потому что десктопные приложения вроде Unigram не умеют принимать текст из системного шаринга)
        UI.safeBind(UI.$('#btn-share'), 'click', function () {
            _clickSound();
            try {
                const score = window.UI.$('#go-score');
                const text = _t('share.text', 'Мій результат у Neon Gravity Runner: {score}!').replace('{score}', score ? score.textContent : '0') +
                    ' ' + location.origin + location.pathname;
                const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                if (navigator.share && isTouch) {
                    navigator.share({ title: 'Neon Gravity Runner', text: text }).catch(function (err) {
                        // AbortError — пользователь сам закрыл окно; остальное — фоллбэк в буфер обмена
                        if (err && err.name !== 'AbortError') _copyShare(text);
                    });
                } else {
                    _copyShare(text);
                }
            } catch (e) {
                _log('error', 'share', e.message);
            }
        });
        UI.safeBind(UI.$('#btn-gameover-levels'), 'click', function () {
            _clickSound();
            buildLevelsGrid();
            UI.showScreen('levels');
        });
        UI.safeBind(UI.$('#btn-gameover-menu'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.goMenu(); } catch (e) {}
        });

        // Екран перемоги
        UI.safeBind(UI.$('#btn-vic-next'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.startNextLevel(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-vic-retry'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.retryCurrent(); } catch (e) {}
        });
        UI.safeBind(UI.$('#btn-vic-levels'), 'click', function () {
            _clickSound();
            buildLevelsGrid();
            UI.showScreen('levels');
        });
        UI.safeBind(UI.$('#btn-vic-menu'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.goMenu(); } catch (e) {}
        });

        // Туторіал
        UI.safeBind(UI.$('#btn-tutorial-start'), 'click', function () {
            _clickSound();
            try { if (window.Game) window.Game.finishTutorial(); } catch (e) {}
        });

        // Слайдери
        const sfx = UI.$('#set-sfx');
        if (sfx) {
            UI.safeBind(sfx, 'input', function () {
                try {
                    window.State.setSetting('sfxVolume', parseFloat(this.value));
                    if (window.AudioSys) window.AudioSys.applyVolumes();
                } catch (e) {}
            });
        }
        const music = UI.$('#set-music');
        if (music) {
            UI.safeBind(music, 'input', function () {
                try {
                    window.State.setSetting('musicVolume', parseFloat(this.value));
                    if (window.AudioSys) window.AudioSys.applyVolumes();
                } catch (e) {}
            });
        }

        // Switches
        const mute = UI.$('#set-mute');
        if (mute) {
            UI.safeBind(mute, 'click', function () {
                try {
                    if (window.AudioSys) {
                        const m = window.AudioSys.toggleMute();
                        mute.classList.toggle('on', m);
                    }
                } catch (e) {}
            });
        }
        const rm = UI.$('#set-reduced-motion');
        if (rm) {
            UI.safeBind(rm, 'click', function () {
                try {
                    const cur = !!window.State.getSetting('reducedMotion');
                    window.State.setSetting('reducedMotion', !cur);
                    rm.classList.toggle('on', !cur);
                } catch (e) {}
            });
        }
        const vib = UI.$('#set-vibration');
        if (vib) {
            UI.safeBind(vib, 'click', function () {
                try {
                    // Демонстрация отзыва: короткая вибрация при включении
                    const cur = window.State.getSetting('vibration') !== false;
                    window.State.setSetting('vibration', !cur);
                    vib.classList.toggle('on', !cur);
                    if (!cur) window.Utils.vibrate(60);
                } catch (e) {}
            });
        }
        const gg = UI.$('#set-gravity-guide');
        if (gg) {
            UI.safeBind(gg, 'click', function () {
                try {
                    const cur = window.State.getSetting('gravityGuide') !== false;
                    window.State.setSetting('gravityGuide', !cur);
                    gg.classList.toggle('on', !cur);
                } catch (e) {}
            });
        }

        // QOL-5: ім'я пілота для світового лідерборду
        const nick = UI.$('#set-nickname');
        if (nick) {
            UI.safeBind(nick, 'input', function () {
                try {
                    window.State.setSetting('nickname', String(this.value || '').trim().slice(0, 20));
                } catch (e) {}
            });
        }

        // QOL-5: тумблер анонімної телеметрії
        const an = UI.$('#set-analytics');
        if (an) {
            UI.safeBind(an, 'click', function () {
                try {
                    const cur = window.State.getSetting('analytics') !== false;
                    window.State.setSetting('analytics', !cur);
                    an.classList.toggle('on', !cur);
                } catch (e) {}
            });
        }

        // Експорт прогресу (код для переносу між пристроями)
        UI.safeBind(UI.$('#btn-data-export'), 'click', function () {
            _clickSound();
            try {
                const code = window.State.exportProgress();
                if (!code) return;
                // Спочатку — буфер обміну; якщо недоступний (file:// тощо) — код у полі для ручного копіювання
                let copied = false;
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(code).then(function () {
                            window.UI.showToast(_t('settings.exportCopied', 'Код скопійовано в буфер обміну'), 'success');
                        }, function () {
                            window.prompt(_t('settings.exportPrompt', 'Скопіюйте код прогресу:'), code);
                        });
                        copied = true;
                    }
                } catch (x) {}
                if (!copied) {
                    window.prompt(_t('settings.exportPrompt', 'Скопіюйте код прогресу:'), code);
                }
            } catch (e) {
                _log('error', 'export', e.message);
            }
        });

        // Синхронизация с облаком
        UI.safeBind(UI.$('#btn-cloud-sync'), 'click', function () {
            _clickSound();
            try {
                if (window.CloudStorage && window.CloudStorage.isReady()) {
                    window.UI.showToast(_t('cloud.syncing', 'Синхронізація…'), 'warn');
                    Promise.all([
                        window.CloudStorage.pushProgress(),
                        window.CloudStorage.pullFromCloud()
                    ]).then(function (results) {
                        if (results[0] === true || results[1] !== null) {
                            window.UI.showToast(_t('cloud.syncOk', 'Синхронізація успішна'), 'success');
                        } else {
                            window.UI.showToast(_t('cloud.syncFail', 'Помилка синхронізації'), 'error');
                        }
                        _updateCloudStatus();
                    });
                } else {
                    window.UI.showToast(_t('cloud.notReady', 'Хмарне сховище не налаштовано'), 'error');
                }
            } catch (e) {
                _log('error', 'cloud sync', e.message);
            }
        });

        // Імпорт прогресу
        UI.safeBind(UI.$('#btn-data-import'), 'click', function () {
            _clickSound();
            try {
                const code = window.prompt(_t('settings.importPrompt', 'Вставте код прогресу:'));
                if (!code || !code.trim()) return;
                const ok = window.State.importProgress(code.trim());
                window.UI.showToast(
                    ok ? _t('settings.importSuccess', 'Прогрес відновлено!') : _t('settings.importError', 'Некоректний код прогресу'),
                    ok ? 'success' : 'error'
                );
                if (ok) {
                    // Імпорт міг принести іншу мову — застосовуємо одразу, без перезавантаження
                    try {
                        const savedLang = window.State.getSetting('language');
                        if (savedLang && savedLang !== 'auto' && savedLang !== window.I18n.getCurrentLanguage() &&
                            window.I18n.setLanguage(savedLang)) {
                            updateLanguage();
                        }
                    } catch (langErr) {}
                    updateMenuStats();
                    _refreshSettings();
                }
            } catch (e) {
                _log('error', 'import', e.message);
            }
        });

        // Обновление статуса облачного хранилища
        _updateCloudStatus();

        // Скидання прогресу
        UI.safeBind(UI.$('#btn-data-reset'), 'click', function () {
            _clickSound();
            try {
                const confirmed = window.confirm(_t('settings.resetConfirm', 'Скинути весь прогрес? Це незворотно!'));
                if (!confirmed) return;
                window.State.resetProgress();
                updateMenuStats();
                _refreshSettings();
                window.UI.showToast(_t('settings.resetDone', 'Прогрес скинуто'), 'success');
            } catch (e) {
                _log('error', 'reset', e.message);
            }
        });
    }

    function _buildQualityThemeDifficultyButtons() {
        try {
            const C = window.Config;

            // Складність
            const dBox = window.UI.$('#diff-btns');
            if (dBox) {
                const diffs = [
                    { id: 'easy', key: 'settings.easy' },
                    { id: 'normal', key: 'settings.normal' },
                    { id: 'hardcore', key: 'settings.hardcore' }
                ];
                let html = '';
                for (let i = 0; i < diffs.length; i++) {
                    html += '<button class="btn diff-btn" data-d="' + diffs[i].id + '" data-i18n="' + diffs[i].key + '" style="min-width:80px;">' + window.I18n.t(diffs[i].key) + '</button>';
                }
                dBox.innerHTML = html;
                const btns = dBox.querySelectorAll('.diff-btn');
                for (let i = 0; i < btns.length; i++) {
                    window.UI.safeBind(btns[i], 'click', function () {
                        const d = this.getAttribute('data-d');
                        try {
                            window.State.setSetting('difficulty', d);
                            _updateDifficultyUI();
                        } catch (e) {}
                    });
                }
            }

            // Якість
            const qBox = window.UI.$('#quality-btns');
            if (qBox && C && C.QUALITY) {
                let html = '';
                for (let i = 0; i < C.QUALITY.length; i++) {
                    const key = 'quality.' + (C.QUALITY[i].id || String(i));
                    html += '<button class="btn quality-btn" data-q="' + i + '" data-i18n="' + key + '" style="min-width:70px;">' + _t(key, C.QUALITY[i].name) + '</button>';
                }
                qBox.innerHTML = html;
                const btns = qBox.querySelectorAll('.quality-btn');
                for (let i = 0; i < btns.length; i++) {
                    window.UI.safeBind(btns[i], 'click', function () {
                        const idx = parseInt(this.getAttribute('data-q'), 10);
                        try {
                            window.State.setSetting('quality', idx);
                            _updateQualityUI();
                            const c = document.getElementById('game-canvas');
                            if (c && window.Particles) window.Particles.init(c);
                        } catch (e) {}
                    });
                }
            }

            // Тема
            const tBox = window.UI.$('#theme-btns');
            if (tBox && C && C.THEMES) {
                let html = '';
                for (let i = 0; i < C.THEMES.length; i++) {
                    const key = 'theme.' + (C.THEMES[i].i18n || String(C.THEMES[i].id));
                    html += '<button class="btn theme-btn" data-t="' + i + '" data-i18n="' + key + '" style="min-width:90px;">' + _t(key, C.THEMES[i].name) + '</button>';
                }
                tBox.innerHTML = html;
                const btns = tBox.querySelectorAll('.theme-btn');
                for (let i = 0; i < btns.length; i++) {
                    window.UI.safeBind(btns[i], 'click', function () {
                        const idx = parseInt(this.getAttribute('data-t'), 10);
                        try {
                            window.State.setSetting('theme', idx);
                            _updateThemeUI();
                            if (window.Background) window.Background.setTheme(idx);
                        } catch (e) {}
                    });
                }
            }

            // Язык
            const lBox = window.UI.$('#lang-btns');
            if (lBox) {
                const langs = window.I18n.getAvailableLanguages();
                let html = '';
                for (let i = 0; i < langs.length; i++) {
                    html += '<button class="btn lang-btn" data-l="' + langs[i].code + '" style="min-width:90px;">' + langs[i].name + '</button>';
                }
                lBox.innerHTML = html;
                const btns = lBox.querySelectorAll('.lang-btn');
                for (let i = 0; i < btns.length; i++) {
                    window.UI.safeBind(btns[i], 'click', function () {
                        const lang = this.getAttribute('data-l');
                        try {
                            window.I18n.setLanguage(lang);
                            _updateLanguageUI();
                            updateLanguage();
                        } catch (e) {}
                    });
                }
            }
        } catch (e) {
            _log('error', '_buildQualityThemeDifficultyButtons', e.message);
        }
    }

    function _updateLanguageUI() {
        try {
            const currentLang = window.I18n.getCurrentLanguage();
            const btns = document.querySelectorAll('.lang-btn');
            for (let i = 0; i < btns.length; i++) {
                const lang = btns[i].getAttribute('data-l');
                btns[i].classList.toggle('primary', lang === currentLang);
            }
        } catch (e) {
            _log('error', '_updateLanguageUI', e.message);
        }
    }

    function _updateCloudStatus() {
        try {
            const statusEl = window.UI.$('#cloud-status');
            if (!statusEl) return;
            // Рядок хмарної синхронізації видно лише коли хмара реально підключена
            const ready = !!(window.CloudStorage && window.CloudStorage.isReady());
            window.UI.toggle('#cloud-row', ready);
            if (ready) {
                const lastSync = window.CloudStorage.getLastSyncTime();
                const syncTime = lastSync > 0 ? new Date(lastSync).toLocaleTimeString() : _t('cloud.never', 'ніколи');
                statusEl.textContent = window.CloudStorage.getProvider() + ' | ' +
                    _t('cloud.lastSync', 'Остання синхронізація') + ': ' + syncTime;
                statusEl.style.color = 'var(--neon-green)';
            } else {
                statusEl.textContent = _t('cloud.notConfigured', 'Не налаштовано');
                statusEl.style.color = 'var(--text-dim)';
            }
        } catch (e) {
            _log('error', '_updateCloudStatus', e.message);
        }
    }

    function updateLanguage() {
        try {
            // Оновлення всіх елементів з data-i18n (звичайний текст)
            const elements = document.querySelectorAll('[data-i18n]');
            for (let i = 0; i < elements.length; i++) {
                const key = elements[i].getAttribute('data-i18n');
                elements[i].textContent = window.I18n.t(key);
            }

            // Оновлення елементів з HTML-розміткою (туторіал тощо)
            const htmlElements = document.querySelectorAll('[data-i18n-html]');
            for (let i = 0; i < htmlElements.length; i++) {
                const key = htmlElements[i].getAttribute('data-i18n-html');
                htmlElements[i].innerHTML = window.I18n.t(key);
            }

            // Update main menu labels
            window.UI.setText('#menu-best-label', window.I18n.t('menu.best'));
            window.UI.setText('#menu-stars-label', window.I18n.t('menu.stars'));
            window.UI.setText('#menu-games-label', window.I18n.t('menu.games'));

            // Update settings buttons
            _updateDifficultyUI();
            _updateQualityUI();
            _updateThemeUI();
            _updateLanguageUI();

            // Оновлюємо меню-статистику (напис кнопки «Продовжити» залежить від мови)
            try { updateMenuStats(); } catch (e) {}

            // Перебудова динамічних списків, щоб мова застосувалась всюди
            try { buildLeaderboard(); } catch (e) {}
            try { buildStats(); } catch (e) {}
            try { buildSkins(); } catch (e) {}
            try { buildAchievements(); } catch (e) {}
            try { buildLevelsGrid(); } catch (e) {}
            try {
                if (window.Editor && window.UI.currentScreen && window.UI.currentScreen() === 'editor') {
                    window.Editor.build();
                }
            } catch (e) {}

            _log('info', 'Language updated');
        } catch (e) {
            _log('error', 'updateLanguage', e.message);
        }
    }

    function _updateDifficultyUI() {
        try {
            const cur = window.State.getSetting('difficulty') || 'normal';
            const btns = document.querySelectorAll('.diff-btn');
            for (let i = 0; i < btns.length; i++) {
                btns[i].classList.toggle('primary', btns[i].getAttribute('data-d') === cur);
                const key = btns[i].getAttribute('data-i18n');
                if (key) btns[i].textContent = window.I18n.t(key);
            }
        } catch (e) {}
    }

    function _updateQualityUI() {
        try {
            const cur = window.State.getSetting('quality');
            const btns = document.querySelectorAll('.quality-btn');
            for (let i = 0; i < btns.length; i++) {
                const idx = parseInt(btns[i].getAttribute('data-q'), 10);
                btns[i].classList.toggle('primary', idx === cur);
                const key = btns[i].getAttribute('data-i18n');
                if (key) btns[i].textContent = window.I18n.t(key);
            }
        } catch (e) {}
    }

    function _updateThemeUI() {
        try {
            const cur = window.State.getSetting('theme');
            const btns = document.querySelectorAll('.theme-btn');
            for (let i = 0; i < btns.length; i++) {
                const idx = parseInt(btns[i].getAttribute('data-t'), 10);
                btns[i].classList.toggle('primary', idx === cur);
                const key = btns[i].getAttribute('data-i18n');
                if (key) btns[i].textContent = window.I18n.t(key);
            }
        } catch (e) {}
    }

    function _refreshSettings() {
        try {
            const sfx = window.UI.$('#set-sfx');
            if (sfx) sfx.value = window.State.getSetting('sfxVolume');
            const music = window.UI.$('#set-music');
            if (music) music.value = window.State.getSetting('musicVolume');
            const mute = window.UI.$('#set-mute');
            if (mute) mute.classList.toggle('on', !!window.State.getSetting('mute'));
            const rm = window.UI.$('#set-reduced-motion');
            if (rm) rm.classList.toggle('on', !!window.State.getSetting('reducedMotion'));
            const vib = window.UI.$('#set-vibration');
            if (vib) vib.classList.toggle('on', window.State.getSetting('vibration') !== false);
            const gg = window.UI.$('#set-gravity-guide');
            if (gg) gg.classList.toggle('on', window.State.getSetting('gravityGuide') !== false);
            const nick = window.UI.$('#set-nickname');
            if (nick) nick.value = window.State.getSetting('nickname') || '';
            const anSw = window.UI.$('#set-analytics');
            if (anSw) anSw.classList.toggle('on', window.State.getSetting('analytics') !== false);
            _updateDifficultyUI();
            _updateQualityUI();
            _updateThemeUI();
            _updateLanguageUI();
            _updateCloudStatus();
        } catch (e) {}
    }

    function updateMenuStats() {
        try {
            const s = window.State.getStats();
            const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 15;
            const maxStars = (window.Config && window.Config.MAX_STARS) || (maxLvl * 3);
            _animateNumber('#menu-best', s.bestScore || 0, function (v) { return window.Utils.formatNumber(v); });
            _animateNumber('#menu-games', s.totalGames || 0, function (v) { return String(v); });

            // Підрахунок зірок кампанії
            let totalStars = 0;
            const c = window.State.data.campaign;
            if (c && c.stars) {
                for (let k = 1; k <= maxLvl; k++) {
                    totalStars += (c.stars[k] || 0);
                }
            }
            window.UI.setText('#menu-stars', totalStars + '/' + maxStars);

            // QOL: бейджі з особистими рекордами на кнопках режимів (data-sub → CSS ::after)
            const U = window.Utils;
            const bm = (s && s.bestByMode) || {};
            function _setSub(id, txt) {
                const b = window.UI.$(id);
                if (!b) return;
                if (txt) b.setAttribute('data-sub', txt);
                else b.removeAttribute('data-sub');
            }
            _setSub('#btn-endless', bm.endless > 0 ? _t('menu.subBest', 'рекорд: {n}').replace('{n}', U.formatNumber(bm.endless)) : null);
            _setSub('#btn-timeattack', bm.timeattack > 0 ? _t('menu.subBest', 'рекорд: {n}').replace('{n}', U.formatNumber(bm.timeattack)) : null);
            _setSub('#btn-survival', bm.survival > 0 ? _t('menu.subBest', 'рекорд: {n}').replace('{n}', U.formatNumber(bm.survival)) : null);
            const streakN = (s && s.dailyStreak) || 0;
            _setSub('#btn-daily', streakN > 0 ? _t('menu.subStreak', 'серія: {n}').replace('{n}', streakN) : null);

            // Напис кнопки «Кампанія» — кількість рівнів беремо з конфіга, без хардкоду
            const campBtn = window.UI.$('#btn-campaign');
            if (campBtn) {
                campBtn.textContent = _t('menu.campaign', '⭐ Кампанія') +
                    ' (' + maxLvl + ' ' + _t('levels.word', 'рівнів') + ')';
            }

            // Кнопка «Продовжити кампанію» — лише коли є прогрес
            const contBtn = window.UI.$('#btn-continue');
            if (contBtn) {
                const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 15;
                const nextLvl = Math.min(maxLvl, Math.max(1, (c && c.maxLevel) || 1));
                const showIt = nextLvl > 1;
                contBtn.classList.toggle('hidden', !showIt);
                if (showIt) {
                    contBtn.textContent = _t('menu.continue', '▶ Продовжити кампанію') +
                        ' · ' + _t('hud.level', 'Рівень') + ' ' + nextLvl;
                }
            }
        } catch (e) {}
    }

    // Сітка рівнів кампанії
    function buildLevelsGrid() {
        const grid = window.UI.$('#levels-grid');
        if (!grid) return;
        try {
            const levels = (window.Config && window.Config.LEVELS) || [];
            const c = window.State.data.campaign || { maxLevel: 1, stars: {} };
            const maxLvl = c.maxLevel || 1;
            const cfgMaxLvl = (window.Config && window.Config.MAX_LEVEL) || levels.length || 1;
            let html = '';

            // QOL: прогрес-бар зірок кампанії над сіткою
            let barTotal = 0;
            for (let k = 1; k <= cfgMaxLvl; k++) barTotal += (c.stars && c.stars[k]) || 0;
            const maxStarsAll = (window.Config && window.Config.MAX_STARS) || (cfgMaxLvl * 3);
            const fillEl = window.UI.$('#levels-progress-fill');
            if (fillEl) {
                fillEl.style.width = Math.min(100, Math.round(barTotal / maxStarsAll * 100)) + '%';
            }
            window.UI.setText('#levels-progress-label', '⭐ ' + barTotal + ' / ' + maxStarsAll);

            for (let i = 0; i < levels.length; i++) {
                const lvl = levels[i];
                const isUnlocked = lvl.id <= maxLvl;
                const isFrontier = isUnlocked && lvl.id === Math.min(maxLvl, cfgMaxLvl);
                const starsCount = (c.stars && c.stars[lvl.id]) || 0;
                const lvlName = _t('level.' + lvl.id, lvl.name);

                let starsHtml = '';
                for (let s = 1; s <= 3; s++) {
                    starsHtml += s <= starsCount ? '<span class="star-on">★</span>' : '<span class="star-off">☆</span>';
                }

                const cls = 'level-tile' + (isUnlocked ? ' unlocked' : ' locked') + (isFrontier ? ' current' : '');
                const lockIcon = isUnlocked ? '' : '<div class="level-lock">🔒</div>';
                const nextBadge = isFrontier ? '<div class="level-next">▶ ' + _t('levels.frontier', 'Далі') + '</div>' : '';

                html += '<div class="' + cls + '" data-level="' + lvl.id + '" style="animation-delay:' + Math.min(i * 26, 400) + 'ms">' +
                    lockIcon +
                    nextBadge +
                    '<div class="level-num">' + lvl.id + '</div>' +
                    '<div class="level-name">' + lvlName + '</div>' +
                    '<div class="level-stars">' + (isUnlocked ? starsHtml : '🔒') + '</div>' +
                    '<div class="level-time">⏱ ' + lvl.duration + _t('time.sec', 'с') + '</div>' +
                    '</div>';
            }

            grid.innerHTML = html;

            const tiles = grid.querySelectorAll('.level-tile.unlocked');
            for (let i = 0; i < tiles.length; i++) {
                window.UI.safeBind(tiles[i], 'click', function () {
                    const lvlId = parseInt(this.getAttribute('data-level'), 10);
                    _clickSound();
                    try {
                        if (window.Game) window.Game.startCampaignLevel(lvlId);
                    } catch (e) {}
                });
            }
        } catch (e) {
            _log('error', 'buildLevelsGrid', e.message);
        }
    }

    // Екран перемоги рівня
    function showLevelVictory(data) {
        try {
            const U = window.Utils;
            const lvl = data.level;
            window.UI.setText('#vic-title', _t('hud.level', 'Рівень') + ' ' + lvl.id + ' — ' + _t('level.' + lvl.id, lvl.name) + ' ✓');
            _animateNumber('#vic-score', data.score || 0, function (v) { return U.formatNumber(v); });

            // Режим рівня кампанії: показуємо зірки та вимоги
            window.UI.toggle('#vic-stars-box', true);
            window.UI.toggle('#vic-details', true);
            window.UI.toggle('#btn-vic-levels', true);
            window.UI.toggle('#vic-newrecord', false);

            // Зірки
            const stars = data.stars || 1;
            for (let i = 1; i <= 3; i++) {
                const sEl = window.UI.$('#vic-star-' + i);
                if (sEl) {
                    sEl.classList.toggle('active', i <= stars);
                }
            }

            // Вимоги
            window.UI.setText('#vic-score-val', (data.score || 0) + ' / ' + lvl.starScore + (data.score >= lvl.starScore ? ' ✓' : ' ✗'));
            const req2El = window.UI.$('#vic-req-2');
            if (req2El) req2El.classList.toggle('ok', data.score >= lvl.starScore);

            const shieldOk = !data.shieldUsed && data.nearMisses >= 5;
            window.UI.setText('#vic-shield-val', (data.shieldUsed ? _t('victory.shieldDamaged', 'Щит пошкоджено') : _t('victory.noDamage', 'Без шкоди')) + ', ' + (data.nearMisses || 0) + '/5 near-miss' + (shieldOk ? ' ✓' : ' ✗'));
            const req3El = window.UI.$('#vic-req-3');
            if (req3El) req3El.classList.toggle('ok', shieldOk);

            // QOL: загальний баланс зірок кампанії після зарахування цих зірок
            try {
                const maxL = (window.Config && window.Config.MAX_LEVEL) || 15;
                const maxSt = (window.Config && window.Config.MAX_STARS) || (maxL * 3);
                let total = 0;
                const cc = window.State.data.campaign;
                if (cc && cc.stars) {
                    for (let k = 1; k <= maxL; k++) total += cc.stars[k] || 0;
                }
                window.UI.setText('#vic-total-stars',
                    _t('victory.totalStars', '⭐ Всього зірок: {x}/{y}')
                        .replace('{x}', total).replace('{y}', maxSt));
            } catch (e) {}

            // Кнопка "Наступний рівень"
            const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 15;
            const nextBtn = window.UI.$('#btn-vic-next');
            if (nextBtn) {
                nextBtn.classList.toggle('hidden', lvl.id >= maxLvl);
            }

            window.UI.showScreen('victory');
            try { if (window.AudioSys) window.AudioSys.playVictory(); } catch (e) {}
        } catch (e) {
            _log('error', 'showLevelVictory', e.message);
        }
    }

    // Екран результатів режиму (Time Attack тощо) — без зірок і вимог кампанії
    function showModeVictory(data) {
        try {
            const U = window.Utils;
        window.UI.setText('#vic-title', _t('mode.' + data.mode + '.done', 'Гру завершено!'));
        _animateNumber('#vic-score', data.score || 0, function (v) { return U.formatNumber(v); });

            window.UI.toggle('#vic-stars-box', false);
            window.UI.toggle('#vic-details', false);
            window.UI.toggle('#btn-vic-next', false);
            window.UI.toggle('#btn-vic-levels', false);
            window.UI.toggle('#btn-vic-retry', true);
            window.UI.toggle('#vic-newrecord', !!data.newRecord);

            window.UI.showScreen('victory');
            try { if (window.AudioSys) window.AudioSys.playVictory(); } catch (e) {}
        } catch (e) {
            _log('error', 'showModeVictory', e.message);
        }
    }

    // QOL-5: вкладки локального та світового лідербордів
    let _lbTab = 'local';
    let _lbMode = '';
    const _LB_MODES = ['', 'endless', 'daily', 'timeattack', 'survival', 'custom'];

    function _renderLbTabs() {
        const tabs = window.UI.$('#leaderboard-tabs');
        if (!tabs) return;
        tabs.innerHTML =
            '<button class="btn lb-tab' + (_lbTab === 'local' ? ' primary' : '') + '" data-tab="local">' + _t('lb.tabLocal', '🏠 Локальні') + '</button>' +
            '<button class="btn lb-tab' + (_lbTab === 'world' ? ' primary' : '') + '" data-tab="world">' + _t('lb.tabWorld', '🌍 Світ') + '</button>';
        const btns = tabs.querySelectorAll('.lb-tab');
        for (let i = 0; i < btns.length; i++) {
            window.UI.safeBind(btns[i], 'click', function () {
                _clickSound();
                _lbTab = this.getAttribute('data-tab') || 'local';
                buildLeaderboard();
            });
        }
    }

    function _renderLbModes() {
        const box = window.UI.$('#lb-modes');
        if (!box) return;
        if (_lbTab !== 'world') {
            box.classList.add('hidden');
            box.innerHTML = '';
            return;
        }
        box.classList.remove('hidden');
        let html = '';
        for (let i = 0; i < _LB_MODES.length; i++) {
            const m = _LB_MODES[i];
            const label = m === '' ? _t('lb.allModes', 'Всі') : (m === 'campaign' ? _t('hud.level', 'Рівень') : _t('lb.' + m, m));
            html += '<button class="btn lb-mode-chip' + (_lbMode === m ? ' primary' : '') + '" data-m="' + m + '">' + label + '</button>';
        }
        box.innerHTML = html;
        const chips = box.querySelectorAll('.lb-mode-chip');
        for (let i = 0; i < chips.length; i++) {
            window.UI.safeBind(chips[i], 'click', function () {
                _clickSound();
                _lbMode = this.getAttribute('data-m') || '';
                buildLeaderboard();
            });
        }
    }

    function _renderWorldRows(rows) {
        const box = window.UI.$('#leaderboard-list');
        if (!box) return;
        if (!rows) {
            box.innerHTML = '<div style="text-align:center;color:#8a92b2;padding:20px;">' +
                _t('lb.worldEmpty', 'Ще немає світових рекордів — стань першим!') + '</div>';
            return;
        }
        if (!rows.length) {
            box.innerHTML = '<div style="text-align:center;color:#8a92b2;padding:20px;">' +
                _t('leaderboard.empty', 'Ще немає збережених рекордів. Зіграйте забіг!') + '</div>';
            return;
        }
        const U = window.Utils;
        let html = '';
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rank = i + 1;
            const badge = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : '#' + rank));
            let modeText = _t('lb.' + r.mode, r.mode || '');
            if (r.mode === 'campaign') modeText = _t('hud.level', 'Рівень') + ' ' + (r.level || '?');
            html += '<div class="setting-row" style="padding:10px 0;">' +
                '<span class="setting-label">' + badge + ' <b>' + String(r.player || '?').replace(/[<>&]/g, '') + '</b>' +
                ' <span style="font-size:11px;color:#8a92b2;">· ' + modeText + '</span></span>' +
                '<span class="setting-value" style="font-size:17px;">' + U.formatNumber(r.score || 0) + '</span>' +
                '</div>';
        }
        box.innerHTML = html;
    }

    // ТОП-5 Рекордів
    function buildLeaderboard() {
        const box = window.UI.$('#leaderboard-list');
        if (!box) return;
        try {
            _renderLbTabs();
            _renderLbModes();

            if (_lbTab === 'world') {
                if (!(window.GlobalScores && window.GlobalScores.ready())) {
                    box.innerHTML = '<div style="text-align:center;color:#8a92b2;padding:20px;">☁ ' +
                        _t('cloud.notConfigured', 'Не налаштовано') + '</div>';
                    return;
                }
                box.innerHTML = '<div style="text-align:center;color:#8a92b2;padding:20px;">⏳ ' +
                    _t('lb.loading', 'Завантаження…') + '</div>';
                window.GlobalScores.top(_lbMode || null, 10).then(function (rows) {
                    // Малюємо лише якщо користувач ще на цій вкладці
                    if (_lbTab === 'world') _renderWorldRows(rows);
                });
                return;
            }

            const list = window.State.getLeaderboard();
            const U = window.Utils;
            if (list.length === 0) {
                box.innerHTML = '<div style="text-align:center; color:#8a92b2; padding:20px;">' + _t('leaderboard.empty', 'Ще немає збережених рекордів. Зіграйте забіг!') + '</div>';
                return;
            }
            let html = '';
            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                const rank = i + 1;
                const badge = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : '#' + rank));
                let modeText = _t('lb.' + item.mode, _t('lb.endless', 'Нескінченність'));
                if (item.mode === 'campaign') {
                    modeText = _t('hud.level', 'Рівень') + ' ' + (item.level || '?');
                }
                html += '<div class="setting-row" style="padding:10px 0;">' +
                    '<span class="setting-label">' + badge + ' ' + modeText + ' <span style="font-size:11px;color:#8a92b2;">(' + (item.date || '') + ')</span></span>' +
                    '<span class="setting-value" style="font-size:17px;">' + U.formatNumber(item.score) + '</span>' +
                    '</div>';
            }
            box.innerHTML = html;
        } catch (e) {
            _log('error', 'buildLeaderboard', e.message);
        }
    }

    function buildSkins() {
        const grid = window.UI.$('#skins-grid');
        if (!grid) return;
        try {
            const skins = window.Skins.list();
            const currentId = window.State.getSetting('skin');
            let html = '';
            for (let i = 0; i < skins.length; i++) {
                const s = skins[i];
                const active = s.id === currentId ? ' active' : '';
                const locked = s.unlocked ? '' : ' locked';
                const skinName = _t('skin.' + s.id, s.name);
                let iconStyle = 'background:' + s.color + ';';
                if (s.color === 'rainbow') {
                    iconStyle = 'background:linear-gradient(45deg,#ff0000,#ff8800,#ffff00,#00ff00,#0088ff,#8800ff);';
                }
                let unlockHint = '';
                if (!s.unlocked) {
                    unlockHint = '<div class="tile-label" style="color:#ff3860;font-size:10px;">' + _unlockText(s.unlock) + '</div>';
                } else {
                    unlockHint = '<div class="tile-label" style="font-size:10px; color:#8a92b2;">' + _t('skins.trail', 'Трейл') + ': ' + s.trailShape + '</div>';
                }
                html += '<div class="tile' + active + locked + '" data-skin="' + s.id + '">' +
                    '<div class="tile-icon" style="' + iconStyle + '"></div>' +
                    '<div class="tile-label">' + skinName + '</div>' +
                    unlockHint +
                    '</div>';
            }
            grid.innerHTML = html;

            const tiles = grid.querySelectorAll('.tile');
            for (let i = 0; i < tiles.length; i++) {
                window.UI.safeBind(tiles[i], 'click', function () {
                    const id = this.getAttribute('data-skin');
                    if (window.Skins.select(id)) {
                        _clickSound();
                        buildSkins();
                    } else {
                        try { window.UI.showToast(_t('skins.locked', 'Скін заблокований'), 'warn'); } catch (e) {}
                    }
                });
            }
        } catch (e) {
            _log('error', 'buildSkins', e.message);
        }
    }

    function _unlockText(u) {
        if (!u || u === 'free') return '';
        if (u.stats) {
            const names = {
                bestScore: _t('record', 'Рекорд'),
                bestCombo: _t('combo', 'Комбо'),
                starsCollected: _t('stars_collected', 'Зірки')
            };
            return (names[u.stats] || u.stats) + ' ≥ ' + u.value;
        }
        if (u.achievement) return _t('achievements.word', 'Досягнення');
        return '';
    }

    function buildAchievements() {
        const grid = window.UI.$('#achievements-grid');
        if (!grid) return;
        try {
            const achs = window.Achievements.list();
            let unlockedCount = 0;
            let html = '';
            for (let i = 0; i < achs.length; i++) {
                const a = achs[i];
                if (a.unlocked) unlockedCount++;
                const cls = a.unlocked ? ' active' : ' locked';
                const icon = a.unlocked ? '🏆' : '🔒';
                html += '<div class="tile' + cls + '">' +
                    '<div class="tile-icon">' + icon + '</div>' +
                    '<div class="tile-label">' + _t('ach.' + a.id + '.name', a.name) + '</div>' +
                    '<div class="tile-label" style="font-size:10px;">' + _t('ach.' + a.id + '.desc', a.desc) + '</div>' +
                    '</div>';
            }
            grid.innerHTML = html;
            window.UI.setText('#ach-progress',
                _t('achievements.progress', 'Розблоковано: {x}/{y}')
                    .replace('{x}', unlockedCount).replace('{y}', achs.length));
        } catch (e) {
            _log('error', 'buildAchievements', e.message);
        }
    }

    function buildStats() {
        const list = window.UI.$('#stats-list');
        if (!list) return;
        try {
            const s = window.State.getStats();
            const U = window.Utils;
            const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 15;
            const maxStars = (window.Config && window.Config.MAX_STARS) || (maxLvl * 3);
            let totalStars = 0;
            const c = window.State.data.campaign;
            if (c && c.stars) {
                for (let k = 1; k <= maxLvl; k++) totalStars += (c.stars[k] || 0);
            }

            const rows = [
                [_t('stats.bestScore', '🏆 Найкращий рахунок'), U.formatNumber(s.bestScore || 0)],
                [_t('stats.campaignStars', '⭐ Зірок у кампанії'), totalStars + ' / ' + maxStars],
                [_t('stats.dailyStreak', '🔥 Серія викликів дня'), (s.dailyStreak || 0) + ' 🔥'],
                [_t('stats.bestCombo', '🔥 Найкраще комбо'), s.bestCombo || 0],
                [_t('stats.totalGames', '🎮 Всього ігор'), s.totalGames || 0],
                [_t('stats.totalDeaths', '💀 Всього смертей'), s.totalDeaths || 0],
                [_t('stats.starsCollected', '⭐ Зірок зібрано під час гри'), s.starsCollected || 0],
                [_t('stats.stormsSurvived', '⚡ Штормів пережито'), s.stormsSurvived || 0],
                [_t('stats.nearMisses', '🎯 Near-miss'), s.nearMisses || 0],
                [_t('stats.ghostPasses', '👻 Крізь стіни'), s.ghostPasses || 0],
                [_t('stats.longestGame', '⏱ Найдовша гра'), U.formatTime(s.longestGame || 0)],
                [_t('stats.totalPlaytime', '🕐 Загальний час'), U.formatTime(s.totalPlaytime || 0)]
            ];
            let html = '';
            for (let i = 0; i < rows.length; i++) {
                html += '<div class="setting-row">' +
                    '<span class="setting-label">' + rows[i][0] + '</span>' +
                    '<span class="setting-value">' + rows[i][1] + '</span>' +
                    '</div>';
            }
            list.innerHTML = html;
        } catch (e) {
            _log('error', 'buildStats', e.message);
        }
    }

    // QOL: пауза показывает режим, счёт и время забега
    function updatePauseInfo(data) {
        try {
            const el = window.UI.$('#pause-info');
            if (!el) return;
            window.UI.toggle('#pause-info', true);
            const U = window.Utils;
            let modeText = _t('lb.' + (data.mode || 'endless'), data.mode || '—');
            if (data.mode === 'campaign' && data.level) {
                modeText = _t('hud.level', 'Рівень') + ' ' + data.level.id +
                    ' · ' + _t('level.' + data.level.id, data.level.name);
            }
            const rows = [
                [_t('pause.mode', 'Режим'), modeText],
                [_t('settings.difficulty', 'Складність'), _t('settings.' + ((window.State.getSetting('difficulty') || 'normal')), 'Normal')],
                [_t('score', 'Очки'), U.formatNumber(data.score || 0)],
                [_t('time', 'Час'), U.formatTime(data.elapsed || 0)]
            ];
            let html = '';
            for (let i = 0; i < rows.length; i++) {
                html += '<div class="pause-info-row"><span>' + rows[i][0] + '</span><b>' + rows[i][1] + '</b></div>';
            }
            el.innerHTML = html;
        } catch (e) {
            _log('error', 'updatePauseInfo', e.message);
        }
    }

    function showGameOver(data) {
        try {
            const U = window.Utils;
            _animateNumber('#go-score', data.score || 0, function (v) { return U.formatNumber(v); });
            window.UI.setText('#go-best', U.formatNumber(data.best || 0));
            window.UI.setText('#go-combo', data.combo || 0);
            window.UI.setText('#go-stars', data.stars || 0);
            window.UI.toggle('#go-newrecord', !!data.newRecord);

            // Рекорд дня — только в режиме Daily Challenge
            const hasDaily = typeof data.dailyBest === 'number';
            window.UI.toggle('#go-dailybest', hasDaily);
            if (hasDaily) {
                window.UI.setText('#go-dailybest-val', U.formatNumber(data.dailyBest));
            }

            // QOL: причина смерти — в что врезался
            const hasCause = !!data.cause;
            window.UI.toggle('#go-cause', hasCause);
            if (hasCause) {
                window.UI.setText('#go-cause-val', _t('cause.' + data.cause, data.cause));
            }

            const levelsBtn = window.UI.$('#btn-gameover-levels');
            if (levelsBtn) {
                levelsBtn.classList.toggle('hidden', data.mode !== 'campaign');
            }

            window.UI.showScreen('gameover');
        } catch (e) {
            _log('error', 'showGameOver', e.message);
        }
    }

    window.Screens = {
        init: init,
        buildLevelsGrid: buildLevelsGrid,
        showLevelVictory: showLevelVictory,
        showModeVictory: showModeVictory,
        buildLeaderboard: buildLeaderboard,
        buildSkins: buildSkins,
        buildAchievements: buildAchievements,
        buildStats: buildStats,
        updateMenuStats: updateMenuStats,
        updatePauseInfo: updatePauseInfo,
        showGameOver: showGameOver,
        updateLanguage: updateLanguage
    };
})();
