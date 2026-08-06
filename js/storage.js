/**
 * 設定と学習進捗を localStorage に保存する。
 */
(function (global) {
  'use strict';

  var SETTINGS_KEY = 'flashcards.settings.v1';
  var PROGRESS_KEY = 'flashcards.progress.v1';

  var DEFAULT_SETTINGS = {
    wordCount: 20,          // 1 セッションで出題する単語数
    requiredStreak: 2,      // 学習済みと判定する連続正解回数
    direction: 'term-first',// term-first | meaning-first | mixed
    order: 'unlearned-first'// unlearned-first | random | weak-first
  };

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      var value = JSON.parse(raw);
      return (value && typeof value === 'object') ? value : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function read(key, fallback) {
    try {
      return safeParse(global.localStorage.getItem(key), fallback);
    } catch (err) {
      // プライベートモードなどで localStorage が使えない場合
      return fallback;
    }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function clampInt(value, min, max, fallback) {
    var num = parseInt(value, 10);
    if (isNaN(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function normalizeSettings(settings) {
    var s = settings || {};
    return {
      wordCount: clampInt(s.wordCount, 1, 500, DEFAULT_SETTINGS.wordCount),
      requiredStreak: clampInt(s.requiredStreak, 1, 10, DEFAULT_SETTINGS.requiredStreak),
      direction: ['term-first', 'meaning-first', 'mixed'].indexOf(s.direction) >= 0
        ? s.direction : DEFAULT_SETTINGS.direction,
      order: ['unlearned-first', 'random', 'weak-first'].indexOf(s.order) >= 0
        ? s.order : DEFAULT_SETTINGS.order
    };
  }

  function loadSettings() {
    return normalizeSettings(read(SETTINGS_KEY, DEFAULT_SETTINGS));
  }

  function saveSettings(settings) {
    var normalized = normalizeSettings(settings);
    write(SETTINGS_KEY, normalized);
    return normalized;
  }

  function loadProgress() {
    return read(PROGRESS_KEY, {});
  }

  function saveProgress(progress) {
    write(PROGRESS_KEY, progress || {});
  }

  /** セッションの結果を進捗に反映する */
  function recordSession(cards) {
    var progress = loadProgress();
    var now = Date.now();
    (cards || []).forEach(function (card) {
      var id = card.word.id;
      var stat = progress[id] || { correct: 0, wrong: 0, learned: false, studiedAt: null };
      stat.correct += card.correct;
      stat.wrong += card.wrong;
      stat.learned = stat.learned || card.learned;
      stat.studiedAt = now;
      progress[id] = stat;
    });
    saveProgress(progress);
    return progress;
  }

  function resetProgress(deckId) {
    if (!deckId) {
      saveProgress({});
      return {};
    }
    var progress = loadProgress();
    Object.keys(progress).forEach(function (id) {
      if (id.indexOf(deckId + ':') === 0) delete progress[id];
    });
    saveProgress(progress);
    return progress;
  }

  var api = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    normalizeSettings: normalizeSettings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    recordSession: recordSession,
    resetProgress: resetProgress
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.AppStorage = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
