/**
 * I18n.js — модуль інтернаціоналізації.
 * - Підтримка трьох мов: українська, російська, англійська
 * - Автовизначення мови браузера
 * - Збереження обраної мови в localStorage
 */
(function () {
    'use strict';

    const TRANSLATIONS = {
        uk: {
            // Головне меню
            'menu.title': 'Neon Gravity Runner',
            'menu.continue': '▶ Продовжити кампанію',
            'menu.campaign': '⭐ Кампанія',
            'levels.word': 'рівнів',
            'menu.endless': '♾ Нескінченність',
            'menu.daily': '📅 Виклик дня',
            'menu.timeattack': '⏱ Time Attack',
            'menu.survival': '💀 Survival',
            'menu.zen': '🧘 Zen',
            'menu.skins': '🎨 Скіни',
            'menu.achievements': '🏆 Досягнення',
            'menu.leaderboard': '👑 Рекорди ТОП-5',
            'menu.settings': '⚙ Налаштування',
            'menu.stats': '📊 Статистика',
            'menu.best': 'Рекорд',
            'menu.stars': 'Зірки',
            'menu.games': 'Ігор',

            // Довідка
            'btn.help': '❔ Довідка',
            'help.title': 'Довідка',
            'help.controls': 'Керування',
            'help.controlsList': '<b>SPACE</b> / клік / тап — перемкнути гравітацію<br><b>P</b> — пауза · <b>M</b> — звук · <b>F</b> — повний екран<br><b>R</b> — швидкий рестарт · <b>ESC</b> — пауза',
            'help.bonuses': 'Бонуси',

            // Причина смерті
            'gameover.cause': 'Причина',
            'cause.wall': 'Стіна',
            'cause.gate': 'Ворота',
            'cause.moving': 'Рухомий блок',
            'cause.spikes': 'Шипи',
            'cause.laser': 'Лазер',
            'cause.moving_laser': 'Рухомий лазер',
            'cause.pulsar': 'Пульсар',

            // Режими гри
            'mode.timeattack.name': 'Time Attack',
            'mode.timeattack.desc': 'Набрати максимум очок за 3 хвилини',
            'mode.timeattack.hud': '⏱ Time Attack',
            'mode.timeattack.done': '⏱ Час вичерпано!',
            'mode.survival.name': 'Survival',
            'mode.survival.desc': 'Вижити як можна довше з ростучою складністю',
            'mode.survival.hud': '💀 Survival',
            'mode.zen.name': 'Zen',
            'mode.zen.desc': 'Спокійний політ без очок і смертей',
            'mode.zen.hud': '🧘 Zen',

            // Екрани
            'levels.title': 'Вибір рівня кампанії',
            'levels.description': 'Пройдіть усі 25 випробувань та зберіть максимум зірок!',
            'victory.title': 'Рівень пройдено!',
            'victory.scoreEarned': 'Отримано очок у рівні',
            'victory.req1': '★ Вижити до кінця:',
            'victory.req3': '★★★ Без втрати щита та ≥5 Near-Miss:',
            'victory.shieldDamaged': 'Щит пошкоджено',
            'victory.noDamage': 'Без шкоди',
            'leaderboard.title': '👑 ТОП-5 Рекордів',
            'leaderboard.empty': 'Ще немає збережених рекордів. Зіграйте забіг!',
            'lb.endless': 'Нескінченність',
            'lb.daily': 'Виклик дня',
            'lb.timeattack': 'Time Attack',
            'lb.survival': 'Survival',
            'lb.zen': 'Zen',
            'skins.title': 'Скіни гравця',
            'skins.description': 'Кожен скін має свій колір та унікальну форму трейлу!',
            'skins.locked': 'Скін заблокований',
            'skins.trail': 'Трейл',
            'achievements.title': 'Досягнення',
            'settings.title': 'Налаштування',
            'stats.title': 'Статистика пілота',
            'pause.title': 'Пауза',
            'pause.mode': 'Режим',
            'pause.keys': '<b>SPACE</b> — гравітація · <b>P</b> — пауза · <b>M</b> — звук · <b>F</b> — повний екран · <b>R</b> — рестарт',
            'gameover.title': 'Зіткнення!',
            'tutorial.title': 'Як грати',
            'tutorial.description': 'Натискай <b>SPACE</b>, клікай або тапай, щоб перемикати гравітацію.',
            'tutorial.description2': 'Кожен стрибок дає імпульс. Уникай стін, лазерів, вогняних шипів і пульсарів!',
            'tutorial.gravity': '🌀 <b>Гравітаційні зони</b> тимчасово перевертають гравітацію.',
            'tutorial.storm': '⚡ Кожні 45 секунд — <b>Neon Storm</b>!',

            // Кнопки
            'btn.back': '← Назад',
            'btn.resume': '▶ Продовжити',
            'btn.retry': '↻ Повторити',
            'btn.restart': '↻ Перезапустити',
            'btn.menu': 'У меню',
            'btn.next': 'Наступний рівень ▶',
            'btn.levels': '☰ Усі рівні',
            'btn.start': 'Почати політ!',

            // Налаштування
            'settings.difficulty': 'Складність',
            'settings.easy': 'Легко',
            'settings.normal': 'Нормально',
            'settings.hardcore': 'Хардкор',
            'settings.sfx': 'Звуки',
            'settings.music': 'Музика',
            'settings.quality': 'Якість графіки',
            'settings.theme': 'Тема оформлення',
            'settings.reducedMotion': 'Зменшений рух (без тряски)',
            'settings.mute': 'Вимкнути звук повністю',
            'settings.vibration': 'Вібрація (мобільні)',
            'settings.gravityGuide': 'Лінія гравітації',
            'settings.language': 'Мова',

            // Дані прогресу
            'settings.data': 'Дані прогресу',
            'settings.export': '⬆ Експорт',
            'settings.import': '⬇ Імпорт',
            'settings.reset': '🗑 Скинути',
            'settings.exportCopied': 'Код скопійовано в буфер обміну',
            'settings.exportPrompt': 'Скопіюйте код прогресу:',
            'settings.importPrompt': 'Вставте код прогресу:',
            'settings.importSuccess': 'Прогрес відновлено!',
            'settings.importError': 'Некоректний код прогресу',
            'settings.resetConfirm': 'Скинути весь прогрес? Це незворотно!',
            'settings.resetDone': 'Прогрес скинуто',

            // Хмарна синхронізація
            'settings.cloudSync': '☁ Хмарна синхронізація',
            'settings.cloudSyncBtn': '☁ Синхронізувати',
            'cloud.lastSync': 'Остання синхронізація',
            'cloud.never': 'ніколи',
            'cloud.notConfigured': 'Не налаштовано',
            'cloud.notReady': 'Хмарне сховище не налаштовано',
            'cloud.syncing': 'Синхронізація…',
            'cloud.syncOk': 'Синхронізація успішна',
            'cloud.syncFail': 'Помилка синхронізації',

            // Рівні складності
            'quality.low': 'Низька',
            'quality.medium': 'Середня',
            'quality.high': 'Висока',
            'quality.ultra': 'Ультра',

            // Теми
            'theme.cyberpunk': 'Кіберпанк',
            'theme.retrowave': 'Ретро-вейв',
            'theme.matrix': 'Матриця',
            'theme.fire': 'Вогонь',
            'theme.dark': 'Темний сектор',
            'theme.iris': 'Ірис',

            // Рівні кампанії
            'level.1': 'Перший політ',
            'level.2': 'Ворота',
            'level.3': 'Хиткі блоки',
            'level.4': 'Шиповий пояс',
            'level.5': 'Лазерний рубіж',
            'level.6': 'Подвійна загроза',
            'level.7': 'Неоновий шторм',
            'level.8': 'Щільний вогонь',
            'level.9': 'Гравітаційні зони',
            'level.10': 'Пульсар',
            'level.11': 'Хаос',
            'level.12': 'Штормове ядро',
            'level.13': 'Межа швидкості',
            'level.14': 'Темний сектор',
            'level.15': 'Фінальний рубіж',
            'level.16': 'Подвійний пульсар',
            'level.17': 'Лазерний шторм',
            'level.18': 'Танець руху',
            'level.19': 'Гравітаційна воронка',
            'level.20': 'Вогняний рубіж',
            'level.21': 'Нескінченні ворота',
            'level.22': 'Електрична сітка',
            'level.23': 'Матричний хаос',
            'level.24': 'Ядро бурі',
            'level.25': 'Остання межа',

            // Скіни
            'skin.default': 'Базовий',
            'skin.pink': 'Неон-рожевий',
            'skin.gold': 'Золотий',
            'skin.green': 'Хакер',
            'skin.rainbow': 'Веселка',
            'skin.white': 'Привид',
            'skin.plasma': 'Плазма',
            'skin.toxic': 'Токсичний',

            // Досягнення
            'ach.first_game.name': 'Перший політ',
            'ach.first_game.desc': 'Зіграйте одну гру',
            'ach.score_300.name': 'Початківець',
            'ach.score_300.desc': 'Наберіть 300 очок',
            'ach.score_1000.name': 'Пілот',
            'ach.score_1000.desc': 'Наберіть 1000 очок',
            'ach.score_2500.name': 'Ас',
            'ach.score_2500.desc': 'Наберіть 2500 очок',
            'ach.combo_6.name': 'Комбо-майстер',
            'ach.combo_6.desc': 'Комбо 6+',
            'ach.combo_12.name': 'Серія',
            'ach.combo_12.desc': 'Комбо 12+',
            'ach.near_miss_20.name': 'Ледь оминули',
            'ach.near_miss_20.desc': '20 near-miss',
            'ach.stars_50.name': 'Зіркозбирач',
            'ach.stars_50.desc': 'Зібрати 50 зірок',
            'ach.first_storm.name': 'Пережити бурю',
            'ach.first_storm.desc': 'Пережити перший Neon Storm',
            'ach.ghost_master.name': 'Привид',
            'ach.ghost_master.desc': '5 разів пройти крізь стіни',
            'ach.marathon.name': 'Марафон',
            'ach.marathon.desc': 'Протриматися 2 хвилини',
            'ach.streak_3.name': 'Серія 3',
            'ach.streak_3.desc': 'Виклик дня 3 дні підряд',
            'ach.streak_7.name': 'Тижнева серія',
            'ach.streak_7.desc': 'Виклик дня 7 днів підряд',
            'ach.level_5.name': 'Рубіж 5',
            'ach.level_5.desc': 'Пройти 5 рівень кампанії',
            'ach.level_10.name': 'Рубіж 10',
            'ach.level_10.desc': 'Пройти 10 рівень кампанії',
            'ach.level_15.name': 'Чемпіон',
            'ach.level_15.desc': 'Пройти всі 25 рівнів кампанії',
            'ach.stars_15.name': 'Колекціонер зірок',
            'ach.stars_15.desc': 'Зібрати 15★ у кампанії',

            // Статистика
            'stats.bestScore': '🏆 Найкращий рахунок',
            'stats.campaignStars': '⭐ Зірок у кампанії',
            'stats.dailyStreak': '🔥 Серія викликів дня',
            'stats.bestCombo': '🔥 Найкраще комбо',
            'stats.totalGames': '🎮 Всього ігор',
            'stats.totalDeaths': '💀 Всього смертей',
            'stats.starsCollected': '⭐ Зірок зібрано під час гри',
            'stats.stormsSurvived': '⚡ Штормів пережито',
            'stats.nearMisses': '🎯 Near-miss',
            'stats.ghostPasses': '👻 Крізь стіни',
            'stats.longestGame': '⏱ Найдовша гра',
            'stats.totalPlaytime': '🕐 Загальний час',

            // HUD
            'hud.level': 'Рівень',
            'hud.best': 'Рекорд',
            'hud.daily': '📅 Виклик дня',

            // Бонуси
            'bonus.star': '+50',
            'bonus.shield': 'ЩИТ!',
            'bonus.slow': 'SLOW-MO',
            'bonus.double': '×2 ОЧКИ',
            'bonus.magnet': 'МАГНІТ',
            'bonus.ghost': 'ПРИВИД',
            'bonus.revive': 'ДРУГЕ ЖИТТЯ',
            'bonus.phase': 'ФАЗА!',

            // Підказки бонусів (перший підбір + довідка)
            'hint.star': 'Зірка дає +50 очок',
            'hint.shield': 'Щит поглинає один удар',
            'hint.slow': 'Уповільнює час на 3 секунди',
            'hint.double': 'Подвоює очки на 8 секунд',
            'hint.magnet': 'Притягує зірки 8 секунд',
            'hint.ghost': 'Проходь крізь перешкоди 5 секунд',
            'hint.revive': 'Друге життя після смерті',
            'hint.phase': 'Миттєвий прохід крізь усе 0.8 секунди',

            // Плаваючі тексти
            'float.ghost': 'ПРИВИД!',
            'float.storm': 'ШТОРМ!',
            'float.gravity': 'ГРАВІТАЦІЯ!',
            'storm.warning': 'Наближається NEON STORM!',

            // Поділитися результатом
            'btn.share': '📤 Поділитися',
            'share.text': 'Мій результат у Neon Gravity Runner: {score}!',
            'share.copied': 'Результат скопійовано!',
            'share.fail': 'Не вдалося поділитися',

            // Boot / помилки
            'boot.init': 'Ініціалізація…',
            'boot.check': 'Перевірка модулів…',
            'boot.state': 'Ініціалізація стану…',
            'boot.lang': 'Ініціалізація мови…',
            'boot.ui': 'Побудова інтерфейсу…',
            'boot.game': 'Ініціалізація гри…',
            'boot.settings': 'Застосування налаштувань…',
            'boot.update': 'Оновлення інтерфейсу…',
            'boot.ready': 'Готово!',
            'error.title': 'Щось пішло не так',
            'error.text': 'Сталася неочікувана помилка.',
            'error.reload': 'Перезапустити гру',

            // Інше
            'new_record': '🎉 НОВИЙ РЕКОРД!',
            'float.record': 'НОВИЙ РЕКОРД!',
            'gameover.dailyBest': 'Рекорд дня',
            'score': 'Очки',
            'combo': 'Комбо',
            'stars_collected': 'Зірки',
            'record': 'Рекорд',
            'achievements.word': 'Досягнення',
            'time': 'Час',
            'time.sec': 'с',
            'survived': 'ВИКОНАНО',
            'shield_used': '—'
        },
        ru: {
            // Главное меню
            'menu.title': 'Neon Gravity Runner',
            'menu.continue': '▶ Продолжить кампанию',
            'menu.campaign': '⭐ Кампания',
            'levels.word': 'уровней',
            'menu.endless': '♾ Бесконечность',
            'menu.daily': '📅 Ежедневный вызов',
            'menu.timeattack': '⏱ Time Attack',
            'menu.survival': '💀 Survival',
            'menu.zen': '🧘 Zen',
            'menu.skins': '🎨 Скины',
            'menu.achievements': '🏆 Достижения',
            'menu.leaderboard': '👑 Рекорды ТОП-5',
            'menu.settings': '⚙ Настройки',
            'menu.stats': '📊 Статистика',
            'menu.best': 'Рекорд',
            'menu.stars': 'Звезды',
            'menu.games': 'Игр',

            // Справка
            'btn.help': '❔ Справка',
            'help.title': 'Справка',
            'help.controls': 'Управление',
            'help.controlsList': '<b>SPACE</b> / клик / тап — переключить гравитацию<br><b>P</b> — пауза · <b>M</b> — звук · <b>F</b> — полный экран<br><b>R</b> — быстрый рестарт · <b>ESC</b> — пауза',
            'help.bonuses': 'Бонусы',

            // Причина смерти
            'gameover.cause': 'Причина',
            'cause.wall': 'Стена',
            'cause.gate': 'Ворота',
            'cause.moving': 'Движущийся блок',
            'cause.spikes': 'Шипы',
            'cause.laser': 'Лазер',
            'cause.moving_laser': 'Движущийся лазер',
            'cause.pulsar': 'Пульсар',

            // Режимы игры
            'mode.timeattack.name': 'Time Attack',
            'mode.timeattack.desc': 'Набрать максимум очков за 3 минуты',
            'mode.timeattack.hud': '⏱ Time Attack',
            'mode.timeattack.done': '⏱ Время вышло!',
            'mode.survival.name': 'Survival',
            'mode.survival.desc': 'Выжить как можно дольше с растущей сложностью',
            'mode.survival.hud': '💀 Survival',
            'mode.zen.name': 'Zen',
            'mode.zen.desc': 'Спокойный полет без очков и смертей',
            'mode.zen.hud': '🧘 Zen',

            // Экраны
            'levels.title': 'Выбор уровня кампании',
            'levels.description': 'Пройдите все 25 испытаний и соберите максимум звезд!',
            'victory.title': 'Уровень пройден!',
            'victory.scoreEarned': 'Получено очков за уровень',
            'victory.req1': '★ Продержаться до конца:',
            'victory.req3': '★★★ Без потери щита и ≥5 Near-Miss:',
            'victory.shieldDamaged': 'Щит поврежден',
            'victory.noDamage': 'Без повреждений',
            'leaderboard.title': '👑 ТОП-5 Рекордов',
            'leaderboard.empty': 'Ещё нет сохранённых рекордов. Сыграйте забег!',
            'lb.endless': 'Бесконечность',
            'lb.daily': 'Вызов дня',
            'lb.timeattack': 'Time Attack',
            'lb.survival': 'Survival',
            'lb.zen': 'Zen',
            'skins.title': 'Скины игрока',
            'skins.description': 'Каждый скин имеет свой цвет и уникальную форму следа!',
            'skins.locked': 'Скин заблокирован',
            'skins.trail': 'След',
            'achievements.title': 'Достижения',
            'settings.title': 'Настройки',
            'stats.title': 'Статистика пилота',
            'pause.title': 'Пауза',
            'pause.mode': 'Режим',
            'pause.keys': '<b>SPACE</b> — гравитация · <b>P</b> — пауза · <b>M</b> — звук · <b>F</b> — полный экран · <b>R</b> — рестарт',
            'gameover.title': 'Столкновение!',
            'tutorial.title': 'Как играть',
            'tutorial.description': 'Нажимай <b>SPACE</b>, кликай или тапай, чтобы переключать гравитацию.',
            'tutorial.description2': 'Каждый прыжок дает импульс. Избегай стен, лазеров, огненных шипов и пульсаров!',
            'tutorial.gravity': '🌀 <b>Гравитационные зоны</b> временно переворачивают гравитацию.',
            'tutorial.storm': '⚡ Каждые 45 секунд — <b>Neon Storm</b>!',

            // Кнопки
            'btn.back': '← Назад',
            'btn.resume': '▶ Продолжить',
            'btn.retry': '↻ Повторить',
            'btn.restart': '↻ Перезапустить',
            'btn.menu': 'В меню',
            'btn.next': 'Следующий уровень ▶',
            'btn.levels': '☰ Все уровни',
            'btn.start': 'Начать полет!',

            // Настройки
            'settings.difficulty': 'Сложность',
            'settings.easy': 'Легко',
            'settings.normal': 'Нормально',
            'settings.hardcore': 'Хардкор',
            'settings.sfx': 'Звуки',
            'settings.music': 'Музыка',
            'settings.quality': 'Качество графики',
            'settings.theme': 'Тема оформления',
            'settings.reducedMotion': 'Уменьшенное движение (без тряски)',
            'settings.mute': 'Выключить звук полностью',
            'settings.vibration': 'Вибрация (мобильные)',
            'settings.gravityGuide': 'Линия гравитации',
            'settings.language': 'Язык',

            // Данные прогресса
            'settings.data': 'Данные прогресса',
            'settings.export': '⬆ Экспорт',
            'settings.import': '⬇ Импорт',
            'settings.reset': '🗑 Сбросить',
            'settings.exportCopied': 'Код скопирован в буфер обмена',
            'settings.exportPrompt': 'Скопируйте код прогресса:',
            'settings.importPrompt': 'Вставьте код прогресса:',
            'settings.importSuccess': 'Прогресс восстановлен!',
            'settings.importError': 'Некорректный код прогресса',
            'settings.resetConfirm': 'Сбросить весь прогресс? Это необратимо!',
            'settings.resetDone': 'Прогресс сброшен',

            // Облачная синхронизация
            'settings.cloudSync': '☁ Облачная синхронизация',
            'settings.cloudSyncBtn': '☁ Синхронизировать',
            'cloud.lastSync': 'Последняя синхронизация',
            'cloud.never': 'никогда',
            'cloud.notConfigured': 'Не настроено',
            'cloud.notReady': 'Облачное хранилище не настроено',
            'cloud.syncing': 'Синхронизация…',
            'cloud.syncOk': 'Синхронизация успешна',
            'cloud.syncFail': 'Ошибка синхронизации',

            // Уровни качества
            'quality.low': 'Низкая',
            'quality.medium': 'Средняя',
            'quality.high': 'Высокая',
            'quality.ultra': 'Ультра',

            // Темы
            'theme.cyberpunk': 'Киберпанк',
            'theme.retrowave': 'Ретро-вейв',
            'theme.matrix': 'Матрица',
            'theme.fire': 'Огонь',
            'theme.dark': 'Темный сектор',
            'theme.iris': 'Ирис',

            // Уровни кампании
            'level.1': 'Первый полет',
            'level.2': 'Врата',
            'level.3': 'Качающиеся блоки',
            'level.4': 'Шиповый пояс',
            'level.5': 'Лазерный рубеж',
            'level.6': 'Двойная угроза',
            'level.7': 'Неоновый шторм',
            'level.8': 'Плотный огонь',
            'level.9': 'Гравитационные зоны',
            'level.10': 'Пульсар',
            'level.11': 'Хаос',
            'level.12': 'Штормовое ядро',
            'level.13': 'Предел скорости',
            'level.14': 'Темный сектор',
            'level.15': 'Финальный рубеж',
            'level.16': 'Двойной пульсар',
            'level.17': 'Лазерный шторм',
            'level.18': 'Танец движения',
            'level.19': 'Гравитационная воронка',
            'level.20': 'Огненный рубеж',
            'level.21': 'Бесконечные ворота',
            'level.22': 'Электрическая сетка',
            'level.23': 'Матричный хаос',
            'level.24': 'Око бури',
            'level.25': 'Последний предел',

            // Скины
            'skin.default': 'Базовый',
            'skin.pink': 'Неоново-розовый',
            'skin.gold': 'Золотой',
            'skin.green': 'Хакер',
            'skin.rainbow': 'Радуга',
            'skin.white': 'Призрак',
            'skin.plasma': 'Плазма',
            'skin.toxic': 'Токсичный',

            // Достижения
            'ach.first_game.name': 'Первый полет',
            'ach.first_game.desc': 'Сыграйте одну игру',
            'ach.score_300.name': 'Новичок',
            'ach.score_300.desc': 'Наберите 300 очков',
            'ach.score_1000.name': 'Пилот',
            'ach.score_1000.desc': 'Наберите 1000 очков',
            'ach.score_2500.name': 'Ас',
            'ach.score_2500.desc': 'Наберите 2500 очков',
            'ach.combo_6.name': 'Комбо-мастер',
            'ach.combo_6.desc': 'Комбо 6+',
            'ach.combo_12.name': 'Серия',
            'ach.combo_12.desc': 'Комбо 12+',
            'ach.near_miss_20.name': 'Едва минули',
            'ach.near_miss_20.desc': '20 near-miss',
            'ach.stars_50.name': 'Звездочет',
            'ach.stars_50.desc': 'Собрать 50 звезд',
            'ach.first_storm.name': 'Пережить бурю',
            'ach.first_storm.desc': 'Пережить первый Neon Storm',
            'ach.ghost_master.name': 'Призрак',
            'ach.ghost_master.desc': '5 раз пройти сквозь стены',
            'ach.marathon.name': 'Марафон',
            'ach.marathon.desc': 'Продержаться 2 минуты',
            'ach.streak_3.name': 'Серия 3',
            'ach.streak_3.desc': 'Ежедневный вызов 3 дня подряд',
            'ach.streak_7.name': 'Недельная серия',
            'ach.streak_7.desc': 'Ежедневный вызов 7 дней подряд',
            'ach.level_5.name': 'Рубеж 5',
            'ach.level_5.desc': 'Пройти 5 уровень кампании',
            'ach.level_10.name': 'Рубеж 10',
            'ach.level_10.desc': 'Пройти 10 уровень кампании',
            'ach.level_15.name': 'Чемпион',
            'ach.level_15.desc': 'Пройти все 25 уровней кампании',
            'ach.stars_15.name': 'Коллекционер звезд',
            'ach.stars_15.desc': 'Собрать 15★ в кампании',

            // Статистика
            'stats.bestScore': '🏆 Лучший счет',
            'stats.campaignStars': '⭐ Звезд в кампании',
            'stats.dailyStreak': '🔥 Серия ежедневных вызовов',
            'stats.bestCombo': '🔥 Лучшее комбо',
            'stats.totalGames': '🎮 Всего игр',
            'stats.totalDeaths': '💀 Всего смертей',
            'stats.starsCollected': '⭐ Звезд собрано за игру',
            'stats.stormsSurvived': '⚡ Штормов пережито',
            'stats.nearMisses': '🎯 Near-miss',
            'stats.ghostPasses': '👻 Сквозь стены',
            'stats.longestGame': '⏱ Самая долгая игра',
            'stats.totalPlaytime': '🕐 Общее время',

            // HUD
            'hud.level': 'Уровень',
            'hud.best': 'Рекорд',
            'hud.daily': '📅 Ежедневный вызов',

            // Бонусы
            'bonus.star': '+50',
            'bonus.shield': 'ЩИТ!',
            'bonus.slow': 'SLOW-MO',
            'bonus.double': '×2 ОЧКИ',
            'bonus.magnet': 'МАГНИТ',
            'bonus.ghost': 'ПРИЗРАК',
            'bonus.revive': 'ВТОРАЯ ЖИЗНЬ',
            'bonus.phase': 'ФАЗА!',

            // Подсказки бонусов (первый подбор + справка)
            'hint.star': 'Звезда даёт +50 очков',
            'hint.shield': 'Щит поглощает один удар',
            'hint.slow': 'Замедляет время на 3 секунды',
            'hint.double': 'Удваивает очки на 8 секунд',
            'hint.magnet': 'Притягивает звёзды 8 секунд',
            'hint.ghost': 'Проходи сквозь препятствия 5 секунд',
            'hint.revive': 'Вторая жизнь после смерти',
            'hint.phase': 'Мгновенный проход сквозь всё 0.8 секунды',

            // Плавающие тексты
            'float.ghost': 'ПРИЗРАК!',
            'float.storm': 'ШТОРМ!',
            'float.gravity': 'ГРАВИТАЦИЯ!',
            'storm.warning': 'Приближается NEON STORM!',

            // Поделиться результатом
            'btn.share': '📤 Поделиться',
            'share.text': 'Мой результат в Neon Gravity Runner: {score}!',
            'share.copied': 'Результат скопирован!',
            'share.fail': 'Не удалось поделиться',

            // Boot / ошибки
            'boot.init': 'Инициализация…',
            'boot.check': 'Проверка модулей…',
            'boot.state': 'Инициализация состояния…',
            'boot.lang': 'Инициализация языка…',
            'boot.ui': 'Построение интерфейса…',
            'boot.game': 'Инициализация игры…',
            'boot.settings': 'Применение настроек…',
            'boot.update': 'Обновление интерфейса…',
            'boot.ready': 'Готово!',
            'error.title': 'Что-то пошло не так',
            'error.text': 'Произошла непредвиденная ошибка.',
            'error.reload': 'Перезапустить игру',

            // Другое
            'new_record': '🎉 НОВЫЙ РЕКОРД!',
            'float.record': 'НОВЫЙ РЕКОРД!',
            'gameover.dailyBest': 'Рекорд дня',
            'score': 'Очки',
            'combo': 'Комбо',
            'stars_collected': 'Звезды',
            'record': 'Рекорд',
            'achievements.word': 'Достижения',
            'time': 'Время',
            'time.sec': 'с',
            'survived': 'ВЫПОЛНЕНО',
            'shield_used': '—'
        },
        en: {
            // Main menu
            'menu.title': 'Neon Gravity Runner',
            'menu.continue': '▶ Continue Campaign',
            'menu.campaign': '⭐ Campaign',
            'levels.word': 'levels',
            'menu.endless': '♾ Endless',
            'menu.daily': '📅 Daily Challenge',
            'menu.timeattack': '⏱ Time Attack',
            'menu.survival': '💀 Survival',
            'menu.zen': '🧘 Zen',
            'menu.skins': '🎨 Skins',
            'menu.achievements': '🏆 Achievements',
            'menu.leaderboard': '👑 TOP-5 Records',
            'menu.settings': '⚙ Settings',
            'menu.stats': '📊 Statistics',
            'menu.best': 'Record',
            'menu.stars': 'Stars',
            'menu.games': 'Games',

            // Help
            'btn.help': '❔ Help',
            'help.title': 'Help',
            'help.controls': 'Controls',
            'help.controlsList': '<b>SPACE</b> / click / tap — flip gravity<br><b>P</b> — pause · <b>M</b> — mute · <b>F</b> — fullscreen<br><b>R</b> — quick restart · <b>ESC</b> — pause',
            'help.bonuses': 'Bonuses',

            // Death cause
            'gameover.cause': 'Cause',
            'cause.wall': 'Wall',
            'cause.gate': 'Gate',
            'cause.moving': 'Moving block',
            'cause.spikes': 'Spikes',
            'cause.laser': 'Laser',
            'cause.moving_laser': 'Moving laser',
            'cause.pulsar': 'Pulsar',

            // Game modes
            'mode.timeattack.name': 'Time Attack',
            'mode.timeattack.desc': 'Score as much as possible in 3 minutes',
            'mode.timeattack.hud': '⏱ Time Attack',
            'mode.timeattack.done': '⏱ Time is up!',
            'mode.survival.name': 'Survival',
            'mode.survival.desc': 'Survive as long as you can with rising difficulty',
            'mode.survival.hud': '💀 Survival',
            'mode.zen.name': 'Zen',
            'mode.zen.desc': 'A calm flight without score or deaths',
            'mode.zen.hud': '🧘 Zen',

            // Screens
            'levels.title': 'Campaign Level Selection',
            'levels.description': 'Complete all 25 challenges and collect maximum stars!',
            'victory.title': 'Level Completed!',
            'victory.scoreEarned': 'Points earned in level',
            'victory.req1': '★ Survive until the end:',
            'victory.req3': '★★★ No shield loss and ≥5 near-misses:',
            'victory.shieldDamaged': 'Shield damaged',
            'victory.noDamage': 'No damage',
            'leaderboard.title': '👑 TOP-5 Records',
            'leaderboard.empty': 'No records yet. Play a run!',
            'lb.endless': 'Endless',
            'lb.daily': 'Daily Challenge',
            'lb.timeattack': 'Time Attack',
            'lb.survival': 'Survival',
            'lb.zen': 'Zen',
            'skins.title': 'Player Skins',
            'skins.description': 'Each skin has its own color and unique trail shape!',
            'skins.locked': 'Skin locked',
            'skins.trail': 'Trail',
            'achievements.title': 'Achievements',
            'settings.title': 'Settings',
            'stats.title': 'Pilot Statistics',
            'pause.title': 'Pause',
            'pause.mode': 'Mode',
            'pause.keys': '<b>SPACE</b> — gravity · <b>P</b> — pause · <b>M</b> — mute · <b>F</b> — fullscreen · <b>R</b> — restart',
            'gameover.title': 'Collision!',
            'tutorial.title': 'How to Play',
            'tutorial.description': 'Press <b>SPACE</b>, click or tap to switch gravity.',
            'tutorial.description2': 'Each jump gives impulse. Avoid walls, lasers, fire spikes and pulsars!',
            'tutorial.gravity': '🌀 <b>Gravity zones</b> temporarily invert gravity.',
            'tutorial.storm': '⚡ Every 45 seconds — <b>Neon Storm</b>!',

            // Buttons
            'btn.back': '← Back',
            'btn.resume': '▶ Resume',
            'btn.retry': '↻ Retry',
            'btn.restart': '↻ Restart',
            'btn.menu': 'Menu',
            'btn.next': 'Next Level ▶',
            'btn.levels': '☰ All levels',
            'btn.start': 'Start Flight!',

            // Settings
            'settings.difficulty': 'Difficulty',
            'settings.easy': 'Easy',
            'settings.normal': 'Normal',
            'settings.hardcore': 'Hardcore',
            'settings.sfx': 'Sounds',
            'settings.music': 'Music',
            'settings.quality': 'Graphics Quality',
            'settings.theme': 'Theme',
            'settings.reducedMotion': 'Reduced Motion (no shake)',
            'settings.mute': 'Mute All Sounds',
            'settings.vibration': 'Vibration (mobile)',
            'settings.gravityGuide': 'Gravity guide line',
            'settings.language': 'Language',

            // Progress data
            'settings.data': 'Progress data',
            'settings.export': '⬆ Export',
            'settings.import': '⬇ Import',
            'settings.reset': '🗑 Reset',
            'settings.exportCopied': 'Code copied to clipboard',
            'settings.exportPrompt': 'Copy your progress code:',
            'settings.importPrompt': 'Paste your progress code:',
            'settings.importSuccess': 'Progress restored!',
            'settings.importError': 'Invalid progress code',
            'settings.resetConfirm': 'Reset all progress? This cannot be undone!',
            'settings.resetDone': 'Progress has been reset',

            // Cloud sync
            'settings.cloudSync': '☁ Cloud Sync',
            'settings.cloudSyncBtn': '☁ Sync Now',
            'cloud.lastSync': 'Last sync',
            'cloud.never': 'never',
            'cloud.notConfigured': 'Not configured',
            'cloud.notReady': 'Cloud storage is not configured',
            'cloud.syncing': 'Syncing…',
            'cloud.syncOk': 'Sync complete',
            'cloud.syncFail': 'Sync failed',

            // Quality levels
            'quality.low': 'Low',
            'quality.medium': 'Medium',
            'quality.high': 'High',
            'quality.ultra': 'Ultra',

            // Themes
            'theme.cyberpunk': 'Cyberpunk',
            'theme.retrowave': 'Retrowave',
            'theme.matrix': 'Matrix',
            'theme.fire': 'Fire',
            'theme.dark': 'Dark Sector',
            'theme.iris': 'Iris',

            // Campaign levels
            'level.1': 'First Flight',
            'level.2': 'Gates',
            'level.3': 'Shaky Blocks',
            'level.4': 'Spike Belt',
            'level.5': 'Laser Frontier',
            'level.6': 'Double Threat',
            'level.7': 'Neon Storm',
            'level.8': 'Heavy Fire',
            'level.9': 'Gravity Zones',
            'level.10': 'Pulsar',
            'level.11': 'Chaos',
            'level.12': 'Storm Core',
            'level.13': 'Speed Limit',
            'level.14': 'Dark Sector',
            'level.15': 'Final Frontier',
            'level.16': 'Double Pulsar',
            'level.17': 'Laser Storm',
            'level.18': 'Dance of Motion',
            'level.19': 'Gravity Funnel',
            'level.20': 'Fire Frontier',
            'level.21': 'Endless Gates',
            'level.22': 'Electric Grid',
            'level.23': 'Matrix Chaos',
            'level.24': 'Eye of the Storm',
            'level.25': 'The Final Limit',

            // Skins
            'skin.default': 'Basic',
            'skin.pink': 'Neon Pink',
            'skin.gold': 'Gold',
            'skin.green': 'Hacker',
            'skin.rainbow': 'Rainbow',
            'skin.white': 'Ghost',
            'skin.plasma': 'Plasma',
            'skin.toxic': 'Toxic',

            // Achievements
            'ach.first_game.name': 'First Flight',
            'ach.first_game.desc': 'Play one game',
            'ach.score_300.name': 'Rookie',
            'ach.score_300.desc': 'Score 300 points',
            'ach.score_1000.name': 'Pilot',
            'ach.score_1000.desc': 'Score 1000 points',
            'ach.score_2500.name': 'Ace',
            'ach.score_2500.desc': 'Score 2500 points',
            'ach.combo_6.name': 'Combo Master',
            'ach.combo_6.desc': 'Combo 6+',
            'ach.combo_12.name': 'Streak',
            'ach.combo_12.desc': 'Combo 12+',
            'ach.near_miss_20.name': 'Near Missed',
            'ach.near_miss_20.desc': '20 near-misses',
            'ach.stars_50.name': 'Star Collector',
            'ach.stars_50.desc': 'Collect 50 stars',
            'ach.first_storm.name': 'Weather the Storm',
            'ach.first_storm.desc': 'Survive your first Neon Storm',
            'ach.ghost_master.name': 'Ghost',
            'ach.ghost_master.desc': 'Pass through walls 5 times',
            'ach.marathon.name': 'Marathon',
            'ach.marathon.desc': 'Last 2 minutes',
            'ach.streak_3.name': 'Streak 3',
            'ach.streak_3.desc': 'Daily challenge 3 days in a row',
            'ach.streak_7.name': 'Week Streak',
            'ach.streak_7.desc': 'Daily challenge 7 days in a row',
            'ach.level_5.name': 'Milestone 5',
            'ach.level_5.desc': 'Complete campaign level 5',
            'ach.level_10.name': 'Milestone 10',
            'ach.level_10.desc': 'Complete campaign level 10',
            'ach.level_15.name': 'Champion',
            'ach.level_15.desc': 'Complete all 25 campaign levels',
            'ach.stars_15.name': 'Star Hoarder',
            'ach.stars_15.desc': 'Collect 15★ in campaign',

            // Statistics
            'stats.bestScore': '🏆 Best score',
            'stats.campaignStars': '⭐ Campaign stars',
            'stats.dailyStreak': '🔥 Daily challenge streak',
            'stats.bestCombo': '🔥 Best combo',
            'stats.totalGames': '🎮 Total games',
            'stats.totalDeaths': '💀 Total deaths',
            'stats.starsCollected': '⭐ Stars collected in runs',
            'stats.stormsSurvived': '⚡ Storms survived',
            'stats.nearMisses': '🎯 Near-misses',
            'stats.ghostPasses': '👻 Through walls',
            'stats.longestGame': '⏱ Longest run',
            'stats.totalPlaytime': '🕐 Total time',

            // HUD
            'hud.level': 'Level',
            'hud.best': 'Best',
            'hud.daily': '📅 Daily Challenge',

            // Bonuses
            'bonus.star': '+50',
            'bonus.shield': 'SHIELD!',
            'bonus.slow': 'SLOW-MO',
            'bonus.double': '×2 POINTS',
            'bonus.magnet': 'MAGNET',
            'bonus.ghost': 'GHOST',
            'bonus.revive': 'EXTRA LIFE',
            'bonus.phase': 'PHASE!',

            // Bonus hints (first pickup + help screen)
            'hint.star': 'Star gives +50 points',
            'hint.shield': 'Shield absorbs one hit',
            'hint.slow': 'Slows down time for 3 seconds',
            'hint.double': 'Doubles points for 8 seconds',
            'hint.magnet': 'Attracts stars for 8 seconds',
            'hint.ghost': 'Pass through obstacles for 5 seconds',
            'hint.revive': 'Extra life after death',
            'hint.phase': 'Instant phase through everything for 0.8s',

            // Floating texts
            'float.ghost': 'GHOST!',
            'float.storm': 'STORM!',
            'float.gravity': 'GRAVITY!',
            'storm.warning': 'NEON STORM approaching!',

            // Share result
            'btn.share': '📤 Share',
            'share.text': 'My Neon Gravity Runner score: {score}!',
            'share.copied': 'Score copied!',
            'share.fail': 'Could not share',

            // Boot / errors
            'boot.init': 'Initializing…',
            'boot.check': 'Checking modules…',
            'boot.state': 'Initializing state…',
            'boot.lang': 'Initializing language…',
            'boot.ui': 'Building interface…',
            'boot.game': 'Initializing game…',
            'boot.settings': 'Applying settings…',
            'boot.update': 'Updating interface…',
            'boot.ready': 'Ready!',
            'error.title': 'Something went wrong',
            'error.text': 'An unexpected error occurred.',
            'error.reload': 'Restart game',

            // Other
            'new_record': '🎉 NEW RECORD!',
            'float.record': 'NEW RECORD!',
            'gameover.dailyBest': "Day's best",
            'score': 'Score',
            'combo': 'Combo',
            'stars_collected': 'Stars',
            'record': 'Record',
            'achievements.word': 'Achievement',
            'time': 'Time',
            'time.sec': 's',
            'survived': 'COMPLETED',
            'shield_used': '—'
        }
    };

    let _currentLang = 'uk';

    function _log(level, msg) {
        try { if (window.Logger) window.Logger[level]('[I18n] ' + msg); } catch (e) {}
    }

    function _applyHtmlLang() {
        try { document.documentElement.lang = _currentLang; } catch (e) {}
    }

    function init() {
        try {
            // Попытка загрузить сохраненный язык
            const savedLang = window.State.getSetting('language');
            if (savedLang && TRANSLATIONS[savedLang]) {
                _currentLang = savedLang;
            } else {
                // Автоопределение языка браузера
                const browserLang = navigator.language || navigator.userLanguage;
                if (browserLang && browserLang.startsWith('ru')) {
                    _currentLang = 'ru';
                } else if (browserLang && browserLang.startsWith('en')) {
                    _currentLang = 'en';
                } else {
                    _currentLang = 'uk'; // по умолчанию украинский
                }
            }
            _applyHtmlLang();
            _log('info', 'init OK, language: ' + _currentLang);
        } catch (e) {
            _log('error', 'init: ' + e.message);
        }
    }

    function t(key) {
        const dict = TRANSLATIONS[_currentLang];
        const translation = dict ? dict[key] : undefined;
        return translation !== undefined ? translation : key;
    }

    function setLanguage(lang) {
        if (TRANSLATIONS[lang]) {
            _currentLang = lang;
            window.State.setSetting('language', lang);
            _applyHtmlLang();
            _log('info', 'Language changed to: ' + lang);
            return true;
        }
        return false;
    }

    function getCurrentLanguage() {
        return _currentLang;
    }

    function getAvailableLanguages() {
        return Object.keys(TRANSLATIONS).map(function (code) {
            const names = { uk: 'Українська', ru: 'Русский', en: 'English' };
            return { code: code, name: names[code] || code };
        });
    }

    // Для тестів і дебагу: прямий доступ до словників (в UI не використовувати)
    function getTranslations() {
        return TRANSLATIONS;
    }

    window.I18n = {
        init: init,
        t: t,
        setLanguage: setLanguage,
        getCurrentLanguage: getCurrentLanguage,
        getAvailableLanguages: getAvailableLanguages,
        getTranslations: getTranslations
    };
})();
