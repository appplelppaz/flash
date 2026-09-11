/**
 * 画面の描画と操作。
 * ロジックは tsv / session / library / speech / gesture に置き、ここは繋ぐだけ。
 */
(function (global) {
  'use strict';

  var F = global.Flash;
  var store = F.store, library = F.library, speech = F.speech, gesture = F.gesture;
  var Session = F.session, tsv = F.tsv, links = F.links, plan = F.plan;

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  /* ---- 設定 -------------------------------------------------------- */

  var DEFAULTS = {
    theme: 'auto',
    setSize: 20,
    order: 'listed',
    mode: 'full',
    direction: 'example-first',
    showExampleJa: false,
    highlightLinks: true,
    tts: true,
    ttsPlan: 'full',
    rate: 1,
    voices: {},
    autoFlip: true,
    flipDelay: 1,
    autoNext: true,
    nextDelay: 1.5,
    quickFlipDelay: 0.5,
    quickNextDelay: 0.8,
    coachSeen: false,
    scope: 'new'
  };

  var settings = Object.assign({}, DEFAULTS);

  function saveSettings() {
    store.setSoon('settings', settings, 200);
  }

  /** 前の版で保存された設定を今の形に直す */
  function migrateSettings(saved) {
    var s = Object.assign({}, saved);
    if (s.auto !== undefined && s.autoFlip === undefined) {
      s.autoFlip = s.auto;
      s.autoNext = s.auto;
    }
    if (s.delay !== undefined && s.flipDelay === undefined) {
      s.flipDelay = s.delay;
      s.nextDelay = Math.max(s.delay, 1.5);
    }
    if (s.mode !== 'full' && s.mode !== 'quick') s.mode = 'full';
    delete s.auto;
    delete s.delay;
    return s;
  }

  /* ---- 画面遷移 ---------------------------------------------------- */

  var stack = ['home'];

  function render(name) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle('on', views[i].dataset.view === name);
    }
    if (name !== 'study') stopStudy();
    var scroller = document.querySelector('.view.on .scroll');
    if (scroller) scroller.scrollTop = 0;
  }

  /**
   * 画面を出す。replace を付けると、いまの画面を置き換える（戻る先には残らない）。
   */
  function show(name, opts) {
    render(name);
    if (opts && opts.replace) {
      stack.pop();
      if (stack[stack.length - 1] !== name) stack.push(name);
    } else if (stack[stack.length - 1] !== name) {
      stack.push(name);
    }
  }

  function back() {
    if (stack.length > 1) stack.pop();
    render(stack[stack.length - 1] || 'home');
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function applyTheme() {
    var html = document.documentElement;
    if (settings.theme === 'auto') html.removeAttribute('data-theme');
    else html.setAttribute('data-theme', settings.theme);
  }

  /* ---- 通算の記録 -------------------------------------------------- */

  var stats = { days: {}, streak: 0, last: '' };

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function markStudiedToday() {
    var key = todayKey();
    if (stats.days[key]) return;
    stats.days[key] = true;
    var y = new Date(Date.now() - 86400000);
    var yKey = y.getFullYear() + '-' + ('0' + (y.getMonth() + 1)).slice(-2) + '-' + ('0' + y.getDate()).slice(-2);
    stats.streak = stats.days[yKey] ? (stats.streak || 0) + 1 : 1;
    stats.last = key;
    store.setSoon('stats', stats);
  }

  /* ---- ホーム ------------------------------------------------------ */

  function countLearned(prog) {
    var n = 0;
    for (var k in prog) if (prog[k].learned) n++;
    return n;
  }

  function renderHome() {
    var lists = library.lists();
    var box = $('decklist');
    box.textContent = '';

    var totalLearned = 0;
    lists.forEach(function (l) {
      var prog = library.cachedProgress(l.id) || {};
      var learned = countLearned(prog);
      totalLearned += learned;
      var pct = l.count ? Math.round(learned / l.count * 100) : 0;
      var info = library.langInfo(l.lang);

      var btn = el('button', 'deck-card');
      btn.appendChild(el('span', 'badge', info.flag));

      var body = el('div', 'body');
      body.appendChild(el('div', 'name', l.name));
      var sub = info.name + ' · ' + l.count.toLocaleString('ja-JP') + ' 語';
      if (!l.builtin) sub += ' · 取り込み';
      body.appendChild(el('div', 'sub', sub));
      var bar = el('div', 'bar');
      var fill = el('i');
      fill.style.width = pct + '%';
      bar.appendChild(fill);
      body.appendChild(bar);
      btn.appendChild(body);
      btn.appendChild(el('span', 'pct', pct + '%'));

      btn.addEventListener('click', function () { openDeck(l.id); });
      box.appendChild(btn);
    });

    if (!lists.length) {
      var empty = el('div', 'empty');
      empty.innerHTML = 'リストがありません。<br>右下の ＋ から TSV を取り込んでください。';
      box.appendChild(empty);
    }

    var totals = $('home-totals');
    totals.textContent = '';
    [[lists.length, 'リスト'], [totalLearned.toLocaleString('ja-JP'), '学習済み'], [(stats.streak || 0) + ' 日', '連続']]
      .forEach(function (pair) {
        var d = el('div');
        d.appendChild(el('b', null, String(pair[0])));
        d.appendChild(el('span', null, pair[1]));
        totals.appendChild(d);
      });
  }

  /* ---- リスト画面 -------------------------------------------------- */

  var deck = null;   // { meta, cards, progress }

  function openDeck(id) {
    var meta = library.find(id);
    if (!meta) return;
    $('deck-title').textContent = meta.name;
    $('deck-nums').innerHTML = '読み込み中…';
    show('deck');
    Promise.all([library.cards(id), library.progress(id)]).then(function (r) {
      deck = { meta: meta, cards: r[0], progress: r[1] };
      renderDeck();
    }).catch(function (e) {
      $('deck-nums').textContent = '読み込めませんでした';
      toast(e.message || '読み込めませんでした');
    });
  }

  function scopeCount(scope) {
    if (!deck) return 0;
    return Session.selectPool(deck.cards, deck.progress, scope).length;
  }

  function renderDeck() {
    if (!deck) return;
    var total = deck.cards.length;
    var learned = countLearned(deck.progress);
    var pct = total ? Math.round(learned / total * 100) : 0;

    var ring = $('deck-ring');
    ring.style.setProperty('--p', pct);
    ring.textContent = '';
    ring.appendChild(el('span', null, pct + '%'));

    var weak = scopeCount('weak'), fav = scopeCount('fav'), fresh = scopeCount('new');
    $('deck-nums').innerHTML =
      '<div><b>' + total.toLocaleString('ja-JP') + '</b> 語 / 学習済み <b>' + learned.toLocaleString('ja-JP') + '</b></div>' +
      '<div>未学習 <b>' + fresh + '</b> · 苦手 <b>' + weak + '</b> · ★ <b>' + fav + '</b></div>';

    document.querySelectorAll('#scope-picker button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.scope === settings.scope);
    });
    document.querySelectorAll('#mode-picker button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.mode === settings.mode);
    });
    document.querySelectorAll('#order-picker button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.order === settings.order);
    });
    $('mode-note').textContent = settings.mode === 'quick'
      ? '例文は出さず、単語と訳だけを短い間隔で回します。'
      : '例文 → 単語 → 訳 の順に見せます（順番は設定で変えられます）。';
    $('size-value').textContent = settings.setSize;
    document.querySelectorAll('#size-presets button').forEach(function (b) {
      b.classList.toggle('on', Number(b.dataset.size) === settings.setSize);
    });

    var n = Math.min(settings.setSize, scopeCount(settings.scope));
    $('start-label').textContent = n > 0 ? n + ' 語で学習を始める' : '出題できる語がありません';
    $('btn-start').disabled = n === 0;
    $('btn-deck-delete').textContent = deck.meta.builtin ? 'リストは削除できません' : 'リストを削除';
    $('btn-deck-delete').disabled = !!deck.meta.builtin;
  }

  function bindDeck() {
    document.querySelectorAll('#scope-picker button').forEach(function (b) {
      b.addEventListener('click', function () {
        settings.scope = b.dataset.scope;
        saveSettings();
        renderDeck();
      });
    });
    document.querySelectorAll('#mode-picker button').forEach(function (b) {
      b.addEventListener('click', function () {
        settings.mode = b.dataset.mode;
        saveSettings();
        renderDeck();
      });
    });
    document.querySelectorAll('#order-picker button').forEach(function (b) {
      b.addEventListener('click', function () {
        settings.order = b.dataset.order;
        saveSettings();
        renderDeck();
      });
    });
    $('size-minus').addEventListener('click', function () { bumpSize(-5); });
    $('size-plus').addEventListener('click', function () { bumpSize(5); });
    document.querySelectorAll('#size-presets button').forEach(function (b) {
      b.addEventListener('click', function () {
        settings.setSize = Number(b.dataset.size);
        saveSettings();
        renderDeck();
      });
    });
    $('btn-deck-cards').addEventListener('click', function () { openCards(); });
    $('btn-start').addEventListener('click', startStudy);
    $('btn-deck-reset').addEventListener('click', function () {
      if (!deck || !confirm('「' + deck.meta.name + '」の進み具合を消します。よろしいですか？')) return;
      library.resetProgress(deck.meta.id).then(function () {
        deck.progress = library.cachedProgress(deck.meta.id);
        renderDeck();
        toast('進み具合をリセットしました');
      });
    });
    $('btn-deck-delete').addEventListener('click', function () {
      if (!deck || deck.meta.builtin) return;
      if (!confirm('「' + deck.meta.name + '」を削除します。よろしいですか？')) return;
      library.deleteList(deck.meta.id).then(function () {
        deck = null;
        renderHome();
        stack = ['home'];
        render('home');
        toast('削除しました');
      });
    });
  }

  function bumpSize(d) {
    settings.setSize = Math.max(5, Math.min(200, settings.setSize + d));
    saveSettings();
    renderDeck();
  }

  /* ---- 単語一覧 ---------------------------------------------------- */

  var cardsFilter = 'all';
  var cardsQuery = '';
  var cardsShown = 0;
  var PAGE = 60;

  function openCards() {
    if (!deck) return;
    $('cards-title').textContent = deck.meta.name;
    cardsQuery = '';
    $('cards-search').value = '';
    cardsShown = 0;
    renderCards(true);
    show('cards');
  }

  function matchCard(c, i) {
    var p = deck.progress[i] || {};
    if (cardsFilter === 'learned' && !p.learned) return false;
    if (cardsFilter === 'new' && p.learned) return false;
    if (cardsFilter === 'weak' && !(p.wrong > 0 && !p.learned)) return false;
    if (cardsFilter === 'fav' && !p.fav) return false;
    if (cardsQuery) {
      var q = cardsQuery.toLowerCase();
      var hay = (c.term + ' ' + c.meaning + ' ' + (c.example || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function renderCards(reset) {
    if (!deck) return;
    var box = $('wordlist');
    if (reset) { box.textContent = ''; cardsShown = 0; }

    var matched = [];
    for (var i = 0; i < deck.cards.length; i++) {
      if (matchCard(deck.cards[i], i)) matched.push(i);
    }
    var slice = matched.slice(cardsShown, cardsShown + PAGE);
    slice.forEach(function (i) {
      var c = deck.cards[i];
      var p = deck.progress[i] || {};
      var row = el('div', 'word-row' + (p.learned ? ' is-learned' : (p.wrong > 0 ? ' is-weak' : '')));
      row.appendChild(el('span', 'mark'));
      var w = el('div', 'w');
      w.appendChild(el('div', 't', c.term + (c.reading ? '　' + c.reading : '')));
      w.appendChild(el('div', 'm', c.meaning));
      if (c.example) w.appendChild(el('div', 'e', c.example));
      row.appendChild(w);
      if (p.fav) {
        var star = el('span', 'fav');
        star.innerHTML = '<svg style="fill:currentColor"><use href="#i-star"/></svg>';
        row.appendChild(star);
      }
      box.appendChild(row);
    });
    cardsShown += slice.length;

    if (!matched.length) {
      var empty = el('div', 'empty', '見つかりませんでした');
      box.appendChild(empty);
    }
    $('cards-more').hidden = cardsShown >= matched.length;
    $('cards-title').textContent = deck.meta.name + '（' + matched.length.toLocaleString('ja-JP') + '）';
  }

  function bindCards() {
    $('cards-search').addEventListener('input', function (e) {
      cardsQuery = e.target.value.trim();
      renderCards(true);
    });
    document.querySelectorAll('#cards-filter button').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#cards-filter button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        cardsFilter = b.dataset.filter;
        renderCards(true);
      });
    });
    $('btn-cards-more').addEventListener('click', function () { renderCards(false); });
    $('btn-export-tsv').addEventListener('click', function () {
      if (!deck) return;
      download(deck.meta.name + '.tsv', tsv.stringify(deck.cards), 'text/tab-separated-values');
    });
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---- 取り込み ---------------------------------------------------- */

  var parsed = null;

  function openImport() {
    parsed = null;
    $('import-name').value = '';
    $('import-text').value = '';
    $('import-status').textContent = '';
    $('import-preview').textContent = '';
    $('btn-import-go').disabled = true;
    show('import');
  }

  function fillLangSelect() {
    var sel = $('import-lang');
    sel.textContent = '';
    Object.keys(library.LANGS).forEach(function (code) {
      if (code === 'ja') return;
      var o = el('option', null, library.LANGS[code].name);
      o.value = code;
      sel.appendChild(o);
    });
  }

  function reviewImport(text, filename) {
    var res = tsv.parse(text);
    parsed = res;
    var status = $('import-status');
    var pv = $('import-preview');
    status.textContent = '';
    pv.textContent = '';

    if (!res.cards.length) {
      status.innerHTML = '<span class="err">読み取れる行がありませんでした。タブ区切り 4 列か確かめてください。</span>';
      $('btn-import-go').disabled = true;
      return;
    }

    if (filename) {
      var guess = tsv.nameFromFile(filename);
      if (!$('import-name').value) $('import-name').value = guess.name;
      if (guess.lang) $('import-lang').value = guess.lang;
      else $('import-lang').value = tsv.detectLang(res.cards);
    } else if (!$('import-lang').dataset.touched) {
      $('import-lang').value = tsv.detectLang(res.cards);
    }

    var msg = '<span class="ok">' + res.cards.length.toLocaleString('ja-JP') + ' 語を読み取りました。</span>';
    if (res.dropped) msg += ' <span class="warn">重複 ' + res.dropped + ' 行はまとめました。</span>';
    if (res.skipped.length) msg += ' <span class="warn">' + res.skipped.length + ' 行は飛ばしました（' + res.skipped[0].reason + ' など）。</span>';
    if (res.delimiter === ',') msg += ' <span class="warn">タブが無いのでカンマ区切りとして読みました。</span>';
    status.innerHTML = msg;

    res.cards.slice(0, 4).forEach(function (c) {
      var d = el('div', 'pv');
      d.appendChild(el('b', null, c.term + ' — ' + c.meaning));
      if (c.example) d.appendChild(el('i', null, c.example));
      pv.appendChild(d);
    });

    $('btn-import-go').disabled = false;
  }

  function bindImport() {
    var ta = $('import-text');
    var timer = null;
    ta.addEventListener('input', function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        var v = ta.value.trim();
        if (!v) {
          parsed = null;
          $('import-status').textContent = '';
          $('import-preview').textContent = '';
          $('btn-import-go').disabled = true;
          return;
        }
        reviewImport(ta.value, null);
      }, 250);
    });

    $('import-lang').addEventListener('change', function (e) { e.target.dataset.touched = '1'; });

    $('btn-pick-file').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) readFile(file);
      e.target.value = '';
    });

    var dz = $('dropzone');
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
    });
    dz.addEventListener('drop', function (e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) readFile(file);
    });

    $('btn-import-go').addEventListener('click', function () {
      if (!parsed || !parsed.cards.length) return;
      var name = $('import-name').value.trim() || '無題のリスト';
      library.addList({ name: name, lang: $('import-lang').value, cards: parsed.cards })
        .then(function (entry) {
          toast(entry.name + ' を取り込みました');
          renderHome();
          stack = ['home'];
          openDeck(entry.id);
        })
        .catch(function (e) { toast('保存できませんでした: ' + e.message); });
    });
  }

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      $('import-text').value = String(reader.result).slice(0, 4000000);
      reviewImport(String(reader.result), file.name);
    };
    reader.onerror = function () { toast('ファイルを読めませんでした'); };
    reader.readAsText(file, 'utf-8');
  }

  /* ---- 学習 -------------------------------------------------------- */

  var st = {
    session: null,
    stages: [],
    stage: 0,
    paused: false,
    links: [],
    speaking: false,
    timer: null,
    seq: 0,
    wakeLock: null
  };

  /** いまの設定を plan に渡す形にする */
  function planOpts() {
    return {
      mode: settings.mode,
      direction: settings.direction,
      ttsPlan: settings.ttsPlan,
      lang: deck ? library.langInfo(deck.meta.lang).speech : 'en-US',
      ja: library.langInfo('ja').speech
    };
  }

  function stagesFor(card) {
    return plan.stages(card, planOpts());
  }

  function startStudy() {
    if (!deck) return;
    var session = Session.create({
      cards: deck.cards,
      progress: deck.progress,
      setSize: settings.setSize,
      scope: settings.scope,
      order: settings.order
    });
    if (!session.start()) {
      toast('出題できる語がありません');
      return;
    }
    st.session = session;
    st.paused = false;
    speech.unlock();
    markStudiedToday();
    requestWakeLock();
    show('study');
    var quick = settings.mode === 'quick';
    $('card').classList.toggle('dir-mf', settings.direction === 'meaning-first');
    $('card').classList.toggle('dir-ef', !quick && settings.direction === 'example-first');
    $('card').classList.toggle('quick', quick);
    if (!settings.coachSeen) {
      $('coach').hidden = false;
    } else {
      $('coach').hidden = true;
    }
    renderCard(true);
  }

  function stopStudy() {
    clearTimer();
    speech.cancel();
    releaseWakeLock();
  }

  function clearTimer() {
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    var f = $('timer-fill');
    f.style.transition = 'none';
    f.style.width = '0%';
  }

  function requestWakeLock() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      st.wakeLock = lock;
      lock.addEventListener('release', function () { st.wakeLock = null; });
    }).catch(function () {});
  }

  function releaseWakeLock() {
    if (st.wakeLock) { try { st.wakeLock.release(); } catch (e) {} st.wakeLock = null; }
  }

  function currentCard() {
    var cur = st.session && st.session.current();
    return cur ? cur.card : null;
  }

  /**
   * 例文の中の「おまけの語」——リストには入っていないが、
   * この文のついでに覚えてしまいたい語（TSV の 5 列目）。
   */
  function linksFor(id, card) {
    if (!plan.showsExample(planOpts())) return [];
    if (!settings.highlightLinks || !card.example || !card.extras || !card.extras.length) return [];
    return links.findExtras(card.example, card.extras, deck.meta.lang);
  }

  /** 例文を描く。おまけの語には下線を引く */
  function paintExample(card, hits) {
    var node = $('line-example');
    node.textContent = '';
    var text = card.example || '';
    if (!text) return;
    if (!settings.highlightLinks || !hits || !hits.length) {
      node.textContent = text;
      return;
    }
    links.split(text, hits).forEach(function (part) {
      if (part.id === null) node.appendChild(document.createTextNode(part.text));
      else node.appendChild(el('span', 'link', part.text));
    });
  }

  /**
   * カードの空きいっぱいまで文字を大きくする。
   *
   * 画面の縦横は端末と持ち方で変わるうえ、語の長さも例文の長さもまちまちなので、
   * CSS の決め打ちでは「短い語なのに小さい」「長い例文がはみ出す」が避けられない。
   * ここでは入る大きさを実際に測って二分探索で決める。
   */
  var FIT_MIN = 18;
  var FIT_MAX = 150;

  function fitCard() {
    var stage = $('stage');
    var card = $('card');
    var inner = card.firstElementChild;
    if (!inner) return;

    // 入る大きさはステージの内側で決まる。カード自身の高さは中身につられて
    // 伸びてしまうので、基準にしてはいけない
    var cs = getComputedStyle(stage);
    var availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var availW = Math.min(
      stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      card.clientWidth
    );
    if (availH < 40 || availW < 40) return;

    var hi = Math.max(FIT_MIN + 1, Math.min(FIT_MAX, availH * 0.62));
    var lo = FIT_MIN;
    var best = FIT_MIN;

    var fits = function (size) {
      card.style.setProperty('--lead', size.toFixed(1) + 'px');
      return inner.scrollHeight <= availH && inner.scrollWidth <= availW + 1;
    };

    if (fits(hi)) {
      best = hi;
    } else {
      for (var i = 0; i < 8; i++) {
        var mid = (lo + hi) / 2;
        if (fits(mid)) { best = mid; lo = mid; } else { hi = mid; }
      }
    }
    card.style.setProperty('--lead', best.toFixed(1) + 'px');
  }

  /** 「この例文でついでに覚える語」の行 */
  function paintLinkNotes(hits) {
    var node = $('line-links');
    node.textContent = '';
    hits.forEach(function (h) {
      var item = el('span');
      item.appendChild(el('b', null, h.term));
      item.appendChild(document.createTextNode(h.meaning || ''));
      node.appendChild(item);
    });
  }

  function renderCard(fresh) {
    var cur = st.session && st.session.current();
    if (!cur) return finishStudy();

    var c = cur.card;
    if (fresh) {
      st.stages = stagesFor(c);
      st.stage = 0;
    }

    $('line-term').textContent = c.term;
    $('line-reading').textContent = c.reading || '';
    $('line-meaning').textContent = c.meaning;
    $('line-example-ja').textContent = c.exampleJa || '';
    if (fresh) st.links = linksFor(cur.id, c);
    paintExample(c, st.links);

    var shown = st.stages.slice(0, st.stage + 1);
    ['term', 'meaning', 'example'].forEach(function (role) {
      var node = $('line-' + role);
      node.classList.remove('is-lead', 'is-sub');
      var at = shown.indexOf(role);
      if (at === -1) return;
      node.classList.add(at === st.stage ? 'is-lead' : 'is-sub');
    });
    var readingNode = $('line-reading');
    readingNode.classList.remove('is-lead', 'is-sub');
    if (c.reading && shown.indexOf('term') !== -1 && st.stages[st.stage] === 'term') readingNode.classList.add('is-sub');

    var ejNode = $('line-example-ja');
    ejNode.classList.remove('is-lead', 'is-sub');
    // 例文から始める並びでは、単語が出るまで例文の訳は伏せておく（答えが先に見えてしまうため）
    var ejReady = shown.indexOf('example') !== -1 &&
      (settings.direction !== 'example-first' || st.stage > 0);
    if (settings.showExampleJa && c.exampleJa && ejReady) ejNode.classList.add('is-sub');

    // 例文の中で見つけた他の単語は、訳まで進んだところで意味を添える
    var linkNode = $('line-links');
    var showLinks = plan.showsExample(planOpts()) && settings.highlightLinks &&
      st.links && st.links.length &&
      shown.indexOf('example') !== -1 && st.stage === st.stages.length - 1;
    linkNode.classList.toggle('show', !!showLinks);
    if (showLinks) paintLinkNotes(st.links);

    // 点と進み具合
    var dots = $('dots');
    dots.textContent = '';
    for (var i = 0; i < st.stages.length; i++) {
      var d = el('i');
      if (i <= st.stage) d.className = 'on';
      dots.appendChild(d);
    }
    var total = st.session.setTotal();
    var left = st.session.setLeft();
    var rest = st.session.remaining();
    $('setbar-fill').style.width = (total ? Math.round((1 - left / total) * 100) : 0) + '%';
    $('study-count').textContent = rest ? left + ' ＋' + rest : String(left);

    $('btn-fav').classList.toggle('active', !!cur.progress.fav);
    $('card').classList.toggle('paused', st.paused);

    fitCard();

    // 操作の説明を出している間は、読み上げも自動めくりも始めない
    if (!st.paused && $('coach').hidden) playStage();
  }

  /** いまの段階で読み上げる内容 */
  function speechSteps() {
    if (!settings.tts) return [];
    var c = currentCard();
    if (!c) return [];
    return plan.speech(c, st.stages[st.stage], planOpts());
  }

  function playStage() {
    clearTimer();
    var mySeq = ++st.seq;
    var steps = speechSteps();

    var run = function (i) {
      if (mySeq !== st.seq || st.paused) return;
      if (i >= steps.length) return afterSpeech(mySeq);
      speech.speak(steps[i].t, steps[i].l).then(function () {
        run(i + 1);
      }, function () { /* 取り消し */ });
    };

    if (steps.length) run(0);
    else afterSpeech(mySeq);
  }

  function afterSpeech(mySeq) {
    if (mySeq !== st.seq || st.paused) return;
    var last = st.stage >= st.stages.length - 1;
    // 最後の段階なら「自動送り（次の単語へ）」、途中なら「自動めくり」
    if (last ? !settings.autoNext : !settings.autoFlip) return;
    var quick = settings.mode === 'quick';
    var delay = last
      ? (quick ? settings.quickNextDelay : settings.nextDelay)
      : (quick ? settings.quickFlipDelay : settings.flipDelay);
    var ms = Math.max(250, delay * 1000);
    var f = $('timer-fill');
    f.style.transition = 'none';
    f.style.width = '0%';
    // 次のフレームで幅を伸ばす
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (mySeq !== st.seq || st.paused) return;
        f.style.transition = 'width ' + ms + 'ms linear';
        f.style.width = '100%';
      });
    });
    st.timer = setTimeout(function () {
      if (mySeq !== st.seq || st.paused) return;
      nextStage(true);
    }, ms);
  }

  function nextStage(auto) {
    if (st.stage < st.stages.length - 1) {
      st.stage++;
      renderCard(false);
    } else if (auto) {
      // 判定しないまま最後まで見た → 記録せず次の単語へ
      st.session.skip();
      renderCard(true);
    } else {
      // 手で最後までめくったら読み上げをもう一度
      playStage();
    }
  }

  function judge(kind) {
    if (!st.session || !st.session.current()) return;
    clearTimer();
    speech.cancel();
    st.seq++;
    var stage = $('stage');
    stage.classList.remove('flash-good', 'flash-bad');
    void stage.offsetWidth;
    stage.classList.add(kind === 'known' ? 'flash-good' : 'flash-bad');
    flyCard(kind === 'known' ? 'up' : 'down', function () {
      if (kind === 'known') st.session.known();
      else st.session.unknown();
      library.saveProgress(deck.meta.id, deck.progress);
      renderCard(true);
    });
  }

  function flyCard(dir, done) {
    var card = $('card');
    var dy = dir === 'up' ? -window.innerHeight * 0.5 : window.innerHeight * 0.5;
    card.classList.add('animating');
    card.style.transform = 'translateY(' + dy + 'px)';
    card.style.opacity = '0';
    setTimeout(function () {
      card.style.transition = 'none';
      card.style.transform = '';
      card.style.opacity = '';
      done();
      requestAnimationFrame(function () {
        card.style.transition = '';
        card.classList.remove('animating');
      });
    }, 200);
  }

  function togglePause(force) {
    st.paused = force === undefined ? !st.paused : force;
    st.seq++;
    clearTimer();
    speech.cancel();
    $('card').classList.toggle('paused', st.paused);
    $('btn-pause').innerHTML = '<svg><use href="#i-' + (st.paused ? 'play' : 'pause') + '"/></svg>';
    if (!st.paused) playStage();
  }

  function finishStudy() {
    clearTimer();
    speech.cancel();
    releaseWakeLock();
    var s = st.session ? st.session.stats() : { answered: 0, correct: 0, learned: 0, sets: 0, elapsed: 0, accuracy: 0 };
    library.saveProgress(deck.meta.id, deck.progress, true);

    var total = deck.cards.length;
    var learned = countLearned(deck.progress);
    $('result-title').textContent = st.session && st.session.remaining() === 0 && learned >= total
      ? 'リストを全部覚えました'
      : 'おつかれさま';

    var mins = Math.round(s.elapsed / 60000);
    var grid = $('result-grid');
    grid.textContent = '';
    [[s.learned, '覚えた語'], [Math.round(s.accuracy * 100) + '%', '正答率'],
     [s.answered, '判定した回数'], [(mins < 1 ? '1 分未満' : mins + ' 分'), '学習時間'],
     [learned + ' / ' + total, 'リスト全体'], [(stats.streak || 0) + ' 日', '連続学習']]
      .forEach(function (p) {
        var d = el('div');
        d.appendChild(el('b', null, String(p[0])));
        d.appendChild(el('span', null, p[1]));
        grid.appendChild(d);
      });

    $('btn-result-again').disabled = scopeCount(settings.scope) === 0;
    renderHome();
    show('result', { replace: true });
  }

  function quitStudy() {
    if (deck) library.saveProgress(deck.meta.id, deck.progress, true);
    st.session = null;
    stopStudy();
    renderHome();
    renderDeck();
    show('deck', { replace: true });
  }

  function bindStudy() {
    var card = $('card');
    var stage = $('stage');

    gesture.attach(stage, {
      onTap: function () {
        if (!$('coach').hidden) return;
        if (st.paused) return togglePause(false);
        nextStage(false);
      },
      onLongPress: function () {
        if (!$('coach').hidden) return;
        togglePause();
        if (navigator.vibrate) navigator.vibrate(12);
      },
      onDrag: function (dx, dy) {
        var adx = Math.abs(dx), ady = Math.abs(dy);
        card.style.transform = 'translate(' + dx * 0.5 + 'px,' + dy * 0.6 + 'px) rotate(' + (dx * 0.012) + 'deg)';
        stage.classList.toggle('cue-up-on', ady > adx && dy < -24);
        stage.classList.toggle('cue-down-on', ady > adx && dy > 24);
      },
      onDragEnd: function () {
        card.style.transform = '';
        stage.classList.remove('cue-up-on', 'cue-down-on');
      },
      onSwipe: function (dir) {
        if (!$('coach').hidden) return;
        if (dir === 'up') judge('known');
        else if (dir === 'down') judge('unknown');
        else if (dir === 'left') { clearTimer(); speech.cancel(); st.seq++; st.session.skip(); renderCard(true); }
        else if (dir === 'right') {
          clearTimer(); speech.cancel(); st.seq++;
          if (st.session.back()) renderCard(true);
        }
      }
    });

    $('btn-pause').addEventListener('click', function () { togglePause(); });
    $('btn-sound').addEventListener('click', function () {
      settings.tts = !settings.tts;
      saveSettings();
      updateSoundIcon();
      speech.cancel();
      st.seq++;
      if (!st.paused) playStage();
    });
    $('btn-fav').addEventListener('click', function () {
      if (!st.session) return;
      var on = st.session.toggleFav();
      $('btn-fav').classList.toggle('active', on);
      library.saveProgress(deck.meta.id, deck.progress);
    });
    $('btn-quit').addEventListener('click', quitStudy);
    $('btn-coach-ok').addEventListener('click', function () {
      $('coach').hidden = true;
      settings.coachSeen = true;
      saveSettings();
      speech.unlock();
      renderCard(false);
    });

    document.addEventListener('keydown', function (e) {
      if (!document.querySelector('.view.on') || document.querySelector('.view.on').dataset.view !== 'study') return;
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      var k = e.key;
      if (k === ' ' || k === 'Enter') { e.preventDefault(); nextStage(false); }
      else if (k === 'ArrowUp' || k === '2') { e.preventDefault(); judge('known'); }
      else if (k === 'ArrowDown' || k === '1') { e.preventDefault(); judge('unknown'); }
      else if (k === 'ArrowLeft') { e.preventDefault(); st.seq++; clearTimer(); speech.cancel(); if (st.session.back()) renderCard(true); }
      else if (k === 'ArrowRight') { e.preventDefault(); st.seq++; clearTimer(); speech.cancel(); st.session.skip(); renderCard(true); }
      else if (k === 'p' || k === 'P') togglePause();
      else if (k === 'Escape') quitStudy();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && st.session) togglePause(true);
    });

    // 向きを変えたり、アドレスバーの出入りで高さが変わったら測り直す
    var refit = null;
    var scheduleFit = function () {
      if (!st.session) return;
      if (refit) clearTimeout(refit);
      refit = setTimeout(function () { refit = null; fitCard(); }, 120);
    };
    global.addEventListener('resize', scheduleFit);
    global.addEventListener('orientationchange', function () {
      scheduleFit();
      setTimeout(fitCard, 400);
    });
  }

  function updateSoundIcon() {
    $('btn-sound').innerHTML = '<svg><use href="#i-sound-' + (settings.tts ? 'on' : 'off') + '"/></svg>';
    $('btn-sound').classList.toggle('off', !settings.tts);
  }

  /* ---- 結果画面 ---------------------------------------------------- */

  function bindResult() {
    $('btn-result-home').addEventListener('click', function () {
      renderDeck();
      show('deck', { replace: true });
    });
    $('btn-result-again').addEventListener('click', function () {
      renderDeck();
      startStudy();
    });
  }

  /* ---- 設定画面 ---------------------------------------------------- */

  function renderSettings() {
    document.querySelectorAll('#theme-picker button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.theme === settings.theme);
    });
    $('set-order').value = settings.order;
    $('set-mode').value = settings.mode;
    $('set-direction').value = settings.direction;
    $('set-show-example-ja').checked = settings.showExampleJa;
    $('set-links').checked = settings.highlightLinks;
    $('set-tts').checked = settings.tts;
    $('set-tts-plan').value = settings.ttsPlan;
    $('set-rate').value = settings.rate;
    $('rate-out').textContent = Number(settings.rate).toFixed(2).replace(/0$/, '');
    $('set-auto-flip').checked = settings.autoFlip;
    $('set-flip-delay').value = settings.flipDelay;
    $('flip-delay-out').textContent = settings.flipDelay.toFixed(1) + ' 秒';
    $('set-auto-next').checked = settings.autoNext;
    $('set-next-delay').value = settings.nextDelay;
    $('next-delay-out').textContent = settings.nextDelay.toFixed(1) + ' 秒';
    $('set-quick-flip').value = settings.quickFlipDelay;
    $('quick-flip-out').textContent = settings.quickFlipDelay.toFixed(1) + ' 秒';
    $('set-quick-next').value = settings.quickNextDelay;
    $('quick-next-out').textContent = settings.quickNextDelay.toFixed(1) + ' 秒';
    renderVoiceFields();
    $('storage-note').textContent = '保存先: ' + (store.usingIndexedDb() ? 'IndexedDB' : 'localStorage') +
      (speech.supported ? '' : ' · この端末では読み上げが使えません');
  }

  function renderVoiceFields() {
    var box = $('voice-fields');
    box.textContent = '';
    if (!speech.supported) return;
    var used = {};
    library.lists().forEach(function (l) { used[l.lang] = true; });
    used.ja = true;
    Object.keys(used).forEach(function (code) {
      var list = speech.voicesFor(library.langInfo(code).speech);
      if (!list.length) return;
      var label = el('label', 'field row');
      label.appendChild(el('span', null, library.langInfo(code).name + 'の声'));
      var sel = el('select');
      var auto = el('option', null, '自動');
      auto.value = '';
      sel.appendChild(auto);
      list.forEach(function (v) {
        var o = el('option', null, v.name + '（' + v.lang + '）');
        o.value = v.voiceURI;
        sel.appendChild(o);
      });
      sel.value = settings.voices[code] || '';
      sel.addEventListener('change', function () {
        settings.voices[code] = sel.value;
        speech.setVoice(library.langInfo(code).speech, sel.value);
        saveSettings();
        if (sel.value) speech.speak(code === 'ja' ? 'テスト' : 'test', library.langInfo(code).speech);
      });
      label.appendChild(sel);
      box.appendChild(label);
    });
  }

  function bindSettings() {
    $('btn-settings').addEventListener('click', function () {
      renderSettings();
      show('settings');
    });
    document.querySelectorAll('#theme-picker button').forEach(function (b) {
      b.addEventListener('click', function () {
        settings.theme = b.dataset.theme;
        applyTheme();
        saveSettings();
        renderSettings();
      });
    });
    $('set-order').addEventListener('change', function (e) { settings.order = e.target.value; saveSettings(); });
    $('set-mode').addEventListener('change', function (e) { settings.mode = e.target.value; saveSettings(); });
    $('set-direction').addEventListener('change', function (e) { settings.direction = e.target.value; saveSettings(); });
    $('set-show-example-ja').addEventListener('change', function (e) { settings.showExampleJa = e.target.checked; saveSettings(); });
    $('set-links').addEventListener('change', function (e) { settings.highlightLinks = e.target.checked; saveSettings(); });
    $('set-tts').addEventListener('change', function (e) { settings.tts = e.target.checked; saveSettings(); updateSoundIcon(); });
    $('set-tts-plan').addEventListener('change', function (e) { settings.ttsPlan = e.target.value; saveSettings(); });
    $('set-rate').addEventListener('input', function (e) {
      settings.rate = Number(e.target.value);
      speech.setRate(settings.rate);
      $('rate-out').textContent = settings.rate.toFixed(2).replace(/0$/, '');
      saveSettings();
    });
    $('set-auto-flip').addEventListener('change', function (e) { settings.autoFlip = e.target.checked; saveSettings(); });
    $('set-flip-delay').addEventListener('input', function (e) {
      settings.flipDelay = Number(e.target.value);
      $('flip-delay-out').textContent = settings.flipDelay.toFixed(1) + ' 秒';
      saveSettings();
    });
    $('set-auto-next').addEventListener('change', function (e) { settings.autoNext = e.target.checked; saveSettings(); });
    $('set-next-delay').addEventListener('input', function (e) {
      settings.nextDelay = Number(e.target.value);
      $('next-delay-out').textContent = settings.nextDelay.toFixed(1) + ' 秒';
      saveSettings();
    });
    $('set-quick-flip').addEventListener('input', function (e) {
      settings.quickFlipDelay = Number(e.target.value);
      $('quick-flip-out').textContent = settings.quickFlipDelay.toFixed(1) + ' 秒';
      saveSettings();
    });
    $('set-quick-next').addEventListener('input', function (e) {
      settings.quickNextDelay = Number(e.target.value);
      $('quick-next-out').textContent = settings.quickNextDelay.toFixed(1) + ' 秒';
      saveSettings();
    });

    $('btn-backup').addEventListener('click', function () {
      library.exportAll().then(function (data) {
        download('flashcards-backup-' + todayKey() + '.json', JSON.stringify(data), 'application/json');
      });
    });
    $('btn-restore').addEventListener('click', function () { $('restore-file').click(); });
    $('restore-file').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(String(reader.result));
          library.importAll(data).then(function () {
            return store.get('settings');
          }).then(function (s) {
            if (s) settings = Object.assign({}, DEFAULTS, s);
            applyTheme();
            return library.loadAllProgress();
          }).then(function () {
            renderHome();
            renderSettings();
            toast('読み込みました');
          });
        } catch (err) {
          toast('読み込めませんでした');
        }
      };
      reader.readAsText(file, 'utf-8');
    });
    $('btn-coach-again').addEventListener('click', function () {
      settings.coachSeen = false;
      saveSettings();
      toast('次の学習で操作の説明を表示します');
    });
    $('btn-wipe').addEventListener('click', function () {
      if (!confirm('取り込んだリストも進み具合も、すべて消します。よろしいですか？')) return;
      store.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return store.del(k); }));
      }).then(function () { location.reload(); });
    });
  }

  /* ---- 立ち上げ ---------------------------------------------------- */

  function bindCommon() {
    document.querySelectorAll('[data-back]').forEach(function (b) {
      b.addEventListener('click', back);
    });
    $('btn-import').addEventListener('click', openImport);
    global.addEventListener('pagehide', function () { store.flush(); });
    global.addEventListener('beforeunload', function () { store.flush(); });
  }

  function boot() {
    fillLangSelect();
    bindCommon();
    bindDeck();
    bindCards();
    bindImport();
    bindStudy();
    bindResult();
    bindSettings();

    Promise.all([store.get('settings'), store.get('stats'), library.load()])
      .then(function (r) {
        if (r[0]) settings = Object.assign({}, DEFAULTS, migrateSettings(r[0]));
        if (r[1]) stats = Object.assign({ days: {}, streak: 0, last: '' }, r[1]);
        applyTheme();
        speech.setRate(settings.rate);
        updateSoundIcon();
        return library.loadAllProgress();
      })
      .then(function () {
        renderHome();
        stack = ['home'];
        render('home');
        return speech.init();
      })
      .then(function () {
        Object.keys(settings.voices || {}).forEach(function (code) {
          speech.setVoice(library.langInfo(code).speech, settings.voices[code]);
        });
      })
      .catch(function (e) {
        console.error(e);
        toast('起動に失敗しました: ' + e.message);
        render('home');
      });

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
