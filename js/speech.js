/**
 * 読み上げ（Web Speech API）
 *
 * iPhone / Safari の癖に合わせてある。
 *   - 声の一覧は非同期で届くので voiceschanged を待つ
 *   - 最初の発話は必ずユーザー操作の中で始める（unlock）
 *   - 長い発話が途中で止まるブラウザ向けに resume を定期的に叩く
 *   - 一時停止は pause() ではなく「取り消して、再開時に言い直す」
 */
(function (global) {
  'use strict';

  var synth = global.speechSynthesis;
  var supported = !!(synth && global.SpeechSynthesisUtterance);

  var voices = [];
  var chosen = {};        // langCode -> voiceURI
  var rate = 1;
  var unlocked = false;
  var currentUtter = null;
  var currentReject = null;
  var watchdog = null;
  var lastSpoken = null;  // 一時停止からの言い直し用

  function refreshVoices() {
    if (!supported) return;
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
  }

  function init() {
    if (!supported) return Promise.resolve([]);
    refreshVoices();
    if (voices.length) return Promise.resolve(voices);
    return new Promise(function (resolve) {
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        refreshVoices();
        resolve(voices);
      };
      if ('onvoiceschanged' in synth) synth.onvoiceschanged = finish;
      setTimeout(finish, 1200);
    });
  }

  function baseOf(code) {
    return String(code || '').toLowerCase().split(/[-_]/)[0];
  }

  /** その言語で使える声 */
  function voicesFor(code) {
    var base = baseOf(code);
    return voices.filter(function (v) { return baseOf(v.lang) === base; });
  }

  function pickVoice(code) {
    var list = voicesFor(code);
    if (!list.length) return null;
    var want = chosen[baseOf(code)];
    if (want) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].voiceURI === want || list[i].name === want) return list[i];
      }
    }
    // 地域まで一致する声、次に既定の声、無ければ先頭
    var exact = list.filter(function (v) { return v.lang.toLowerCase().replace('_', '-') === String(code).toLowerCase(); });
    var pool = exact.length ? exact : list;
    for (var j = 0; j < pool.length; j++) if (pool[j].default) return pool[j];
    return pool[0];
  }

  function setVoice(code, voiceURI) {
    chosen[baseOf(code)] = voiceURI || '';
  }

  function getVoice(code) {
    return chosen[baseOf(code)] || '';
  }

  function setRate(v) {
    rate = Math.max(0.5, Math.min(2, Number(v) || 1));
  }

  function getRate() { return rate; }

  function stopWatchdog() {
    if (watchdog) { clearInterval(watchdog); watchdog = null; }
  }

  function cancel() {
    stopWatchdog();
    currentUtter = null;
    var rej = currentReject;
    currentReject = null;
    if (supported) { try { synth.cancel(); } catch (e) {} }
    if (rej) rej({ cancelled: true });
  }

  /** 最初のユーザー操作で音声を起こす（iOS 対策） */
  function unlock() {
    if (!supported || unlocked) return;
    unlocked = true;
    try {
      var u = new global.SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
    } catch (e) {}
  }

  /**
   * @param {string} text
   * @param {string} code  読み上げロケール（en-US など）
   * @returns {Promise} 読み終わりで解決。取り消しは {cancelled:true} で棄却
   */
  function speak(text, code) {
    if (!supported || !text) return Promise.resolve();
    cancel();
    lastSpoken = { text: text, code: code };
    return new Promise(function (resolve, reject) {
      var u = new global.SpeechSynthesisUtterance(String(text));
      var voice = pickVoice(code);
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : (code || 'en-US');
      u.rate = rate;
      u.pitch = 1;
      currentUtter = u;
      currentReject = reject;

      var settle = function (fn) {
        return function () {
          if (currentUtter !== u) return;
          stopWatchdog();
          currentUtter = null;
          currentReject = null;
          fn();
        };
      };
      u.onend = settle(resolve);
      u.onerror = settle(resolve);

      try {
        synth.speak(u);
      } catch (e) {
        currentUtter = null;
        currentReject = null;
        return resolve();
      }

      // 一部のブラウザは 15 秒ほどで勝手に止まるので突つく
      stopWatchdog();
      watchdog = setInterval(function () {
        if (!currentUtter) return stopWatchdog();
        try { if (synth.paused) synth.resume(); } catch (e) {}
      }, 4000);

      // 発話が始まらないまま終わってしまったときの保険
      setTimeout(function () {
        if (currentUtter === u && !synth.speaking && !synth.pending) settle(resolve)();
      }, 400);
    });
  }

  /** 一時停止で取り消した発話を言い直す */
  function repeatLast() {
    if (!lastSpoken) return Promise.resolve();
    return speak(lastSpoken.text, lastSpoken.code);
  }

  var api = {
    supported: supported,
    init: init,
    unlock: unlock,
    speak: speak,
    cancel: cancel,
    repeatLast: repeatLast,
    voicesFor: voicesFor,
    allVoices: function () { return voices.slice(); },
    setVoice: setVoice,
    getVoice: getVoice,
    setRate: setRate,
    getRate: getRate
  };

  global.Flash = global.Flash || {};
  global.Flash.speech = api;
})(typeof window !== 'undefined' ? window : globalThis);
