/**
 * Game.js — головний ігровий движок.
 * - Режими: campaign (25 рівнів з таймером і зірками), endless (нескінченність), daily (щоденний виклик)
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
    let _speed = 0;
    let _elapsed = 0;
    let _bounds = { top: 60, bottom: 660 };
    let _area = { top: 60, bottom: 660, width: 1280 };

    let _achievementTimer = 0;
    let _hudTimer = 0;
    let _stormsThisRun = 0;
    let _ghostThisRun = 0;
    let _errorCount = 0;
    let _errorTimer = 0;

    // QOL: рекорд на початку забігу (для HUD і моменту «новий рекорд»)
    let _bestAtRunStart = 0;
    let _recordBeaten = false;
    // QOL: Wake Lock — не даємо екрану мобільного згаснути під час гри
    let _wakeLock = null;
    // QOL: тип перешкоди, в яку врізалися (для екрана Game Over)
    let _deathCause = null;

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

    function init() {
        try {
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
            _area.top = margin;
            _area.bottom = h - margin;
            _area.width = w;

            try { if (window.Background) window.Background.resize(); } catch (e) {}
        } catch (e) {
            _log('error', '_resize', e.message);
        }
    }

    function isPlaying() {
        return _state === 'playing';
    }

    // ---- Wake Lock (екран не гасне під час гри; де не підтримується — тихо ігнорується) ----
    function _acquireWakeLock() {
        try {
            if (!(navigator && navigator.wakeLock && typeof navigator.wakeLock.request === 'function')) return;
            if (_wakeLock) return;
            navigator.wakeLock.request('screen').then(function (lock) {
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
            if (_wakeLock) {
                _wakeLock.release();
                _wakeLock = null;
            }
        } catch (e) {
            _wakeLock = null;
        }
    }

    function tryStart() {
        startEndless();
    }

    function startEndless() {
        _mode = 'endless';
        _currentLevel = null;
        _startRun();
    }

    function startCampaignLevel(levelId) {
        _mode = 'campaign';
        _currentLevel = window.Levels.get(levelId);
        _startRun();
    }

    function startNextLevel() {
        const maxLvl = (window.Config && window.Config.MAX_LEVEL) || 15;
        if (_currentLevel && _currentLevel.id < maxLvl) {
            startCampaignLevel(_currentLevel.id + 1);
        } else {
            goMenu();
        }
    }

    function startDaily() {
        _mode = 'daily';
        _currentLevel = null;
        _startRun();
    }

    function startTimeAttack() {
        _mode = 'timeattack';
        _currentLevel = null;
        _startRun();
    }

    function startSurvival() {
        _mode = 'survival';
        _currentLevel = null;
        _startRun();
    }

    function startZen() {
        _mode = 'zen';
        _currentLevel = null;
        _startRun();
    }

    function retryCurrent() {
        if (_mode === 'campaign' && _currentLevel) {
            startCampaignLevel(_currentLevel.id);
        } else if (_mode === 'daily') {
            startDaily();
        } else if (_mode === 'timeattack') {
            startTimeAttack();
        } else if (_mode === 'survival') {
            startSurvival();
        } else if (_mode === 'zen') {
            startZen();
        } else {
            startEndless();
        }
    }

    function finishTutorial() {
        try {
            window.State.data.tutorialDone = true;
            window.State.save();
        } catch (e) {}
        startEndless();
    }

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
            if (_mode === 'daily') {
                const todayStr = window.Utils.getTodayString();
                const seed = window.Utils.seedFromString(todayStr);
                customRng = window.Utils.createRng(seed);
            }

            // Применение настроек режима
            let modeSettings = {};
            if (_mode === 'timeattack' || _mode === 'survival' || _mode === 'zen') {
                try {
                    if (window.Modes) {
                        modeSettings = window.Modes.getModeConfig(_mode) || {};
                    }
                } catch (e) {}
            }

            // Скидання систем
            window.Scoring.reset();
            // Множник очок режиму (Time Attack ×2, Survival ×1.5, Zen ×0)
            if (modeSettings && typeof modeSettings.scoreMultiplier === 'number') {
                window.Scoring.setExternalMultiplier(modeSettings.scoreMultiplier);
            } else {
                window.Scoring.setExternalMultiplier(1);
            }
            window.Particles.clear();
            window.FloatingTexts.clear();

            // Zen — спокійний режим: базові перешкоди, менша щільність, без штормів
            const ZEN_TYPES = ['wall', 'gate', 'moving', 'spikes'];

            // Скидання перешкод та бонусів
            if (_mode === 'campaign' && _currentLevel) {
                window.Obstacles.reset(_currentLevel.obstacles, _currentLevel.density || 1.0, customRng);
                window.Bonuses.reset(customRng);
                window.Storm.reset(_currentLevel);
                if (window.Background) window.Background.setTheme(_currentLevel.theme);
            } else if (_mode === 'zen') {
                window.Obstacles.reset(ZEN_TYPES, 0.7, customRng);
                window.Bonuses.reset(customRng);
                window.Storm.reset({ storm: false });
                const t = window.State.getSetting('theme');
                if (window.Background) window.Background.setTheme(t);
            } else {
                window.Obstacles.reset(null, 1.0, customRng);
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
            if (_mode === 'campaign' && _currentLevel) {
                _speed = baseSpd * (_currentLevel.speedMult || 1.0) * diffMult;
            } else {
                _speed = baseSpd * diffMult;
            }

            _elapsed = 0;
            _achievementTimer = 0;
            _hudTimer = 0;
            _stormsThisRun = 0;
            _ghostThisRun = 0;

            // QOL: фіксуємо рекорд на старті — для HUD і моменту «новий рекорд»
            try { _bestAtRunStart = window.State.getStats('bestScore') || 0; } catch (e) { _bestAtRunStart = 0; }
            _recordBeaten = false;
            _deathCause = null;

            _state = 'playing';

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

    function goMenu() {
        _state = 'menu';
        window.HUD.show(false);
        _releaseWakeLock();
        try { if (window.AudioSys) window.AudioSys.stopMusic(); } catch (e) {}
        window.UI.showScreen('main');
        try { window.Screens.updateMenuStats(); } catch (e) {}
    }

    function togglePause() {
        if (_state === 'playing') {
            pause();
        } else if (_state === 'paused') {
            resume();
        }
    }

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

    function resume() {
        if (_state !== 'paused') return;
        _state = 'playing';
        _hideAllScreens();
        _lastTime = 0;
        _acquireWakeLock();
    }

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

        // Получаем настройки режима
        let modeGrowth = growth;
        let modeDuration = Infinity;

        try {
            if (window.Modes && (_mode === 'timeattack' || _mode === 'survival' || _mode === 'zen')) {
                const modeConfig = window.Modes.getModeConfig(_mode);
                if (modeConfig) {
                    modeGrowth = growth * (modeConfig.difficultyGrowth || 1.0);
                    modeDuration = modeConfig.duration || Infinity;
                }
            }
        } catch (e) {}

        if (_mode === 'campaign' && _currentLevel) {
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
        try { window.Storm.update(dt, window.Player.alive); } catch (e) {}
        try { window.Scoring.update(realDt); } catch (e) {}
        try { window.Particles.update(dt); } catch (e) {}
        try { window.FloatingTexts.update(dt); } catch (e) {}

        // Перевірка завершення рівня кампанії
        if (_mode === 'campaign' && _currentLevel && _elapsed >= _currentLevel.duration) {
            _levelComplete();
            return;
        }

        // Проверка завершения Time Attack режима
        if (_mode === 'timeattack' && _elapsed >= modeDuration) {
            _timeAttackComplete();
            return;
        }

        // Колізії з перешкодами (у Zen смерть вимкнена — гравець проходить крізь усе)
        let hitObs = null;
        if (_mode !== 'zen') {
            try { hitObs = window.Obstacles.hit(window.Player); } catch (e) {}
        }
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
        if (!_recordBeaten && _bestAtRunStart > 0 && _mode !== 'zen') {
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
                if (_mode === 'campaign' && _currentLevel && _currentLevel.duration > 0) {
                    lvlProg = _elapsed / _currentLevel.duration;
                } else if (_mode === 'timeattack' && modeDuration > 0) {
                    lvlProg = _elapsed / modeDuration;
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
                    duration: modeDuration
                });
            } catch (e) {}
        }
    }

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

    // Завершение Time Attack режима — экран результатов вместо вылета в меню
    function _timeAttackComplete() {
        _state = 'victory';
        window.HUD.show(false);
        _releaseWakeLock();
        try { if (window.AudioSys) window.AudioSys.stopMusic(); } catch (e) {}

        try {
            const finalScore = window.Scoring.finalScore();
            let isNewRecord = false;
            _recordModeBest('timeattack', finalScore);

            const s = window.State.getStats();
            isNewRecord = finalScore > (s.bestScore || 0);
            window.State.updateStats({
                bestScore: Math.max(s.bestScore || 0, finalScore),
                bestCombo: Math.max(s.bestCombo || 0, window.Scoring.bestCombo()),
                totalGames: (s.totalGames || 0) + 1,
                starsCollected: (s.starsCollected || 0) + window.Scoring.stars(),
                stormsSurvived: (s.stormsSurvived || 0) + _stormsThisRun,
                nearMisses: (s.nearMisses || 0) + window.Scoring.nearMisses(),
                ghostPasses: (s.ghostPasses || 0) + _ghostThisRun,
                totalPlaytime: (s.totalPlaytime || 0) + _elapsed,
                lastPlayed: Date.now()
            });

            window.State.addLeaderboardEntry({
                score: finalScore,
                mode: 'timeattack',
                level: null,
                combo: window.Scoring.bestCombo()
            });

            try { window.Achievements.checkAll(); } catch (e) {}
            try { window.Skins.checkUnlocks(); } catch (e) {}
            try { if (window.CloudStorage) window.CloudStorage.pushProgress(); } catch (e) {}

            // Показать экран результатов Time Attack
            if (window.Screens && typeof window.Screens.showModeVictory === 'function') {
                window.Screens.showModeVictory({
                    mode: 'timeattack',
                    score: finalScore,
                    newRecord: isNewRecord
                });
            } else {
                window.UI.showScreen('main');
                try { window.Screens.updateMenuStats(); } catch (e) {}
            }
        } catch (e) {
            _log('error', '_timeAttackComplete', e.message);
        }
    }

    // Перемога в рівні Кампанії
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

            window.Levels.saveProgress(_currentLevel.id, stars);

            _recordModeBest('campaign', finalScore);

            const s = window.State.getStats();
            window.State.updateStats({
                bestScore: Math.max(s.bestScore || 0, finalScore),
                bestCombo: Math.max(s.bestCombo || 0, window.Scoring.bestCombo()),
                totalGames: (s.totalGames || 0) + 1,
                starsCollected: (s.starsCollected || 0) + window.Scoring.stars(),
                stormsSurvived: (s.stormsSurvived || 0) + _stormsThisRun,
                nearMisses: (s.nearMisses || 0) + window.Scoring.nearMisses(),
                ghostPasses: (s.ghostPasses || 0) + _ghostThisRun,
                totalPlaytime: (s.totalPlaytime || 0) + _elapsed,
                lastPlayed: Date.now()
            });

            window.State.addLeaderboardEntry({
                score: finalScore,
                mode: 'campaign',
                level: _currentLevel.id,
                combo: window.Scoring.bestCombo()
            });

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

    function _loop(timestamp) {
        _rafId = requestAnimationFrame(_loop);
        try {
            if (_lastTime === 0) _lastTime = timestamp;
            let dt = (timestamp - _lastTime) / 1000;
            _lastTime = timestamp;
            if (dt > 0.05) dt = 0.05;
            if (dt <= 0) return;

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
        startTimeAttack: startTimeAttack,
        startSurvival: startSurvival,
        startZen: startZen,
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
