'use strict';
const test = require('node:test');
const assert = require('node:assert');
const tsv = require('../js/tsv.js');

test('4 列のタブ区切りを読む', () => {
  const res = tsv.parse('go\t行く\tI go home.\t家に帰る。\nsee\t見る\tI see it.\tそれが見える。');
  assert.strictEqual(res.cards.length, 2);
  assert.deepStrictEqual(res.cards[0], {
    term: 'go', reading: '', meaning: '行く', example: 'I go home.', exampleJa: '家に帰る。', extras: []
  });
  assert.strictEqual(res.delimiter, '\t');
});

test('空行と前後の空白を落とす', () => {
  const res = tsv.parse('\n  go \t 行く \t\t\n\n');
  assert.strictEqual(res.cards.length, 1);
  assert.strictEqual(res.cards[0].term, 'go');
  assert.strictEqual(res.cards[0].example, '');
});

test('訳が無い行は飛ばして理由を返す', () => {
  const res = tsv.parse('go\t行く\nbroken\n');
  assert.strictEqual(res.cards.length, 1);
  assert.strictEqual(res.skipped.length, 1);
  assert.strictEqual(res.skipped[0].line, 2);
  assert.strictEqual(res.skipped[0].reason, 'no meaning');
});

test('抽出器の候補ファイル（8 列・ヘッダーつき）も読める', () => {
  const text = [
    'kind\tword\treading\tja\texample\texample_ja\tcount\tfirst_at',
    'word\tabate\t\t和らぐ\tThe storm began to abate.\t嵐は弱まり始めた。\t2\t00:01',
    'phrase\tget away with\t\tやり過ごす\tHe got away with it.\t彼は済ませた。\t1\t00:02'
  ].join('\n');
  const res = tsv.parse(text);
  assert.strictEqual(res.cards.length, 2);
  assert.strictEqual(res.cards[0].term, 'abate');
  assert.strictEqual(res.cards[0].meaning, '和らぐ');
  assert.strictEqual(res.cards[1].term, 'get away with');
});

test('同じ単語が二度出たらまとめ、例文は情報の多いほうを残す', () => {
  const res = tsv.parse('go\t行く\t\t\nGo\t行く\tI go home.\t家に帰る。');
  assert.strictEqual(res.cards.length, 1);
  assert.strictEqual(res.dropped, 1);
  assert.strictEqual(res.cards[0].example, 'I go home.');
});

test('5 列以上は先頭 4 列だけ使う', () => {
  const res = tsv.parse('go\t行く\tI go.\t行く。\t余計\tもっと余計');
  assert.strictEqual(res.cards[0].exampleJa, '行く。');
});

test('タブが無いときだけカンマ区切りとして読む', () => {
  const res = tsv.parse('go,行く,I go.,行く。');
  assert.strictEqual(res.delimiter, ',');
  assert.strictEqual(res.cards[0].meaning, '行く');
});

test('例文にカンマがあってもタブ区切りなら壊れない', () => {
  const res = tsv.parse('go\t行く\tWell, I go home, now.\tさて、もう帰る。');
  assert.strictEqual(res.cards[0].example, 'Well, I go home, now.');
});

test('BOM つきでも読める', () => {
  const res = tsv.parse('﻿go\t行く');
  assert.strictEqual(res.cards[0].term, 'go');
});

test('言語を推定する', () => {
  const zh = tsv.parse('一目了然\t一目瞭然だ\t这样就一目了然了。\tこうすれば一目瞭然だ。').cards;
  assert.strictEqual(tsv.detectLang(zh), 'zh');

  const es = tsv.parse('mañana\t明日\t¿Qué haces mañana por la tarde?\t明日の午後は何をするの。').cards;
  assert.strictEqual(tsv.detectLang(es), 'es');

  const fr = tsv.parse("aujourd'hui\t今日\tQu'est-ce que tu fais aujourd'hui ?\t今日は何をするの。").cards;
  assert.strictEqual(tsv.detectLang(fr), 'fr');

  const en = tsv.parse('shipment\t積み荷\tThe shipment arrived late and it was not for us.\t積み荷は遅れて届いた。').cards;
  assert.strictEqual(tsv.detectLang(en), 'en');
});

test('ファイル名からリスト名と言語を取り出す', () => {
  assert.deepStrictEqual(tsv.nameFromFile('vocab/es_la_casa_de_papel.tsv'), { name: 'la casa de papel', lang: 'es' });
  assert.deepStrictEqual(tsv.nameFromFile('my list.tsv'), { name: 'my list', lang: '' });
});

test('書き出したものを読み直すと元に戻る', () => {
  const cards = tsv.parse('go\t行く\tI go home.\t家に帰る。').cards;
  const round = tsv.parse(tsv.stringify(cards)).cards;
  assert.deepStrictEqual(round, cards);
});

test('見本のリストが読める', () => {
  const fs = require('node:fs');
  const text = fs.readFileSync(__dirname + '/../vocab/en_sample.tsv', 'utf8');
  assert.ok(tsv.parse(text).cards.length >= 10);
});

// --- 5 列目：例文の中の、リストに無い語 ---

test('5 列目のおまけの語を読む', () => {
  const res = tsv.parse('offer\t申し出\tTheir offer hid a threat.\t彼らの申し出は脅しを隠していた。\tthreat=脅し; hide=隠す');
  assert.deepStrictEqual(res.cards[0].extras, [
    { term: 'threat', meaning: '脅し' },
    { term: 'hide', meaning: '隠す' }
  ]);
});

test('4 列だけの古いリストも読める（おまけの語は空）', () => {
  const res = tsv.parse('go\t行く\tI go home.\t家に帰る。');
  assert.deepStrictEqual(res.cards[0].extras, []);
});

test('訳の無いおまけの語、全角のセミコロンと等号も受ける', () => {
  assert.deepStrictEqual(tsv.parseExtras('threat'), [{ term: 'threat', meaning: '' }]);
  assert.deepStrictEqual(tsv.parseExtras('a＝あ；b=い'), [
    { term: 'a', meaning: 'あ' },
    { term: 'b', meaning: 'い' }
  ]);
  assert.deepStrictEqual(tsv.parseExtras(''), []);
});

test('おまけの語つきで書き出して、読み直すと元に戻る', () => {
  const line = 'offer\t申し出\tTheir offer hid a threat.\t彼らの申し出は脅しを隠していた。\tthreat=脅し; hide=隠す';
  const cards = tsv.parse(line).cards;
  assert.deepStrictEqual(tsv.parse(tsv.stringify(cards)).cards, cards);
});

test('おまけの語が誰にも無ければ 4 列で書き出す', () => {
  const cards = tsv.parse('go\t行く\tI go home.\t家に帰る。').cards;
  assert.strictEqual(tsv.stringify(cards).trim().split('\t').length, 4);
});

test('見本のリストが 5 列である', () => {
  const fs = require('node:fs');
  const text = fs.readFileSync(__dirname + '/../vocab/en_sample.tsv', 'utf8');
  text.split('\n').filter(Boolean).forEach((line, i) => {
    assert.strictEqual(line.split('\t').length, 5, (i + 1) + ' 行目の列数が 5 でない');
  });
});
