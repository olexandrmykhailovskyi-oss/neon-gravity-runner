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

            '<div class="btn-grid" style="margin-top:14px;">' +
            '<button id="ed-play" class="btn primary" data-i18n="editor.btnPlay">▶ Тест</button>' +
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
        const g = (id) => { const e = $(id); return e ? parseFloat(e.value) : 0; };
        const durV = $('#ed-dur-val'); if (durV) durV.textContent = Math.round(g('#ed-dur')) + 'с';
        const spdV = $('#ed-spd-val'); if (spdV) spdV.textContent = '×' + g('#ed-spd').toFixed(2);
        const denV = $('#ed-den-val'); if (denV) denV.textContent = '×' + g('#ed-den').toFixed(2);
        const stV = $('#ed-star-val'); if (stV) stV.textContent = String(Math.round(g('#ed-star')));
    }

    function _bind() {
        const UI = window.UI;
        ['ed-dur', 'ed-spd', 'ed-den', 'ed-star'].forEach(function (id) {
            const r = $('#' + id);
            if (r) UI.safeBind(r, 'input', _refreshLabels);
        });
        const storm = $('#ed-storm');
        if (storm) {
            UI.safeBind(storm, 'click', function () { storm.classList.toggle('on'); });
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

        UI.safeBind($('#ed-back'), 'click', function () {
            collect(); // зберігаємо чернетку
            window.UI.showScreen('main');
        });
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
