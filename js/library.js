/**
 * 単語リストの棚。収録リストと取り込んだリストをまとめて扱う。
 *
 * 収録リスト（js/data/*.js）は開いたときに <script> で読み込む。
 * 取り込んだリスト（Netflix 字幕などの TSV）は IndexedDB に入れる。
 */
(function (global) {
  'use strict';

  var store = global.Flash.store;

  var LANGS = {
    en: { name: '英語', speech: 'en-US', flag: 'EN' },
    zh: { name: '中国語', speech: 'zh-CN', flag: '中' },
    es: { name: 'スペイン語', speech: 'es-ES', flag: 'ES' },
    fr: { name: 'フランス語', speech: 'fr-FR', flag: 'FR' },
    ja: { name: '日本語', speech: 'ja-JP', flag: '日' },
    de: { name: 'ドイツ語', speech: 'de-DE', flag: 'DE' },
    it: { name: 'イタリア語', speech: 'it-IT', flag: 'IT' },
    ko: { name: '韓国語', speech: 'ko-KR', flag: '韓' },
    pt: { name: 'ポルトガル語', speech: 'pt-PT', flag: 'PT' }
  };

  var BUILTIN = [
    { id: 'en-eiken1', name: '英検1級以上', lang: 'en', count: 2077, src: 'js/data/en-eiken1.js', note: '英検1級以上で問われる語彙（発音記号つき）' },
    { id: 'zh-hsk69', name: 'HSK 6〜9級', lang: 'zh', count: 2051, src: 'js/data/zh-hsk69.js', note: 'HSK 6級〜9級（高等）相当の語彙（ピンインつき）' },
    { id: 'es-vida3000', name: '生活スペイン語 3000', lang: 'es', count: 3000, src: 'js/data/es-vida3000.js', note: 'スペイン語圏での生活に必要な 3000 語' },
    { id: 'fr-vie3000', name: '生活フランス語 3000', lang: 'fr', count: 3000, src: 'js/data/fr-vie3000.js', note: 'フランスでの生活に必要な 3000 語' }
  ];

  var meta = [];          // 取り込んだリストのメタ情報
  var cardCache = {};     // listId -> cards
  var progCache = {};     // listId -> progress

  function langInfo(code) {
    return LANGS[code] || { name: code || '—', speech: code || 'en-US', flag: (code || '?').toUpperCase() };
  }

  function newId() {
    return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function builtinMeta(b) {
    return {
      id: b.id, name: b.name, lang: b.lang, count: b.count,
      note: b.note, builtin: true, createdAt: 0
    };
  }

  function load() {
    return store.get('lists').then(function (saved) {
      meta = Array.isArray(saved) ? saved : [];
    });
  }

  /** 表示順：取り込んだリストが新しい順、そのあとに収録リスト */
  function lists() {
    var mine = meta.slice().sort(function (a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); });
    return mine.concat(BUILTIN.map(builtinMeta));
  }

  function find(id) {
    for (var i = 0; i < meta.length; i++) if (meta[i].id === id) return meta[i];
    for (var j = 0; j < BUILTIN.length; j++) if (BUILTIN[j].id === id) return builtinMeta(BUILTIN[j]);
    return null;
  }

  function saveMeta() {
    return store.set('lists', meta);
  }

  var scriptLoads = {};

  function loadScript(src) {
    if (scriptLoads[src]) return scriptLoads[src];
    scriptLoads[src] = new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = function () { resolve(); };
      el.onerror = function () { reject(new Error('読み込めません: ' + src)); };
      document.head.appendChild(el);
    });
    return scriptLoads[src];
  }

  function builtinDef(id) {
    for (var i = 0; i < BUILTIN.length; i++) if (BUILTIN[i].id === id) return BUILTIN[i];
    return null;
  }

  /** listId のカード配列を返す */
  function cards(id) {
    if (cardCache[id]) return Promise.resolve(cardCache[id]);
    var b = builtinDef(id);
    if (b) {
      return loadScript(b.src).then(function () {
        var raw = (global.WordLists && global.WordLists[id] && global.WordLists[id].words) || [];
        var out = raw.map(function (w) {
          return { term: w[0], reading: w[1] || '', meaning: w[2] || '',
                   example: w[3] || '', exampleJa: w[4] || '', extras: [] };
        });
        cardCache[id] = out;
        return out;
      });
    }
    return store.get('cards:' + id).then(function (rows) {
      var out = (rows || []).map(function (w) {
        return Array.isArray(w)
          ? { term: w[0], reading: w[1] || '', meaning: w[2] || '', example: w[3] || '',
              exampleJa: w[4] || '', extras: global.Flash.tsv.parseExtras(w[5] || '') }
          : w;
      });
      cardCache[id] = out;
      return out;
    });
  }

  function packCards(list) {
    return list.map(function (c) {
      return [c.term, c.reading || '', c.meaning, c.example || '', c.exampleJa || '',
              global.Flash.tsv.stringifyExtras(c.extras)];
    });
  }

  function progress(id) {
    if (progCache[id]) return Promise.resolve(progCache[id]);
    return store.get('prog:' + id).then(function (p) {
      progCache[id] = p || {};
      return progCache[id];
    });
  }

  function cachedProgress(id) {
    return progCache[id] || null;
  }

  function saveProgress(id, prog, now) {
    progCache[id] = prog;
    if (now) return store.set('prog:' + id, prog);
    store.setSoon('prog:' + id, prog);
    return Promise.resolve();
  }

  /** 進み具合の要約 */
  function summary(id, total) {
    var p = progCache[id];
    if (!p) return null;
    var learned = 0, weak = 0, fav = 0;
    for (var k in p) {
      if (p[k].learned) learned++;
      else if (p[k].wrong > 0) weak++;
      if (p[k].fav) fav++;
    }
    return { learned: learned, weak: weak, fav: fav, total: total };
  }

  function addList(opts) {
    var id = newId();
    var entry = {
      id: id,
      name: opts.name || '無題のリスト',
      lang: opts.lang || 'en',
      count: opts.cards.length,
      note: opts.note || '',
      builtin: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    meta.push(entry);
    cardCache[id] = opts.cards;
    return store.set('cards:' + id, packCards(opts.cards))
      .then(saveMeta)
      .then(function () { return entry; });
  }

  function replaceCards(id, list) {
    var entry = find(id);
    if (!entry || entry.builtin) return Promise.reject(new Error('収録リストは書き換えられません'));
    cardCache[id] = list;
    for (var i = 0; i < meta.length; i++) {
      if (meta[i].id === id) { meta[i].count = list.length; meta[i].updatedAt = Date.now(); }
    }
    return store.set('cards:' + id, packCards(list)).then(saveMeta);
  }

  function updateList(id, patch) {
    for (var i = 0; i < meta.length; i++) {
      if (meta[i].id === id) {
        for (var k in patch) meta[i][k] = patch[k];
        meta[i].updatedAt = Date.now();
        return saveMeta();
      }
    }
    return Promise.resolve();
  }

  function deleteList(id) {
    var entry = find(id);
    if (entry && entry.builtin) return resetProgress(id);
    meta = meta.filter(function (m) { return m.id !== id; });
    delete cardCache[id];
    delete progCache[id];
    return Promise.all([store.del('cards:' + id), store.del('prog:' + id)]).then(saveMeta);
  }

  function resetProgress(id) {
    progCache[id] = {};
    return store.set('prog:' + id, {});
  }

  /** すべてのリストの進み具合を読み込む（一覧表示用） */
  function loadAllProgress() {
    var all = lists();
    return Promise.all(all.map(function (l) { return progress(l.id); }));
  }

  function exportAll() {
    var all = lists();
    return Promise.all(all.map(function (l) {
      return Promise.all([l.builtin ? Promise.resolve(null) : cards(l.id), progress(l.id)])
        .then(function (r) {
          return { id: l.id, name: l.name, lang: l.lang, builtin: !!l.builtin,
                   cards: r[0] ? packCards(r[0]) : null, progress: r[1] };
        });
    })).then(function (payload) {
      return store.get('settings').then(function (settings) {
        return { app: 'flashcards', version: 2, exportedAt: new Date().toISOString(),
                 settings: settings || {}, lists: payload };
      });
    });
  }

  function importAll(data) {
    if (!data || data.app !== 'flashcards') return Promise.reject(new Error('このアプリのバックアップではありません'));
    var jobs = [];
    (data.lists || []).forEach(function (l) {
      if (l.progress) jobs.push(saveProgress(l.id, l.progress, true));
      if (!l.builtin && l.cards) {
        var exists = find(l.id);
        if (!exists) {
          meta.push({ id: l.id, name: l.name, lang: l.lang, count: l.cards.length,
                      builtin: false, createdAt: Date.now(), updatedAt: Date.now() });
        }
        delete cardCache[l.id];
        jobs.push(store.set('cards:' + l.id, l.cards));
      }
    });
    if (data.settings) jobs.push(store.set('settings', data.settings));
    return Promise.all(jobs).then(saveMeta);
  }

  var api = {
    LANGS: LANGS,
    langInfo: langInfo,
    load: load,
    lists: lists,
    find: find,
    cards: cards,
    progress: progress,
    cachedProgress: cachedProgress,
    saveProgress: saveProgress,
    summary: summary,
    addList: addList,
    replaceCards: replaceCards,
    updateList: updateList,
    deleteList: deleteList,
    resetProgress: resetProgress,
    loadAllProgress: loadAllProgress,
    exportAll: exportAll,
    importAll: importAll
  };

  global.Flash = global.Flash || {};
  global.Flash.library = api;
})(typeof window !== 'undefined' ? window : globalThis);
