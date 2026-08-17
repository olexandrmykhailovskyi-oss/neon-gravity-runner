/**
 * Screens.js — побудова та керування всіма екранами гри.
 * - Головне меню (Кампанія, Нескінченність, Виклик дня, Скіни, Досягнення, Рекорди, Налаштування, Статистика)
 * - Кампанія: сітка 15 рівнів із зірками та замками
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
            '<h1>Neon Gravity Runner</h1>' +
            '<div class="menu-stats-row">' +
            '<span>🏆 Рекорд: <b id="menu-best">0</b></span>' +
            '<span>⭐ Зірки: <b id="menu-stars">0/45</b></span>' +
            '<span>🎮 Ігор: <b id="menu-games">0</b></span>' +
            '</div>' +
            '<div class="btn-grid main-menu-grid">' +
            '<button id="btn-campaign" class="btn primary highlight-btn">⭐ Кампанія (15 рівнів)</button>' +
            '<button id="btn-endless" class="btn primary">♾ Нескінченність</button>' +
            '<button id="btn-daily" class="btn accent-btn">📅 Виклик дня</button>' +
            '<button id="btn-skins" class="btn">🎨 Скіни</button>' +
            '<button id="btn-achievements" class="btn">🏆 Досягнення</button>' +
            '<button id="btn-leaderboard" class="btn">👑 Рекорди ТОП-5</button>' +
            '<button id="btn-settings" class="btn">⚙ Налаштування</button>' +
            '<button id="btn-stats" class="btn">📊 Статистика</button>' +
            '</div>' +
            '</div>';
    }

    function _buildLevelsScreen() {
        const el = window.UI.$('#screen-levels');
        if (!el) return;
        el.innerHTML =
            '<div class="panel levels-panel">' +
            '<h2>Вибір рівня кампанії</h2>' +
            '<p style="text-align:center;">Пройдіть усі 15 випробувань та зберіть максимум зірок!</p>' +
            '<div class="levels-grid" id="levels-grid"></div>' +
            '<div class="btn-grid" style="margin-top:18px;">' +
            '<button id="btn-levels-back" class="btn">← Назад у меню</button>' +
            '</div>' +
            '</div>';
    }

    function _buildVictoryScreen() {
        const el = window.UI.$('#screen-victory');
        if (!el) return;
        el.innerHTML =
            '<div class="panel victory-panel">' +
            '<h2 id="vic-title" style="color:#39ff14; text-shadow: 0 0 16px #39ff14;">Рівень пройдено!</h2>' +
            '<div class="victory-stars-box" id="vic-stars-box">' +
            '<span class="star-icon" id="vic-star-1">★</span>' +
            '<span class="star-icon" id="vic-star-2">★</span>' +
            '<span class="star-icon" id="vic-star-3">★</span>' +
            '</div>' +
            '<div class="victory-details">' +
            '<div class="vic-row" id="vic-req-1"><span>★ Вижити до кінця:</span> <b class="ok">ВИКОНАНО</b></div>' +
            '<div class="vic-row" id="vic-req-2"><span>★★ Рахунок:</span> <b id="vic-score-val">0 / 0</b></div>' +
            '<div class="vic-row" id="vic-req-3"><span>★★★ Без втрати щита та ≥5 Near-Miss:</span> <b id="vic-shield-val">—</b></div>' +
            '</div>' +
            '<div style="text-align:center; margin: 12px 0;">' +
            '<div style="font-size:32px; color:#00e5ff; font-weight:700;" id="vic-score">0</div>' +
            '<div style="color:#8a92b2;">Отримано очок у рівні</div>' +
            '</div>' +
            '<div class="btn-grid">' +
            '<button id="btn-vic-next" class="btn primary">Наступний рівень ▶</button>' +
            '<button id="btn-vic-retry" class="btn">↻ Повторити</button>' +
            '<button id="btn-vic-levels" class="btn">☰ Усі рівні</button>' +
            '<button id="btn-vic-menu" class="btn">У меню</button>' +
            '</div>' +
            '</div>';
    }

    function _buildLeaderboardScreen() {
        const el = window.UI.$('#screen-leaderboard');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2>👑 ТОП-5 Рекордів</h2>' +
            '<div id="leaderboard-list" style="margin: 14px 0;"></div>' +
            '<div class="btn-grid">' +
            '<button id="btn-leaderboard-back" class="btn">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    function _buildSkinsScreen() {
        const el = window.UI.$('#screen-skins');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2>Скіни гравця</h2>' +
            '<p style="text-align:center;">Кожен скін має свій колір та унікальну форму трейлу!</p>' +
            '<div class="grid" id="skins-grid"></div>' +
            '<div class="btn-grid">' +
            '<button id="btn-skins-back" class="btn">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    function _buildAchievementsScreen() {
        const el = window.UI.$('#screen-achievements');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2>Досягнення</h2>' +
            '<div class="grid" id="achievements-grid"></div>' +
            '<div class="btn-grid">' +
            '<button id="btn-achievements-back" class="btn">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    function _buildSettingsScreen() {
        const el = window.UI.$('#screen-settings');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2>Налаштування</h2>' +
            '<div class="setting-row">' +
            '<span class="setting-label">Складність</span>' +
            '<div id="diff-btns" class="btn-grid" style="margin:0;"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label">Звуки</span>' +
            '<input type="range" id="set-sfx" min="0" max="1" step="0.1">' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label">Музика</span>' +
            '<input type="range" id="set-music" min="0" max="1" step="0.1">' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label">Якість графіки</span>' +
            '<div id="quality-btns" class="btn-grid" style="margin:0;"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label">Тема оформлення</span>' +
            '<div id="theme-btns" class="btn-grid" style="margin:0;"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label">Зменшений рух (без тряски)</span>' +
            '<div class="switch" id="set-reduced-motion"></div>' +
            '</div>' +
            '<div class="setting-row">' +
            '<span class="setting-label">Вимкнути звук повністю</span>' +
            '<div class="switch" id="set-mute"></div>' +
            '</div>' +
            '<div class="btn-grid">' +
            '<button id="btn-settings-back" class="btn">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    function _buildStatsScreen() {
        const el = window.UI.$('#screen-stats');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2>Статистика пілота</h2>' +
            '<div id="stats-list"></div>' +
            '<div class="btn-grid">' +
            '<button id="btn-stats-back" class="btn">← Назад</button>' +
            '</div>' +
            '</div>';
    }

    function _buildPauseScreen() {
        const el = window.UI.$('#screen-pause');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2>Пауза</h2>' +
            '<div class="btn-grid">' +
            '<button id="btn-resume" class="btn primary">▶ Продовжити</button>' +
            '<button id="btn-pause-retry" class="btn">↻ Перезапустити</button>' +
            '<button id="btn-pause-menu" class="btn">У меню</button>' +
            '</div>' +
            '</div>';
    }

    function _buildGameOverScreen() {
        const el = window.UI.$('#screen-gameover');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2>Зіткнення!</h2>' +
            '<div style="text-align:center; margin-bottom:16px;">' +
            '<div style="font-size:42px; color:#ff3860; font-weight:700;" id="go-score">0</div>' +
            '<div style="color:#8a92b2; margin-top:4px;">' +
            'Рекорд: <span id="go-best">0</span> | ' +
            'Комбо: <span id="go-combo">0</span> | ' +
            'Зірки: <span id="go-stars">0</span>' +
            '</div>' +
            '<div id="go-newrecord" class="hidden" style="color:#fff36b; margin-top:8px; font-weight:700;">🎉 НОВИЙ РЕКОРД!</div>' +
            '</div>' +
            '<div class="btn-grid">' +
            '<button id="btn-retry" class="btn primary">↻ Повторити</button>' +
            '<button id="btn-gameover-levels" class="btn hidden" id="btn-go-levels">☰ Рівні</button>' +
            '<button id="btn-gameover-menu" class="btn">У меню</button>' +
            '</div>' +
            '</div>';
    }

    function _buildTutorialScreen() {
        const el = window.UI.$('#screen-tutorial');
        if (!el) return;
        el.innerHTML =
            '<div class="panel">' +
            '<h2>Як грати</h2>' +
            '<p>Натискай <b>SPACE</b>, клікай або тапай, щоб перемикати гравітацію.</p>' +
            '<p>Кожен стрибок дає імпульс. Уникай стін, лазерів, вогняних шипів і пульсарів!</p>' +
            '<p>🌀 <b>Гравітаційні зони</b> тимчасово перевертають гравітацію.</p>' +
            '<p>⚡ Кожні 45 секунд — <b>Neon Storm</b>!</p>' +
            '<div class="btn-grid">' +
            '<button id="btn-tutorial-start" class="btn primary">Почати політ!</button>' +
            '</div>' +
            '</div>';
    }

    function _bindButtons() {
        const UI = window.UI;

        // Головне меню
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

        // Назад
        UI.safeBind(UI.$('#btn-levels-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-skins-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-achievements-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-leaderboard-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-settings-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });
        UI.safeBind(UI.$('#btn-stats-back'), 'click', function () { _clickSound(); UI.showScreen('main'); });

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
    }

    function _buildQualityThemeDifficultyButtons() {
        try {
            const C = window.Config;

            // Складність
            const dBox = window.UI.$('#diff-btns');
            if (dBox) {
                const diffs = [
                    { id: 'easy', name: 'Легко' },
                    { id: 'normal', name: 'Нормально' },
                    { id: 'hardcore', name: 'Хардкор' }
                ];
                let html = '';
                for (let i = 0; i < diffs.length; i++) {
                    html += '<button class="btn diff-btn" data-d="' + diffs[i].id + '" style="min-width:80px;">' + diffs[i].name + '</button>';
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
                    html += '<button class="btn quality-btn" data-q="' + i + '" style="min-width:70px;">' + C.QUALITY[i].name + '</button>';
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
                    html += '<button class="btn theme-btn" data-t="' + i + '" style="min-width:90px;">' + C.THEMES[i].name + '</button>';
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
        } catch (e) {
            _log('error', '_buildQualityThemeDifficultyButtons', e.message);
        }
    }

    function _updateDifficultyUI() {
        try {
            const cur = window.State.getSetting('difficulty') || 'normal';
            const btns = document.querySelectorAll('.diff-btn');
            for (let i = 0; i < btns.length; i++) {
                btns[i].classList.toggle('primary', btns[i].getAttribute('data-d') === cur);
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
            _updateDifficultyUI();
            _updateQualityUI();
            _updateThemeUI();
        } catch (e) {}
    }

    function updateMenuStats() {
        try {
            const s = window.State.getStats();
            window.UI.setText('#menu-best', window.Utils.formatNumber(s.bestScore || 0));
            window.UI.setText('#menu-games', s.totalGames || 0);

            // Підрахунок зірок кампанії
            let totalStars = 0;
            const c = window.State.data.campaign;
            if (c && c.stars) {
                for (let k = 1; k <= 15; k++) {
                    totalStars += (c.stars[k] || 0);
                }
            }
            window.UI.setText('#menu-stars', totalStars + '/45');
        } catch (e) {}
    }

    // Сітка 15 рівнів кампанії
    function buildLevelsGrid() {
        const grid = window.UI.$('#levels-grid');
        if (!grid) return;
        try {
            const levels = (window.Config && window.Config.LEVELS) || [];
            const c = window.State.data.campaign || { maxLevel: 1, stars: {} };
            const maxLvl = c.maxLevel || 1;
            let html = '';

            for (let i = 0; i < levels.length; i++) {
                const lvl = levels[i];
                const isUnlocked = lvl.id <= maxLvl;
                const starsCount = (c.stars && c.stars[lvl.id]) || 0;

                let starsHtml = '';
                for (let s = 1; s <= 3; s++) {
                    starsHtml += s <= starsCount ? '<span class="star-on">★</span>' : '<span class="star-off">☆</span>';
                }

                const cls = isUnlocked ? 'level-tile unlocked' : 'level-tile locked';
                const lockIcon = isUnlocked ? '' : '<div class="level-lock">🔒</div>';

                html += '<div class="' + cls + '" data-level="' + lvl.id + '">' +
                    lockIcon +
                    '<div class="level-num">' + lvl.id + '</div>' +
                    '<div class="level-name">' + lvl.name + '</div>' +
                    '<div class="level-stars">' + (isUnlocked ? starsHtml : '🔒') + '</div>' +
                    '<div class="level-time">⏱ ' + lvl.duration + 'с</div>' +
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
            window.UI.setText('#vic-title', 'Рівень ' + lvl.id + ' пройдено!');
            window.UI.setText('#vic-score', U.formatNumber(data.score || 0));

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
            window.UI.setText('#vic-shield-val', (data.shieldUsed ? 'Щит пошкоджено' : 'Без шкоди') + ', ' + (data.nearMisses || 0) + '/5 near-miss' + (shieldOk ? ' ✓' : ' ✗'));
            const req3El = window.UI.$('#vic-req-3');
            if (req3El) req3El.classList.toggle('ok', shieldOk);

            // Кнопка "Наступний рівень"
            const nextBtn = window.UI.$('#btn-vic-next');
            if (nextBtn) {
                nextBtn.classList.toggle('hidden', lvl.id >= 15);
            }

            window.UI.showScreen('victory');
            try { if (window.AudioSys) window.AudioSys.playVictory(); } catch (e) {}
        } catch (e) {
            _log('error', 'showLevelVictory', e.message);
        }
    }

    // ТОП-5 Рекордів
    function buildLeaderboard() {
        const box = window.UI.$('#leaderboard-list');
        if (!box) return;
        try {
            const list = window.State.getLeaderboard();
            const U = window.Utils;
            if (list.length === 0) {
                box.innerHTML = '<div style="text-align:center; color:#8a92b2; padding:20px;">Ще немає збережених рекордів. Зіграйте забіг!</div>';
                return;
            }
            let html = '';
            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                const rank = i + 1;
                const badge = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : '#' + rank));
                const modeText = item.mode === 'campaign' ? ('Рівень ' + (item.level || '?')) : (item.mode === 'daily' ? 'Виклик дня' : 'Нескінченність');
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
                let iconStyle = 'background:' + s.color + ';';
                if (s.color === 'rainbow') {
                    iconStyle = 'background:linear-gradient(45deg,#ff0000,#ff8800,#ffff00,#00ff00,#0088ff,#8800ff);';
                }
                let unlockHint = '';
                if (!s.unlocked) {
                    unlockHint = '<div class="tile-label" style="color:#ff3860;font-size:10px;">' + _unlockText(s.unlock) + '</div>';
                } else {
                    unlockHint = '<div class="tile-label" style="font-size:10px; color:#8a92b2;">Трейл: ' + s.trailShape + '</div>';
                }
                html += '<div class="tile' + active + locked + '" data-skin="' + s.id + '">' +
                    '<div class="tile-icon" style="' + iconStyle + '"></div>' +
                    '<div class="tile-label">' + s.name + '</div>' +
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
                        try { window.UI.showToast('Скін заблокований', 'warn'); } catch (e) {}
                    }
                });
            }
        } catch (e) {
            _log('error', 'buildSkins', e.message);
        }
    }

    function _unlockText(u) {
        if (!u || u === 'free') return '';
        const names = { bestScore: 'Рекорд', bestCombo: 'Комбо', starsCollected: 'Зірки' };
        if (u.stats) {
            return (names[u.stats] || u.stats) + ' ≥ ' + u.value;
        }
        if (u.achievement) return 'Досягнення';
        return '';
    }

    function buildAchievements() {
        const grid = window.UI.$('#achievements-grid');
        if (!grid) return;
        try {
            const achs = window.Achievements.list();
            let html = '';
            for (let i = 0; i < achs.length; i++) {
                const a = achs[i];
                const cls = a.unlocked ? ' active' : ' locked';
                const icon = a.unlocked ? '🏆' : '🔒';
                html += '<div class="tile' + cls + '">' +
                    '<div class="tile-icon">' + icon + '</div>' +
                    '<div class="tile-label">' + a.name + '</div>' +
                    '<div class="tile-label" style="font-size:10px;">' + a.desc + '</div>' +
                    '</div>';
            }
            grid.innerHTML = html;
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
            let totalStars = 0;
            const c = window.State.data.campaign;
            if (c && c.stars) {
                for (let k = 1; k <= 15; k++) totalStars += (c.stars[k] || 0);
            }

            const rows = [
                ['🏆 Найкращий рахунок', U.formatNumber(s.bestScore || 0)],
                ['⭐ Зірок у кампанії', totalStars + ' / 45'],
                ['🔥 Найкраще комбо', s.bestCombo || 0],
                ['🎮 Всього ігор', s.totalGames || 0],
                ['💀 Всього смертей', s.totalDeaths || 0],
                ['⭐ Зірок зібрано під час гри', s.starsCollected || 0],
                ['⚡ Штормів пережито', s.stormsSurvived || 0],
                ['🎯 Near-miss', s.nearMisses || 0],
                ['👻 Крізь стіни', s.ghostPasses || 0],
                ['⏱ Найдовша гра', U.formatTime(s.longestGame || 0)],
                ['🕐 Загальний час', U.formatTime(s.totalPlaytime || 0)]
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

    function showGameOver(data) {
        try {
            const U = window.Utils;
            window.UI.setText('#go-score', U.formatNumber(data.score || 0));
            window.UI.setText('#go-best', U.formatNumber(data.best || 0));
            window.UI.setText('#go-combo', data.combo || 0);
            window.UI.setText('#go-stars', data.stars || 0);
            window.UI.toggle('#go-newrecord', !!data.newRecord);

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
        buildLeaderboard: buildLeaderboard,
        buildSkins: buildSkins,
        buildAchievements: buildAchievements,
        buildStats: buildStats,
        updateMenuStats: updateMenuStats,
        showGameOver: showGameOver
    };
})();
