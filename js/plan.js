/**
 * カードを「何の順で見せ、何を読み上げるか」を決める（DOM に依存しない）。
 *
 * 二つのモードがある。
 *   full   例文もカードの一部として見せる。既定は 例文 → 単語 → 訳。
 *   quick  例文は表示も読み上げもしない。単語 → 訳 だけをテンポよく回す。
 *
 * 並び（direction）と読み上げの範囲（ttsPlan）は、どちらのモードでも効く。
 * repeat を 2 にすると、1 枚のカードでこの組をもう一度はじめから見せ、読み上げる。
 */
(function (global) {
  'use strict';

  /** 読み上げの範囲。ttsPlan ごとに、どれを声に出すか */
  var PARTS = {
    full:   { example: true,  exampleJa: true,  term: true,  meaning: true },
    short:  { example: true,  exampleJa: false, term: true,  meaning: true },
    target: { example: true,  exampleJa: false, term: true,  meaning: false },
    word:   { example: false, exampleJa: false, term: true,  meaning: false }
  };

  function partsFor(ttsPlan) {
    return PARTS[ttsPlan] || PARTS.full;
  }

  /**
   * カードを見せる順。
   * @param {Object} card {term, meaning, example}
   * @param {Object} opts {mode: 'full'|'quick', direction: 'example-first'|'term-first'|'meaning-first'}
   * @returns {Array<string>} 'term' | 'meaning' | 'example' の並び
   */
  function stages(card, opts) {
    var o = opts || {};
    var pair = o.direction === 'meaning-first' ? ['meaning', 'term'] : ['term', 'meaning'];

    // 単語だけモード、または例文が無い語は、単語と訳の 2 段階で終わる
    if (o.mode === 'quick' || !card || !card.example) return pair;

    if (o.direction === 'example-first') return ['example', 'term', 'meaning'];
    return pair.concat(['example']);
  }

  /**
   * 1 枚のカードで、段階の組を何周見せるか（1〜3）。
   * 2 にすると 例文 → 単語 → 訳 を見せ終えたあと、もう一度はじめから同じ組を見せる。
   * @param {Object} opts {repeat}
   * @returns {number}
   */
  function passes(opts) {
    var n = Math.round(Number((opts || {}).repeat) || 1);
    return Math.max(1, Math.min(3, n));
  }

  /**
   * その段階で読み上げる内容。
   * @param {Object} card
   * @param {string} role  'term' | 'meaning' | 'example'
   * @param {Object} opts {mode, direction, ttsPlan, lang, ja}
   * @returns {Array<{t:string, l:string}>}
   */
  function speech(card, role, opts) {
    var o = opts || {};
    if (!card) return [];
    var parts = partsFor(o.ttsPlan);
    var steps = [];

    if (role === 'term') {
      if (parts.term && card.term) steps.push({ t: card.term, l: o.lang });
      return steps;
    }
    if (role === 'meaning') {
      if (parts.meaning && card.meaning) steps.push({ t: card.meaning, l: o.ja });
      return steps;
    }
    // 単語だけモードでは例文まで進まないが、念のため読み上げない
    if (role !== 'example' || o.mode === 'quick' || !card.example) return steps;

    if (parts.example) steps.push({ t: card.example, l: o.lang });
    if (parts.exampleJa && card.exampleJa) steps.push({ t: card.exampleJa, l: o.ja });
    // 単語から始める並びでは、訳を聞いたあとにもう一度例文を聞いて締める
    if (o.direction !== 'example-first' &&
        parts.example && parts.exampleJa && card.exampleJa) {
      steps.push({ t: card.example, l: o.lang });
    }
    return steps;
  }

  /** その段階で、例文まわりの行を画面に出してよいか */
  function showsExample(opts) {
    return (opts || {}).mode !== 'quick';
  }

  var api = { stages: stages, passes: passes, speech: speech, showsExample: showsExample, PARTS: PARTS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Flash = global.Flash || {};
    global.Flash.plan = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
