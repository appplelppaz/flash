/**
 * 保存まわり。IndexedDB を使い、使えない環境では localStorage に落とす。
 *
 * キー
 *   settings          設定
 *   lists             リストの一覧（メタ情報のみ）
 *   cards:<listId>    取り込んだリストの単語（収録リストはファイルから読む）
 *   prog:<listId>     学習の進み具合  index -> {learned,right,wrong,fav}
 *   stats             通算の記録（連続日数など）
 */
(function (global) {
  'use strict';

  var DB_NAME = 'flashcards';
  var DB_VERSION = 1;
  var STORE = 'kv';
  var LS_PREFIX = 'flash:';

  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) return reject(new Error('no indexedDB'));
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('blocked')); };
    }).catch(function (err) {
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  }

  function idbRun(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var req = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { resolve(req && req.result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function lsGet(key) {
    try {
      var raw = global.localStorage.getItem(LS_PREFIX + key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch (e) { return undefined; }
  }

  function lsSet(key, value) {
    global.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  }

  function lsKeys() {
    var out = [];
    for (var i = 0; i < global.localStorage.length; i++) {
      var k = global.localStorage.key(i);
      if (k && k.indexOf(LS_PREFIX) === 0) out.push(k.slice(LS_PREFIX.length));
    }
    return out;
  }

  var useIdb = true;

  function get(key) {
    if (!useIdb) return Promise.resolve(lsGet(key));
    return idbRun('readonly', function (s) { return s.get(key); }).catch(function () {
      useIdb = false;
      return lsGet(key);
    });
  }

  function set(key, value) {
    if (!useIdb) return Promise.resolve(lsSet(key, value));
    return idbRun('readwrite', function (s) { return s.put(value, key); }).catch(function () {
      useIdb = false;
      lsSet(key, value);
    });
  }

  function del(key) {
    if (!useIdb) {
      try { global.localStorage.removeItem(LS_PREFIX + key); } catch (e) {}
      return Promise.resolve();
    }
    return idbRun('readwrite', function (s) { return s.delete(key); }).catch(function () {
      useIdb = false;
      try { global.localStorage.removeItem(LS_PREFIX + key); } catch (e) {}
    });
  }

  function keys() {
    if (!useIdb) return Promise.resolve(lsKeys());
    return idbRun('readonly', function (s) { return s.getAllKeys(); }).catch(function () {
      useIdb = false;
      return lsKeys();
    });
  }

  /** 書き込みをまとめて遅らせる（学習中の連打で毎回書かないため） */
  var pending = {};
  var timers = {};

  function setSoon(key, value, delay) {
    pending[key] = value;
    if (timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(function () {
      timers[key] = null;
      var v = pending[key];
      delete pending[key];
      set(key, v);
    }, delay || 400);
  }

  function flush() {
    var jobs = [];
    for (var key in pending) {
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = null;
      jobs.push(set(key, pending[key]));
    }
    pending = {};
    return Promise.all(jobs);
  }

  var api = {
    get: get,
    set: set,
    del: del,
    keys: keys,
    setSoon: setSoon,
    flush: flush,
    usingIndexedDb: function () { return useIdb; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Flash = global.Flash || {};
    global.Flash.store = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
