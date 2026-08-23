/**
 * Scoring.js — підрахунок очок, комбо, подвоєння.
 * - Пасивні очки за час
 * - Combo зростає при подіях, зникає після COMBO_DECAY
 * - Спецефекти на кожні 5 комбо (COMBO x5, COMBO x10...)
 * - Double множник
 */
(function () {
    'use strict';

    let _score = 0;
    let _combo = 0;
    let _bestCombo = 0;
    let _doubleTime = 0;
    let _elapsed = 0;
    let _comboTimer = 0;
    let _obstaclesPassed = 0;
    let _nearMisses = 0;
    let _stars = 0;
    let _externalMult = 1;   // множник режиму гри (Time Attack ×2, Zen ×0 тощо)

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[Scoring] ' + msg); } catch (e) {}
    }

    function _getConfig(key, fallback) {
        try {
            if (window.Config && window.Config.SCORE) {
                return window.Config.SCORE[key] != null ? window.Config.SCORE[key] : fallback;
            }
        } catch (e) {}
        return fallback;
    }

    function _getGameConfig(key, fallback) {
        try {
            if (window.Config && window.Config.GAME) {
                return window.Config.GAME[key] != null ? window.Config.GAME[key] : fallback;
            }
        } catch (e) {}
        return fallback;
    }

    function _multiplier() {
        const comboMult = 1 + _combo * 0.1;
        const doubleMult = _doubleTime > 0 ? 2 : 1;
        return comboMult * doubleMult * _externalMult;
    }

    function _checkComboMilestone(newCombo) {
        if (newCombo >= 5 && newCombo % 5 === 0) {
            try {
                if (window.FloatingTexts && window.Player) {
                    window.FloatingTexts.add(
                        window.Player.x + 30,
                        window.Player.y - 35,
                        'COMBO ×' + newCombo + '!',
                        '#ff2bd6'
                    );
                }
                if (window.Effects) {
                    window.Effects.flash('#ff2bd6', 0.2, 100);
                    window.Effects.pulseNow();
                }
            } catch (e) {}
        }
    }

    function _updateBestCombo() {
        if (_combo > _bestCombo) _bestCombo = _combo;
    }

    const Scoring = {
        reset: function () {
            _score = 0;
            _combo = 0;
            _bestCombo = 0;
            _doubleTime = 0;
            _elapsed = 0;
            _comboTimer = 0;
            _obstaclesPassed = 0;
            _nearMisses = 0;
            _stars = 0;
            _externalMult = 1;
        },

        // Множник режиму гри; викликається після reset() при старті забігу
        setExternalMultiplier: function (m) {
            _externalMult = (typeof m === 'number' && m >= 0) ? m : 1;
        },

        update: function (dt) {
            if (dt <= 0) return;
            _elapsed += dt;
            _score += dt * 5 * _externalMult;

            if (_doubleTime > 0) {
                _doubleTime -= dt;
                if (_doubleTime < 0) _doubleTime = 0;
            }

            if (_combo > 0) {
                _comboTimer += dt;
                const decay = _getGameConfig('COMBO_DECAY', 1.5);
                if (_comboTimer > decay) {
                    _combo = 0;
                    _comboTimer = 0;
                }
            }
        },

        addObstacle: function () {
            const pts = _getConfig('OBSTACLE', 10);
            _score += pts * _multiplier();
            _combo++;
            _obstaclesPassed++;
            _updateBestCombo();
            _comboTimer = 0;
            _checkComboMilestone(_combo);
        },

        addNearMiss: function () {
            const pts = _getConfig('NEAR_MISS', 25);
            _score += pts * _multiplier();
            _combo++;
            _nearMisses++;
            _updateBestCombo();
            _comboTimer = 0;
            _checkComboMilestone(_combo);
        },

        addStar: function () {
            const pts = _getConfig('STAR', 50);
            _score += pts * _multiplier();
            _combo++;
            _stars++;
            _updateBestCombo();
            _comboTimer = 0;
            _checkComboMilestone(_combo);
        },

        addStorm: function () {
            const pts = _getConfig('STORM', 200);
            _score += pts * _multiplier();
        },

        setDouble: function (seconds) {
            const dur = seconds != null ? seconds : _getConfig('DOUBLE_TIME', 8);
            _doubleTime = dur;
        },

        score: function () { return Math.floor(_score); },
        combo: function () { return _combo; },
        bestCombo: function () { return _bestCombo; },
        doubleTime: function () { return Math.max(0, _doubleTime); },
        elapsed: function () { return _elapsed; },
        obstaclesPassed: function () { return _obstaclesPassed; },
        nearMisses: function () { return _nearMisses; },
        stars: function () { return _stars; },

        finalScore: function () {
            return Math.floor(_score + _bestCombo * 10);
        },

        isDoubleActive: function () {
            return _doubleTime > 0;
        },

        multiplierText: function () {
            const m = _multiplier();
            return '×' + m.toFixed(1);
        }
    };

    try {
        Object.defineProperty(Scoring, 'scoreValue', {
            get: function () { return Math.floor(_score); },
            enumerable: false,
            configurable: false
        });
        Object.defineProperty(Scoring, 'comboValue', {
            get: function () { return _combo; },
            enumerable: false,
            configurable: false
        });
    } catch (e) {}

    window.Scoring = Scoring;
})();
