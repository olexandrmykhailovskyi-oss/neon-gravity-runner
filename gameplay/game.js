/**
 * Game.js — головний ігровий движок.
 * - Режими: campaign (15 рівнів з таймером і зірками), endless (нескінченність), daily (щоденний виклик)
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
        if (_currentLevel && _currentLevel.id < 15) {
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

    function retryCurrent() {
        if (_mode === 'campaign' && _currentLevel) {
            startCampaignLevel(_currentLevel.id);
        } else if (_mode === 'daily') {
            startDaily();
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

            // Скидання систем
            window.Scoring.reset();
            window.Particles.clear();
            window.FloatingTexts.clear();

            // Скидання перешкод та бонусів
            if (_mode === 'campaign' && _currentLevel) {
                window.Obstacles.reset(_currentLevel.obstacles, _currentLevel.density || 1.0, customRng);
                window.Bonuses.reset(customRng);
                window.Storm.reset(_currentLevel);
                if (window.Background) window.Background.setTheme(_currentLevel.theme);
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
            _state = 'playing';

            _hideAllScreens();
            window.HUD.show(true);

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
        window.UI.showScreen('pause');
    }

    function resume() {
        if (_state !== 'paused') return;
        _state = 'playing';
        _hideAllScreens();
        _lastTime = 0;
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

        if (_mode === 'campaign' && _currentLevel) {
            let lvlSpd = baseSpd * (_currentLevel.speedMult || 1.0);
            if (_currentLevel.speedGrowthMax) {
                const growthFactor = Math.min(1, _elapsed / _currentLevel.duration);
                lvlSpd = baseSpd * (_currentLevel.speedMult + (_currentLevel.speedGrowthMax - _currentLevel.speedMult) * growthFactor);
            }
            _speed = lvlSpd * diffMult;
        } else {
            _speed = Math.min(baseSpd + _elapsed * growth, maxSpd) * diffMult;
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

        // Колізії з перешкодами
        let hitObs = null;
        try { hitObs = window.Obstacles.hit(window.Player); } catch (e) {}
        if (hitObs) {
            const result = window.Player.hit();
            if (result.wasGhost) {
                _ghostThisRun++;
                try {
                    window.FloatingTexts.add(window.Player.x, window.Player.y - 30, 'ПРИВИД!', '#c0a0ff');
                } catch (e) {}
            } else if (result.revived) {
                // Воскресіння оброблено в Player
            } else if (result.usedShield) {
                // Щит поглинув удар
            } else if (result.wasInvincible || result.wasPhase) {
                // Невразливість
            } else if (result.died) {
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
                window.FloatingTexts.add(window.Player.x, window.Player.y - 40, 'ШТОРМ!', '#ff2bd6');
            }
        } catch (e) {}

        // Досягнення
        _achievementTimer += dt;
        if (_achievementTimer > 2) {
            _achievementTimer = 0;
            try { window.Achievements.checkAll(); } catch (e) {}
        }

        // Оновлення HUD
        _hudTimer += dt;
        if (_hudTimer > 0.08) {
            _hudTimer = 0;
            try {
                const lvlProg = (_mode === 'campaign' && _currentLevel && _currentLevel.duration > 0)
                    ? (_elapsed / _currentLevel.duration)
                    : 0;

                window.HUD.update({
                    score: window.Scoring.score(),
                    combo: window.Scoring.combo(),
                    shield: window.Player.shield,
                    magnet: window.Player.magnet > 0,
                    ghost: window.Player.ghost > 0,
                    revive: window.Player.revive,
                    phase: window.Player.phase > 0,
                    double: window.Scoring.isDoubleActive(),
                    mode: _mode,
                    level: _currentLevel,
                    levelProgress: lvlProg
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

    // Перемога в рівні Кампанії
    function _levelComplete() {
        _state = 'victory';
        window.HUD.show(false);
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
        try { if (window.AudioSys) window.AudioSys.stopMusic(); } catch (e) {}

        try {
            const s = window.State.getStats();
            const finalScore = window.Scoring.finalScore();
            const isNewRecord = finalScore > (s.bestScore || 0);

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
                if (s.dailyDate !== todayStr || finalScore > (s.dailyBest || 0)) {
                    window.State.updateStats({
                        dailyBest: finalScore,
                        dailyDate: todayStr
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

            window.Screens.showGameOver({
                mode: _mode,
                score: finalScore,
                best: Math.max(s.bestScore || 0, finalScore),
                combo: window.Scoring.bestCombo(),
                stars: window.Scoring.stars(),
                newRecord: isNewRecord
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
