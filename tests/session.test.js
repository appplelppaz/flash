'use strict';

var test = require('node:test');
var assert = require('node:assert');

// storage.js は localStorage を使うため、Node では簡易実装を用意する
if (typeof globalThis.localStorage === 'undefined') {
  var store = new Map();
  globalThis.localStorage = {
    getItem: function (key) { return store.has(key) ? store.get(key) : null; },
    setItem: function (key, value) { store.set(key, String(value)); },
    removeItem: function (key) { store.delete(key); },
    clear: function () { store.clear(); }
  };
}

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

test('最初のカードでは前の単語に戻れない', function () {
  var session = new Study.StudySession({ words: makeWords(3), requiredStreak: 2 });
  assert.strictEqual(session.hasPrevious(), false);
  assert.strictEqual(session.previous(), null);
});

test('previous は直前に見ていた単語をもう一度先頭に出す（左スワイプ）', function () {
  var session = new Study.StudySession({ words: makeWords(3), requiredStreak: 2 });
  var first = session.current();

  session.skip();
  assert.notStrictEqual(session.current(), first);
  assert.strictEqual(session.hasPrevious(), true);

  assert.strictEqual(session.previous(), first);
  assert.strictEqual(session.current(), first, '前の単語が先頭に戻っていない');
  assert.strictEqual(session.hasPrevious(), false, '履歴を使い切っている');
  assert.strictEqual(session.queue.length, 3, 'カードが二重に並んでいる');
});

test('判定したあとでも previous でその単語に戻れる', function () {
  var session = new Study.StudySession({ words: makeWords(3), requiredStreak: 2 });
  var first = session.current();

  session.answer(false);
  assert.strictEqual(session.previous(), first);
  assert.strictEqual(session.current(), first);
  assert.strictEqual(first.wrong, 1, '判定そのものは取り消さない');
  assert.strictEqual(session.queue.length, 3);
});

test('学習済みになった単語も previous で戻せ、セッションは未完了に戻る', function () {
  var session = new Study.StudySession({ words: makeWords(1), requiredStreak: 1 });
  var only = session.current();

  var result = session.answer(true);
  assert.strictEqual(result.complete, true);
  assert.strictEqual(session.isComplete(), true);

  session.previous();
  assert.strictEqual(session.current(), only);
  assert.strictEqual(session.isComplete(), false);
  assert.strictEqual(session.learnedCount(), 1, '学習済みの判定は残る');
});

test('previous でさかのぼれるのは直近 50 枚まで', function () {
  var session = new Study.StudySession({ words: makeWords(60), requiredStreak: 5 });
  for (var i = 0; i < 60; i++) session.skip();
  var count = 0;
  while (session.hasPrevious()) {
    session.previous();
    count++;
  }
  assert.strictEqual(count, 50);
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

test('listWithCustom は自作単語をリストに合流させる', function () {
  var list = Decks.listWithCustom('en', { en: [{ term: 'serendipity', meaning: '偶然の幸運' }] });
  var added = list.words.filter(function (w) { return w.term === 'serendipity'; })[0];

  assert.ok(added, '自作単語が合流していない');
  assert.strictEqual(added.custom, true);
  assert.strictEqual(added.id, 'en:serendipity');
  assert.strictEqual(list.words.length, Decks.getList('en').words.length + 1);
  assert.strictEqual(Decks.getList('en').words.length, 60, '元のリストは変更されない');
});

test('listWithCustom は既存の単語と重複する自作単語を無視する', function () {
  var list = Decks.listWithCustom('en', { en: [{ term: 'effort', meaning: '重複' }] });
  var hits = list.words.filter(function (w) { return w.term === 'effort'; });

  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].meaning, '努力');
});

test('withCustom は言語ごとに全リストを返す', function () {
  var decks = Decks.withCustom({ 'fr-vie3000': [{ term: 'zzz-test', meaning: 'テスト' }] });
  var fr = decks.filter(function (d) { return d.id === 'fr'; })[0];

  assert.ok(fr.lists.length >= 2, 'フランス語のリストが 2 つ以上ない');
  var target = fr.lists.filter(function (l) { return l.id === 'fr-vie3000'; })[0];
  assert.ok(target.words.some(function (w) { return w.term === 'zzz-test'; }));
  assert.strictEqual(fr.lists[0].id, fr.defaultListId, '既定のリストが先頭に並んでいない');
});

