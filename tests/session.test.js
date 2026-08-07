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

test('4 択クイズは正解 1 つとダミー 3 つを返す', function () {
  var words = makeWords(10);
  var session = new Study.StudySession({ words: [words[0]], direction: 'term-first' });
  var quiz = Study.makeChoices(session.cards[0], words.slice(1));

  assert.strictEqual(quiz.choices.length, 4);
  assert.strictEqual(new Set(quiz.choices).size, 4, '選択肢が重複している');
  assert.strictEqual(quiz.choices[quiz.answerIndex], words[0].meaning);
  assert.strictEqual(quiz.correct, words[0].meaning);
});

test('4 択クイズは出題の向きに合わせた選択肢を出す', function () {
  var words = makeWords(10);
  var session = new Study.StudySession({ words: [words[0]], direction: 'meaning-first' });
  var quiz = Study.makeChoices(session.cards[0], words.slice(1));

  assert.strictEqual(quiz.correct, words[0].term, '意味 → 単語 では単語が答えになる');
  quiz.choices.forEach(function (choice) {
    assert.ok(choice.indexOf('term') === 0, '選択肢が単語になっていない: ' + choice);
  });
});

test('候補が足りないときは選択肢を減らして返す', function () {
  var words = makeWords(2);
  var session = new Study.StudySession({ words: [words[0]] });
  var quiz = Study.makeChoices(session.cards[0], words.slice(1));

  assert.strictEqual(quiz.choices.length, 2);
  assert.ok(quiz.answerIndex >= 0);
});

test('weakWords は間違えたことがある未学習の単語だけを返す', function () {
  var words = makeWords(4);
  var progress = {
    w0: { correct: 1, wrong: 3, learned: false },  // 苦手
    w1: { correct: 5, wrong: 2, learned: true },   // 学習済みなので除外
    w2: { correct: 0, wrong: 0, learned: false }   // 間違えていないので除外
  };

  var weak = Study.weakWords(words, progress);
  assert.deepStrictEqual(weak.map(function (w) { return w.id; }), ['w0']);
});

test('連続学習日数は翌日なら加算、間が空けばリセットされる', function () {
  var stats = { streakDays: 0, bestStreakDays: 0, lastStudyDate: null };

  Storage.touchStreak(stats, '2026-08-05');
  assert.strictEqual(stats.streakDays, 1);

  Storage.touchStreak(stats, '2026-08-05'); // 同じ日は増えない
  assert.strictEqual(stats.streakDays, 1);

  Storage.touchStreak(stats, '2026-08-06');
  assert.strictEqual(stats.streakDays, 2);

  Storage.touchStreak(stats, '2026-08-09'); // 3 日空いた
  assert.strictEqual(stats.streakDays, 1);
  assert.strictEqual(stats.bestStreakDays, 2);
});

test('withCustom は自作単語を単語帳に合流させる', function () {
  var decks = Decks.withCustom({ en: [{ term: 'serendipity', meaning: '偶然の幸運' }] });
  var en = decks.filter(function (d) { return d.id === 'en'; })[0];
  var added = en.words.filter(function (w) { return w.term === 'serendipity'; })[0];

  assert.ok(added, '自作単語が合流していない');
  assert.strictEqual(added.custom, true);
  assert.strictEqual(added.id, 'en:serendipity');
  assert.strictEqual(en.words.length, Decks.getDeck('en').words.length + 1);
  assert.strictEqual(Decks.getDeck('en').words.length, 60, '元の単語帳は変更されない');
});

test('withCustom は既存の単語と重複する自作単語を無視する', function () {
  var decks = Decks.withCustom({ en: [{ term: 'effort', meaning: '重複' }] });
  var en = decks.filter(function (d) { return d.id === 'en'; })[0];
  var hits = en.words.filter(function (w) { return w.term === 'effort'; });

  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].meaning, '努力');
});

test('設定は新しい項目も含めて補正される', function () {
  var settings = Storage.normalizeSettings({ mode: 'bogus', theme: 'bogus', speech: false });
  assert.strictEqual(settings.mode, 'flashcard');
  assert.strictEqual(settings.theme, 'auto');
  assert.strictEqual(settings.speech, false);
  assert.strictEqual(Storage.normalizeSettings({}).speech, true);
});

test('単語帳には言語コードと読み上げ用のロケールがある', function () {
  Decks.DECKS.forEach(function (deck) {
    assert.match(deck.code, /^[A-Z]{2}$/, deck.name + ' の code が不正');
    assert.match(deck.lang, /^[a-z]{2}-[A-Z]{2}$/, deck.name + ' の lang が不正');
  });
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
