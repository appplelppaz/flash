'use strict';

var test = require('node:test');
var assert = require('node:assert');

var Study = require('../js/session.js');
var Decks = require('../js/decks.js');
var Storage = require('../js/storage.js');

function makeWords(count) {
  var words = [];
  for (var i = 0; i < count; i++) {
    words.push({ id: 'w' + i, term: 'term' + i, meaning: 'imi' + i, deckId: 'test' });
  }
  return words;
}

test('pickWords は指定した語数だけ返す', function () {
  var picked = Study.pickWords(makeWords(50), 20, { order: 'random' });
  assert.strictEqual(picked.length, 20);
});

test('pickWords は単語帳の総数を超えない', function () {
  var picked = Study.pickWords(makeWords(8), 20, { order: 'random' });
  assert.strictEqual(picked.length, 8);
});

test('pickWords は重複した単語を返さない', function () {
  var picked = Study.pickWords(makeWords(30), 20, { order: 'random' });
  var ids = picked.map(function (w) { return w.id; });
  assert.strictEqual(new Set(ids).size, 20);
});

test('unlearned-first は未学習の単語を優先する', function () {
  var words = makeWords(10);
  var progress = {};
  // w0..w7 は学習済み、w8/w9 は未学習
  for (var i = 0; i < 8; i++) progress['w' + i] = { correct: 2, wrong: 0, learned: true };

  var picked = Study.pickWords(words, 2, { order: 'unlearned-first', progress: progress });
  var ids = picked.map(function (w) { return w.id; }).sort();
  assert.deepStrictEqual(ids, ['w8', 'w9']);
});

test('weak-first は間違えた回数が多い単語を優先する', function () {
  var words = makeWords(5);
  var progress = { w3: { correct: 0, wrong: 9, learned: false } };
  var picked = Study.pickWords(words, 1, { order: 'weak-first', progress: progress });
  assert.strictEqual(picked[0].id, 'w3');
});

test('連続正解が規定回数に達すると学習済みになる', function () {
  var session = new Study.StudySession({ words: makeWords(1), requiredStreak: 2 });

  var first = session.answer(true);
  assert.strictEqual(first.learned, false, '1 回目の正解では学習済みにならない');
  assert.strictEqual(session.isComplete(), false);

  var second = session.answer(true);
  assert.strictEqual(second.learned, true, '2 回連続で正解すると学習済み');
  assert.strictEqual(session.isComplete(), true);
});

test('不正解で連続正解数がリセットされ、再出題される', function () {
  var session = new Study.StudySession({ words: makeWords(1), requiredStreak: 2 });

  session.answer(true);
  var wrong = session.answer(false);
  assert.strictEqual(wrong.card.streak, 0);
  assert.strictEqual(wrong.learned, false);
  assert.strictEqual(session.isComplete(), false, '不正解の単語はキューに残る');

  session.answer(true);
  session.answer(true);
  assert.strictEqual(session.isComplete(), true);
});

test('選んだ単語がすべて学習済みになるまでセッションは終わらない', function () {
  var session = new Study.StudySession({ words: makeWords(20), requiredStreak: 2 });
  var guard = 0;

  // 3 回に 1 回だけ間違えるユーザーを模擬する
  while (!session.isComplete() && guard < 5000) {
    session.answer(guard % 3 !== 0);
    guard++;
  }

  assert.ok(session.isComplete(), 'いつかは全単語が学習済みになる');
  assert.strictEqual(session.learnedCount(), 20);
  session.cards.forEach(function (card) {
    assert.ok(card.learned, card.word.term + ' が学習済みでない');
    assert.ok(card.streak >= 2, card.word.term + ' の連続正解が足りない');
  });
});

test('未回答のカードがある間は current() が値を返す', function () {
  var session = new Study.StudySession({ words: makeWords(3), requiredStreak: 1 });
  assert.ok(session.current());
  session.answer(true);
  session.answer(true);
  assert.ok(session.current());
  session.answer(true);
  assert.strictEqual(session.current(), null);
  assert.strictEqual(session.currentFace(), null);
});

test('出題方向の設定が表裏に反映される', function () {
  var words = [{ id: 'x', term: 'apple', meaning: 'りんご', reading: 'ˈæpl' }];

  var forward = new Study.StudySession({ words: words, direction: 'term-first' }).currentFace();
  assert.strictEqual(forward.question, 'apple');
  assert.strictEqual(forward.answer, 'りんご');

  var reverse = new Study.StudySession({ words: words, direction: 'meaning-first' }).currentFace();
  assert.strictEqual(reverse.question, 'りんご');
  assert.strictEqual(reverse.answer, 'apple');
});

test('stats は正答率と学習済み数を集計する', function () {
  var session = new Study.StudySession({ words: makeWords(2), requiredStreak: 1 });
  session.answer(true);
  session.answer(false);
  session.answer(true);

  var stats = session.stats();
  assert.strictEqual(stats.total, 2);
  assert.strictEqual(stats.learned, 2);
  assert.strictEqual(stats.answered, 3);
  assert.strictEqual(stats.correct, 2);
  assert.ok(Math.abs(stats.accuracy - 2 / 3) < 1e-9);
});

test('設定のデフォルトは 20 語', function () {
  assert.strictEqual(Storage.DEFAULT_SETTINGS.wordCount, 20);
  assert.strictEqual(Storage.normalizeSettings({}).wordCount, 20);
});

test('設定は範囲外の値を補正する', function () {
  assert.strictEqual(Storage.normalizeSettings({ wordCount: 0 }).wordCount, 1);
  assert.strictEqual(Storage.normalizeSettings({ wordCount: 9999 }).wordCount, 500);
  assert.strictEqual(Storage.normalizeSettings({ wordCount: 'abc' }).wordCount, 20);
  assert.strictEqual(Storage.normalizeSettings({ requiredStreak: 99 }).requiredStreak, 10);
  assert.strictEqual(Storage.normalizeSettings({ direction: 'bogus' }).direction, 'term-first');
});

test('単語帳のデータが揃っていて ID が一意である', function () {
  var seen = new Set();
  assert.ok(Decks.DECKS.length > 0);

  Decks.DECKS.forEach(function (deck) {
    assert.ok(deck.words.length >= 20, deck.name + ' の単語が 20 語未満');
    deck.words.forEach(function (word) {
      assert.ok(word.term && word.meaning, deck.name + ' に不完全な単語がある');
      assert.strictEqual(word.deckId, deck.id);
      assert.ok(!seen.has(word.id), 'ID が重複: ' + word.id);
      seen.add(word.id);
    });
  });
});
