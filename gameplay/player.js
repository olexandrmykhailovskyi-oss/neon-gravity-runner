/**
 * Player.js — гравець (неонова частинка).
 * - Трейл: точки зміщуються вліво на speed * dt
 * - Фізика: GRAVITY 1900, flip дає імпульс vy = gravityDir * 420, maxVy = 700
 * - Підтримка бонусів: shield, magnet, ghost, revive (друге життя), phase (фаза)
 * - Підтримка gravity_zone (тимчасова інверсія гравітації)
 */
(function () {
    'use strict';

    const MAX_TRAIL = 26;

    const Player = {
        x: 0,
        y: 0,
        vy: 0,
        gravityDir: 1,      // 1 = вниз, -1 = вгору
        radius: 12,
        alive: true,

        // Бонуси
        shield: false,
        shieldUsedThisRun: false,
        invincible: 0,
        ghost: 0,
        magnet: 0,
        revive: false,
        phase: 0,

        // Гравітаційна зона
        gravityZoneTimer: 0,

        // Візуал
        trail: [],
        color: '#00e5ff',

        _flipCooldown: 0,
        _flipBuffered: false,
        _trailTimer: 0,

        reset: function (bounds) {
            const b = bounds || { top: 60, bottom: 660, startX: 280 };
            this.x = b.startX || 280;
            this.y = (b.top + b.bottom) / 2;
            this.vy = 0;
            this.gravityDir = 1;
            this.alive = true;
            this.shield = false;
            this.shieldUsedThisRun = false;
            this.invincible = 0;
            this.ghost = 0;
            this.magnet = 0;
            this.revive = false;
            this.phase = 0;
            this.gravityZoneTimer = 0;
            this.trail = [];
            this._flipCooldown = 0;
            this._flipBuffered = false;
            this._trailTimer = 0;

            try {
                if (window.Skins) {
                    const skin = window.Skins.current();
                    this.color = skin ? skin.color : '#00e5ff';
                }
            } catch (e) {
                this.color = '#00e5ff';
            }
        },

        flip: function () {
            if (!this.alive) return false;
            // QOL: буфер вводу — тап під час кулдауну не губиться, а спрацьовує одразу після нього
            if (this._flipCooldown > 0) {
                this._flipBuffered = true;
                return false;
            }
            return this._doFlip();
        },

        _doFlip: function () {
            this._flipBuffered = false;
            this.gravityDir = -this.gravityDir;

            // P1: імпульс у напрямку нової гравітації
            let impulse = 420;
            try {
                if (window.Config && window.Config.GAME) {
                    impulse = window.Config.GAME.FLIP_IMPULSE || 420;
                }
            } catch (e) {}

            this.vy = this.gravityDir * impulse;
            this._flipCooldown = 0.12;

            try { if (window.AudioSys) window.AudioSys.playFlip(); } catch (e) {}
            try { if (window.Effects) window.Effects.pulseNow(); } catch (e) {}
            return true;
        },

        applyGravityZone: function (duration) {
            this.gravityZoneTimer = duration || 3.0;
            this.gravityDir = -this.gravityDir;
            this.vy = this.gravityDir * 350;
            try { if (window.AudioSys) window.AudioSys.playGravityZone(); } catch (e) {}
            try {
                if (window.Effects) {
                    window.Effects.flash('#a855f7', 0.25, 200);
                    window.Effects.addShake(6);
                }
            } catch (e) {}
        },

        update: function (dt, bounds, timeScale, speed) {
            if (!this.alive) return;
            const ts = typeof timeScale === 'number' ? timeScale : 1;
            const realDt = dt * ts;
            if (realDt <= 0) return;

            const spd = typeof speed === 'number' ? speed : 250;

            if (this._flipCooldown > 0) this._flipCooldown -= realDt;

            // QOL: буферизований фліп спрацьовує, щойно кулдаун закінчився
            if (this._flipBuffered) {
                let bufferTime = 0.15;
                try {
                    if (window.Config && window.Config.GAME) {
                        bufferTime = window.Config.GAME.FLIP_BUFFER || 0.15;
                    }
                } catch (e) {}
                if (this._flipCooldown <= 0) {
                    this._doFlip();
                } else if (this._flipCooldown > bufferTime) {
                    // Кулдаун довший за вікно буфера — натискання застаріло
                    this._flipBuffered = false;
                }
            }

            if (this.invincible > 0) this.invincible -= realDt;
            if (this.ghost > 0) this.ghost -= realDt;
            if (this.phase > 0) this.phase -= realDt;
            if (this.magnet > 0) this.magnet -= realDt;

            // Таймер гравітаційної зони
            if (this.gravityZoneTimer > 0) {
                this.gravityZoneTimer -= realDt;
                if (this.gravityZoneTimer <= 0) {
                    this.gravityZoneTimer = 0;
                    this.gravityDir = -this.gravityDir;
                    this.vy = this.gravityDir * 300;
                }
            }

            // Гравітація та множники складності
            let GRAVITY = 1900;
            let MAX_VY = 700;
            try {
                if (window.Config && window.Config.GAME) {
                    GRAVITY = window.Config.GAME.GRAVITY || 1900;
                    MAX_VY = window.Config.GAME.MAX_VY || 700;
                }
                if (window.State && typeof window.State.getDifficultyMultipliers === 'function') {
                    const mults = window.State.getDifficultyMultipliers();
                    GRAVITY *= mults.gravity;
                }
            } catch (e) {}

            this.vy += GRAVITY * this.gravityDir * realDt;

            if (this.vy > MAX_VY) this.vy = MAX_VY;
            if (this.vy < -MAX_VY) this.vy = -MAX_VY;

            this.y += this.vy * realDt;

            const top = bounds ? bounds.top : 60;
            const bottom = bounds ? bounds.bottom : 660;
            if (this.y - this.radius < top) {
                this.y = top + this.radius;
                this.vy = 0;
            }
            if (this.y + this.radius > bottom) {
                this.y = bottom - this.radius;
                this.vy = 0;
            }

            // P1: Зсуваємо всі існуючі точки трейлу вліво на speed * dt
            for (let i = 0; i < this.trail.length; i++) {
                this.trail[i].x -= spd * realDt;
            }
            // Видаляємо точки, що пішли далеко за екран
            while (this.trail.length > 0 && this.trail[0].x < -50) {
                this.trail.shift();
            }

            // Додаємо нову точку
            this._trailTimer += realDt;
            if (this._trailTimer > 0.025) {
                this._trailTimer = 0;
                this.trail.push({ x: this.x, y: this.y });
                if (this.trail.length > MAX_TRAIL) this.trail.shift();
            }

            // Частинки шлейфа з формою скіна та швидкістю гри
            try {
                if (window.Particles) {
                    const c = this._getRenderColor();
                    const shape = this._getTrailShape();
                    window.Particles.trail(this.x, this.y, c, (this.ghost > 0 || this.phase > 0) ? 1 : 2, spd, shape);
                }
            } catch (e) {}
        },

        hit: function () {
            const result = {
                died: false,
                usedShield: false,
                wasInvincible: false,
                wasGhost: false,
                wasPhase: false,
                revived: false
            };
            if (!this.alive) return result;

            // Phase: повний імунітет, не враховується в ачівку ghost
            if (this.phase > 0) {
                result.wasPhase = true;
                return result;
            }

            // Ghost: імунітет з зарахуванням у статистику
            if (this.ghost > 0) {
                result.wasGhost = true;
                return result;
            }

            if (this.invincible > 0) {
                result.wasInvincible = true;
                return result;
            }

            if (this.shield) {
                this.shield = false;
                this.shieldUsedThisRun = true;
                this.invincible = 1.2;
                result.usedShield = true;
                try {
                    if (window.Effects) {
                        window.Effects.flash('#39ff14', 0.3, 150);
                        window.Effects.addShake(8);
                    }
                    if (window.Particles) {
                        window.Particles.explosion(this.x, this.y, '#39ff14', 16, 180);
                    }
                } catch (e) {}
                return result;
            }

            // Друге життя (Revive)
            if (this.revive) {
                this.revive = false;
                this.invincible = 2.0;
                result.revived = true;
                try {
                    if (window.Effects) {
                        window.Effects.flash('#ff2a70', 0.45, 250);
                        window.Effects.addShake(14);
                        window.Effects.slowmo(0.4, 800);
                    }
                    if (window.Particles) {
                        window.Particles.explosion(this.x, this.y, '#ff2a70', 30, 260);
                    }
                    if (window.FloatingTexts) {
                        window.FloatingTexts.add(this.x, this.y - 30, 'ДРУГЕ ЖИТТЯ!', '#ff2a70');
                    }
                    if (window.AudioSys) window.AudioSys.playRevive();
                } catch (e) {}
                return result;
            }

            // Смерть
            this.alive = false;
            result.died = true;
            try {
                const deathColor = this._getRenderColor();
                if (window.Effects) {
                    window.Effects.flash('#ff3860', 0.5, 200);
                    window.Effects.addShake(20);
                    window.Effects.hitStop(80);
                    window.Effects.slowmo(0.3, 600);
                }
                if (window.Particles) {
                    window.Particles.explosion(this.x, this.y, deathColor, 40, 320);
                }
                if (window.AudioSys) window.AudioSys.playDeath();
            } catch (e) {}
            return result;
        },

        _getRenderColor: function () {
            try {
                if (window.Skins) {
                    const skin = window.Skins.current();
                    if (skin) return window.Skins.getColor(skin.id);
                }
            } catch (e) {}
            return this.color;
        },

        _getTrailShape: function () {
            try {
                if (window.Skins) {
                    const skin = window.Skins.current();
                    if (skin) return window.Skins.getTrailShape(skin.id);
                }
            } catch (e) {}
            return 'circle';
        },

        draw: function (ctx) {
            if (!ctx) return;
            const color = this._getRenderColor();
            const isGhost = this.ghost > 0;
            const isPhase = this.phase > 0;
            const isInv = this.invincible > 0;

            ctx.save();

            if (isInv && Math.floor(Date.now() * 0.02) % 2 === 0) {
                ctx.globalAlpha = 0.4;
            } else if (isGhost || isPhase) {
                ctx.globalAlpha = 0.45;
            }

            // Горизонтальний трейл
            if (this.trail.length > 1) {
                ctx.save();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                for (let i = 1; i < this.trail.length; i++) {
                    const a = i / this.trail.length;
                    ctx.globalAlpha = a * 0.5 * (isGhost || isPhase ? 0.4 : 1);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = this.radius * 1.6 * a;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = color;
                    ctx.beginPath();
                    ctx.moveTo(this.trail[i - 1].x, this.trail[i - 1].y);
                    ctx.lineTo(this.trail[i].x, this.trail[i].y);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // Основне коло гравця
            ctx.shadowBlur = 24;
            ctx.shadowColor = color;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Ядро
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
            ctx.fill();

            // Щит
            if (this.shield) {
                ctx.save();
                ctx.strokeStyle = '#39ff14';
                ctx.lineWidth = 2.5;
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#39ff14';
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Друге життя (Revive aura)
            if (this.revive) {
                ctx.save();
                ctx.strokeStyle = '#ff2a70';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ff2a70';
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 12, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // Ghost / Phase aura
            if (isGhost || isPhase) {
                ctx.save();
                ctx.strokeStyle = isPhase ? '#00ffee' : '#c0a0ff';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 12;
                ctx.shadowColor = isPhase ? '#00ffee' : '#c0a0ff';
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            ctx.restore();
        }
    };

    window.Player = Player;
})();
