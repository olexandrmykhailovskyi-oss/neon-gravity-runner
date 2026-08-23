/**
 * Storm.js — Neon Storm движок.
 * - Підтримка звичайного нескінченного режиму (кожні 45с)
 * - Підтримка рівнів кампанії (storm: true, 'double', 'boss')
 * - Синхронізація з тривожним шаром процедурної музики
 */
(function () {
    'use strict';

    const Storm = {
        timer: 0,
        active: false,
        survived: false,
        elapsed: 0,
        duration: 0,
        _notified: false,
        _stormQueue: [],
        _mode: 'endless',

        reset: function (levelConfig) {
            this.active = false;
            this.survived = false;
            this.elapsed = 0;
            this.duration = 0;
            this._notified = false;
            this._stormQueue = [];

            try {
                if (window.AudioSys) window.AudioSys.setStormMusic(false);
            } catch (e) {}

            if (levelConfig && levelConfig.storm) {
                this._mode = 'campaign';
                if (levelConfig.storm === 'double') {
                    this._stormQueue = [14, 38];
                } else if (levelConfig.storm === 'boss') {
                    this._stormQueue = [18];
                } else if (levelConfig.storm === true) {
                    this._stormQueue = [15];
                }
                this.timer = this._stormQueue.length > 0 ? this._stormQueue.shift() : 9999;
            } else if (levelConfig && levelConfig.storm === false) {
                this._mode = 'campaign';
                this.timer = 99999;
            } else {
                this._mode = 'endless';
                let interval = 45;
                try {
                    if (window.Config && window.Config.GAME) interval = window.Config.GAME.STORM_INTERVAL || 45;
                } catch (e) {}
                this.timer = interval;
            }
        },

        update: function (dt, playerAlive) {
            if (dt <= 0) return;

            if (!this.active) {
                this.timer -= dt;
                if (this.timer <= 3 && !this._notified && this.timer > 0) {
                    this._notified = true;
                    try {
                        if (window.UI && window.I18n) {
                            window.UI.showToast('⚡ ' + window.I18n.t('storm.warning'), 'warn');
                        }
                    } catch (e) {}
                }
                if (this.timer <= 0 && this.timer > -100) {
                    this._activate();
                }
            } else {
                this.elapsed += dt;
                if (this.elapsed >= this.duration) {
                    this._deactivate(playerAlive);
                }
            }
        },

        _activate: function () {
            let dur = 8;
            try {
                if (window.Config && window.Config.GAME) dur = window.Config.GAME.STORM_DURATION || 8;
            } catch (e) {}
            this.active = true;
            this.elapsed = 0;
            this.duration = dur;
            this._notified = false;

            try {
                if (window.AudioSys) {
                    window.AudioSys.playStorm();
                    window.AudioSys.setStormMusic(true);
                }
                if (window.Effects) {
                    window.Effects.flash('#ff2bd6', 0.35, 400);
                    window.Effects.addShake(12);
                }
                if (window.UI) window.UI.showToast('⚡ NEON STORM!', 'error');
            } catch (e) {}
        },

        _deactivate: function (playerAlive) {
            this.active = false;
            this.survived = playerAlive !== false;

            try {
                if (window.AudioSys) window.AudioSys.setStormMusic(false);
            } catch (e) {}

            if (this._mode === 'campaign') {
                if (this._stormQueue.length > 0) {
                    this.timer = this._stormQueue.shift();
                } else {
                    this.timer = 99999;
                }
            } else {
                let interval = 45;
                try {
                    if (window.Config && window.Config.GAME) interval = window.Config.GAME.STORM_INTERVAL || 45;
                } catch (e) {}
                this.timer = interval;
            }

            try {
                if (window.Effects) {
                    window.Effects.flash('#00e5ff', 0.25, 300);
                }
            } catch (e) {}
        },

        isActive: function () {
            return this.active;
        },

        consumeSurvived: function () {
            const s = this.survived;
            this.survived = false;
            return s;
        },

        getProgress: function () {
            if (this.active) {
                return this.duration > 0 ? this.elapsed / this.duration : 0;
            }
            return 0;
        },

        speedMultiplier: function () {
            return this.active ? 1.3 : 1.0;
        }
    };

    window.Storm = Storm;
})();
