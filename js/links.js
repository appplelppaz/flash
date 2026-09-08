/**
 * 例文の中の「おまけの語」を、文のどこにあるか突き止める。
 *
 * 語彙リストは覚えるべき骨組みで、例文はそこに語を上乗せする場所。
 * 例文にはリストに無い語をわざと入れてあり（TSV の 5 列目）、
 * この道具はその語が文のどこに現れているかを見つける。
 * 見つけた語は例文の中で目立たせ、訳の段階で意味を添える。
 *
 * 英語・スペイン語・フランス語は語境界で切って、
 * 単純な語尾（-s / -ed / -ing / -es …）を落として突き合わせる。
 * 中国語は語境界が無いので、そのまま部分一致で拾う。
 */
(function (global) {
  'use strict';

  var MAX_GRAM = 4;      // 何語までのまとまりを見るか（句動詞・成語のため）
  var MAX_HITS = 4;      // 1 つの例文で拾う数の上限

  function isCjk(lang) {
    return lang === 'zh' || lang === 'ja' || lang === 'ko';
  }

  /** 語尾を落として引き当てやすくする（引き当て側の粗い受け皿） */
  function stem(word) {
    var w = word;
    if (w.length > 5 && /ings?$/.test(w)) return w.replace(/ings?$/, '');
    if (w.length > 4 && /(ied|ies)$/.test(w)) return w.replace(/(ied|ies)$/, 'y');
    if (w.length > 4 && /ed$/.test(w)) return w.replace(/e?d$/, '');
    if (w.length > 4 && /(es|s)$/.test(w) && !/(ss|us|is)$/.test(w)) return w.replace(/e?s$/, '');
    return w;
  }

  /**
   * 見出し語から、文の中に出てきそうな形を作る。
   * 引き当て側で語尾を落とすより、こちらで形を並べたほうが当たりが良い。
   * 英語だけ動詞の変化まで作り、スペイン語・フランス語は複数形や女性形の範囲にとどめる。
   */
  function inflect(word, lang) {
    var out = [word];
    var last = word.slice(-1);
    if (lang === 'en') {
      if (/[^aeiou]y$/.test(word)) {
        out.push(word.slice(0, -1) + 'ies', word.slice(0, -1) + 'ied', word + 'ing');
      } else if (/(s|x|z|ch|sh)$/.test(word)) {
        out.push(word + 'es', word + 'ed', word + 'ing');
      } else if (last === 'e') {
        out.push(word + 's', word + 'd', word.slice(0, -1) + 'ing');
      } else {
        out.push(word + 's', word + 'ed', word + 'ing');
      }
      // ship → shipped / shipping のように語尾を重ねるもの
      if (/^[a-z]{3,6}$/.test(word) && /[^aeiou][aeiou][^aeiouwxy]$/.test(word)) {
        out.push(word + last + 'ed', word + last + 'ing');
      }
    } else if (lang === 'es') {
      out.push(/[aeiouáéíóú]$/.test(word) ? word + 's' : word + 'es');
    } else if (lang === 'fr') {
      out.push(word + 's');
      if (last !== 'e') out.push(word + 'e', word + 'es');
    }
    return out;
  }

  function keysFor(term, lang) {
    var lower = term.toLowerCase().replace(/[’']/g, "'").trim();
    if (isCjk(lang)) return [lower];
    var parts = lower.split(/\s+/);
    var head = parts[0];
    var rest = parts.slice(1).join(' ');
    var keys = [lower];
    // まとまりの語は、先頭の語だけを変化させる（turn down → turned down）
    inflect(head, lang).forEach(function (form) {
      var key = rest ? form + ' ' + rest : form;
      if (keys.indexOf(key) === -1) keys.push(key);
    });
    var stemmed = parts.map(stem).join(' ');
    if (keys.indexOf(stemmed) === -1) keys.push(stemmed);
    return keys;
  }

  /**
   * 探す語の索引を作る。
   * @param {Array} items  {term} を持つ配列（おまけの語、または見出し語）
   * @param {string} lang
   * @param {Object} [opts] minLen: この長さ未満の語は無視する
   * @returns {{lang:string, map:Object, phrases:Array}}
   */
  function build(items, lang, opts) {
    var minLen = (opts && opts.minLen) || (isCjk(lang) ? 2 : 3);
    var map = Object.create(null);
    var phrases = [];
    for (var i = 0; i < items.length; i++) {
      var term = (items[i].term || '').trim();
      if (!term) continue;
      if (isCjk(lang)) {
        if (term.length < minLen) continue;
        phrases.push({ text: term, id: i });
        continue;
      }
      if (term.length < minLen) continue;
      var keys = keysFor(term, lang);
      for (var k = 0; k < keys.length; k++) {
        if (map[keys[k]] === undefined) map[keys[k]] = i;
      }
    }
    if (isCjk(lang)) phrases.sort(function (a, b) { return b.text.length - a.text.length; });
    return { lang: lang, map: map, phrases: phrases };
  }

  function findCjk(index, text, selfId) {
    var hits = [];
    var taken = [];
    for (var p = 0; p < index.phrases.length && hits.length < MAX_HITS; p++) {
      var ph = index.phrases[p];
      if (ph.id === selfId) continue;
      var at = text.indexOf(ph.text);
      if (at === -1) continue;
      var end = at + ph.text.length;
      var clash = false;
      for (var t = 0; t < taken.length; t++) {
        if (at < taken[t][1] && end > taken[t][0]) { clash = true; break; }
      }
      if (clash) continue;
      taken.push([at, end]);
      hits.push({ id: ph.id, start: at, end: end });
    }
    return hits.sort(function (a, b) { return a.start - b.start; });
  }

  function findLatin(index, text, selfId) {
    var re = /[^\W\d_]+(?:['’][^\W\d_]+)?/g;
    var tokens = [];
    var m;
    while ((m = re.exec(text))) tokens.push({ w: m[0], start: m.index, end: m.index + m[0].length });

    var hits = [];
    var usedUntil = -1;
    for (var i = 0; i < tokens.length && hits.length < MAX_HITS; i++) {
      if (i <= usedUntil) continue;
      for (var n = Math.min(MAX_GRAM, tokens.length - i); n >= 1; n--) {
        var slice = tokens.slice(i, i + n);
        var raw = slice.map(function (t) { return t.w.toLowerCase().replace(/[’]/g, "'"); }).join(' ');
        var id = index.map[raw];
        if (id === undefined) id = index.map[slice.map(function (t) { return stem(t.w.toLowerCase()); }).join(' ')];
        if (id === undefined || id === selfId) continue;
        hits.push({ id: id, start: slice[0].start, end: slice[n - 1].end });
        usedUntil = i + n - 1;
        break;
      }
    }
    return hits;
  }

  /**
   * 例文の中から、索引にある語を探す。
   * @param {Object} index build() の戻り値
   * @param {string} text  例文
   * @param {number} [skipId] 除きたい語の番号（見出し語自身を外すときに使う）
   */
  function find(index, text, skipId) {
    if (!index || !text) return [];
    var skip = skipId === undefined ? -1 : skipId;
    return isCjk(index.lang) ? findCjk(index, text, skip) : findLatin(index, text, skip);
  }

  /**
   * 例文とおまけの語から、見つかったものだけを位置つきで返す。
   * @param {string} text
   * @param {Array} extras [{term, meaning}]
   * @param {string} lang
   * @returns {Array<{id:number, start:number, end:number, term:string, meaning:string}>}
   */
  function findExtras(text, extras, lang) {
    if (!text || !extras || !extras.length) return [];
    var index = build(extras, lang, { minLen: 1 });
    return find(index, text).map(function (h) {
      return { id: h.id, start: h.start, end: h.end,
               term: extras[h.id].term, meaning: extras[h.id].meaning };
    });
  }

  /**
   * 例文を「ふつうの文字」と「おまけの語」に切り分ける。
   * DOM を組み立てる側が innerHTML を使わずに済むよう、断片の配列で返す。
   * @returns {Array<{text:string, id:number|null}>}
   */
  function split(text, hits) {
    if (!hits || !hits.length) return [{ text: text, id: null }];
    var out = [];
    var at = 0;
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      if (h.start > at) out.push({ text: text.slice(at, h.start), id: null });
      out.push({ text: text.slice(h.start, h.end), id: h.id });
      at = h.end;
    }
    if (at < text.length) out.push({ text: text.slice(at), id: null });
    return out;
  }

  var api = { build: build, find: find, findExtras: findExtras, split: split, MAX_HITS: MAX_HITS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Flash = global.Flash || {};
    global.Flash.links = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
