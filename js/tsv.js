/**
 * TSV パーサと言語判定
 *
 * netflix-subs-to-vocab スキルが出力する 4 列・ヘッダーなしの TSV
 *
 *     word <TAB> 日本語訳 <TAB> example <TAB> 例文の日本語訳
 *
 * を読み込む。取りこぼしを減らすため、次の入力も受け付ける。
 *
 * - 抽出器の候補ファイル（kind/word/reading/ja/example/example_ja/count/first_at）
 * - 2 列（単語・訳のみ）や 3 列（例文の訳なし）
 * - タブが 1 つも無いときだけカンマ区切りとして読む
 *
 * ブラウザでは global.Flash.tsv、Node では module.exports として使う。
 */
(function (global) {
  'use strict';

  var CANDIDATE_HEADER = ['kind', 'word', 'reading', 'ja', 'example', 'example_ja'];

  function stripBom(text) {
    return text.charAt(0) === '﻿' ? text.slice(1) : text;
  }

  function splitLines(text) {
    return stripBom(String(text)).replace(/\r\n?/g, '\n').split('\n');
  }

  function looksLikeHeader(cells) {
    var low = cells.map(function (c) { return c.trim().toLowerCase(); });
    var hit = 0;
    for (var i = 0; i < low.length; i++) {
      if (CANDIDATE_HEADER.indexOf(low[i]) !== -1) hit++;
    }
    if (hit >= 3) return true;
    return low[0] === '単語' || low[0] === 'word' || low[0] === 'term';
  }

  /** 抽出器の候補 TSV（8 列）か */
  function isCandidateRow(cells) {
    return cells.length >= 6 && (cells[0] === 'word' || cells[0] === 'phrase');
  }

  /**
   * @param {string} text
   * @returns {{cards: Array, skipped: Array, delimiter: string, dropped: number}}
   */
  function parse(text) {
    var lines = splitLines(text);
    var joined = lines.join('\n');
    var delimiter = joined.indexOf('\t') !== -1 ? '\t' : ',';
    var cards = [];
    var skipped = [];
    var seen = Object.create(null);
    var dropped = 0;

    for (var n = 0; n < lines.length; n++) {
      var raw = lines[n];
      if (!raw || !raw.trim()) continue;

      var cells = raw.split(delimiter).map(function (c) { return c.trim(); });

      if (isCandidateRow(cells)) {
        // kind / word / reading / ja / example / example_ja / ...
        cells = [cells[1], cells[3], cells[4] || '', cells[5] || ''];
      } else if (n < 3 && looksLikeHeader(cells)) {
        continue;
      } else if (cells.length > 4) {
        cells = cells.slice(0, 4);
      }

      var term = cells[0] || '';
      var meaning = cells[1] || '';
      var example = cells[2] || '';
      var exampleJa = cells[3] || '';

      if (!term) {
        skipped.push({ line: n + 1, text: raw, reason: '単語の列が空' });
        continue;
      }
      if (!meaning) {
        skipped.push({ line: n + 1, text: raw, reason: '日本語訳が無い' });
        continue;
      }

      var key = term.toLowerCase();
      if (seen[key] !== undefined) {
        // 後から来た行のほうが情報が多ければ差し替える
        var prev = cards[seen[key]];
        if (!prev.example && example) {
          prev.example = example;
          prev.exampleJa = exampleJa;
        }
        dropped++;
        continue;
      }
      seen[key] = cards.length;
      cards.push({ term: term, reading: '', meaning: meaning, example: example, exampleJa: exampleJa });
    }

    return { cards: cards, skipped: skipped, delimiter: delimiter, dropped: dropped };
  }

  /** カードの配列を 4 列 TSV に戻す（書き出し用） */
  function stringify(cards) {
    return cards.map(function (c) {
      return [c.term, c.meaning, c.example || '', c.exampleJa || ''].join('\t');
    }).join('\n') + '\n';
  }

  var FR_HINT = 'le la les des du une est pas que qui vous nous je tu il elle ce cette pour dans avec plus mais on ne'.split(' ');
  var ES_HINT = 'el la los las un una es que de en por para con no se lo su muy pero como más está están qué'.split(' ');
  var EN_HINT = 'the and is are you to of a in that it for on was with have this not be he she'.split(' ');

  function countOf(text, chars) {
    var n = 0;
    for (var i = 0; i < text.length; i++) if (chars.indexOf(text.charAt(i)) !== -1) n++;
    return n;
  }

  function overlap(words, hints) {
    var n = 0;
    for (var i = 0; i < hints.length; i++) if (words[hints[i]]) n++;
    return n;
  }

  /**
   * 単語と例文から学習言語を推定する（en / zh / es / fr）。
   * スキルの extract_vocab.py の detect_lang を簡略化したもの。
   */
  function detectLang(cards) {
    var sample = cards.slice(0, 400).map(function (c) {
      return (c.term || '') + ' ' + (c.example || '');
    }).join(' ');
    var lower = sample.toLowerCase();

    var cjk = 0, kana = 0, letters = 0;
    for (var i = 0; i < sample.length; i++) {
      var ch = sample.charAt(i);
      if (ch >= '一' && ch <= '鿿') cjk++;
      else if (ch >= '぀' && ch <= 'ヿ') kana++;
      if (/[^\W\d_]/.test(ch)) letters++;
    }
    if (cjk && cjk > kana && cjk / Math.max(letters, 1) > 0.3) return 'zh';

    var words = Object.create(null);
    var m = lower.match(/[^\W\d_]+/g) || [];
    for (var j = 0; j < m.length; j++) words[m[j]] = true;

    var score = {
      fr: overlap(words, FR_HINT) + 3 * countOf(lower, 'œ') + countOf(lower, 'ç') + countOf(lower, 'èêùôû'),
      es: overlap(words, ES_HINT) + 5 * countOf(lower, 'ñ¿¡'),
      en: overlap(words, EN_HINT)
    };
    score.fr += 2 * (lower.match(/\b[cdjlmnstqu]{1,2}['’]/g) || []).length;

    var best = 'en';
    for (var k in score) if (score[k] > score[best]) best = k;
    return best;
  }

  /** vocab/en_title.tsv のようなファイル名からリスト名と言語を取り出す */
  function nameFromFile(filename) {
    var base = String(filename || '').replace(/\.[^.]+$/, '').replace(/^.*[\\/]/, '');
    var lang = '';
    var m = base.match(/^(en|zh|es|fr)[_-](.+)$/i);
    if (m) {
      lang = m[1].toLowerCase();
      base = m[2];
    }
    base = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return { name: base, lang: lang };
  }

  var api = {
    parse: parse,
    stringify: stringify,
    detectLang: detectLang,
    nameFromFile: nameFromFile
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Flash = global.Flash || {};
    global.Flash.tsv = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
