/**
 * HSK 6〜9級
 * HSK 6級〜9級（高等）相当の語彙（ピンイン・例文つき）
 *
 * 1 語は [term, reading, meaning, example, exampleJa] の配列。
 * reading は発音・ピンイン・名詞の性など（無い場合は空文字）。
 */
(function (global) {
  'use strict';

  var WORDS = [
  ];

  var LIST = {
    id: 'zh-hsk69',
    deckId: 'zh',
    name: 'HSK 6〜9級',
    description: 'HSK 6級〜9級（高等）相当の語彙（ピンイン・例文つき）',
    words: WORDS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LIST;
  } else {
    global.WordLists = global.WordLists || {};
    global.WordLists[LIST.id] = LIST;
  }
})(typeof window !== 'undefined' ? window : globalThis);
