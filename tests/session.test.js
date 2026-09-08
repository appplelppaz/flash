'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Session = require('../js/session.js');

function deck(n) {
  return Array.from({ length: n }, (_, i) => ({ term: 'w' + i, meaning: 'm' + i, example: 'e' + i }));
}

test('セットの語数ぶんだけキューに入る', () => {
  const s = Session.create({ cards: deck(10), progress: {}, setSize: 3 });
  assert.ok(s.start());
  assert.strictEqual(s.setLeft(), 3);
  assert.strictEqual(s.remaining(), 7);
  assert.strictEqual(s.current().card.term, 'w0');
});

test('覚えた語はその場でセットから外れ、学習済みになる', () => {
  const progress = {};
  const s = Session.create({ cards: deck(5), progress, setSize: 3 });
  s.start();
  s.known();
  assert.strictEqual(progress[0].learned, true);
  assert.strictEqual(s.setLeft(), 2);
  assert.strictEqual(s.current().card.term, 'w1');
});

test('まだの語は同じセットの中でもう一度出る', () => {
  const progress = {};
  const s = Session.create({ cards: deck(5), progress, setSize: 3 });
  s.start();
  s.unknown();
  assert.strictEqual(progress[0].wrong, 1);
  assert.strictEqual(progress[0].learned, false);
  assert.strictEqual(s.setLeft(), 3);
  s.known(); // w1
  s.known(); // w2
  assert.strictEqual(s.current().card.term, 'w0', 'まだの語が戻ってくる');
});

test('セットが片付いたら残りの語で次のセットが始まる', () => {
  const s = Session.create({ cards: deck(5), progress: {}, setSize: 3 });
  s.start();
  s.known(); s.known(); s.known();
  assert.strictEqual(s.setNo(), 2);
  assert.strictEqual(s.current().card.term, 'w3');
  assert.strictEqual(s.setLeft(), 2);
});

test('全部覚えたら終わる', () => {
  const s = Session.create({ cards: deck(4), progress: {}, setSize: 2 });
  s.start();
  for (let i = 0; i < 4; i++) s.known();
  assert.strictEqual(s.finished(), true);
  assert.strictEqual(s.current(), null);
  assert.strictEqual(s.stats().learned, 4);
});

test('判定せず飛ばした語は記録されず、後ろに回る', () => {
  const progress = {};
  const s = Session.create({ cards: deck(3), progress, setSize: 3 });
  s.start();
  s.skip();
  assert.deepStrictEqual(progress, {});
  assert.strictEqual(s.stats().answered, 0);
  assert.strictEqual(s.setLeft(), 3);
  assert.strictEqual(s.current().card.term, 'w1');
});

test('前に戻れる。判定そのものは取り消さない', () => {
  const progress = {};
  const s = Session.create({ cards: deck(4), progress, setSize: 4 });
  s.start();
  s.unknown();                       // w0
  assert.strictEqual(s.current().card.term, 'w1');
  assert.strictEqual(s.back(), true);
  assert.strictEqual(s.current().card.term, 'w0');
  assert.strictEqual(progress[0].wrong, 1, '戻っても判定は残る');
  s.known();
  assert.strictEqual(progress[0].learned, true, '押し直せば上書きできる');
});

test('履歴が無ければ戻れない', () => {
  const s = Session.create({ cards: deck(2), progress: {}, setSize: 2 });
  s.start();
  assert.strictEqual(s.back(), false);
});

test('★ の付け外し', () => {
  const progress = {};
  const s = Session.create({ cards: deck(2), progress, setSize: 2 });
  s.start();
  assert.strictEqual(s.toggleFav(), true);
  assert.strictEqual(progress[0].fav, true);
  assert.strictEqual(s.toggleFav(), false);
});

test('出題範囲：未学習・苦手・★・すべて', () => {
  const cards = deck(4);
  const progress = {
    0: { learned: true, right: 1, wrong: 0, fav: false },
    1: { learned: false, right: 0, wrong: 2, fav: false },
    2: { learned: false, right: 0, wrong: 0, fav: true }
  };
  assert.deepStrictEqual(Session.selectPool(cards, progress, 'new'), [1, 2, 3]);
  assert.deepStrictEqual(Session.selectPool(cards, progress, 'weak'), [1]);
  assert.deepStrictEqual(Session.selectPool(cards, progress, 'fav'), [2]);
  assert.deepStrictEqual(Session.selectPool(cards, progress, 'all'), [0, 1, 2, 3]);
});

test('苦手を先に並べる', () => {
  const cards = deck(3);
  const progress = {
    0: { learned: false, right: 0, wrong: 0, fav: false },
    1: { learned: false, right: 0, wrong: 3, fav: false },
    2: { learned: false, right: 0, wrong: 1, fav: false }
  };
  const s = Session.create({ cards, progress, setSize: 3, order: 'weak-first' });
  s.start();
  assert.strictEqual(s.current().card.term, 'w1');
});

test('ランダムでも語は増えも減りもしない', () => {
  const cards = deck(20);
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const s = Session.create({ cards, progress: {}, setSize: 20, order: 'random', random });
  s.start();
  const seen = new Set();
  while (!s.finished()) { seen.add(s.current().card.term); s.known(); }
  assert.strictEqual(seen.size, 20);
});

test('出題できる語が無ければ始まらない', () => {
  const progress = {};
  for (let i = 0; i < 3; i++) progress[i] = { learned: true, right: 1, wrong: 0, fav: false };
  const s = Session.create({ cards: deck(3), progress, setSize: 10 });
  assert.strictEqual(s.start(), false);
  assert.strictEqual(s.current(), null);
});

test('正答率と覚えた語数を数える', () => {
  const s = Session.create({ cards: deck(4), progress: {}, setSize: 4 });
  s.start();
  s.known();    // 正解 1
  s.unknown();  // 不正解 1
  const st = s.stats();
  assert.strictEqual(st.answered, 2);
  assert.strictEqual(st.correct, 1);
  assert.strictEqual(st.learned, 1);
  assert.strictEqual(st.accuracy, 0.5);
});

test('セットより語が少なくても動く', () => {
  const s = Session.create({ cards: deck(2), progress: {}, setSize: 50 });
  assert.ok(s.start());
  assert.strictEqual(s.setLeft(), 2);
  assert.strictEqual(s.remaining(), 0);
});

test('セットに最初何語入っていたかを持っている', () => {
  const s = Session.create({ cards: deck(5), progress: {}, setSize: 3 });
  s.start();
  assert.strictEqual(s.setTotal(), 3);
  s.known();
  assert.strictEqual(s.setTotal(), 3, 'セットの途中では変わらない');
  s.known(); s.known();
  assert.strictEqual(s.setTotal(), 2, '次のセットに入ったら更新される');
});
