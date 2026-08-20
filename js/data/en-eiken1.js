/**
 * 英検1級以上
 * 英検1級以上のレベルで問われる語彙（発音記号・例文つき）
 *
 * 1 語は [term, reading, meaning, example, exampleJa] の配列。
 * reading は発音・ピンイン・名詞の性など（無い場合は空文字）。
 */
(function (global) {
  'use strict';

  var WORDS = [
  ];

  var LIST = {
    id: 'en-eiken1',
    deckId: 'en',
    name: '英検1級以上',
    description: '英検1級以上のレベルで問われる語彙（発音記号・例文つき）',
    words: WORDS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LIST;
  } else {
    global.WordLists = global.WordLists || {};
    global.WordLists[LIST.id] = LIST;
  }
})(typeof window !== 'undefined' ? window : globalThis);
