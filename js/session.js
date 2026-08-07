/**
 * 学習セッションのロジック。
 *
 * 選んだ単語がすべて「学習済み」になるまで出題を繰り返す。
 * 1 枚のカードは requiredStreak 回連続で正解すると学習済みになり、
 * 不正解なら連続正解数が 0 に戻ってキューの後ろに積み直される。
 * DOM には一切触れないので Node からもテストできる。
 */
(function (global) {
  'use strict';

  // 不正解の単語を何枚あとに再出題するか（キューが短いときは末尾）
  var REQUEUE_AFTER_WRONG = 3;
  // 正解したがまだ学習済みでない単語を何枚あとに再出題するか
  var REQUEUE_AFTER_CORRECT = 6;

  function shuffle(items, random) {
    var rand = random || Math.random;
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  }

  /**
   * 出題する単語を選ぶ。
   * order:
   *   'unlearned-first' … 未学習・苦手なものを優先（デフォルト）
   *   'random'          … 完全にランダム
   *   'weak-first'      … これまでの不正解が多い順
   * progress は { [wordId]: { correct, wrong, learned } } 形式。
   */
  function pickWords(words, count, options) {
    var opts = options || {};
    var order = opts.order || 'unlearned-first';
    var progress = opts.progress || {};
    var random = opts.random || Math.random;
    var limit = Math.max(1, Math.min(count, words.length));
    var pool = shuffle(words, random);

    function statOf(word) {
      return progress[word.id] || { correct: 0, wrong: 0, learned: false };
    }

    if (order === 'unlearned-first') {
      pool.sort(function (a, b) {
        var sa = statOf(a);
        var sb = statOf(b);
        // 未学習を先に、その中では不正解が多いものを先に
        return (sa.learned === sb.learned)
          ? (sb.wrong - sa.wrong)
          : (sa.learned ? 1 : -1);
      });
    } else if (order === 'weak-first') {
      pool.sort(function (a, b) {
        return statOf(b).wrong - statOf(a).wrong;
      });
    }

    return pool.slice(0, limit);
  }

  /**
   * @param {Object} options
   * @param {Array}  options.words          出題する単語（pickWords の戻り値）
   * @param {number} options.requiredStreak 学習済みと判定する連続正解回数
   * @param {string} options.direction      'term-first' | 'meaning-first' | 'mixed'
   */
  function StudySession(options) {
    var opts = options || {};
    var random = opts.random || Math.random;

    this.requiredStreak = Math.max(1, opts.requiredStreak || 2);
    this.direction = opts.direction || 'term-first';
    this._random = random;
    this.answeredCount = 0;
    this.correctCount = 0;
    this.startedAt = opts.startedAt || Date.now();
    this.finishedAt = null;

    this.cards = (opts.words || []).map(function (word) {
      return {
        word: word,
        streak: 0,
        correct: 0,
        wrong: 0,
        learned: false,
        // mixed のときはカードごとに出題方向を固定しておく
        askMeaningFirst: opts.direction === 'meaning-first' ||
          (opts.direction === 'mixed' && random() < 0.5)
      };
    });

    this.queue = this.cards.slice();
  }

  StudySession.prototype.total = function () {
    return this.cards.length;
  };

  StudySession.prototype.learnedCount = function () {
    return this.cards.filter(function (card) {
      return card.learned;
    }).length;
  };

  StudySession.prototype.remainingCount = function () {
    return this.total() - this.learnedCount();
  };

  StudySession.prototype.isComplete = function () {
    return this.queue.length === 0;
  };

  StudySession.prototype.current = function () {
    return this.queue.length ? this.queue[0] : null;
  };

  /** 現在のカードの表(問題)と裏(答え)を返す */
  StudySession.prototype.currentFace = function () {
    var card = this.current();
    if (!card) return null;
    var word = card.word;
    if (card.askMeaningFirst) {
      return {
        question: word.meaning,
        answer: word.term,
        reading: word.reading || '',
        questionLabel: '意味',
        answerLabel: '単語'
      };
    }
    return {
      question: word.term,
      answer: word.meaning,
      reading: word.reading || '',
      questionLabel: '単語',
      answerLabel: '意味'
    };
  };

  /**
   * 現在のカードに答える。
   * @param {boolean} isCorrect
   * @returns {{card: Object, learned: boolean, complete: boolean}|null}
   */
  StudySession.prototype.answer = function (isCorrect) {
    var card = this.queue.shift();
    if (!card) return null;

    this.answeredCount++;

    if (isCorrect) {
      this.correctCount++;
      card.correct++;
      card.streak++;
      if (card.streak >= this.requiredStreak) {
        card.learned = true;
      }
    } else {
      card.wrong++;
      card.streak = 0;
      card.learned = false;
    }

    if (!card.learned) {
      var offset = isCorrect ? REQUEUE_AFTER_CORRECT : REQUEUE_AFTER_WRONG;
      this.queue.splice(Math.min(offset, this.queue.length), 0, card);
    }

    var complete = this.isComplete();
    if (complete && !this.finishedAt) {
      this.finishedAt = Date.now();
    }

    return { card: card, learned: card.learned, complete: complete };
  };

  StudySession.prototype.stats = function () {
    return {
      total: this.total(),
      learned: this.learnedCount(),
      remaining: this.remainingCount(),
      answered: this.answeredCount,
      correct: this.correctCount,
      accuracy: this.answeredCount ? this.correctCount / this.answeredCount : 0,
      elapsedMs: (this.finishedAt || Date.now()) - this.startedAt
    };
  };

  /**
   * 4 択クイズの選択肢を作る。正解 1 つ＋同じ単語帳からのダミー 3 つ。
   * @param {Object} card    StudySession のカード
   * @param {Array}  pool    選択肢を取る単語の集合（同じ言語の単語帳）
   */
  function makeChoices(card, pool, options) {
    var opts = options || {};
    var random = opts.random || Math.random;
    var size = opts.size || 4;
    var askMeaningFirst = card.askMeaningFirst;
    var valueOf = function (word) { return askMeaningFirst ? word.term : word.meaning; };
    var correct = valueOf(card.word);

    var distractors = [];
    var seen = {};
    seen[correct] = true;

    shuffle(pool, random).forEach(function (word) {
      var value = valueOf(word);
      if (seen[value] || distractors.length >= size - 1) return;
      seen[value] = true;
      distractors.push(value);
    });

    var choices = shuffle(distractors.concat([correct]), random);
    return { choices: choices, answerIndex: choices.indexOf(correct), correct: correct };
  }

  /** 苦手（間違えたことがある / 未学習）の単語だけを抜き出す */
  function weakWords(words, progress) {
    var stats = progress || {};
    return words.filter(function (word) {
      var stat = stats[word.id];
      return stat && stat.wrong > 0 && !stat.learned;
    });
  }

  var api = {
    StudySession: StudySession,
    pickWords: pickWords,
    makeChoices: makeChoices,
    weakWords: weakWords,
    shuffle: shuffle
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Study = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
