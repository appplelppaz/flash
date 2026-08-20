/**
 * 生活スペイン語 3000
 * スペイン語圏での生活に必要な 3000 語（例文つき）
 *
 * 1 語は [term, reading, meaning, example, exampleJa] の配列。
 * reading は発音・ピンイン・名詞の性など（無い場合は空文字）。
 */
(function (global) {
  'use strict';

  var WORDS = [
  ];

  var LIST = {
    id: 'es-vida3000',
    deckId: 'es',
    name: '生活スペイン語 3000',
    description: 'スペイン語圏での生活に必要な 3000 語（例文つき）',
    words: WORDS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LIST;
  } else {
    global.WordLists = global.WordLists || {};
    global.WordLists[LIST.id] = LIST;
  }
})(typeof window !== 'undefined' ? window : globalThis);
