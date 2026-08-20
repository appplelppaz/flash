/**
 * 単語リスト（js/data/*.js）に単語を追記する開発用スクリプト。
 *
 *   node tools/add-words.js js/data/fr-vie3000.js chunk.js
 *
 * chunk.js は ['term', 'reading', 'meaning', 'example', 'exampleJa'], を並べたもの。
 * 既存の単語と重複する term は自動的に取り除き、書式を揃えて挿入する。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

function quote(value) {
  var text = String(value == null ? '' : value);
  if (text.indexOf("'") < 0) return "'" + text.replace(/\\/g, '\\\\') + "'";
  if (text.indexOf('"') < 0) return '"' + text.replace(/\\/g, '\\\\') + '"';
  return "'" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function serialize(entry) {
  return '    [' + entry.map(quote).join(', ') + '],';
}

/** 例文にその単語（活用を考慮して語幹）が含まれているか */
function containsTerm(example, term, deckId) {
  var haystack = example.toLowerCase();
  if (deckId === 'zh') return example.indexOf(term) >= 0;
  var stem = term.toLowerCase().slice(0, 4);
  return haystack.indexOf(stem) >= 0;
}

function main() {
  var listPath = process.argv[2];
  var chunkPath = process.argv[3];
  if (!listPath || !chunkPath) {
    console.error('usage: node tools/add-words.js <list.js> <chunk.js>');
    process.exit(2);
  }

  var list = require(path.resolve(listPath));
  var deckId = list.deckId;

  var chunkSource = fs.readFileSync(chunkPath, 'utf8').trim().replace(/,\s*$/, '');
  var entries = vm.runInNewContext('[' + chunkSource + ']');

  var seen = Object.create(null);
  list.words.forEach(function (word) { seen[word[0]] = true; });

  var accepted = [];
  var duplicates = [];
  var errors = [];

  entries.forEach(function (entry, index) {
    var where = chunkPath + ' #' + (index + 1) + ' ' + (entry && entry[0]);
    if (!Array.isArray(entry) || entry.length !== 5) {
      errors.push(where + ': 5 要素の配列ではない');
      return;
    }
    var term = String(entry[0]).trim();
    if (!term || !String(entry[2]).trim()) {
      errors.push(where + ': term か meaning が空');
      return;
    }
    if (!String(entry[3]).trim() || !String(entry[4]).trim()) {
      errors.push(where + ': 例文か例文の訳が空');
      return;
    }
    if ((deckId === 'en' || deckId === 'zh') && !containsTerm(entry[3], term, deckId)) {
      errors.push(where + ': 例文に単語が含まれていない → ' + entry[3]);
      return;
    }
    if (seen[term]) {
      duplicates.push(term);
      return;
    }
    seen[term] = true;
    accepted.push([term, String(entry[1] || '').trim(), String(entry[2]).trim(),
      String(entry[3]).trim(), String(entry[4]).trim()]);
  });

  if (errors.length) {
    console.error('NG (' + errors.length + ' 件):');
    errors.slice(0, 20).forEach(function (message) { console.error('  ' + message); });
    process.exit(1);
  }

  var lines = fs.readFileSync(listPath, 'utf8').split('\n');
  var marker = lines.indexOf('  ];');
  if (marker < 0) {
    console.error('挿入位置（"  ];"）が見つかりません: ' + listPath);
    process.exit(1);
  }

  var inserted = accepted.map(serialize);
  lines.splice.apply(lines, [marker, 0].concat(inserted));
  fs.writeFileSync(listPath, lines.join('\n'));

  var total = list.words.length + accepted.length;
  console.log('added ' + accepted.length + ' / total ' + total +
    (duplicates.length ? ' / skipped duplicates ' + duplicates.length + ': ' + duplicates.join(', ') : ''));
}

main();
