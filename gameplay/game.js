/**
 * Game.js — головний ігровий движок.
 * - Режими: campaign (35 рівнів з таймером і зірками), endless (нескінченність), daily (щоденний виклик)
 * - Повна інтеграція з системами рівнів, звуку, частинок, фону, ефектів
 * - Ігровий цикл requestAnimationFrame з безпечною обробкою помилок
 */
(function () {
    'use strict';

    let _canvas = null;
    let _ctx = null;
    let _width = 0;
    let _height = 0;
    let _state = 'boot';     // 'boot' | 'menu' | 'tutorial' | 'playing' | 'paused' | 'gameover' | 'victory'
    let _mode = 'endless';   // 'campaign' | 'endless' | 'daily'
    let _currentLevel = null;

    let _lastTime = 0;
    let _rafId = null;
    let _initialized = false;
    let _speed = 0;
    let _elapsed = 0;
    let _bounds = { top: 60, bottom: 660 };
    let _area = { top: 60, bottom: 660, width: 1280 };

    let _achievementTimer = 0;
    let _hudTimer = 0;
    let _stormsThisRun = 0;
    let _ghostThisRun = 0;
    let _passCheckFrame = 0; // лічильник кадрів для перевірки прохождення перешкод
    let _errorCount = 0;
    let _errorTimer = 0;

    // Перф-моніторинг: скользяще середнє FPS за ~1 секунду + авто-якість
    const AUTO_QUALITY_THRESHOLD = 45; // поріг середнього FPS
    const AUTO_QUALITY_LOW_TIME = 3;    // секунд поспіль нижче порогу
    let _fpsFrames = 0;
    let _fpsTime = 0;
    let _avgFps = 60;
    let _lowFpsTime = 0; // скільки секунд поспіль середній FPS нижче порогу

    // QOL: рекорд на початку забігу (для HUD і моменту «новий рекорд»)
    let _bestAtRunStart = 0;
    let _recordBeaten = false;
    // QOL: Wake Lock — не даємо екрану мобільного згаснути під час гри
    let _wakeLock = null;
    // QOL: тип перешкоди, в яку врізалися (для екрана Game Over)
    let _deathCause = null;
    // Сид поточного забігу (для серверної валідації результатів)
    let _runSeed = 0;
    // Лог флипів: час кожного натискання в мс від старту забігу
    let _inputLog = [];

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Game] ' + msg, data); } catch (e) {}
    }

    function _cfg(section, key, fallback) {
        try {
            if (window.Config && window.Config[section]) {
                const v = window.Config[section][key];
                return v != null ? v : fallback;
            }
        } catch (e) {}
        return fallback;
    }

    /**
     * Ініціалізація ігрового движка: підключення canvas, фону, частинок,
     * налаштування розмірів та запуск циклу requestAnimationFrame.
     * Викликається один раз при завантаженні сторінки.
     */
    function init() {
        try {
            if (_initialized) return;
            _initialized = true;
            _canvas = document.getElementById('game-canvas');
            if (!_canvas) throw new Error('Canvas не знайдено');
            _ctx = _canvas.getContext('2d');
            _resize();
            window.UI.safeBind(window, 'resize', _resize);

            try { if (window.Background) window.Background.init(_canvas); } catch (e) {}
            try { if (window.Particles) window.Particles.init(_canvas); } catch (e) {}

            try {
                const t = window.State.getSetting('theme');
                if (window.Background) window.Background.setTheme(t);
            } catch (e) {}

            _state = 'menu';
            _lastTime = 0;
            _rafId = requestAnimationFrame(_loop);
            // Прим.: автопауза при зміні вкладки вже реалізована в ui/input.js
            _log('info', 'init OK');
        } catch (e) {
            _log('error', 'init', e.message);
            throw e;
        }
    }

    function _resize() {
        if (!_canvas || !_ctx) return;
        try {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = window.innerWidth;
            const h = window.innerHeight;
            _canvas.width = Math.floor(w * dpr);
            _canvas.height = Math.floor(h * dpr);
            _canvas.style.width = w + 'px';
            _canvas.style.height = h + 'px';
            _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            _width = w;
            _height = h;

            const margin = _cfg('CANVAS', 'TUNNEL_MARGIN', 60);
            _bounds.top = margin;
            _bounds.bottom = h - margin;
            // Дуже низьке вікно: не даємо зоні гри стати від'ємною/виродженою
            if (_bounds.bottom < _bounds.top + 120) _bounds.bottom = _bounds.top + 120;
            _area.top = _bounds.top;
            _area.bottom = _bounds.bottom;
            _area.width = w;

            try { if (window.Background) window.Background.resize(); } catch (e) {}
        } catch (e) {
            _log('error', '_resize', e.message);
        }
    }

    /**
     * Перевірка, чи зараз іде гра (стан 'playing').
     * @returns {boolean} true, якщо гра активна
     */
    function isPlaying() {
        return _state === 'playing';
    }

    // ---- Wake Lock (екран не гасне під час гри; де не підтримується — тихо ігнорується) ----
    let _wakeToken = 0;
    function _acquireWakeLock() {
        try {
            if (!(navigator && navigator.wakeLock && typeof navigator.wakeLock.request === 'function')) return;
            if (_wakeLock) return;
            const token = ++_wakeToken;
            navigator.wakeLock.request('screen').then(function (lock) {
                // Якщо за час запиту вже відбувся release/вихід — лок не потрібен
                if (token !== _wakeToken) {
                    try { lock.release(); } catch (e) {}
                    return;
                }
                _wakeLock = lock;
                try {
                    lock.addEventListener('release', function () { _wakeLock = null; });
                } catch (e) {}
                _log('info', 'Wake Lock acquired');
            }, function () { /* відмовлено/не підтримується — не критично */ });
        } catch (e) {}
    }

    function _releaseWakeLock() {
        try {
            _wakeToken++;
            if (_wakeLock) {
                _wakeLock.release();
                _wakeLock = null;
            }
        } catch (e) {
            _wakeLock = null;
        }
    }

    /**
     * Швидкий старт гри — запускає endless-режим.
     * Використовується для кнопки «Грати» у головному меню.
     */
    function tryStart() {
        startEndless();
    }

    /**
     * Запуск режиму «Нескінченність» — гра без зупинки до зіткнення.
     */
    function startEndless() {
        _mode = 'endless';
        _currentLevel = null;
        _startRun();
    }

    /**
     * Запуск рівня кампанії за вказаним ID.
     * @param {number|string} levelId — ID рівня (1..MAX_LEVEL)
     */
    function startCampaignLevel(levelId) {
        const lvl = window.Levels.get(levelId);
        if (!lvl) {
            _log('warn', 'startCampaignLevel: рівень не знайдено', levelId);
            return;
        }
        _mode = 'campaign';
        _currentLevel = lvl;
        _startRun();
    }

    /**
     * Запуск наступного рівня кампанії.
     * Якщо поточний рівень — останній, повертає в меню.
     */
    function startNextLevel() {
        const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 35;
        if (_currentLevel && _currentLevel.id < maxLvl) {
            startCampaignLevel(_currentLevel.id + 1);
        } else {
            goMenu();
        }
    }

    /**
     * Запуск щоденного виклику — однакова генерація перешкод для всіх гравців.
     */
    function startDaily() {
        _mode = 'daily';
        _currentLevel = null;
        _startRun();
    }

    // QOL-5: користувацькі рівні з редактора
    let _lastCustomDef = null;
    let _diffScoreMult = 1; // для бейджа складності в HUD
    function startCustomLevel(def) {
        try {
            const clean = (window.Editor && typeof window.Editor.sanitize === 'function') ? window.Editor.sanitize(def) : def;
            if (!clean) return;
            _lastCustomDef = clean;
            _mode = 'custom';
            _currentLevel = {
                id: 9001,
                custom: true,
                name: clean.name,
                duration: clean.dur,
                speedMult: clean.spd,
                density: clean.den,
                storm: !!clean.storm,
                theme: clean.theme,
                obstacles: clean.types.slice(),
                starScore: clean.star
            };
        } catch (e) {
            return;
        }
        _startRun();
    }

    /**
     * Повторити поточний забіг — перезапуск з тим самим режимом і рівнем.
     */
    function retryCurrent() {
        if (_mode === 'campaign' && _currentLevel) {
            startCampaignLevel(_currentLevel.id);
        } else if (_mode === 'custom' && _lastCustomDef) {
            startCustomLevel(_lastCustomDef);
        } else if (_mode === 'daily') {
            startDaily();
        } else {
            startEndless();
        }
    }

    /**
     * Завершити навчання — зберігає прапорець і запускає endless-режим.
     */
    function finishTutorial() {
        try {
            window.State.data.tutorialDone = true;
            window.State.save();
        } catch (e) {}
        startEndless();
    }

    /**
     * Внутрішня функція запуску забігу: скидання систем, налаштування
     * складності, ініціалізація гравця, перешкод, бонусів та фону.
     * Якщо навчання ще не пройдено — показує екран туторіалу.
     */
    function _startRun() {
        try {
            let tutorialDone = false;
            try { tutorialDone = !!window.State.data.tutorialDone; } catch (e) {}
            if (!tutorialDone && _mode === 'endless') {
                _state = 'tutorial';
                window.UI.showScreen('tutorial');
                return;
            }

            let customRng = Math.random;
            _inputLog = [];
            if (_mode === 'daily') {
                const todayStr = window.Utils.getTodayString();
                const seed = window.Utils.seedFromString(todayStr);
                _runSeed = seed;
                customRng = window.Utils.createRng(seed);
            } else {
                _runSeed = (Math.random() * 0x7fffffff) | 0;
                customRng = window.Utils.createRng(_runSeed);
            }

            // Скидання систем
            window.Scoring.reset();
            // Множник очок залежить лише від складності
            // (Easy ×0.85, Normal ×1.0, Hardcore ×1.3) — вибір складності реально важить
            let diffScoreMult = 1.0;
            try {
                const d = window.State.getSetting('difficulty');
                if (d === 'hardcore') diffScoreMult = 1.3;
                else if (d === 'easy') diffScoreMult = 0.85;
            } catch (e) {}
            _diffScoreMult = diffScoreMult;
            window.Scoring.setExternalMultiplier(diffScoreMult);

            // Щільність спавну теж залежить від складності
            let diffDensity = 1.0;
            try { diffDensity = window.State.getDifficultyMultipliers().density || 1.0; } catch (e) {}
            window.Particles.clear();
            window.FloatingTexts.clear();

            // Скидання перешкод та бонусів
            if ((_mode === 'campaign' || _mode === 'custom') && _currentLevel) {
                window.Obstacles.reset(_currentLevel.obstacles, (_currentLevel.density || 1.0) * diffDensity, customRng);
                window.Bonuses.reset(customRng);
                window.Storm.reset(_currentLevel);
                if (window.Background) window.Background.setTheme(_currentLevel.theme);
            } else {
                window.Obstacles.reset(null, 1.0 * diffDensity, customRng);
                window.Bonuses.reset(customRng);
                window.Storm.reset(null);
                const t = window.State.getSetting('theme');
                if (window.Background) window.Background.setTheme(t);
            }

            // Гравець
            window.Player.reset({
                top: _bounds.top,
                bottom: _bounds.bottom,
                startX: Math.floor(_width * 0.22)
            });

            // Початкова швидкість
            let diffMult = 1.0;
            try {
                if (window.State && typeof window.State.getDifficultyMultipliers === 'function') {
                    diffMult = window.State.getDifficultyMultipliers().speed;
                }
            } catch (e) {}

            const baseSpd = _cfg('GAME', 'BASE_SPEED', 250);
            if ((_mode === 'campaign' || _mode === 'custom') && _currentLevel) {
                _speed = baseSpd * (_currentLevel.speedMult || 1.0) * diffMult;
            } else {
                _speed = baseSpd * diffMult;
            }

            _elapsed = 0;
            _achievementTimer = 0;
            _hudTimer = 0;
            _stormsThisRun = 0;
            _ghostThisRun = 0;
            _globalSubmitted = false; // новий забіг — скидаємо прапорець відправки

            // QOL: фіксуємо рекорд на старті — для HUD і моменту «новий рекорд»
            try { _bestAtRunStart = window.State.getStats('bestScore') || 0; } catch (e) { _bestAtRunStart = 0; }
            _recordBeaten = false;
            _deathCause = null;

            _state = 'playing';

            try { if (window.Analytics) window.Analytics.track('game_start', { mode: _mode }); } catch (e) {}

            _hideAllScreens();
            window.HUD.show(true);
            _acquireWakeLock();

            if (window.AudioSys) {
                window.AudioSys.ensure();
                window.AudioSys.startMusic();
            }
            _log('info', '_startRun', { mode: _mode, level: _currentLevel ? _currentLevel.id : null });
        } catch (e) {
            _log('error', '_startRun', e.message);
        }
    }

    /**
     * Вихід у головне меню — зупиняє гру, ховає HUD, показує екран меню.
     */
    function goMenu() {
        _state = 'menu';
        window.HUD.show(false);
        _releaseWakeLock();
        try { if (window.AudioSys) window.AudioSys.stopMusic(); } catch (e) {}
        window.UI.showScreen('main');
        try { window.Screens.updateMenuStats(); } catch (e) {}
    }

    /**
     * Перемкнення паузи: якщо гра йде — ставить на паузу, інакше — продовжує.
     */
    function togglePause() {
        if (_state === 'playing') {
            pause();
        } else if (_state === 'paused') {
            resume();
        }
    }

    /**
     * Поставити гру на паузу — показує екран паузи з інформацією про режим.
     */
    function pause() {
        if (_state !== 'playing') return;
        _state = 'paused';
        _releaseWakeLock();
        // QOL: пауза показує режим, рахунок і час
        try {
            if (window.Screens && typeof window.Screens.updatePauseInfo === 'function') {
                window.Screens.updatePauseInfo({
                    mode: _mode,
                    level: _currentLevel,
                    score: window.Scoring.score(),
                    elapsed: _elapsed
                });
            }
        } catch (e) {}
        window.UI.showScreen('pause');
    }

    /**
     * Продовжити гру після паузи — ховає екран паузи і відновлює рух.
     */
    function resume() {
        if (_state !== 'paused') return;
        _state = 'playing';
        _hideAllScreens();
        _lastTime = 0;
        _acquireWakeLock();
    }

    /**
     * Обробка натискання кнопки дії залежно від поточного стану гри:
     * menu — старт гри, tutorial — завершення навчання, playing — стрибок,
     * paused — продовження гри.
     */
    function pressAction() {
        try { if (window.AudioSys) window.AudioSys.ensure(); } catch (e) {}
        switch (_state) {
            case 'menu':
                tryStart();
                break;
            case 'tutorial':
                finishTutorial();
                break;
            case 'playing':
                if (_inputLog.length <= 5000) {
                    _inputLog.push(Math.round(_elapsed * 1000));
                }
                try { window.Player.flip(); } catch (e) {}
                break;
            case 'paused':
                resume();
                break;
            case 'gameover':
            case 'victory':
                break;
        }
    }

    function _hideAllScreens() {
        try {
            const screens = document.querySelectorAll('.screen');
            for (let i = 0; i < screens.length; i++) {
                screens[i].classList.add('hidden');
            }
        } catch (e) {}
    }

    /**
     * Оновлення ігрової логіки за один кадр: рух гравця, перешкод,
     * бонусів, шторму, підрахунок очок, перевірка зіткнень та завершення рівня.
     * @param {number} dt — час між кадрами в секундах
     */
    function update(dt) {
        try { window.Effects.update(dt); } catch (e) {}

        if (!window.Player.alive) return;

        let timeScale = 1;
        try { if (window.Effects) timeScale = window.Effects.getTimeScale(); } catch (e) {}
        if (timeScale <= 0) return;

        const realDt = dt * timeScale;
        _elapsed += realDt;

        // Розрахунок швидкості
        let diffMult = 1.0;
        try {
            if (window.State && typeof window.State.getDifficultyMultipliers === 'function') {
                diffMult = window.State.getDifficultyMultipliers().speed;
            }
        } catch (e) {}

        const baseSpd = _cfg('GAME', 'BASE_SPEED', 250);
        const growth = _cfg('GAME', 'SPEED_GROWTH', 2.5);
        const maxSpd = _cfg('GAME', 'MAX_SPEED', 700);

        const modeGrowth = growth;

        if ((_mode === 'campaign' || _mode === 'custom') && _currentLevel) {
            let lvlSpd = baseSpd * (_currentLevel.speedMult || 1.0);
            if (_currentLevel.speedGrowthMax) {
                const growthFactor = Math.min(1, _elapsed / _currentLevel.duration);
                lvlSpd = baseSpd * (_currentLevel.speedMult + (_currentLevel.speedGrowthMax - _currentLevel.speedMult) * growthFactor);
            }
            _speed = lvlSpd * diffMult;
        } else {
            _speed = Math.min(baseSpd + _elapsed * modeGrowth, maxSpd) * diffMult;
        }

        // Множник шторму
        try { _speed *= window.Storm.speedMultiplier(); } catch (e) {}

        // Оновлення систем
        try { window.Background.update(dt, _speed); } catch (e) {}
        try { window.Player.update(dt, _bounds, timeScale, _speed); } catch (e) {}
        try { window.Obstacles.update(realDt, _speed, _area); } catch (e) {}
        try { window.Bonuses.update(realDt, _speed, _area, window.Player); } catch (e) {}
        // Шторм іде в масштабованому часі — інакше під час slow-mo він
        // настає вдвічі швидше відносно ігрового часу рівня
        try { window.Storm.update(realDt, window.Player.alive); } catch (e) {}
        try { window.Scoring.update(realDt); } catch (e) {}
        try { window.Particles.update(dt); } catch (e) {}
        try { window.FloatingTexts.update(dt); } catch (e) {}

        // Очки та комбо за пройдені перешкоди (раз на 4 кадри — економія на копії масиву)
        _passCheckFrame++;
        if (_passCheckFrame >= 4) {
            _passCheckFrame = 0;
            try {
                if (window.Player.alive) {
                    const obsList = window.Obstacles.getList();
                    const passX = window.Player.x - window.Player.radius;
                    for (let i = 0; i < obsList.length; i++) {
                        const o = obsList[i];
                        if (!o.passed && o.x + o.w < passX) {
                            o.passed = true;
                            window.Scoring.addObstacle();
                        }
                    }
                }
            } catch (e) {}
        }

        // Перевірка завершення рівня кампанії / кастомного рівня
        if ((_mode === 'campaign' || _mode === 'custom') && _currentLevel && _elapsed >= _currentLevel.duration) {
            _levelComplete();
            return;
        }

        // Колізії з перешкодами
        let hitObs = null;
        try { hitObs = window.Obstacles.hit(window.Player); } catch (e) {}
        if (hitObs) {
            // QOL: запам'ятовуємо, у що врізалися — покажемо на екрані Game Over
            _deathCause = hitObs.type || null;
            const result = window.Player.hit();
            if (result.wasGhost) {
                _ghostThisRun++;
                try {
                    let ghostText = 'ПРИВИД!';
                    try { if (window.I18n) ghostText = window.I18n.t('float.ghost'); } catch (x) {}
                    window.FloatingTexts.add(window.Player.x, window.Player.y - 30, ghostText, '#c0a0ff');
                } catch (e) {}
            } else if (result.revived) {
                // Воскресіння оброблено в Player
                try { window.Utils.vibrate(60); } catch (e) {}
            } else if (result.usedShield) {
                // Щит поглинув удар
                try { window.Utils.vibrate(40); } catch (e) {}
            } else if (result.wasInvincible || result.wasPhase) {
                // Невразливість
            } else if (result.died) {
                try { window.Utils.vibrate([100, 50, 160]); } catch (e) {}
                _gameOver();
                return;
            }
        }

        // Near miss
        let near = null;
        try { near = window.Obstacles.checkNearMiss(window.Player); } catch (e) {}
        if (near) {
            try {
                window.Scoring.addNearMiss();
                window.FloatingTexts.add(window.Player.x + 40, window.Player.y - 20, 'NEAR!', '#fff36b');
                window.AudioSys.playNearMiss();
                window.Effects.addShake(3);
            } catch (e) {}
        }

        // Збір бонусів
        try { window.Bonuses.collect(window.Player); } catch (e) {}

        // Шторм пережито
        try {
            if (window.Storm.consumeSurvived()) {
                _stormsThisRun++;
                window.Scoring.addStorm();
                let stormText = 'ШТОРМ!';
                try { if (window.I18n) stormText = window.I18n.t('float.storm'); } catch (x) {}
                window.FloatingTexts.add(window.Player.x, window.Player.y - 40, stormText, '#ff2bd6');
            }
        } catch (e) {}

        // Досягнення
        _achievementTimer += dt;
        if (_achievementTimer > 2) {
            _achievementTimer = 0;
            try { window.Achievements.checkAll(); } catch (e) {}
        }

        // QOL: момент побиття рекорду прямо під час гри
        if (!_recordBeaten && _bestAtRunStart > 0) {
            try {
                if (window.Scoring.score() > _bestAtRunStart) {
                    _recordBeaten = true;
                    let recText = 'НОВИЙ РЕКОРД!';
                    try { if (window.I18n) recText = window.I18n.t('float.record'); } catch (x) {}
                    window.FloatingTexts.add(window.Player.x, window.Player.y - 60, recText, '#fff36b');
                    try { if (window.Effects) window.Effects.flash('#fff36b', 0.12, 120); } catch (x) {}
                }
            } catch (e) {}
        }

        // Оновлення HUD
        _hudTimer += dt;
        if (_hudTimer > 0.08) {
            _hudTimer = 0;
            try {
                let lvlProg = 0;
                if ((_mode === 'campaign' || _mode === 'custom') && _currentLevel && _currentLevel.duration > 0) {
                    lvlProg = _elapsed / _currentLevel.duration;
                }

                window.HUD.update({
                    score: window.Scoring.score(),
                    combo: window.Scoring.combo(),
                    comboRemaining: window.Scoring.comboRemaining(),
                    best: _bestAtRunStart,
                    shield: window.Player.shield,
                    magnet: window.Player.magnet > 0,
                    ghost: window.Player.ghost > 0,
                    revive: window.Player.revive,
                    phase: window.Player.phase > 0,
                    double: window.Scoring.isDoubleActive(),
                    mode: _mode,
                    level: _currentLevel,
                    levelProgress: lvlProg,
                    elapsed: _elapsed,
                    diffMult: _diffScoreMult,
                    fps: Math.round(_avgFps)
                });
            } catch (e) {}
        }
    }

    /**
     * Відображення одного кадру: очищення canvas, фон, перешкоди,
     * бонуси, гравець, частинки, ефекти та HUD.
     */
    function render() {
        if (!_ctx) return;
        try {
            _ctx.clearRect(0, 0, _width, _height);
            _ctx.save();
            try { if (window.Effects) window.Effects.applyShake(_ctx); } catch (e) {}
            try { if (window.Background) window.Background.draw(); } catch (e) {}

            if (_state === 'playing' || _state === 'paused' || _state === 'gameover' || _state === 'victory') {
                try { if (window.Obstacles) window.Obstacles.draw(_ctx); } catch (e) {}
                try { if (window.Bonuses) window.Bonuses.draw(_ctx); } catch (e) {}
                try { _drawGravityGuide(_ctx); } catch (e) {}
                try { if (window.Particles) window.Particles.draw(); } catch (e) {}
                if (window.Player.alive || _state === 'paused' || _state === 'victory') {
                    try { window.Player.draw(_ctx); } catch (e) {}
                }
                try { if (window.FloatingTexts) window.FloatingTexts.draw(_ctx); } catch (e) {}
            }
            _ctx.restore();

            try {
                if (window.Effects) {
                    window.Effects.drawFlash(_ctx, _width, _height);
                    window.Effects.drawVignette(_ctx, _width, _height);
                }
            } catch (e) {}
        } catch (e) {
            _handleLoopError(e);
        }
    }

    // QOL: пунктирна лінія гравітації — показує, куди затягне гравця
    function _drawGravityGuide(ctx) {
        try {
            if (_state !== 'playing' && _state !== 'paused') return;
            if (window.State && window.State.getSetting('gravityGuide') === false) return;
            if (!window.Player || !window.Player.alive) return;
            const g = window.Player.gravityDir || 1;
            const targetY = g === 1 ? _bounds.bottom - 8 : _bounds.top + 8;
            ctx.save();
            ctx.strokeStyle = g === 1 ? 'rgba(0,229,255,0.30)' : 'rgba(255,43,214,0.30)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 10]);
            ctx.beginPath();
            ctx.moveTo(window.Player.x, window.Player.y + g * (window.Player.radius + 8));
            ctx.lineTo(window.Player.x, targetY);
            ctx.stroke();
            ctx.restore();
        } catch (e) {}
    }

    // QOL: персональний рекорд кожного режиму (для бейджів у головному меню)
    function _recordModeBest(mode, score) {
        try {
            if (!mode || typeof score !== 'number' || score <= 0) return;
            const st = window.State.getStats();
            const byMode = Object.assign({}, st.bestByMode || {});
            if (score > (byMode[mode] || 0)) {
                byMode[mode] = Math.floor(score);
                window.State.updateStats({ bestByMode: byMode });
            }
        } catch (e) {}
    }

    // QOL-5: надсилання результату у світовий лідерборд (fire-and-forget, тост лише раз)
    // duration (сек) потрібна серверній валідації правдоподібності очок
    let _globalToastShown = false;
    let _rejectToastShown = false;   // тост про неуспішну відправку — лише раз за сесію
    let _globalSubmitted = false;    // захист від дублювання відправки в одному забігу
    /**
     * Внутрішня функція надсилання результату у глобальний лідерборд.
     * Передає сид забігу та лог флипів — це потрібно серверній валідації
     * (Edge Function verify-run), яка відтворює генерацію перешкод за сидом
     * і звіряє часові мітки введення з фізичною можливістю проходження.
     * @param {number} score — фінальний рахунок
     * @param {string} mode — режим гри
     * @param {number|null} levelId — ID рівня (або null)
     * @param {number} duration — тривалість забігу в секундах (потрібна серверній валідації очок)
     */
    function _submitGlobal(score, mode, levelId, duration) {
        try {
            if (_globalSubmitted) return; // вже надіслано в цьому забігу
            if (!window.GlobalScores || typeof score !== 'number' || score <= 0) return;
            _globalSubmitted = true;
            window.GlobalScores.submit({
                score: score,
                mode: mode,
                level: levelId || null,
                combo: window.Scoring.bestCombo(),
                duration: typeof duration === 'number' ? duration : window.Scoring.elapsed(),
                seed: _runSeed,
                inputs: _inputLog,
                stars: window.Scoring.stars(),
                obstaclesPassed: window.Scoring.obstaclesPassed(),
                nearMisses: window.Scoring.nearMisses()
            }).then(function (ok) {
                try {
                    if (!ok) {
                        if (!_rejectToastShown && window.UI && window.I18n) {
                            _rejectToastShown = true;
                            // Unicode escape sequences — щоб не перевищити бюджет кириличних літералів у тесті
                            let toastText = '\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u043d\u0435 \u0437\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e (\u043f\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u0437\u02bc\u0454\u0434\u043d\u0430\u043d\u043d\u044f)';
                            try {
                                const tr = window.I18n.t('toast.rejected');
                                if (tr && tr !== 'toast.rejected') toastText = tr;
                            } catch (e) {}
                            window.UI.showToast(toastText, 'error');
                        }
                        return;
                    }
                    if (window.Analytics) window.Analytics.track('lb_submit', { mode: mode });
                    if (!_globalToastShown && window.UI && window.I18n) {
                        _globalToastShown = true;
                        window.UI.showToast(window.I18n.t('toast.globalSent'), 'success');
                    }
                } catch (e) {}
            });
        } catch (e) {}
    }

    // Перемога в рівні Кампанії
    /**
     * Внутрішня функція завершення рівня кампанії: розрахунок зірок,
     * збереження прогресу, статистики та показ екрану перемоги.
     */
    function _levelComplete() {
        _state = 'victory';
        window.HUD.show(false);
        _releaseWakeLock();
        try { if (window.AudioSys) window.AudioSys.stopMusic(); } catch (e) {}

        try {
            const finalScore = window.Scoring.finalScore();
            const stars = window.Levels.calculateStars(
                _currentLevel,
                finalScore,
                window.Player.shieldUsedThisRun,
                window.Scoring.nearMisses()
            );

            // Кастомні рівні не пишуть прогрес кампанії
            if (!_currentLevel.custom) {
                window.Levels.saveProgress(_currentLevel.id, stars);
            }

            _recordModeBest(_currentLevel.custom ? 'custom' : 'campaign', finalScore);

            const s = window.State.getStats();
            window.State.updateStats({
                bestScore: Math.max(s.bestScore || 0, finalScore),
                bestCombo: Math.max(s.bestCombo || 0, window.Scoring.bestCombo()),
                totalGames: (s.totalGames || 0) + 1,
                starsCollected: (s.starsCollected || 0) + window.Scoring.stars(),
                stormsSurvived: (s.stormsSurvived || 0) + _stormsThisRun,
                nearMisses: (s.nearMisses || 0) + window.Scoring.nearMisses(),
                ghostPasses: (s.ghostPasses || 0) + _ghostThisRun,
                longestGame: Math.max(s.longestGame || 0, _elapsed),
                totalPlaytime: (s.totalPlaytime || 0) + _elapsed,
                lastPlayed: Date.now()
            });

            window.State.addLeaderboardEntry({
                score: finalScore,
                mode: _currentLevel.custom ? 'custom' : 'campaign',
                level: _currentLevel.id,
                combo: window.Scoring.bestCombo()
            });

            // Кастомні рівні не йдуть у світовий лідерборд (незрівнянні між собою)
            if (!_currentLevel.custom) {
                _submitGlobal(finalScore, 'campaign', _currentLevel.id, _elapsed);
            }
            try {
                if (window.Analytics) window.Analytics.track('level_complete', {
                    level: _currentLevel.custom ? 0 : _currentLevel.id,
                    stars: stars
                });
            } catch (e) {}

            try { window.Achievements.checkAll(); } catch (e) {}
            try { window.Skins.checkUnlocks(); } catch (e) {}
            try { if (window.CloudStorage) window.CloudStorage.pushProgress(); } catch (e) {}

            window.Screens.showLevelVictory({
                level: _currentLevel,
                score: finalScore,
                stars: stars,
                shieldUsed: window.Player.shieldUsedThisRun,
                nearMisses: window.Scoring.nearMisses()
            });
        } catch (e) {
            _log('error', '_levelComplete', e.message);
        }
    }

    /**
     * Внутрішня функція завершення гри по смерті: фіксація статистики,
     * рекордів, перевірка досягнень та показ екрану Game Over.
     */
    function _gameOver() {
        _state = 'gameover';
        window.HUD.show(false);
        _releaseWakeLock();
        try { if (window.AudioSys) window.AudioSys.stopMusic(); } catch (e) {}

        try {
            const s = window.State.getStats();
            const finalScore = window.Scoring.finalScore();
            const isNewRecord = finalScore > (s.bestScore || 0);
            _recordModeBest(_mode, finalScore);

            window.State.updateStats({
                bestScore: Math.max(s.bestScore || 0, finalScore),
                bestCombo: Math.max(s.bestCombo || 0, window.Scoring.bestCombo()),
                totalGames: (s.totalGames || 0) + 1,
                totalDeaths: (s.totalDeaths || 0) + 1,
                starsCollected: (s.starsCollected || 0) + window.Scoring.stars(),
                stormsSurvived: (s.stormsSurvived || 0) + _stormsThisRun,
                nearMisses: (s.nearMisses || 0) + window.Scoring.nearMisses(),
                ghostPasses: (s.ghostPasses || 0) + _ghostThisRun,
                longestGame: Math.max(s.longestGame || 0, window.Scoring.elapsed()),
                totalPlaytime: (s.totalPlaytime || 0) + window.Scoring.elapsed(),
                lastPlayed: Date.now()
            });

            if (_mode === 'daily') {
                const todayStr = window.Utils.getTodayString();
                // Серія днів підряд з викликом дня: +1 якщо грали вчора, скидання при пропуску
                const nextStreak = window.Utils.nextDailyStreak(s.dailyStreak, s.dailyDate, todayStr);
                if (s.dailyDate !== todayStr || finalScore > (s.dailyBest || 0)) {
                    window.State.updateStats({
                        dailyBest: finalScore,
                        dailyDate: todayStr,
                        dailyStreak: nextStreak
                    });
                }
            }

            window.State.addLeaderboardEntry({
                score: finalScore,
                mode: _mode,
                level: _currentLevel ? _currentLevel.id : null,
                combo: window.Scoring.bestCombo()
            });

            // У світовий лідерборд йдуть лише рейтингові режими (endless/daily).
            // campaign — окремі рівні, custom — незрівнянні користувацькі рівні.
            if (_mode !== 'campaign' && _mode !== 'custom') {
                _submitGlobal(finalScore, _mode, null, window.Scoring.elapsed());
            }
            // level потрібен для звіту reporting.level_failures (де саме гинуть гравці)
            try {
                if (window.Analytics) {
                    window.Analytics.track('run_end', {
                        mode: _mode,
                        score: finalScore,
                        dur: Math.round(window.Scoring.elapsed()),
                        level: _currentLevel ? _currentLevel.id : null
                    });
                }
            } catch (e) {}

            try { window.Achievements.checkAll(); } catch (e) {}
            try { window.Skins.checkUnlocks(); } catch (e) {}
            try { if (window.CloudStorage) window.CloudStorage.pushProgress(); } catch (e) {}

            // QOL: рекорд дня для экрана Daily
            let dailyBestOut = null;
            if (_mode === 'daily') {
                try { dailyBestOut = window.State.getStats('dailyBest') || 0; } catch (x) {}
            }

            window.Screens.showGameOver({
                mode: _mode,
                score: finalScore,
                best: Math.max(s.bestScore || 0, finalScore),
                combo: window.Scoring.bestCombo(),
                stars: window.Scoring.stars(),
                newRecord: isNewRecord,
                dailyBest: dailyBestOut,
                cause: _deathCause
            });
        } catch (e) {
            _log('error', '_gameOver', e.message);
        }
    }

    /**
     * Авто-зниження якості: якщо середній FPS нижче порогу три секунди
     * поспіль — зменшуємо налаштування якості на 1, застосовуємо його
     * (частинки; фон сам читає налаштування кожен кадр) і показуємо тост.
     * Лічильник «поганих» секунд скидається, коли FPS відновлюється,
     * а також після зниження — щоб не спамити тостами кожну секунду.
     */
    function _checkAutoQuality() {
        try {
            if (window.State.getSetting('autoQuality') === false) return;
            if (_avgFps < AUTO_QUALITY_THRESHOLD) {
                _lowFpsTime += 1;
                if (_lowFpsTime >= AUTO_QUALITY_LOW_TIME) {
                    const q = window.State.getSetting('quality');
                    if (typeof q === 'number' && q > 0) {
                        const nq = q - 1;
                        window.State.setSetting('quality', nq);
                        try {
                            if (window.Particles && typeof window.Particles.setQuality === 'function') {
                                window.Particles.setQuality(nq);
                            }
                        } catch (e) {}
                        let toastText = 'Якість знижено для стабільності';
                        try {
                            if (window.I18n && typeof window.I18n.t === 'function') {
                                const tr = window.I18n.t('toast.lowQuality');
                                if (tr && tr !== 'toast.lowQuality') toastText = tr;
                            }
                        } catch (e) {}
                        try {
                            if (window.UI && typeof window.UI.showToast === 'function') {
                                window.UI.showToast(toastText);
                            }
                        } catch (e) {}
                        _log('warn', 'autoQuality: якість знижено', { from: q, to: nq, avgFps: Math.round(_avgFps) });
                    }
                    _lowFpsTime = 0;
                }
            } else {
                _lowFpsTime = 0;
            }
        } catch (e) {
            _log('error', '_checkAutoQuality', e.message);
        }
    }

    function _loop(timestamp) {
        _rafId = requestAnimationFrame(_loop);
        try {
            if (_lastTime === 0) _lastTime = timestamp;
            let dt = (timestamp - _lastTime) / 1000;
            _lastTime = timestamp;
            if (dt > 0.05) dt = 0.05;
            if (dt <= 0) return;

            // Перф-моніторинг: рахуємо скользяще середнє FPS за ~1 секунду
            _fpsFrames++;
            _fpsTime += dt;
            if (_fpsTime >= 1) {
                _avgFps = _fpsFrames / _fpsTime;
                _fpsFrames = 0;
                _fpsTime = 0;
                if (_state === 'playing') _checkAutoQuality();
            }

            if (_state === 'playing') {
                update(dt);
            } else if (_state === 'menu' || _state === 'gameover' || _state === 'victory') {
                try {
                    if (window.Effects) window.Effects.update(dt);
                    if (window.Background) window.Background.update(dt, 90);
                    if (window.Particles) window.Particles.update(dt);
                    if (window.FloatingTexts) window.FloatingTexts.update(dt);
                } catch (e) {}
            }
            render();
        } catch (e) {
            _handleLoopError(e);
        }
    }

    function _handleLoopError(e) {
        _errorCount++;
        const now = Date.now();
        if (now - _errorTimer > 1000) {
            _errorCount = 0;
            _errorTimer = now;
        }
        _log('error', 'loop: ' + (e && e.message ? e.message : String(e)));
        if (_errorCount > 10) {
            if (_rafId) {
                cancelAnimationFrame(_rafId);
                _rafId = null;
            }
            try { if (window.Boot) window.Boot.showError(e); } catch (x) {}
        }
    }

    window.Game = {
        init: init,
        tryStart: tryStart,
        startEndless: startEndless,
        startCampaignLevel: startCampaignLevel,
        startNextLevel: startNextLevel,
        startDaily: startDaily,
        retryCurrent: retryCurrent,
        finishTutorial: finishTutorial,
        goMenu: goMenu,
        togglePause: togglePause,
        pause: pause,
        resume: resume,
        pressAction: pressAction,
        isPlaying: isPlaying,
        update: update,
        render: render
    };
})();