test('自動再生・自動送りの設定が補正される', function () {
  var settings = Storage.normalizeSettings({ theme: 'bogus', speech: false, autoAdvance: false, autoSeconds: 99 });
  assert.strictEqual(settings.theme, 'auto');
  assert.strictEqual(settings.speech, false);
  assert.strictEqual(settings.autoAdvance, false);
  assert.strictEqual(settings.autoSeconds, 20);

  var defaults = Storage.normalizeSettings({});
  assert.strictEqual(defaults.speech, true, '読み上げの自動再生は既定でオン');
  assert.strictEqual(defaults.autoAdvance, true, '自動送りは既定でオン');
  assert.strictEqual(defaults.autoSeconds, 1);
});

test('自動送りの間隔は既定で 1 秒（読み上げ後）', function () {
  assert.strictEqual(Storage.DEFAULT_SETTINGS.autoSeconds, 1);
  assert.strictEqual(Storage.normalizeSettings({}).autoSeconds, 1);
});

test('自動送りの間隔は 0.5 秒きざみで 0.5 〜 20 秒', function () {
  var seconds = function (value) {
    return Storage.normalizeSettings({ autoSeconds: value }).autoSeconds;
  };
  assert.strictEqual(seconds(0.5), 0.5);
  assert.strictEqual(seconds(2.5), 2.5);
  assert.strictEqual(seconds(1.3), 1.5, '0.5 きざみに丸める');
  assert.strictEqual(seconds(0.1), 0.5, '下限で止める');
  assert.strictEqual(seconds(99), 20, '上限で止める');
  assert.strictEqual(seconds('abc'), 1, '数値でなければ既定');
});

test('以前の保存（4 秒）は新しい既定の 1 秒に寄せる', function () {
  // 版が無い保存 = 以前のもの。自分で選んだ値でなければ寄せる
  assert.strictEqual(Storage.normalizeSettings({ autoSeconds: 4 }).autoSeconds, 1);
  assert.strictEqual(Storage.normalizeSettings({ autoSeconds: 8 }).autoSeconds, 8,
    '自分で選んだ値はそのまま');
  assert.strictEqual(Storage.normalizeSettings({ version: 2, autoSeconds: 4 }).autoSeconds, 4,
    '新しい保存の 4 秒はそのまま');
});

test('収録言語は 英語・中国語・スペイン語・フランス語 の 4 つ', function () {
  assert.deepStrictEqual(Decks.DECKS.map(function (d) { return d.id; }), ['en', 'zh', 'es', 'fr']);
  assert.deepStrictEqual(Decks.DECKS.map(function (d) { return d.name; }),
    ['英語', '中国語', 'スペイン語', 'フランス語']);
});

test('言語ごとの既定の単語リストが決まっている', function () {
  var expected = {
    en: 'en-eiken1',
    zh: 'zh-hsk69',
    es: 'es-vida3000',
    fr: 'fr-vie3000'
  };
  Decks.DECKS.forEach(function (deck) {
    assert.strictEqual(deck.defaultListId, expected[deck.id], deck.name + ' の既定リストが違う');
    assert.ok(Decks.getList(deck.defaultListId), deck.name + ' の既定リストが存在しない');
    assert.strictEqual(Decks.getList(deck.defaultListId).deckId, deck.id);
  });
});

test('すべての単語に例文と例文の日本語訳がある', function () {
  Decks.LISTS.forEach(function (list) {
    list.words.forEach(function (word) {
      assert.ok(word.example, list.name + ' の ' + word.term + ' に例文が無い');
      assert.ok(word.exampleJa, list.name + ' の ' + word.term + ' に例文の訳が無い');
    });
  });
});

