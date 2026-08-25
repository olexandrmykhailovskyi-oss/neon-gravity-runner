/**
 * Editor.js — конструктор користувацьких рівнів.
 * - Форма: назва, тривалість, швидкість, щільність, шторм, тема, набір перешкод, starScore
 * - Playtest через Game.startCustomLevel(def)
 * - Коди шарингу NGRL1-<hash>-<base64> + бібліотека «Мої рівні» (localStorage)
 */
(function () {
    'use strict';

    const DRAFT_KEY = 'ngr_editor_draft';
    const LIST_KEY = 'ngr_custom_levels';
    const MAX_SAVED = 12;

    const TYPES = ['wall', 'gate', 'moving', 'spikes', 'laser', 'moving_laser', 'gravity_zone', 'pulsar'];

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[Editor] ' + msg); } catch (e) {}
    }

    function _t(key, fallback) {
        try {
            const v = window.I18n ? window.I18n.t(key) : key;
            return (v === key && fallback !== undefined) ? fallback : v;
        } catch (e) {
            return fallback !== undefined ? fallback : key;
        }
    }

    // ---- Кодек NGRL1 (Unicode-safe base64 + djb2-подібна сума, як у State) ----

    function _b64Encode(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (m, p) {
            return String.fromCharCode(parseInt(p, 16));
        }));
    }

    function _b64Decode(str) {
        return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    function _hash36(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return (hash >>> 0).toString(36);
    }

    /** Нормалізація та валідація def. Повертає чистий об'єкт або null. */
    function sanitize(raw) {
        try {
            if (!raw || typeof raw !== 'object') return null;
            const clamp = (v, a, b, d) => {
                v = parseFloat(v);
                if (!isFinite(v)) return d;
                return Math.min(b, Math.max(a, v));
            };
            const types = Array.isArray(raw.types || raw.obstacles)
                ? (raw.types || raw.obstacles).filter(function (t) { return TYPES.indexOf(t) !== -1; })
                : [];
            if (types.length < 1) return null;
            let name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 20) : '';
            if (!name) name = _t('editor.defaultName', 'Мій рівень');
            return {
                v: 1,
                name: name,
                dur: Math.round(clamp(raw.dur || raw.duration, 30, 120, 60)),
                spd: Math.round(clamp(raw.spd || raw.speedMult, 0.8, 2.0, 1.2) * 100) / 100,
                den: Math.round(clamp(raw.den || raw.density, 0.5, 2.5, 1.2) * 100) / 100,
                storm: !!raw.storm,
                theme: Math.round(clamp(raw.theme, 0, 6, 0)),
                star: Math.round(clamp(raw.star || raw.starScore, 500, 6000, 2000) / 100) * 100,
                types: types
            };
        } catch (e) {
            return null;
        }
    }

    function encodeDef(def) {
        const clean = sanitize(def);
        if (!clean) return null;
        const b64 = _b64Encode(JSON.stringify(clean));
        return 'NGRL1-' + _hash36(b64) + '-' + b64;
    }

    function decodeDef(code) {
        try {
            if (typeof code !== 'string' || code.indexOf('NGRL1-') !== 0) return null;
            const rest = code.slice(6);
            const dash = rest.indexOf('-');
            if (dash < 0) return null;
            const hash = rest.slice(0, dash);
            const b64 = rest.slice(dash + 1);
            if (!b64 || _hash36(b64) !== hash) return null;
            return sanitize(JSON.parse(_b64Decode(b64)));
        } catch (e) {
            return null;
        }
    }

    // ---- Сховище чернетки та бібліотеки ----

    function loadDraft() {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            if (!raw) return null;
            return sanitize(JSON.parse(raw));
        } catch (e) { return null; }
    }

    function saveDraft(def) {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(def)); } catch (e) {}
    }

    function getList() {
        try {
            const arr = JSON.parse(localStorage.getItem(LIST_KEY) || '[]');
            if (!Array.isArray(arr)) return [];
            return arr.map(sanitize).filter(Boolean);
        } catch (e) { return []; }
    }

    function saveList(list) {
        try { localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, MAX_SAVED))); } catch (e) {}
    }

    // ---- DOM ----

    function $(sel) { try { return window.UI.$(sel); } catch (e) { return null; } }

    function build() {
        const el = $('#screen-editor');
        if (!el) return;
        const themes = (window.Config && window.Config.THEMES) || [];

        let themeBtns = '';
        for (let i = 0; i < themes.length; i++) {
            const th = themes[i];
            const key = 'theme.' + (th.i18n || String(th.id));
            themeBtns += '<button class="btn ed-chip ed-theme" data-t="' + i + '">' + _t(key, th.name || ('Тема ' + i)) + '</button>';
        }

        let typeChips = '';
        for (let i = 0; i < TYPES.length; i++) {
            typeChips += '<button class="btn ed-chip ed-type" data-type="' + TYPES[i] + '">' +
                _t('cause.' + TYPES[i], TYPES[i]) + '</button>';
        }

        el.innerHTML =
            '<div class="panel editor-panel">' +
            '<h2 data-i18n="editor.title">🛠 Редактор рівнів</h2>' +
            '<div class="setting-row" style="flex-direction:column;align-items:stretch;">' +
            '<span class="setting-label" data-i18n="editor.presets">Пресети складності</span>' +
            '<div class="ed-chips" id="ed-presets">' +
            '<button class="btn ed-chip ed-preset" data-p="easy">🟢 ' + _t('settings.easy', 'Легко') + '</button>' +
            '<button class="btn ed-chip ed-preset" data-p="normal">🟡 ' + _t('settings.normal', 'Норм') + '</button>' +
            '<button class="btn ed-chip ed-preset" data-p="hardcore">🔴 ' + _t('settings.hardcore', 'Хардкор') + '</button>' +
            '</div></div>' +
            '<div class="setting-row"><span class="setting-label" data-i18n="editor.name">Назва</span>' +
            '<input type="text" id="ed-name" maxlength="20" style="max-width:180px;"></div>' +

            '<div class="setting-row"><span class="setting-label" data-i18n="editor.duration">Тривалість</span>' +
            '<span style="display:flex;align-items:center;gap:8px;"><input type="range" id="ed-dur" min="30" max="120" step="5"><b id="ed-dur-val">60с</b></span></div>' +

            '<div class="setting-row"><span class="setting-label" data-i18n="editor.speed">Швидкість</span>' +
            '<span style="display:flex;align-items:center;gap:8px;"><input type="range" id="ed-spd" min="0.8" max="2.0" step="0.05"><b id="ed-spd-val">×1.2</b></span></div>' +

            '<div class="setting-row"><span class="setting-label" data-i18n="editor.density">Щільність</span>' +
            '<span style="display:flex;align-items:center;gap:8px;"><input type="range" id="ed-den" min="0.5" max="2.5" step="0.05"><b id="ed-den-val">×1.2</b></span></div>' +

            '<div class="setting-row"><span class="setting-label" data-i18n="editor.starScore">Ціль ★★</span>' +
            '<span style="display:flex;align-items:center;gap:8px;"><input type="range" id="ed-star" min="500" max="6000" step="100"><b id="ed-star-val">2000</b></span></div>' +

            '<div class="setting-row"><span class="setting-label" data-i18n="editor.storm">Neon Storm</span><div class="switch" id="ed-storm"></div></div>' +

            '<div class="setting-row" style="flex-direction:column;align-items:stretch;"><span class="setting-label" data-i18n="editor.theme">Тема</span>' +
            '<div class="ed-chips" id="ed-themes">' + themeBtns + '</div></div>' +

            '<div class="setting-row" style="flex-direction:column;align-items:stretch;"><span class="setting-label" data-i18n="editor.types">Перешкоди</span>' +
            '<div class="ed-chips" id="ed-types">' + typeChips + '</div></div>' +

            '<div class="setting-row" style="flex-direction:column;align-items:stretch;">' +
            '<span class="setting-label"><span data-i18n="editor.preview">Прев’ю</span> <b id="ed-rating" style="margin-left:6px;"></b></span>' +
            '<canvas id="ed-preview" width="380" height="120" style="width:100%;max-width:440px;height:auto;background:rgba(0,0,0,0.35);border:1px solid var(--panel-border);border-radius:8px;margin-top:6px;"></canvas></div>' +

            '<div class="btn-grid" style="margin-top:14px;">' +
            '<button id="ed-play" class="btn primary" data-i18n="editor.btnPlay">▶ Тест</button>' +
            '<button id="ed-random" class="btn" data-i18n="editor.random">🎲 Випадковий</button>' +
            '<button id="ed-save" class="btn" data-i18n="editor.btnSave">💾 Зберегти</button>' +
            '<button id="ed-code" class="btn" data-i18n="editor.btnCode">📤 Код</button>' +
            '<button id="ed-import" class="btn" data-i18n="editor.btnImport">📥 Імпорт</button>' +
            '</div>' +

            '<h3 data-i18n="editor.myLevels" style="margin-top:16px;">Мої рівні</h3>' +
            '<div id="ed-list" class="grid"></div>' +

            '<div class="btn-grid">' +
            '<button id="ed-back" class="btn" data-i18n="btn.back">← Назад у меню</button>' +
            '</div>' +
            '</div>';

        _restoreDraft();
        _bind();
        renderList();
        _log('info', 'build OK');
    }

    function collect() {
        const def = sanitize({
            name: ($('#ed-name') || {}).value,
            dur: (($('#ed-dur') || {}).value),
            spd: (($('#ed-spd') || {}).value),
            den: (($('#ed-den') || {}).value),
            star: (($('#ed-star') || {}).value),
            storm: !!($('#ed-storm') && $('#ed-storm').classList.contains('on')),
            theme: _selectedTheme(),
            types: _selectedTypes()
        });
        if (def) saveDraft(def);
        return def;
    }

    let _theme = 0;

    function _selectedTheme() { return _theme; }

    function _selectedTypes() {
        const out = [];
        const chips = document.querySelectorAll('#ed-types .ed-type.primary');
        for (let i = 0; i < chips.length; i++) out.push(chips[i].getAttribute('data-type'));
        return out;
    }

    function _restoreDraft() {
        const def = loadDraft();
        const nameEl = $('#ed-name');
        if (nameEl) nameEl.value = def ? def.name : '';
        const setRange = (id, val) => { const r = $(id); if (r) r.value = val; };
        setRange('#ed-dur', def ? def.dur : 60);
        setRange('#ed-spd', def ? def.spd : 1.2);
        setRange('#ed-den', def ? def.den : 1.2);
        setRange('#ed-star', def ? def.star : 2000);
        const storm = $('#ed-storm');
        if (storm && def) storm.classList.toggle('on', !!def.storm);
        _theme = def ? def.theme : 0;
        const tBtns = document.querySelectorAll('#ed-themes .ed-theme');
        for (let i = 0; i < tBtns.length; i++) {
            tBtns[i].classList.toggle('primary', parseInt(tBtns[i].getAttribute('data-t'), 10) === _theme);
        }
        if (def) {
            const chips = document.querySelectorAll('#ed-types .ed-type');
            for (let i = 0; i < chips.length; i++) {
                chips[i].classList.toggle('primary', def.types.indexOf(chips[i].getAttribute('data-type')) !== -1);
            }
        }
        _refreshLabels();
    }

    function _refreshLabels() {
        const g = function (id) { const e = $(id); return e ? parseFloat(e.value) : 0; };
        const durV = $('#ed-dur-val'); if (durV) durV.textContent = Math.round(g('#ed-dur')) + 'с';
        const spdV = $('#ed-spd-val'); if (spdV) spdV.textContent = '×' + g('#ed-spd').toFixed(2);
        const denV = $('#ed-den-val'); if (denV) denV.textContent = '×' + g('#ed-den').toFixed(2);
        const stV = $('#ed-star-val'); if (stV) stV.textContent = String(Math.round(g('#ed-star')));

        // Індикатор складності з чинників рівня
        const ratingEl = $('#ed-rating');
        if (ratingEl) {
            let r = g('#ed-spd') * g('#ed-den') * (0.7 + _selectedTypes().length * 0.15) * (g('#ed-dur') / 60);
            const stormEl = $('#ed-storm');
            if (stormEl && stormEl.classList.contains('on')) r *= 1.15;
            let key = 'settings.normal';
            let color = '#fff36b';
            if (r < 1.15) { key = 'settings.easy'; color = '#39ff14'; }
            else if (r > 1.9) { key = 'settings.hardcore'; color = '#ff3860'; }
            ratingEl.textContent = '· ' + _t(key, 'Normal');
            ratingEl.style.color = color;
        }
    }

    // ---- Живе прев'ю: справжні Obstacle.create/draw на мініканвасі ----
    let _previewObs = [];
    let _previewTimer = null;

    function _buildPreview() {
        try {
            const cv = $('#ed-preview');
            if (!cv || !window.Obstacle) return;
            const types = _selectedTypes().slice(0, 5);
            const area = { top: 14, bottom: 106, width: cv.width };
            _previewObs = [];
            for (let i = 0; i < types.length; i++) {
                const spacing = types.length > 1 ? (cv.width - 90) / (types.length - 1) : 0;
                const o = window.Obstacle.create(types[i], 45 + i * spacing, area, {});
                if (o) _previewObs.push(o);
            }
            if (!_previewTimer && typeof setInterval === 'function') {
                _previewTimer = setInterval(function () {
                    try {
                        if (!window.UI || !window.UI.currentScreen || window.UI.currentScreen() !== 'editor') return;
                        _drawPreview();
                    } catch (e) {}
                }, 90);
            }
            _drawPreview();
        } catch (e) {}
    }

    function _drawPreview() {
        const cv = $('#ed-preview');
        if (!cv || !cv.getContext) return;
        const ctx = cv.getContext('2d');
        const W = cv.width;
        const H = cv.height;
        ctx.clearRect(0, 0, W, H);

        // Тонка сітка + межі поля
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 24) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(0,229,255,0.4)';
        ctx.beginPath(); ctx.moveTo(0, 14.5); ctx.lineTo(W, 14.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 105.5); ctx.lineTo(W, 105.5); ctx.stroke();

        for (let i = 0; i < _previewObs.length; i++) {
            const o = _previewObs[i];
            try { window.Obstacle.update(o, 0.09, 0); } catch (e) {} // час іде, x стоїть (spd=0)
            try { window.Obstacle.draw(o, ctx); } catch (e) {}
        }
    }

    function _bind() {
        const UI = window.UI;
        ['ed-dur', 'ed-spd', 'ed-den', 'ed-star'].forEach(function (id) {
            const r = $('#' + id);
            if (r) UI.safeBind(r, 'input', _refreshLabels);
        });
        const storm = $('#ed-storm');
        if (storm) {
            UI.safeBind(storm, 'click', function () { storm.classList.toggle('on'); _refreshLabels(); });
        }

        // Фікс: чіпи типів перешкод мають бути клікабельними (тогл + оновлення прев'ю)
        const typesBox = $('#ed-types');
        if (typesBox) {
            const chips = typesBox.querySelectorAll('.ed-type');
            for (let i = 0; i < chips.length; i++) {
                UI.safeBind(chips[i], 'click', function () {
                    this.classList.toggle('primary');
                    _refreshLabels();
                    _buildPreview();
                });
            }
        }

        // Пресети складності — швидке заповнення слайдерів
        const presetBox = $('#ed-presets');
        if (presetBox) {
            const pBtns = presetBox.querySelectorAll('.ed-preset');
            for (let i = 0; i < pBtns.length; i++) {
                UI.safeBind(pBtns[i], 'click', function () {
                    const p = this.getAttribute('data-p');
                    const set = function (id, v) { const e = $(id); if (e) e.value = v; };
                    const stormEl = $('#ed-storm');
                    if (p === 'easy') {
                        set('#ed-dur', 45); set('#ed-spd', 1.0); set('#ed-den', 1.0); set('#ed-star', 1200);
                        if (stormEl) stormEl.classList.remove('on');
                    } else if (p === 'hardcore') {
                        set('#ed-dur', 90); set('#ed-spd', 1.6); set('#ed-den', 1.9); set('#ed-star', 3200);
                        if (stormEl) stormEl.classList.add('on');
                    } else {
                        set('#ed-dur', 60); set('#ed-spd', 1.3); set('#ed-den', 1.4); set('#ed-star', 2000);
                        if (stormEl) stormEl.classList.remove('on');
                    }
                    _refreshLabels();
                });
            }
        }
        const themesBox = $('#ed-themes');
        if (themesBox) {
            const btns = themesBox.querySelectorAll('.ed-theme');
            for (let i = 0; i < btns.length; i++) {
                UI.safeBind(btns[i], 'click', function () {
                    _theme = parseInt(this.getAttribute('data-t'), 10) || 0;
                    for (let j = 0; j < btns.length; j++) {
                        btns[j].classList.toggle('primary', btns[j] === this);
                    }
                });
            }
        }

        UI.safeBind($('#ed-play'), 'click', function () {
            const def = collect();
            if (!def) {
                window.UI.showToast(_t('editor.needType', 'Оберіть хоча б один тип перешкод'), 'warn');
                return;
            }
            try { if (window.Analytics) window.Analytics.track('editor_playtest', { dur: def.dur }); } catch (e) {}
            if (window.Game) window.Game.startCustomLevel(def);
        });

        UI.safeBind($('#ed-save'), 'click', function () {
            const def = collect();
            if (!def) {
                window.UI.showToast(_t('editor.needType', 'Оберіть хоча б один тип перешкод'), 'warn');
                return;
            }
            const list = getList().filter(function (d) { return d.name !== def.name; });
            list.unshift(def);
            saveList(list);
            renderList();
            window.UI.showToast(_t('editor.saved', 'Рівень збережено'), 'success');
        });

        UI.safeBind($('#ed-code'), 'click', function () {
            const def = collect();
            if (!def) {
                window.UI.showToast(_t('editor.needType', 'Оберіть хоча б один тип перешкод'), 'warn');
                return;
            }
            const code = encodeDef(def);
            if (!code) return;
            let copied = false;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(code).then(function () {
                        window.UI.showToast(_t('settings.exportCopied', 'Код скопійовано в буфер обміну'), 'success');
                    }, function () {});
                    copied = true;
                }
            } catch (e) {}
            if (!copied) window.prompt(_t('editor.promptExport', 'Код рівня:'), code);
        });

        UI.safeBind($('#ed-import'), 'click', function () {
            const code = window.prompt(_t('editor.promptImport', 'Вставте код рівня (NGRL1-…):'));
            if (!code || !code.trim()) return;
            const def = decodeDef(code.trim());
            if (!def) {
                window.UI.showToast(_t('editor.badCode', 'Некоректний код рівня'), 'error');
                return;
            }
            saveDraft(def);
            build(); // перебудова форми з новою чернеткою
            window.UI.showToast(_t('editor.saved', 'Рівень завантажено'), 'success');
        });

        // 🎲 Випадковий валідний рівень
        UI.safeBind($('#ed-random'), 'click', function () {
            const themes = (window.Config && window.Config.THEMES) || [];
            const pool = TYPES.slice();
            const picked = [];
            const want = 2 + Math.floor(Math.random() * 4); // 2..5 типів
            while (picked.length < want && pool.length) {
                picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
            }
            const def = sanitize({
                name: _t('editor.defaultName', 'Мій рівень') + ' #' + (1 + Math.floor(Math.random() * 99)),
                dur: 40 + Math.floor(Math.random() * 13) * 5,
                spd: Math.round((0.9 + Math.random() * 0.9) * 100) / 100,
                den: Math.round((0.8 + Math.random() * 1.4) * 100) / 100,
                star: (10 + Math.floor(Math.random() * 31)) * 100,
                storm: Math.random() < 0.35,
                theme: Math.floor(Math.random() * Math.max(1, themes.length)),
                types: picked
            });
            if (def) {
                saveDraft(def);
                build(); // перечитує чернетку у форму + перезбирає прев'ю
            }
        });

        UI.safeBind($('#ed-back'), 'click', function () {
            collect(); // зберігаємо чернетку
            window.UI.showScreen('main');
        });

        // Живе прев'ю з поточним набором перешкод
        _buildPreview();
    }

    function renderList() {
        const box = $('#ed-list');
        if (!box) return;
        const list = getList();
        if (!list.length) {
            box.innerHTML = '<div style="text-align:center;color:#8a92b2;padding:12px;">' +
                _t('editor.empty', 'Поки немає збережених рівнів') + '</div>';
            return;
        }
        let html = '';
        for (let i = 0; i < list.length; i++) {
            const d = list[i];
            html += '<div class="tile" data-i="' + i + '">' +
                '<div class="tile-label">' + d.name + '</div>' +
                '<div class="tile-label" style="font-size:10px;color:#8a92b2;">⏱' + d.dur + 'с · ×' + d.spd.toFixed(2) + ' · ' + d.types.length + '🔒</div>' +
                '<div class="tile-actions">' +
                '<button class="btn ed-play-saved" data-i="' + i + '">▶</button>' +
                '<button class="btn ed-share-saved" data-i="' + i + '">📤</button>' +
                '<button class="btn ed-del-saved" data-i="' + i + '">🗑</button>' +
                '</div></div>';
        }
        box.innerHTML = html;

        box.querySelectorAll('.ed-play-saved').forEach(function (b) {
            window.UI.safeBind(b, 'click', function () {
                const def = getList()[parseInt(this.getAttribute('data-i'), 10)];
                if (def) { saveDraft(def); if (window.Game) window.Game.startCustomLevel(def); }
            });
        });
        box.querySelectorAll('.ed-share-saved').forEach(function (b) {
            window.UI.safeBind(b, 'click', function () {
                const def = getList()[parseInt(this.getAttribute('data-i'), 10)];
                if (!def) return;
                const code = encodeDef(def);
                if (!code) return;
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(code).then(function () {
                            window.UI.showToast(_t('settings.exportCopied', 'Код скопійовано в буфер обміну'), 'success');
                        }, function () { window.prompt(_t('editor.promptExport', 'Код рівня:'), code); });
                    } else {
                        window.prompt(_t('editor.promptExport', 'Код рівня:'), code);
                    }
                } catch (e) {
                    window.prompt(_t('editor.promptExport', 'Код рівня:'), code);
                }
            });
        });
        box.querySelectorAll('.ed-del-saved').forEach(function (b) {
            window.UI.safeBind(b, 'click', function () {
                const idx = parseInt(this.getAttribute('data-i'), 10);
                const list = getList();
                list.splice(idx, 1);
                saveList(list);
                renderList();
                window.UI.showToast(_t('editor.deleted', 'Рівень видалено'), 'warn');
            });
        });
    }

    window.Editor = {
        build: build,
        renderList: renderList,
        collect: collect,
        encodeDef: encodeDef,
        decodeDef: decodeDef,
        sanitize: sanitize
    };
})();
