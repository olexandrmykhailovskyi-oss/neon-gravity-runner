/**
 * Obstacle.js — фабрика перешкод.
 * Типи:
 * 1. wall — статичні неонові блоки (зверху/знизу)
 * 2. gate — ворота з проходом посередині
 * 3. moving — вертикально рухомий синусоїдальний блок
 * 4. spikes — шипи на підлозі або стелі
 * 5. laser — стаціонарний промінь із фазами (попередження / удар)
 * 6. moving_laser — лазер, що рухається по X
 * 7. gravity_zone — кругла вихрова воронка (інвертує гравітацію на 3с, не вбиває)
 * 8. pulsar — пульсуючий блок (колізія за поточним розміром sin)
 */
(function () {
    'use strict';

    let _uidCounter = 0;

    function _uid() {
        _uidCounter++;
        return 'obs_' + _uidCounter;
    }

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Obstacle] ' + msg, data); } catch (e) {}
    }

    function create(type, x, area, params) {
        const a = area || { top: 60, bottom: 660, width: 1280 };
        const p = params || {};
        const base = {
            id: _uid(),
            type: type,
            x: x,
            y: a.top,
            w: 40,
            h: 60,
            active: true,
            passed: false,
            nearMissCounted: false,
            time: 0,
            speed: 0,
            _area: a
        };

        switch (type) {
            case 'wall':
                base.w = p.w || 40;
                const fromTop = Math.random() < 0.5;
                const wallH = p.h || (a.bottom - a.top) * (0.35 + Math.random() * 0.25);
                if (fromTop) {
                    base.y = a.top;
                    base.h = wallH;
                } else {
                    base.h = wallH;
                    base.y = a.bottom - wallH;
                }
                break;

            case 'gate':
                base.w = p.w || 36;
                const gap = p.gap || (160 + Math.random() * 60);
                const centerY = a.top + (a.bottom - a.top) * (0.35 + Math.random() * 0.3);
                base.gapY = centerY;
                base.gapH = gap;
                base.topH = Math.max(10, centerY - gap / 2 - a.top);
                base.bottomY = centerY + gap / 2;
                base.h = a.bottom - a.top;
                break;

            case 'moving':
                base.w = p.w || 44;
                base.h = p.h || 80;
                base.baseY = a.top + (a.bottom - a.top) * 0.5 - base.h / 2;
                base.amp = p.amp || (a.bottom - a.top) * 0.25;
                base.freq = p.freq || (1.2 + Math.random() * 0.8);
                base.phase = Math.random() * Math.PI * 2;
                base.y = base.baseY;
                break;

            case 'spikes':
                base.w = p.w || 60;
                base.h = p.h || 40;
                const onFloor = Math.random() < 0.5;
                base.onFloor = onFloor;
                base.y = onFloor ? (a.bottom - base.h) : a.top;
                break;

            case 'laser':
                base.w = 8;
                base.h = a.bottom - a.top;
                base.y = a.top;
                base.warning = 0.6;
                base.activeTime = 0.4;
                base.cooldown = 0.8;
                base.phase = 'warning';
                base.active = false;
                base.color = '#ff3860';
                break;

            case 'moving_laser':
                base.w = 8;
                base.h = a.bottom - a.top;
                base.y = a.top;
                base.warning = 0.4;
                base.activeTime = 0.35;
                base.cooldown = 0.5;
                base.phase = 'warning';
                base.active = false;
                base.moveSpeed = p.moveSpeed || 120;
                base.color = '#ff3860';
                break;

            case 'gravity_zone':
                base.radius = p.radius || 32;
                base.w = base.radius * 2;
                base.h = base.radius * 2;
                base.y = a.top + 60 + Math.random() * (a.bottom - a.top - 120);
                base.color = '#a855f7';
                base.triggered = false;
                break;

            case 'pulsar':
                base.baseRadius = p.baseRadius || 24;
                base.radius = base.baseRadius;
                base.w = base.radius * 2;
                base.h = base.radius * 2;
                base.y = a.top + 60 + Math.random() * (a.bottom - a.top - 120);
                base.freq = p.freq || (2.5 + Math.random() * 1.5);
                base.color = '#f59e0b';
                break;

            default:
                _log('warn', 'невідомий тип: ' + type);
                base.w = 40;
                base.h = 60;
                break;
        }
        return base;
    }

    function update(obs, dt, speed) {
        if (!obs) return;
        obs.time += dt;
        const spd = typeof speed === 'number' ? speed : 250;
        obs.x -= spd * dt;

        switch (obs.type) {
            case 'moving':
                obs.y = obs.baseY + Math.sin(obs.time * obs.freq * Math.PI * 2 + obs.phase) * obs.amp;
                break;

            case 'laser':
            case 'moving_laser':
                if (obs.phase === 'warning') {
                    obs.warning -= dt;
                    if (obs.warning <= 0) {
                        obs.phase = 'active';
                        obs.active = true;
                        try { if (window.AudioSys) window.AudioSys.playLaser(); } catch (e) {}
                    }
                } else if (obs.phase === 'active') {
                    obs.activeTime -= dt;
                    if (obs.activeTime <= 0) {
                        obs.phase = 'cooldown';
                        obs.active = false;
                        obs.cooldown = obs.type === 'laser' ? 0.8 : 0.5;
                    }
                } else if (obs.phase === 'cooldown') {
                    obs.cooldown -= dt;
                    if (obs.cooldown <= 0) {
                        obs.phase = 'warning';
                        obs.warning = obs.type === 'laser' ? 0.6 : 0.4;
                    }
                }
                if (obs.type === 'moving_laser') {
                    obs.x -= obs.moveSpeed * dt;
                }
                break;

            case 'pulsar':
                // Динамічний радіус пульсара (sin)
                const scale = 0.6 + 0.6 * (0.5 + 0.5 * Math.sin(obs.time * obs.freq * Math.PI * 2));
                obs.radius = obs.baseRadius * scale;
                obs.w = obs.radius * 2;
                obs.h = obs.radius * 2;
                break;
        }
    }

    function getRects(obs) {
        if (!obs) return [];
        switch (obs.type) {
            case 'gate':
                const topRect = { x: obs.x, y: obs._area.top, w: obs.w, h: obs.topH };
                const bottomRect = { x: obs.x, y: obs.bottomY, w: obs.w, h: obs._area.bottom - obs.bottomY };
                return [topRect, bottomRect];

            case 'laser':
            case 'moving_laser':
                if (obs.active) {
                    return [{ x: obs.x, y: obs.y, w: obs.w, h: obs.h }];
                }
                return [];

            case 'gravity_zone':
            case 'pulsar':
                // Коло — обробляється окремо в hitTest
                return [];

            default:
                return [{ x: obs.x, y: obs.y, w: obs.w, h: obs.h }];
        }
    }

    function hitTest(obs, player) {
        if (!obs || !player) return false;
        if (player.ghost > 0 || player.phase > 0) return false;

        // 1. Гравітаційна зона (не вбиває, інвертує гравітацію)
        if (obs.type === 'gravity_zone') {
            if (obs.triggered) return false;
            try {
                if (window.Collision && window.Collision.circles) {
                    const hit = window.Collision.circles(
                        { x: obs.x, y: obs.y, radius: obs.radius },
                        player
                    );
                    if (hit) {
                        obs.triggered = true;
                        player.applyGravityZone(3.0);
                        if (window.FloatingTexts) {
                            let gText = 'ГРАВІТАЦІЯ!';
                            try {
                                if (window.I18n) gText = window.I18n.t('float.gravity');
                            } catch (x) {}
                            window.FloatingTexts.add(player.x, player.y - 25, gText, '#a855f7');
                        }
                    }
                }
            } catch (e) {}
            return false; // Не завдає смертельної шкоди
        }

        // 2. Пульсар (коло з динамічним радіусом)
        if (obs.type === 'pulsar') {
            try {
                if (window.Collision && window.Collision.circles) {
                    return window.Collision.circles(
                        { x: obs.x, y: obs.y, radius: obs.radius },
                        player
                    );
                }
            } catch (e) {}
            return false;
        }

        // 3. Лазери (тільки в активній фазі)
        if (obs.type === 'laser' || obs.type === 'moving_laser') {
            if (!obs.active) return false;
        }

        // 4. Прямокутні перешкоди
        const rects = getRects(obs);
        for (let i = 0; i < rects.length; i++) {
            try {
                if (window.Collision && window.Collision.circleRect(player, rects[i])) {
                    return true;
                }
            } catch (e) {}
        }
        return false;
    }

    function nearMissDist(obs, player) {
        if (!obs || !player) return Infinity;
        if (player.ghost > 0 || player.phase > 0) return Infinity;

        if (obs.type === 'gravity_zone') return Infinity;

        if (obs.type === 'pulsar') {
            try {
                if (window.Collision && window.Collision.circleCircleDist) {
                    return window.Collision.circleCircleDist(
                        player,
                        { x: obs.x, y: obs.y, radius: obs.radius }
                    );
                }
            } catch (e) {}
            return Infinity;
        }

        if (obs.type === 'laser' || obs.type === 'moving_laser') {
            if (!obs.active) return Infinity;
        }

        const rects = getRects(obs);
        let min = Infinity;
        for (let i = 0; i < rects.length; i++) {
            try {
                if (window.Collision && window.Collision.circleRectDist) {
                    const d = window.Collision.circleRectDist(
                        player.x, player.y, player.radius,
                        rects[i].x, rects[i].y, rects[i].w, rects[i].h
                    );
                    if (d < min) min = d;
                }
            } catch (e) {}
        }
        return min;
    }

    function draw(obs, ctx) {
        if (!obs || !ctx) return;
        try {
            ctx.save();
            switch (obs.type) {
                case 'wall':
                    _drawWall(obs, ctx);
                    break;
                case 'gate':
                    _drawGate(obs, ctx);
                    break;
                case 'moving':
                    _drawMoving(obs, ctx);
                    break;
                case 'spikes':
                    _drawSpikes(obs, ctx);
                    break;
                case 'laser':
                case 'moving_laser':
                    _drawLaser(obs, ctx);
                    break;
                case 'gravity_zone':
                    _drawGravityZone(obs, ctx);
                    break;
                case 'pulsar':
                    _drawPulsar(obs, ctx);
                    break;
                default:
                    ctx.fillStyle = '#00e5ff';
                    ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
                    break;
            }
            ctx.restore();
        } catch (e) {
            _log('error', 'draw помилка', e.message);
        }
    }

    function _drawWall(obs, ctx) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#00e5ff';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w / 2, obs.y);
        ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h);
        ctx.stroke();
    }

    function _drawGate(obs, ctx) {
        ctx.fillStyle = 'rgba(255, 43, 214, 0.15)';
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#ff2bd6';
        ctx.fillRect(obs.x, obs._area.top, obs.w, obs.topH);
        ctx.strokeStyle = '#ff2bd6';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs._area.top, obs.w, obs.topH);
        ctx.fillRect(obs.x, obs.bottomY, obs.w, obs._area.bottom - obs.bottomY);
        ctx.strokeRect(obs.x, obs.bottomY, obs.w, obs._area.bottom - obs.bottomY);
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#39ff14';
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w / 2, obs.gapY - obs.gapH / 2);
        ctx.lineTo(obs.x + obs.w / 2, obs.gapY + obs.gapH / 2);
        ctx.stroke();
    }

    function _drawMoving(obs, ctx) {
        ctx.fillStyle = 'rgba(255, 243, 107, 0.15)';
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#fff36b';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#fff36b';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    }

    function _drawSpikes(obs, ctx) {
        const count = Math.max(2, Math.floor(obs.w / 16));
        const spikeW = obs.w / count;
        ctx.fillStyle = 'rgba(255, 43, 214, 0.25)';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff2bd6';
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
            const sx = obs.x + i * spikeW;
            if (obs.onFloor) {
                ctx.moveTo(sx, obs.y + obs.h);
                ctx.lineTo(sx + spikeW / 2, obs.y);
                ctx.lineTo(sx + spikeW, obs.y + obs.h);
            } else {
                ctx.moveTo(sx, obs.y);
                ctx.lineTo(sx + spikeW / 2, obs.y + obs.h);
                ctx.lineTo(sx + spikeW, obs.y);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ff2bd6';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    function _drawLaser(obs, ctx) {
        if (obs.phase === 'warning') {
            ctx.globalAlpha = 0.4 + Math.sin(obs.time * 12) * 0.3;
            ctx.strokeStyle = obs.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(obs.x + obs.w / 2, obs.y);
            ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (obs.phase === 'active') {
            ctx.shadowBlur = 30;
            ctx.shadowColor = obs.color;
            ctx.strokeStyle = obs.color;
            ctx.lineWidth = obs.w;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.moveTo(obs.x + obs.w / 2, obs.y);
            ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = obs.w * 0.3;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.moveTo(obs.x + obs.w / 2, obs.y);
            ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h);
            ctx.stroke();
        } else {
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = obs.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(obs.x + obs.w / 2, obs.y);
            ctx.lineTo(obs.x + obs.w / 2, obs.y + obs.h);
            ctx.stroke();
        }
    }

    function _drawGravityZone(obs, ctx) {
        ctx.save();
        ctx.translate(obs.x, obs.y);
        ctx.rotate(obs.time * 3);

        ctx.shadowBlur = 20;
        ctx.shadowColor = '#a855f7';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = obs.triggered ? 0.3 : 0.85;

        // Зовнішнє вихрове коло
        ctx.beginPath();
        ctx.arc(0, 0, obs.radius, 0, Math.PI * 1.5);
        ctx.stroke();

        // Внутрішня спіраль
        ctx.beginPath();
        ctx.arc(0, 0, obs.radius * 0.55, Math.PI, Math.PI * 2.5);
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Стрілки напрямку гравітації (вгору/вниз)
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.moveTo(0, -obs.radius * 0.35);
        ctx.lineTo(-6, -obs.radius * 0.1);
        ctx.lineTo(6, -obs.radius * 0.1);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function _drawPulsar(obs, ctx) {
        ctx.save();
        const r = obs.radius;
        const glowPower = Math.min(30, 10 + r * 0.8);
        ctx.shadowBlur = glowPower;
        ctx.shadowColor = '#f59e0b';

        // Зовнішній ореол
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, r + 4, 0, Math.PI * 2);
        ctx.fill();

        // Основне тіло
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Ядро
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, r * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    window.Obstacle = {
        create: create,
        update: update,
        getRects: getRects,
        hitTest: hitTest,
        nearMissDist: nearMissDist,
        draw: draw
    };
})();
