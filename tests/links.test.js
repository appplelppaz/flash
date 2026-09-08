'use strict';
const test = require('node:test');
const assert = require('node:assert');
const links = require('../js/links.js');

const EN = [
  { term: 'get away with' },
  { term: 'turn down' },
  { term: 'offer' },
  { term: 'negotiation' },
  { term: 'shipment' },
  { term: 'go' }
];

test('索引にある語を例文の中から見つける', () => {
  const idx = links.build(EN, 'en');
  const hits = links.find(idx, 'She turned down the generous offer.', 0);
  assert.deepStrictEqual(hits.map((h) => EN[h.id].term), ['turn down', 'offer']);
});

test('除きたい語は拾わない', () => {
  const idx = links.build(EN, 'en');
  const hits = links.find(idx, 'The offer was an offer, nothing more.', 2);
  assert.strictEqual(hits.length, 0);
});

test('活用した形でも引き当てる', () => {
  const idx = links.build([{ term: 'negotiate' }, { term: 'ship' }, { term: 'carry' }], 'en');
  const hits = links.find(idx, 'They negotiated while carrying the shipped goods.', 99);
  assert.deepStrictEqual(hits.map((h) => h.id).sort(), [0, 1, 2]);
});

test('長いまとまりを先に取る（句動詞が単語に割れない）', () => {
  const idx = links.build([{ term: 'put up with' }, { term: 'put' }], 'en');
  const hits = links.find(idx, 'I put up with it.', 99);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].id, 0);
});

test('拾う数に上限がある', () => {
  const many = 'one two three four five six seven'.split(' ').map((w) => ({ term: w + 'ish' }));
  const idx = links.build(many, 'en');
  const hits = links.find(idx, 'oneish twoish threeish fourish fiveish sixish sevenish', 99);
  assert.strictEqual(hits.length, links.MAX_HITS);
});

test('短すぎる語は拾わない（誤検出を避ける）', () => {
  const idx = links.build([{ term: 'go' }, { term: 'an' }], 'en');
  assert.strictEqual(links.find(idx, 'I go to an office.', 99).length, 0);
});

test('中国語は部分一致で、長い語を先に取る', () => {
  const zh = [{ term: '一目了然' }, { term: '一目' }, { term: '公共设施' }];
  const idx = links.build(zh, 'zh');
  const hits = links.find(idx, '请爱护公共设施，这样就一目了然了。', 99);
  const terms = hits.map((h) => zh[h.id].term);
  assert.ok(terms.includes('公共设施'));
  assert.ok(terms.includes('一目了然'));
  assert.ok(!terms.includes('一目'), '長い語と重なる短い語は取らない');
});

test('例文を「ふつうの文字」と「ほかの単語」に切り分ける', () => {
  const idx = links.build(EN, 'en');
  const text = 'She turned down the offer.';
  const parts = links.split(text, links.find(idx, text, 0));
  assert.strictEqual(parts.map((p) => p.text).join(''), text, '元の文が復元できる');
  assert.deepStrictEqual(parts.filter((p) => p.id !== null).map((p) => p.text), ['turned down', 'offer']);
});

test('見つからなければ 1 つの断片として返す', () => {
  const parts = links.split('Nothing here.', []);
  assert.deepStrictEqual(parts, [{ text: 'Nothing here.', id: null }]);
});

test('フランス語の縮約（l\'offre）でも文が壊れない', () => {
  const idx = links.build([{ term: 'offre' }, { term: 'refuser' }], 'fr');
  const text = "Elle a refusé l'offre sans hésiter.";
  const parts = links.split(text, links.find(idx, text, 99));
  assert.strictEqual(parts.map((p) => p.text).join(''), text);
});

// --- おまけの語（TSV の 5 列目） ---

test('例文の中のおまけの語を、位置と訳つきで返す', () => {
  const extras = [{ term: 'warehouse', meaning: '倉庫' }, { term: 'hand over', meaning: '引き渡す' }];
  const hits = links.findExtras('Hand over the key before the warehouse opens.', extras, 'en');
  assert.deepStrictEqual(hits.map((h) => h.term), ['hand over', 'warehouse']);
  assert.strictEqual(hits[0].meaning, '引き渡す');
  assert.strictEqual('Hand over the key before the warehouse opens.'.slice(hits[1].start, hits[1].end), 'warehouse');
});

test('おまけの語は短くても拾う（リスト側の下限に縛られない）', () => {
  const hits = links.findExtras('He paid the fee in cash.', [{ term: 'fee', meaning: '手数料' }], 'en');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].term, 'fee');
});

test('おまけの語が例文に無ければ何も返さない（書き間違いを見つけるため）', () => {
  const hits = links.findExtras('The plan worked.', [{ term: 'warehouse', meaning: '倉庫' }], 'en');
  assert.deepStrictEqual(hits, []);
});

test('おまけの語も活用形で拾える', () => {
  const extras = [{ term: 'sound', meaning: '鳴る' }, { term: 'bury', meaning: '埋める' }];
  const hits = links.findExtras('The alarm sounded over the buried crate.', extras, 'en');
  assert.deepStrictEqual(hits.map((h) => h.term).sort(), ['bury', 'sound']);
});

test('おまけの語が無ければ空', () => {
  assert.deepStrictEqual(links.findExtras('Any sentence.', [], 'en'), []);
  assert.deepStrictEqual(links.findExtras('', [{ term: 'x', meaning: 'y' }], 'en'), []);
});

test('見本のリストは、すべての例文におまけの語が入っている', () => {
  const fs = require('node:fs');
  const tsv = require('../js/tsv.js');
  const cards = tsv.parse(fs.readFileSync(__dirname + '/../vocab/en_sample.tsv', 'utf8')).cards;
  const headwords = new Set(cards.map((c) => c.term.toLowerCase()));
  cards.forEach((c) => {
    assert.ok(c.extras.length, `${c.term} におまけの語が無い`);
    const hits = links.findExtras(c.example, c.extras, 'en');
    assert.strictEqual(hits.length, c.extras.length, `${c.term} のおまけの語が例文に見当たらない`);
    c.extras.forEach((e) => {
      assert.ok(e.meaning, `${c.term} → ${e.term} に訳が無い`);
      assert.ok(!headwords.has(e.term.toLowerCase()), `${e.term} はリストの見出し語なので、おまけにならない`);
    });
  });
});
