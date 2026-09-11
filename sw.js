/**
 * オフラインで動かすための Service Worker。
 *
 * アプリ本体（HTML/CSS/JS/アイコン）は入れたときにまとめて保存する。
 * 大きな単語リスト（js/data/*.js）は一度開いたときに保存し、次からは取りに行かない。
 */
var VERSION = 'v10';
var SHELL_CACHE = 'flash-shell-' + VERSION;
var DATA_CACHE = 'flash-data-' + VERSION;

var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/tsv.js',
  './js/store.js',
  './js/session.js',
  './js/library.js',
  './js/links.js',
  './js/plan.js',
  './js/speech.js',
  './js/gesture.js',
  './js/app.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL_CACHE && k !== DATA_CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 画面遷移はネットワーク優先、だめなら保存してあるものを返す
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html', { ignoreSearch: true });
      })
    );
    return;
  }

  var isData = url.pathname.indexOf('/js/data/') !== -1;
  var cacheName = isData ? DATA_CACHE : SHELL_CACHE;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) {
        if (!isData) {
          // 裏で更新しておく
          fetch(req).then(function (res) {
            if (res && res.ok) caches.open(cacheName).then(function (c) { c.put(req, res); });
          }).catch(function () {});
        }
        return hit;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(cacheName).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
