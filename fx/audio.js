/**
 * Audio.js — процедурний звуковий та музичний движок.
 * - Web Audio API, без зовнішніх файлів
 * - Lazy init (ensure створює AudioContext після першої взаємодії)
 * - Процедурна фонова музика (ембієнт-луп + тривожний шар на штормах)
 * - Усі SFX синтезовані через осцилятори + безпечний envelope
 */
(function () {
    'use strict';

    let ctx = null;
    let masterGain = null;
    let sfxGain = null;
    let musicGain = null;
    let muted = false;
    let ready = false;

    // Стан музичного синтезатора
    let _musicRunning = false;
    let _musicTimer = null;
    let _musicStep = 0;
    let _musicIsStorm = false;

    function _log(level, msg, data) {
        try { if (window.Logger) window.Logger[level]('[Audio] ' + msg, data); } catch (e) {}
    }

    function ensure() {
        if (ready && ctx) {
            if (ctx.state === 'suspended') {
                try { ctx.resume(); } catch (e) {}
            }
            return true;
        }
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) {
                _log('warn', 'Web Audio API недоступний');
                return false;
            }
            ctx = new AC();
            masterGain = ctx.createGain();
            sfxGain = ctx.createGain();
            musicGain = ctx.createGain();
            sfxGain.connect(masterGain);
            musicGain.connect(masterGain);
            masterGain.connect(ctx.destination);

            applyVolumes();

            if (ctx.state === 'suspended') {
                try { ctx.resume(); } catch (e) {}
            }
            ready = true;
            _log('info', 'Audio готовий');
            return true;
        } catch (e) {
            _log('error', 'ensure: не вдалося ініціалізувати', e.message);
            return false;
        }
    }

    function applyVolumes() {
        if (!ready) return;
        try {
            if (window.State) {
                const sv = window.State.getSetting('sfxVolume');
                const mv = window.State.getSetting('musicVolume');
                const m = window.State.getSetting('mute');
                if (typeof sv === 'number' && sfxGain) sfxGain.gain.value = sv;
                if (typeof mv === 'number' && musicGain) musicGain.gain.value = mv;
                muted = !!m;
                if (masterGain) masterGain.gain.value = muted ? 0 : 1;
            }
        } catch (e) {
            _log('error', 'applyVolumes помилка', e.message);
        }
    }

    function toggleMute() {
        muted = !muted;
        try {
            if (window.State) window.State.setSetting('mute', muted);
            if (masterGain) masterGain.gain.value = muted ? 0 : 1;
        } catch (e) {
            _log('error', 'toggleMute помилка', e.message);
        }
        return muted;
    }

    function _tone(opts) {
        if (!ensure()) return;
        try {
            const now = ctx.currentTime;
            const dur = Math.max(0.03, opts.duration != null ? opts.duration : 0.2);
            const attack = Math.min(opts.attack != null ? opts.attack : 0.01, dur * 0.3);
            const release = Math.min(opts.release != null ? opts.release : 0.15, dur * 0.5);
            const peak = opts.volume != null ? opts.volume : 0.3;

            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = opts.type || 'sine';
            o.frequency.setValueAtTime(opts.freq, now);
            if (opts.slideTo) {
                o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), now + dur);
            }

            g.gain.setValueAtTime(0.0001, now);
            g.gain.linearRampToValueAtTime(peak, now + attack);
            g.gain.linearRampToValueAtTime(peak * 0.8, now + dur - release);
            g.gain.linearRampToValueAtTime(0.0001, now + dur);

            o.connect(g);
            g.connect(opts.target === 'music' ? musicGain : sfxGain);
            o.start(now);
            o.stop(now + dur + 0.05);
        } catch (e) {
            _log('error', '_tone помилка', e.message);
        }
    }

    function _noise(opts) {
        if (!ensure()) return;
        try {
            const now = ctx.currentTime;
            const dur = opts.duration || 0.3;
            const sampleRate = ctx.sampleRate;
            const buffer = ctx.createBuffer(1, Math.floor(sampleRate * dur), sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
            }
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            const g = ctx.createGain();
            const peak = opts.volume != null ? opts.volume : 0.25;
            g.gain.setValueAtTime(peak, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + dur);
            const filter = ctx.createBiquadFilter();
            filter.type = opts.filter || 'lowpass';
            filter.frequency.value = opts.freq || 1000;

            src.connect(filter);
            filter.connect(g);
            g.connect(sfxGain);
            src.start(now);
        } catch (e) {
            _log('error', '_noise помилка', e.message);
        }
    }

    // === ПРОЦЕДУРНА МУЗИКА ===
    const BASS_NOTES = [110, 110, 130.81, 146.83, 110, 98, 110, 164.81]; // A2, C3, D3, G2...
    const LEAD_NOTES = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    const STORM_NOTES = [55, 65.41, 73.42, 82.41]; // Тривожний суббас

    function startMusic() {
        if (_musicRunning) return;
        if (!ensure()) return;
        _musicRunning = true;
        _musicStep = 0;
        _scheduleMusicTick();
    }

    function stopMusic() {
        _musicRunning = false;
        if (_musicTimer) {
            clearTimeout(_musicTimer);
            _musicTimer = null;
        }
    }

    function setStormMusic(isStorm) {
        _musicIsStorm = !!isStorm;
    }

    function _scheduleMusicTick() {
        if (!_musicRunning) return;
        try {
            const step = _musicStep % 16;
            const tempoMs = _musicIsStorm ? 160 : 220;

            // Басова лінія
            if (step % 2 === 0) {
                const bNote = _musicIsStorm
                    ? STORM_NOTES[Math.floor(_musicStep / 4) % STORM_NOTES.length]
                    : BASS_NOTES[Math.floor(_musicStep / 2) % BASS_NOTES.length];
                _tone({
                    type: _musicIsStorm ? 'sawtooth' : 'triangle',
                    freq: bNote,
                    duration: (tempoMs * 1.8) / 1000,
                    attack: 0.02,
                    release: 0.1,
                    volume: _musicIsStorm ? 0.18 : 0.12,
                    target: 'music'
                });
            }

            // Атмосферні арпеджіо / акценти
            if (step % 4 === 1 || (_musicIsStorm && step % 2 === 1)) {
                const lNote = LEAD_NOTES[Math.floor(Math.random() * LEAD_NOTES.length)];
                _tone({
                    type: 'sine',
                    freq: lNote,
                    duration: 0.35,
                    attack: 0.04,
                    release: 0.25,
                    volume: 0.08,
                    target: 'music'
                });
            }

            _musicStep++;
            _musicTimer = setTimeout(_scheduleMusicTick, tempoMs);
        } catch (e) {
            _musicTimer = setTimeout(_scheduleMusicTick, 300);
        }
    }

    // === SFX ЕФЕКТИ ===
    function playFlip() {
        _tone({ type: 'square', freq: 520, slideTo: 280, duration: 0.12, attack: 0.005, release: 0.08, volume: 0.18 });
    }

    function playStar() {
        _tone({ type: 'triangle', freq: 880, duration: 0.18, volume: 0.22 });
        setTimeout(function () {
            _tone({ type: 'triangle', freq: 1320, duration: 0.22, volume: 0.2 });
        }, 60);
    }

    function playBonus() {
        _tone({ type: 'sine', freq: 660, duration: 0.25, volume: 0.2 });
        setTimeout(function () {
            _tone({ type: 'sine', freq: 990, duration: 0.28, volume: 0.18 });
        }, 40);
    }

    function playDeath() {
        _noise({ duration: 0.5, volume: 0.35, freq: 800, filter: 'lowpass' });
        _tone({ type: 'sawtooth', freq: 220, slideTo: 55, duration: 0.5, volume: 0.25 });
    }

    function playClick() {
        _tone({ type: 'square', freq: 880, duration: 0.05, volume: 0.1 });
    }

    function playLaser() {
        _tone({ type: 'sawtooth', freq: 1600, slideTo: 400, duration: 0.18, volume: 0.15 });
    }

    function playNearMiss() {
        _tone({ type: 'sine', freq: 1200, duration: 0.08, volume: 0.18 });
    }

    function playStorm() {
        _tone({ type: 'sawtooth', freq: 110, slideTo: 55, duration: 0.8, volume: 0.28 });
        _noise({ duration: 0.8, volume: 0.2, freq: 400, filter: 'bandpass' });
    }

    function playAchievement() {
        _tone({ type: 'triangle', freq: 523, duration: 0.3, volume: 0.22 });
        setTimeout(function () {
            _tone({ type: 'triangle', freq: 659, duration: 0.3, volume: 0.2 });
        }, 80);
        setTimeout(function () {
            _tone({ type: 'triangle', freq: 784, duration: 0.4, volume: 0.22 });
        }, 160);
    }

    function playVictory() {
        _tone({ type: 'triangle', freq: 587.33, duration: 0.25, volume: 0.25 });
        setTimeout(function () { _tone({ type: 'triangle', freq: 739.99, duration: 0.25, volume: 0.25 }); }, 120);
        setTimeout(function () { _tone({ type: 'triangle', freq: 880, duration: 0.4, volume: 0.3 }); }, 240);
        setTimeout(function () { _tone({ type: 'sine', freq: 1174.66, duration: 0.6, volume: 0.28 }); }, 360);
    }

    function playGravityZone() {
        _tone({ type: 'sine', freq: 300, slideTo: 900, duration: 0.35, volume: 0.22 });
    }

    function playRevive() {
        _tone({ type: 'sawtooth', freq: 220, slideTo: 880, duration: 0.4, volume: 0.3 });
        _noise({ duration: 0.4, volume: 0.2, freq: 1200, filter: 'highpass' });
    }

    function playPhase() {
        _tone({ type: 'sine', freq: 900, slideTo: 1400, duration: 0.2, volume: 0.2 });
    }

    window.AudioSys = {
        ensure: ensure,
        applyVolumes: applyVolumes,
        toggleMute: toggleMute,
        isMuted: function () { return muted; },
        startMusic: startMusic,
        stopMusic: stopMusic,
        setStormMusic: setStormMusic,
        playFlip: playFlip,
        playStar: playStar,
        playBonus: playBonus,
        playDeath: playDeath,
        playClick: playClick,
        playLaser: playLaser,
        playNearMiss: playNearMiss,
        playStorm: playStorm,
        playAchievement: playAchievement,
        playVictory: playVictory,
        playGravityZone: playGravityZone,
        playRevive: playRevive,
        playPhase: playPhase
    };
})();
