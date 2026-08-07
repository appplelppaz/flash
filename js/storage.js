/**
 * 設定・学習進捗・お気に入り・自作単語・統計を localStorage に保存する。
 */
(function (global) {
  'use strict';

  var KEYS = {
    settings: 'flashcards.settings.v1',
    progress: 'flashcards.progress.v1',
    favorites: 'flashcards.favorites.v1',
    custom: 'flashcards.custom.v1',
    stats: 'flashcards.stats.v1'
  };

  var DEFAULT_SETTINGS = {
    wordCount: 20,            // 1 セッションで出題する単語数
    requiredStreak: 2,        // 学習済みと判定する連続正解回数
    direction: 'term-first',  // term-first | meaning-first | mixed
    order: 'unlearned-first', // unlearned-first | random | weak-first
    mode: 'flashcard',        // flashcard | quiz
    theme: 'auto',            // auto | light | dark
    speech: true              // 単語の読み上げ
  };

  var DEFAULT_STATS = {
    answered: 0,
    correct: 0,
    sessions: 0,
    lastStudyDate: null, // 'YYYY-MM-DD'
    streakDays: 0,
    bestStreakDays: 0
  };

  function read(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      var value = JSON.parse(raw);
      return (value && typeof value === 'object') ? value : fallback;
    } catch (err) {
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

  function oneOf(value, allowed, fallback) {
    return allowed.indexOf(value) >= 0 ? value : fallback;
  }

  function normalizeSettings(settings) {
    var s = settings || {};
    return {
      wordCount: clampInt(s.wordCount, 1, 500, DEFAULT_SETTINGS.wordCount),
      requiredStreak: clampInt(s.requiredStreak, 1, 10, DEFAULT_SETTINGS.requiredStreak),
      direction: oneOf(s.direction, ['term-first', 'meaning-first', 'mixed'], DEFAULT_SETTINGS.direction),
      order: oneOf(s.order, ['unlearned-first', 'random', 'weak-first'], DEFAULT_SETTINGS.order),
      mode: oneOf(s.mode, ['flashcard', 'quiz'], DEFAULT_SETTINGS.mode),
      theme: oneOf(s.theme, ['auto', 'light', 'dark'], DEFAULT_SETTINGS.theme),
      speech: s.speech !== false
    };
  }

  function loadSettings() { return normalizeSettings(read(KEYS.settings, DEFAULT_SETTINGS)); }

  function saveSettings(settings) {
    var normalized = normalizeSettings(settings);
    write(KEYS.settings, normalized);
    return normalized;
  }

  function loadProgress() { return read(KEYS.progress, {}); }
  function saveProgress(progress) { write(KEYS.progress, progress || {}); }

  function statOf(wordId, progress) {
    var source = progress || loadProgress();
    return source[wordId] || { correct: 0, wrong: 0, learned: false, studiedAt: null };
  }

  function loadFavorites() { return read(KEYS.favorites, {}); }

  function isFavorite(wordId) { return loadFavorites()[wordId] === true; }

  function toggleFavorite(wordId) {
    var favorites = loadFavorites();
    if (favorites[wordId]) delete favorites[wordId];
    else favorites[wordId] = true;
    write(KEYS.favorites, favorites);
    return favorites[wordId] === true;
  }

  // ---------- 自作単語 ----------

  function loadCustomWords() { return read(KEYS.custom, {}); }

  function customWordsFor(deckId) {
    var all = loadCustomWords();
    return (all[deckId] || []).slice();
  }

  function saveCustomWord(deckId, word, originalTerm) {
    var all = loadCustomWords();
    var list = all[deckId] || [];
    var entry = {
      term: String(word.term || '').trim(),
      reading: String(word.reading || '').trim(),
      meaning: String(word.meaning || '').trim()
    };
    if (!entry.term || !entry.meaning) return { ok: false, reason: 'empty' };

    var index = originalTerm
      ? list.findIndex(function (w) { return w.term === originalTerm; })
      : -1;
    var duplicate = list.some(function (w, i) { return w.term === entry.term && i !== index; });
    if (duplicate) return { ok: false, reason: 'duplicate' };

    if (index >= 0) list[index] = entry;
    else list.push(entry);

    all[deckId] = list;
    write(KEYS.custom, all);
    return { ok: true, word: entry };
  }

  function deleteCustomWord(deckId, term) {
    var all = loadCustomWords();
    var list = all[deckId] || [];
    all[deckId] = list.filter(function (w) { return w.term !== term; });
    write(KEYS.custom, all);

    // 進捗とお気に入りも掃除する
    var wordId = deckId + ':' + term;
    var progress = loadProgress();
    delete progress[wordId];
    saveProgress(progress);
    var favorites = loadFavorites();
    delete favorites[wordId];
    write(KEYS.favorites, favorites);
  }

  // ---------- 統計 ----------

  function todayKey(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function daysBetween(fromKey, toKey) {
    var from = new Date(fromKey + 'T00:00:00');
    var to = new Date(toKey + 'T00:00:00');
    return Math.round((to - from) / 86400000);
  }

  function loadStats() {
    var stats = read(KEYS.stats, DEFAULT_STATS);
    return {
      answered: stats.answered || 0,
      correct: stats.correct || 0,
      sessions: stats.sessions || 0,
      lastStudyDate: stats.lastStudyDate || null,
      streakDays: stats.streakDays || 0,
      bestStreakDays: stats.bestStreakDays || 0
    };
  }

  /** 「今日も学習した」を反映して連続学習日数を更新する */
  function touchStreak(stats, today) {
    var key = today || todayKey();
    if (stats.lastStudyDate === key) return stats;
    if (stats.lastStudyDate && daysBetween(stats.lastStudyDate, key) === 1) stats.streakDays += 1;
    else stats.streakDays = 1;
    stats.lastStudyDate = key;
    stats.bestStreakDays = Math.max(stats.bestStreakDays, stats.streakDays);
    return stats;
  }

  /** セッションの結果を進捗と統計に反映する */
  function recordSession(cards, sessionStats) {
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

    var stats = loadStats();
    stats.answered += (sessionStats && sessionStats.answered) || 0;
    stats.correct += (sessionStats && sessionStats.correct) || 0;
    stats.sessions += 1;
    touchStreak(stats);
    write(KEYS.stats, stats);

    return { progress: progress, stats: stats };
  }

  function resetProgress() {
    saveProgress({});
    write(KEYS.stats, DEFAULT_STATS);
    return {};
  }

  // ---------- バックアップ ----------

  function exportData() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: loadSettings(),
      progress: loadProgress(),
      favorites: loadFavorites(),
      custom: loadCustomWords(),
      stats: loadStats()
    };
  }

  function importData(data) {
    if (!data || typeof data !== 'object') return { ok: false, reason: 'invalid' };
    if (data.settings) saveSettings(data.settings);
    if (data.progress && typeof data.progress === 'object') saveProgress(data.progress);
    if (data.favorites && typeof data.favorites === 'object') write(KEYS.favorites, data.favorites);
    if (data.custom && typeof data.custom === 'object') write(KEYS.custom, data.custom);
    if (data.stats && typeof data.stats === 'object') write(KEYS.stats, data.stats);
    return { ok: true };
  }

  var api = {
    KEYS: KEYS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    normalizeSettings: normalizeSettings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    statOf: statOf,
    loadFavorites: loadFavorites,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    loadCustomWords: loadCustomWords,
    customWordsFor: customWordsFor,
    saveCustomWord: saveCustomWord,
    deleteCustomWord: deleteCustomWord,
    loadStats: loadStats,
    touchStreak: touchStreak,
    todayKey: todayKey,
    recordSession: recordSession,
    resetProgress: resetProgress,
    exportData: exportData,
    importData: importData
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AppStorage = api;
})(typeof window !== 'undefined' ? window : globalThis);
