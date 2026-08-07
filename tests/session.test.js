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
  assert.strictEqual(session.currentSteps(), null);
});

test('カードは 単語 → 日本語訳 → 例文 の順で表示される（例文の訳は表示しない）', function () {
  var words = [{
    id: 'x', term: 'effort', reading: 'ˈefərt', meaning: '努力',
    example: 'It took a lot of effort to finish.', exampleJa: '終わらせるのに多くの努力が必要だった。'
  }];
  var steps = new Study.StudySession({ words: words, direction: 'term-first' }).currentSteps();

  assert.deepStrictEqual(steps.map(function (s) { return s.key; }), ['term', 'meaning', 'example']);
  assert.deepStrictEqual(steps.map(function (s) { return s.text; }),
    ['effort', '努力', 'It took a lot of effort to finish.']);
  assert.strictEqual(steps[0].reading, 'ˈefərt');
  steps.forEach(function (step) {
    assert.notStrictEqual(step.text, '終わらせるのに多くの努力が必要だった。', '例文の訳は表示しない');
  });
});

test('読み上げは 単語 → 日本語訳 → 例文 → 例文の訳 → 例文 の順になる', function () {
  var words = [{
    id: 'x', term: 'effort', meaning: '努力',
    example: 'It took a lot of effort to finish.', exampleJa: '終わらせるのに多くの努力が必要だった。'
  }];
  var steps = new Study.StudySession({ words: words, direction: 'term-first' }).currentSteps();

  var spoken = steps.reduce(function (all, step) { return all.concat(step.speech); }, []);
  assert.deepStrictEqual(spoken.map(function (s) { return s.text; }), [
    'effort',
    '努力',
    'It took a lot of effort to finish.',
    '終わらせるのに多くの努力が必要だった。',
    'It took a lot of effort to finish.'
  ]);
  // 日本語訳と例文の訳だけが日本語で読まれる
  assert.deepStrictEqual(spoken.map(function (s) { return s.ja; }), [false, true, false, true, false]);
});

test('意味 → 単語 の設定では最初の 2 段階が入れ替わる', function () {
  var words = [{ id: 'x', term: 'effort', meaning: '努力', example: 'Nice effort.', exampleJa: 'よい努力だ。' }];
  var steps = new Study.StudySession({ words: words, direction: 'meaning-first' }).currentSteps();

  assert.deepStrictEqual(steps.map(function (s) { return s.key; }), ['meaning', 'term', 'example']);
});

test('例文が無い単語では例文の段階が省かれる', function () {
  var words = [{ id: 'x', term: 'effort', meaning: '努力' }];
  var steps = new Study.StudySession({ words: words }).currentSteps();

  assert.deepStrictEqual(steps.map(function (s) { return s.key; }), ['term', 'meaning']);
});

test('例文の訳が無ければ例文は 1 回だけ読み上げる', function () {
  var words = [{ id: 'x', term: 'effort', meaning: '努力', example: 'Nice effort.' }];
  var steps = new Study.StudySession({ words: words }).currentSteps();
  var example = steps[steps.length - 1];

  assert.strictEqual(example.key, 'example');
  assert.deepStrictEqual(example.speech.map(function (s) { return s.text; }), ['Nice effort.']);
});

test('skip は判定せずにカードを後ろへまわす', function () {
  var session = new Study.StudySession({ words: makeWords(3), requiredStreak: 2 });
  var first = session.current();

  session.skip();
  assert.notStrictEqual(session.current(), first, '次のカードに進んでいない');
  assert.strictEqual(session.answeredCount, 0, '解答数に数えてはいけない');
  assert.strictEqual(session.correctCount, 0);
  assert.strictEqual(first.streak, 0);
  assert.strictEqual(session.learnedCount(), 0);
  assert.strictEqual(session.queue.length, 3, 'カードはキューに残る');
  assert.strictEqual(session.isComplete(), false);
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

test('自動再生・自動めくりの設定が補正される', function () {
  var settings = Storage.normalizeSettings({ theme: 'bogus', speech: false, autoAdvance: false, autoSeconds: 99 });
  assert.strictEqual(settings.theme, 'auto');
  assert.strictEqual(settings.speech, false);
  assert.strictEqual(settings.autoAdvance, false);
  assert.strictEqual(settings.autoSeconds, 20);

  var defaults = Storage.normalizeSettings({});
  assert.strictEqual(defaults.speech, true, '読み上げの自動再生は既定でオン');
  assert.strictEqual(defaults.autoAdvance, true, '自動めくりは既定でオン');
  assert.strictEqual(defaults.autoSeconds, 4);
});

test('収録言語は 英語・中国語・スペイン語・フランス語 の 4 つ', function () {
  assert.deepStrictEqual(Decks.DECKS.map(function (d) { return d.id; }), ['en', 'zh', 'es', 'fr']);
  assert.deepStrictEqual(Decks.DECKS.map(function (d) { return d.name; }),
    ['英語', '中国語', 'スペイン語', 'フランス語']);
});

test('すべての単語に例文と例文の日本語訳がある', function () {
  Decks.DECKS.forEach(function (deck) {
    deck.words.forEach(function (word) {
      assert.ok(word.example, deck.name + ' の ' + word.term + ' に例文が無い');
      assert.ok(word.exampleJa, deck.name + ' の ' + word.term + ' に例文の訳が無い');
    });
  });
});

test('例文にはその単語が含まれている', function () {
  // 中国語は活用が無いのでそのまま、英語は活用を考慮して語幹（先頭 4 文字）で照合する。
  // スペイン語・フランス語は不規則活用（querer → quiero など）があるため対象外。
  Decks.getDeck('zh').words.forEach(function (word) {
    assert.ok(word.example.indexOf(word.term) >= 0,
      '中国語の ' + word.term + ' の例文に単語が含まれていない');
  });

  Decks.getDeck('en').words.forEach(function (word) {
    var stem = word.term.slice(0, 4).toLowerCase();
    assert.ok(word.example.toLowerCase().indexOf(stem) >= 0,
      '英語の ' + word.term + ' の例文に単語が含まれていない: ' + word.example);
  });
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