test('例文にはその単語が含まれている', function () {
  // 中国語は活用が無いのでそのまま、英語は活用を考慮して語幹（先頭 4 文字）で照合する。
  // スペイン語・フランス語は不規則活用（querer → quiero など）があるため対象外。
  Decks.LISTS.forEach(function (list) {
    if (list.deckId === 'zh') {
      list.words.forEach(function (word) {
        assert.ok(word.example.indexOf(word.term) >= 0,
          '中国語の ' + word.term + ' の例文に単語が含まれていない');
      });
    }
    if (list.deckId === 'en') {
      list.words.forEach(function (word) {
        var stem = word.term.slice(0, 4).toLowerCase();
        assert.ok(word.example.toLowerCase().indexOf(stem) >= 0,
          '英語の ' + word.term + ' の例文に単語が含まれていない: ' + word.example);
      });
    }
  });
});

test('単語帳には言語コードと読み上げ用のロケールがある', function () {
  Decks.DECKS.forEach(function (deck) {
    assert.match(deck.code, /^[A-Z]{2}$/, deck.name + ' の code が不正');
    assert.match(deck.lang, /^[a-z]{2}-[A-Z]{2}$/, deck.name + ' の lang が不正');
  });
});

test('単語リストのデータが揃っていて ID が一意である', function () {
  var seen = new Set();
  assert.ok(Decks.LISTS.length >= 8, '単語リストが足りない');

  Decks.LISTS.forEach(function (list) {
    assert.ok(list.name, 'リスト ' + list.id + ' に名前が無い');
    assert.ok(Decks.getDeck(list.deckId), 'リスト ' + list.id + ' の言語が無い');
    assert.ok(list.words.length >= 20, list.name + ' の単語が 20 語未満');

    list.words.forEach(function (word) {
      assert.ok(word.term && word.meaning, list.name + ' に不完全な単語がある');
      assert.strictEqual(word.listId, list.id);
      assert.strictEqual(word.deckId, list.deckId);
      assert.ok(!seen.has(word.id), 'ID が重複: ' + word.id);
      seen.add(word.id);
    });
  });
});

test('選択中の単語リストを言語ごとに保存できる', function () {
  assert.strictEqual(Storage.selectedListId('fr', 'fr-vie3000'), 'fr-vie3000', '未選択なら既定のリスト');

  Storage.saveSelectedList('fr', 'fr');
  assert.strictEqual(Storage.selectedListId('fr', 'fr-vie3000'), 'fr');
  assert.strictEqual(
    Storage.selectedListId('fr', 'fr-vie3000', ['fr-vie3000']),
    'fr-vie3000',
    '選べないリストが保存されていたら既定に戻す'
  );

  Storage.saveSelectedList('fr', null);
  assert.strictEqual(Storage.selectedListId('fr', 'fr-vie3000'), 'fr-vie3000');
});

test('言語ごとの既定リストは十分な語数がある', function () {
  var minimum = {
    'fr-vie3000': 3000,
    'es-vida3000': 3000,
    'en-eiken1': 2000,
    'zh-hsk69': 2000
  };
  Object.keys(minimum).forEach(function (listId) {
    var list = Decks.getList(listId);
    assert.ok(list, listId + ' が見つからない');
    assert.ok(list.words.length >= minimum[listId],
      list.name + ' は ' + minimum[listId] + ' 語以上必要（現在 ' + list.words.length + ' 語）');
  });
});

test('同じリストの中で単語が重複しない', function () {
  Decks.LISTS.forEach(function (list) {
    var seen = new Set();
    list.words.forEach(function (word) {
      assert.ok(!seen.has(word.term), list.name + ' で重複: ' + word.term);
      seen.add(word.term);
    });
  });
});

test('中国語のリストにはピンインが付いている', function () {
  Decks.LISTS.filter(function (list) { return list.deckId === 'zh'; }).forEach(function (list) {
    list.words.forEach(function (word) {
      assert.ok(word.reading, list.name + ' の ' + word.term + ' にピンインが無い');
    });
  });
});

test('例文の日本語訳が日本語で書かれている', function () {
  Decks.LISTS.forEach(function (list) {
    list.words.forEach(function (word) {
      assert.match(word.exampleJa, /[ぁ-んァ-ヶ一-龠]/,
        list.name + ' の ' + word.term + ' の訳が日本語ではない: ' + word.exampleJa);
    });
  });
});
