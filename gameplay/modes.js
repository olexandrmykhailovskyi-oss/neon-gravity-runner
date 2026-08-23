/**
 * Modes.js — модуль для управления режимами игры.
 * - Time Attack: набрать максимум очков за ограниченное время
 * - Survival: выжить как можно дольше с растущей сложностью
 * - Zen: играть без очков и смертей, просто расслабиться
 */
(function () {
    'use strict';

    const MODES = {
        timeattack: {
            id: 'timeattack',
            duration: 180, // 3 минуты
            scoreMultiplier: 2.0,
            difficultyGrowth: 0.5,
            noDeaths: false,
            timeLimited: true
        },
        survival: {
            id: 'survival',
            duration: Infinity,
            scoreMultiplier: 1.5,
            difficultyGrowth: 1.5,
            noDeaths: false,
            timeLimited: false
        },
        zen: {
            id: 'zen',
            duration: Infinity,
            scoreMultiplier: 0,
            difficultyGrowth: 0,
            noDeaths: true,
            timeLimited: false
        }
    };

    function getMode(modeId) {
        return MODES[modeId] || null;
    }

    function getAllModes() {
        return Object.keys(MODES).map(function (key) {
            return MODES[key];
        });
    }

    function getModeConfig(modeId) {
        const mode = getMode(modeId);
        if (!mode) return null;

        return {
            id: mode.id,
            duration: mode.duration,
            scoreMultiplier: mode.scoreMultiplier,
            difficultyGrowth: mode.difficultyGrowth,
            noDeaths: mode.noDeaths,
            timeLimited: mode.timeLimited
        };
    }

    window.Modes = {
        getMode: getMode,
        getAllModes: getAllModes,
        getModeConfig: getModeConfig
    };
})();