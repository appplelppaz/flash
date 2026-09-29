/**
 * 学習セッション（DOM に依存しないロジック）
 *
 * 1 セット = 出題語数ぶんのキュー。
 *   覚えた   → その語は学習済みになりキューから外れる（以後の出題にも出ない）
 *   まだ     → 3 枚あとに積み直され、同じセットの中で必ずもう一度出る
 *   判定なし → 覚えた／まだは記録せず、表示回数の少ない語に順番を譲る
 *              （残りの語の中で、表示回数が同じ語の後ろへ回す。残りが無ければセットの末尾へ）
 * キューが空になったら、残りの語で次のセットが自動的に始まる。
 *
 * 表示した語には seen（回数）と seenAt（最後に表示した時刻）を付ける。
 * 出題の並びは「まだ一度も表示していない語」が先。全部表示し終えたあとも
 * 出なくなるのではなく、表示回数の少ない順（同じ回数なら最後に見たのが古い順）に出る。
 *
 * snapshot() で今どこまで進んだかを取り出し、次に create() へ resume として
 * 渡すと、同じ出題範囲・並び順ならその続きから始まる。
 */
(function (global) {
  'use strict';

  var REQUEUE_GAP = 3;
  var HISTORY_MAX = 50;

  function emptyProgress() {
    return { learned: false, right: 0, wrong: 0, fav: false, seen: 0, seenAt: 0 };
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

  /**
   * 最後に表示した時刻。一度も表示していなければ -1。
   * 表示の記録が無くても、覚えた／まだを判定した語は表示したものとみなす
   * （記録を付ける前の版で見た語）。
   */
  function seenAt(progress, id) {
    var p = progress[id];
    if (!p) return -1;
    if (p.seen) return p.seenAt || 0;
    return (p.right || p.wrong || p.learned) ? 0 : -1;
  }

  /** 表示した回数。記録が無くても判定したことのある語は 1 回とみなす */
  function shownCount(progress, id) {
    var p = progress[id];
    if (!p) return 0;
    if (p.seen) return p.seen;
    return (p.right || p.wrong || p.learned) ? 1 : 0;
  }

  /** 表示回数の少ない語が先。同じ回数なら最後に見たのが古い語が先 */
  function compareShown(progress, a, b) {
    return (shownCount(progress, a) - shownCount(progress, b)) ||
      (seenAt(progress, a) - seenAt(progress, b));
  }

  /**
   * 表示回数の少ない順に並べ直す（まだ表示していない語が先頭）。
   * 回数も最後に見た時刻も同じ語は、もとの並びのまま。
   */
  function fewestShownFirst(ids, progress) {
    var rank = {};
    ids.forEach(function (id, i) { rank[id] = i; });
    return ids.slice().sort(function (a, b) {
      return compareShown(progress, a, b) || (rank[a] - rank[b]);
    });
  }

  function orderPool(pool, progress, order, rand) {
    if (order === 'weak-first') {
      // 苦手順は苦手さを第一に並べる
      return pool.slice().sort(function (a, b) {
        var pa = progressOf(progress, a), pb = progressOf(progress, b);
        var wa = pa.wrong - pa.right, wb = pb.wrong - pb.right;
        if (wa !== wb) return wb - wa;
        // 苦手さが同じなら、表示回数の少ない語 → 最後に見たのが古い語
        return compareShown(progress, a, b) || (a - b);
      });
    }
    // まだ表示していない語を先に。表示した語は表示回数の少ない順
    return fewestShownFirst(order === 'random' ? shuffle(pool, rand) : pool.slice(), progress);
  }

  /**
   * 前回の続きの並びを組み立てる。
   * いまの出題対象に無い語（その後に覚えた語など）は落とし、
   * 前回には無かった語（リセットで未学習に戻った語など）は後ろに足す。
   * そのうえで、前回のセットの途中だった語も含めて、まだ表示していない語を先に並べ直す
   * （やめたときに出ていた語や、同じセットで回っていた語をもう一度先に出さないため）。
   * 続きにできないときは null。
   */
  function restoreOrder(pool, resume, scope, order, progress) {
    if (!resume || resume.scope !== scope || resume.order !== order) return null;
    var inPool = {};
    for (var i = 0; i < pool.length; i++) inPool[pool[i]] = true;
    var seen = {};
    function keep(ids) {
      var out = [];
      (ids || []).forEach(function (id) {
        if (inPool[id] && !seen[id]) { seen[id] = true; out.push(id); }
      });
      return out;
    }
    var ids = keep(resume.queue).concat(keep(resume.remaining));
    pool.forEach(function (id) { if (!seen[id]) ids.push(id); });
    if (!ids.length) return null;
    return {
      queue: [],
      remaining: order === 'weak-first' ? orderPool(ids, progress, order) : fewestShownFirst(ids, progress),
      setTotal: 0,
      setNo: Math.max(0, resume.setNo || 0)
    };
  }

  /**
   * @param {Object} opts
   * @param {Array}  opts.cards     カードの配列
   * @param {Object} opts.progress  index -> {learned,right,wrong,fav}（この場で書き換える）
   * @param {number} opts.setSize   1 セットの語数
   * @param {string} opts.scope     new | weak | fav | all
   * @param {string} opts.order     listed | random | weak-first
   * @param {Function} [opts.random]
   * @param {Object}   [opts.resume]  前回の snapshot()。範囲と並び順が同じなら続きから
   * @param {Function} [opts.now]     時刻（テスト用）
   */
  function create(opts) {
    var cards = opts.cards || [];
    var progress = opts.progress || {};
    var setSize = Math.max(1, opts.setSize || 20);
    var scope = opts.scope || 'new';
    var order = opts.order || 'listed';
    var rand = opts.random;
    var now = opts.now || Date.now;

    var pool = selectPool(cards, progress, scope);
    var restored = restoreOrder(pool, opts.resume, scope, order, progress);
    var remaining = restored ? restored.remaining : orderPool(pool, progress, order, rand);
    var queue = restored ? restored.queue : [];
    var setTotal = restored ? restored.setTotal : 0;
    var history = [];
    var setNo = restored ? restored.setNo : 0;
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

    /**
     * 表示回数の少ない語に順番を譲る。表示回数が同じかより少ない語の後ろへ入れる
     * （苦手順では苦手さの並びを崩さないよう、最後へ）。
     */
    function deferToRemaining(id) {
      if (order === 'weak-first') { remaining.push(id); return; }
      var n = shownCount(progress, id);
      var at = remaining.length;
      while (at > 0 && shownCount(progress, remaining[at - 1]) > n) at--;
      remaining.splice(at, 0, id);
    }

    function advance(id, gap, record) {
      queue.shift();
      pushHistory(id);
      if (record === 'defer' && remaining.length) {
        deferToRemaining(id);
      } else if (record !== 'remove') requeue(id, gap);
      if (!queue.length) fillSet();
    }

    var api = {
      /** 出題があるか */
      start: function () {
        if (queue.length) {
          stats.sets = setNo;
          return true;
        }
        return fillSet();
      },

      /** 前回の続きから始めたか */
      resumed: function () { return !!restored; },

      /** 今どこまで進んだか（保存して次の create() の resume に渡す） */
      snapshot: function () {
        return {
          scope: scope,
          order: order,
          queue: queue.slice(),
          remaining: remaining.slice(),
          setTotal: setTotal,
          setNo: setNo
        };
      },

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
        advance(id, queue.length, 'defer');
      },

      /** いまのカードを表示した、と記録する */
      markSeen: function () {
        var id = currentId();
        if (id === null) return;
        var p = progress[id] || (progress[id] = emptyProgress());
        p.seen = (p.seen || 0) + 1;
        p.seenAt = now();
      },

      /** 直前のカードに戻る（判定は取り消さない） */
      back: function () {
        var id = history.pop();
        if (id === undefined) return false;
        var at = queue.indexOf(id);
        if (at !== -1) queue.splice(at, 1);
        at = remaining.indexOf(id);
        if (at !== -1) remaining.splice(at, 1);
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

  /** 一度も表示していない語の数 */
  function unseenCount(cards, progress, scope) {
    return selectPool(cards, progress, scope).filter(function (id) {
      return seenAt(progress, id) < 0;
    }).length;
  }

  var api = { create: create, selectPool: selectPool, emptyProgress: emptyProgress, unseenCount: unseenCount };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Flash = global.Flash || {};
    global.Flash.session = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
