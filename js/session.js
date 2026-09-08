/**
 * 学習セッション（DOM に依存しないロジック）
 *
 * 1 セット = 出題語数ぶんのキュー。
 *   覚えた   → その語は学習済みになりキューから外れる（以後の出題にも出ない）
 *   まだ     → 3 枚あとに積み直され、同じセットの中で必ずもう一度出る
 *   判定なし → 記録せずキューの末尾へ回す
 * キューが空になったら、残りの語で次のセットが自動的に始まる。
 */
(function (global) {
  'use strict';

  var REQUEUE_GAP = 3;
  var HISTORY_MAX = 50;

  function emptyProgress() {
    return { learned: false, right: 0, wrong: 0, fav: false };
  }

  function progressOf(progress, id) {
    return progress[id] || emptyProgress();
  }

  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor((rand || Math.random)() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * 出題対象の抽出。
   * @param {Array} cards
   * @param {Object} progress
   * @param {string} scope new | weak | fav | all
   */
  function selectPool(cards, progress, scope) {
    var pool = [];
    for (var i = 0; i < cards.length; i++) {
      var p = progressOf(progress, i);
      if (scope === 'weak') {
        if (p.wrong > 0 && !p.learned) pool.push(i);
      } else if (scope === 'fav') {
        if (p.fav) pool.push(i);
      } else if (scope === 'all') {
        pool.push(i);
      } else {
        if (!p.learned) pool.push(i);
      }
    }
    return pool;
  }

  function orderPool(pool, progress, order, rand) {
    if (order === 'random') return shuffle(pool, rand);
    if (order === 'weak-first') {
      return pool.slice().sort(function (a, b) {
        var pa = progressOf(progress, a), pb = progressOf(progress, b);
        var wa = pa.wrong - pa.right, wb = pb.wrong - pb.right;
        if (wa !== wb) return wb - wa;
        return a - b;
      });
    }
    return pool.slice();
  }

  /**
   * @param {Object} opts
   * @param {Array}  opts.cards     カードの配列
   * @param {Object} opts.progress  index -> {learned,right,wrong,fav}（この場で書き換える）
   * @param {number} opts.setSize   1 セットの語数
   * @param {string} opts.scope     new | weak | fav | all
   * @param {string} opts.order     listed | random | weak-first
   * @param {Function} [opts.random]
   */
  function create(opts) {
    var cards = opts.cards || [];
    var progress = opts.progress || {};
    var setSize = Math.max(1, opts.setSize || 20);
    var scope = opts.scope || 'new';
    var order = opts.order || 'listed';
    var rand = opts.random;

    var remaining = orderPool(selectPool(cards, progress, scope), progress, order, rand);
    var queue = [];
    var setTotal = 0;
    var history = [];
    var setNo = 0;
    var stats = { answered: 0, correct: 0, learned: 0, sets: 0, startedAt: Date.now() };

    function fillSet() {
      queue = remaining.splice(0, setSize);
      setTotal = queue.length;
      if (queue.length) {
        setNo++;
        stats.sets = setNo;
      }
      return queue.length > 0;
    }

    function currentId() {
      return queue.length ? queue[0] : null;
    }

    function pushHistory(id) {
      history.push(id);
      if (history.length > HISTORY_MAX) history.shift();
    }

    function requeue(id, gap) {
      var at = Math.min(gap, queue.length);
      queue.splice(at, 0, id);
    }

    function advance(id, gap, record) {
      queue.shift();
      pushHistory(id);
      if (record !== 'remove') requeue(id, gap);
      if (!queue.length) fillSet();
    }

    var api = {
      /** 出題があるか */
      start: function () { return fillSet(); },

      current: function () {
        var id = currentId();
        return id === null ? null : { id: id, card: cards[id], progress: progressOf(progress, id) };
      },

      /** 覚えた */
      known: function () {
        var id = currentId();
        if (id === null) return;
        var p = progress[id] || (progress[id] = emptyProgress());
        p.right++;
        p.learned = true;
        stats.answered++;
        stats.correct++;
        stats.learned++;
        advance(id, 0, 'remove');
      },

      /** まだ覚えていない */
      unknown: function () {
        var id = currentId();
        if (id === null) return;
        var p = progress[id] || (progress[id] = emptyProgress());
        p.wrong++;
        p.learned = false;
        stats.answered++;
        advance(id, REQUEUE_GAP, 'keep');
      },

      /** 判定せず次へ（記録しない） */
      skip: function () {
        var id = currentId();
        if (id === null) return;
        advance(id, queue.length, 'keep');
      },

      /** 直前のカードに戻る（判定は取り消さない） */
      back: function () {
        var id = history.pop();
        if (id === undefined) return false;
        var at = queue.indexOf(id);
        if (at !== -1) queue.splice(at, 1);
        queue.unshift(id);
        return true;
      },

      toggleFav: function () {
        var id = currentId();
        if (id === null) return false;
        var p = progress[id] || (progress[id] = emptyProgress());
        p.fav = !p.fav;
        return p.fav;
      },

      /** セット内の残り枚数（同じ語の重複を除く） */
      setLeft: function () {
        var uniq = {};
        for (var i = 0; i < queue.length; i++) uniq[queue[i]] = true;
        return Object.keys(uniq).length;
      },

      setSize: function () { return setSize; },
      /** いま学習中のセットに最初何語入っていたか */
      setTotal: function () { return setTotal; },
      setNo: function () { return setNo; },
      remaining: function () { return remaining.length; },
      finished: function () { return queue.length === 0; },
      stats: function () {
        var s = {};
        for (var k in stats) s[k] = stats[k];
        s.elapsed = Date.now() - stats.startedAt;
        s.accuracy = stats.answered ? stats.correct / stats.answered : 0;
        return s;
      },
      progress: function () { return progress; }
    };

    return api;
  }

  var api = { create: create, selectPool: selectPool, emptyProgress: emptyProgress };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Flash = global.Flash || {};
    global.Flash.session = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
