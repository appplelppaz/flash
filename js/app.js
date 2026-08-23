/**
 * 画面の描画とイベント処理。
 */
(function () {
  'use strict';

  var Decks = window.Decks;
  var Storage = window.AppStorage;
  var Study = window.Study;

  var SCREENS = ['home', 'deck', 'study', 'result', 'list', 'edit', 'settings'];

  var TITLES = {
    home: 'FLASHCARDS',
    deck: '学習の設定',
    study: '学習中',
    result: '結果',
    list: '単語一覧',
    edit: '単語の編集',
    settings: '設定'
  };

  var SCOPE_LABELS = { all: 'すべて', weak: '苦手のみ', fav: '★ のみ' };

  var el = {};
  function $(id) {
    if (!el[id]) el[id] = document.getElementById(id);
    return el[id];
  }

  var state = {
    screen: 'home',
    history: [],
    settings: Storage.loadSettings(),
    decks: [],
    deck: null,
    list: null,
    session: null,
    steps: [],
    stepIndex: 0,
    autoTimer: null,
    autoPaused: false,
    scope: 'all',
    filter: 'all',
    query: '',
    editing: null, // { listId, term } 編集中の自作単語
    listLimit: 0   // 単語一覧で表示している件数
  };

  // ---------- 共通ユーティリティ ----------

  var LIST_PAGE = 200; // 単語一覧は 200 語ずつ描画する（3000 語のリストでも重くならないように）

  function refreshDecks() {
    state.decks = Decks.withCustom(Storage.loadCustomWords());
    if (state.deck) {
      state.deck = state.decks.filter(function (d) { return d.id === state.deck.id; })[0] || null;
    }
    if (state.deck) state.list = selectedList(state.deck, state.list && state.list.id);
    else state.list = null;
  }

  /** その言語で選ばれている単語リスト（未選択なら既定のリスト） */
  function selectedList(deck, preferredId) {
    if (!deck || !deck.lists.length) return null;
    var ids = deck.lists.map(function (list) { return list.id; });
    var wanted = preferredId && ids.indexOf(preferredId) >= 0
      ? preferredId
      : Storage.selectedListId(deck.id, deck.defaultListId, ids);
    return deck.lists.filter(function (list) { return list.id === wanted; })[0] || deck.lists[0];
  }

  function listStats(list, progress) {
    var stats = progress || Storage.loadProgress();
    var learned = 0;
    var weak = 0;
    if (!list) return { total: 0, learned: 0, weak: 0 };
    list.words.forEach(function (word) {
      var stat = stats[word.id];
      if (!stat) return;
      if (stat.learned) learned++;
      else if (stat.wrong > 0) weak++;
    });
    return { total: list.words.length, learned: learned, weak: weak };
  }

  function applyTheme() {
    var theme = state.settings.theme;
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function formatDuration(ms) {
    var seconds = Math.max(0, Math.round(ms / 1000));
    var minutes = Math.floor(seconds / 60);
    return minutes ? minutes + ' 分 ' + (seconds % 60) + ' 秒' : seconds + ' 秒';
  }

  /** 判定したことを、文字ではなく色のまたたきで返す */
  function flashCard(kind) {
    var card = $('card');
    card.classList.remove('is-correct', 'is-wrong');
    void card.offsetWidth; // アニメーションをやり直させる
    card.classList.add(kind);
    setTimeout(function () { card.classList.remove(kind); }, 320);
  }

  // ---------- 読み上げ ----------

  var speechToken = 0;      // 古い読み上げ列を無効化するための世代番号
  var speechFallback = null; // onend が来ない環境のための保険

  function stopSpeaking() {
    speechToken++;
    if (speechFallback) {
      clearTimeout(speechFallback);
      speechFallback = null;
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (err) { /* noop */ }
    }
  }

  /**
   * 複数の文を順番に読み上げ、すべて終わったら onDone を呼ぶ。
   * @param {Array} items [{ text, ja }] ja が true なら日本語で読む
   */
  function speakSequence(items, onDone) {
    stopSpeaking();
    var done = onDone || function () {};
    var queue = (items || []).filter(function (item) { return item && item.text; });

    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance || !queue.length) {
      done();
      return;
    }

    var token = speechToken;
    var index = 0;
    var finished = false;

    function finish() {
      if (finished || token !== speechToken) return;
      finished = true;
      if (speechFallback) {
        clearTimeout(speechFallback);
        speechFallback = null;
      }
      done();
    }

    function next() {
      if (token !== speechToken) return;
      if (index >= queue.length) {
        finish();
        return;
      }
      var item = queue[index++];
      try {
        var utterance = new window.SpeechSynthesisUtterance(item.text);
        utterance.lang = item.ja ? 'ja-JP' : ((state.deck && state.deck.lang) || 'en-US');
        utterance.rate = 0.95;
        utterance.onend = next;
        utterance.onerror = next;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        next();
      }
    }

    // 読み上げが返ってこない環境でも先に進めるようにする
    speechFallback = setTimeout(finish, 4000 + queue.length * 7000);
    next();
  }

  // ---------- 画面遷移 ----------

  function showScreen(name, options) {
    var opts = options || {};
    if (!opts.replace && state.screen !== name) state.history.push(state.screen);
    state.screen = name;

    if (name !== 'study') {
      clearAutoTimer();
      stopSpeaking();
    }

    // 学習画面だけはビューポート全体を使う（横画面で画面いっぱいに表示するため）
    document.body.classList.toggle('is-study', name === 'study');

    SCREENS.forEach(function (screen) {
      document.getElementById('screen-' + screen).hidden = (screen !== name);
    });
    $('topbar-title').textContent = TITLES[name] || 'Flashcards';
    $('back-btn').hidden = (name === 'home');
    $('settings-btn').hidden = (name === 'settings' || name === 'study');
    window.scrollTo(0, 0);
  }

  function goBack() {
    if (state.screen === 'study' && state.session && !state.session.isComplete()) {
      clearAutoTimer();
      if (!window.confirm('学習を中断しますか？ 途中の結果は記録されません。')) {
        scheduleAuto();
        return;
      }
      state.session = null;
    }
    if (state.screen === 'settings') applySettingsForm();

    var target = state.history.pop() || 'home';
    if (target === 'study') target = 'deck';       // 学習画面には戻らない
    if (target === 'edit') target = 'list';

    renderScreen(target);
    showScreen(target, { replace: true });
  }

  function renderScreen(name) {
    if (name === 'home') renderHome();
    if (name === 'deck') renderDeck();
    if (name === 'list') renderList();
    if (name === 'settings') fillSettingsForm();
  }

  // ---------- ホーム ----------

  function renderHome() {
    refreshDecks();
    var progress = Storage.loadProgress();
    var stats = Storage.loadStats();

    var learnedTotal = 0;
    state.decks.forEach(function (deck) {
      deck.lists.forEach(function (list) {
        learnedTotal += listStats(list, progress).learned;
      });
    });

    $('stat-learned').textContent = learnedTotal;
    $('stat-streak').textContent = stats.streakDays;
    $('stat-accuracy').textContent = stats.answered
      ? Math.round((stats.correct / stats.answered) * 100) + '%'
      : '—';

    var list = $('deck-list');
    list.innerHTML = '';

    state.decks.forEach(function (deck) {
      var current = selectedList(deck);
      var stat = listStats(current, progress);
      var percent = stat.total ? Math.round((stat.learned / stat.total) * 100) : 0;

      var li = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'deck-btn';
      button.innerHTML =
        '<span class="code-chip">' + deck.code + '</span>' +
        '<span class="deck-main">' +
          '<span class="deck-name">' + deck.name + '</span>' +
          '<span class="deck-list-name">' + escapeHtml(current ? current.name : 'リストがありません') + '</span>' +
          '<span class="deck-meta">' + stat.total + ' 語 · 学習済み ' + stat.learned + ' · ' + percent + '%</span>' +
          '<span class="deck-line"><span style="width:' + percent + '%"></span></span>' +
        '</span>' +
        '<span class="chev">›</span>';
      button.addEventListener('click', function () { openDeck(deck.id); });
      li.appendChild(button);
      list.appendChild(li);
    });
  }

  // ---------- デッキ（学習の設定） ----------

  function openDeck(deckId) {
    refreshDecks();
    state.deck = state.decks.filter(function (d) { return d.id === deckId; })[0] || null;
    if (!state.deck) return;
    state.list = selectedList(state.deck);
    state.scope = 'all';
    $('deck-word-count').value = Math.min(state.settings.wordCount, state.list ? state.list.words.length : 1);
    renderDeck();
    showScreen('deck');
  }

  /** 単語リストを切り替えて、その言語の選択として保存する */
  function selectList(listId) {
    if (!state.deck) return;
    Storage.saveSelectedList(state.deck.id, listId);
    state.list = selectedList(state.deck, listId);
    state.scope = 'all';
    $('deck-word-count').value = Math.min(state.settings.wordCount, state.list ? state.list.words.length : 1);
    renderDeck();
  }

  /**
   * 出題の対象になる単語。
   * 〇 をつけた（＝学習済みの）単語は、もう出さないので必ず外す。
   */
  function scopeWords() {
    var list = state.list;
    if (!list) return [];
    var progress = Storage.loadProgress();

    var pool;
    if (state.scope === 'weak') {
      pool = Study.weakWords(list.words, progress);
    } else if (state.scope === 'fav') {
      var favorites = Storage.loadFavorites();
      pool = list.words.filter(function (word) { return favorites[word.id]; });
    } else {
      pool = list.words;
    }

    return pool.filter(function (word) {
      var stat = progress[word.id];
      return !(stat && stat.learned);
    });
  }

  function renderDeck() {
    var deck = state.deck;
    if (!deck) return;

    var stat = listStats(state.list);
    var percent = stat.total ? (stat.learned / stat.total) * 100 : 0;

    $('deck-code').textContent = deck.code;
    $('deck-name').textContent = deck.name;
    $('deck-sub').textContent = stat.learned + ' / ' + stat.total + ' 語 学習済み';
    $('deck-meter-fill').style.width = percent + '%';

    renderListSelect(deck);

    Array.prototype.forEach.call($('scope-group').children, function (button) {
      button.classList.toggle('is-active', button.dataset.scope === state.scope);
    });

    var available = scopeWords().length;
    $('scope-hint').textContent = available + ' 語';

    var max = Math.max(1, available);
    var count = Math.min(deckCount(), max);
    $('deck-word-count').value = count;
    $('deck-word-count').max = max;

    Array.prototype.forEach.call($('count-presets').children, function (chip) {
      var value = chip.dataset.count === 'all' ? max : parseInt(chip.dataset.count, 10);
      chip.classList.toggle('is-active', value === count);
      chip.disabled = chip.dataset.count !== 'all' && value > max;
    });

    $('start-btn').disabled = available === 0;
    $('start-btn').textContent = available === 0 ? '対象の単語がありません' : '学習を開始';
  }

  /** 単語リストの選択欄。既定のリストには「既定」を付ける */
  function renderListSelect(deck) {
    var select = $('list-select');
    select.innerHTML = '';
    deck.lists.forEach(function (list) {
      var option = document.createElement('option');
      option.value = list.id;
      option.textContent = list.name + '（' + list.words.length + ' 語）' +
        (list.id === deck.defaultListId ? ' · 既定' : '');
      select.appendChild(option);
    });
    select.value = state.list ? state.list.id : '';
    select.disabled = deck.lists.length < 2;
  }

  function deckCount() {
    var value = parseInt($('deck-word-count').value, 10);
    if (isNaN(value)) value = state.settings.wordCount;
    return Math.max(1, value);
  }

  // ---------- 学習 ----------

  function startSession() {
    var pool = scopeWords();
    if (!pool.length) return;

    var count = Math.min(deckCount(), pool.length);
    var words = Study.pickWords(pool, count, {
      order: state.settings.order,
      progress: Storage.loadProgress()
    });

    state.session = new Study.StudySession({
      words: words,
      // 〇 をつけたらその場で学習済み（もう出さない）
      requiredStreak: 1,
      direction: state.settings.direction
    });
    state.autoPaused = false;
    $('card').classList.remove('is-paused');

    showScreen('study');
    renderAutoButton();
    renderCard();
  }

  /** 進み具合は細いメーターだけで示す（文字では出さない） */
  function renderStudyProgress() {
    var stats = state.session.stats();
    var percent = stats.total ? (stats.learned / stats.total) * 100 : 0;
    $('study-meter-fill').style.width = percent + '%';
  }

  /** カードを最初の段階（単語）から表示する */
  function renderCard() {
    var session = state.session;
    if (!session) return;

    renderStudyProgress();

    if (!session.current()) {
      finishSession();
      return;
    }

    state.steps = session.currentSteps();
    state.stepIndex = 0;
    renderSteps();
  }

  /** いま何段階目かを示す点。段階を切り替えても現在地が分かるようにする */
  function renderStepDots() {
    var dots = $('card-dots');
    dots.innerHTML = '';
    state.steps.forEach(function (step, index) {
      var dot = document.createElement('span');
      dot.className = 'dot' + (index === state.stepIndex ? ' is-on' : '');
      dot.title = step.label;
      dots.appendChild(dot);
    });
  }

  /**
   * いまの段階だけを描画する。
   * 3 つを並べず 1 つずつ切り替えることで、そのとき見るべきものに集中でき、
   * 1 つあたりの文字も大きく取れる。
   */
  function renderSteps() {
    var container = $('card-steps');
    var step = state.steps[state.stepIndex];
    container.innerHTML = '';

    if (step) {
      var div = document.createElement('div');
      div.className = 'card-step is-current';
      div.dataset.key = step.key;
      div.innerHTML =
        '<p class="step-text">' + escapeHtml(step.text) + '</p>' +
        (step.reading ? '<p class="step-reading">' + escapeHtml(step.reading) + '</p>' : '');
      container.appendChild(div);
    }

    renderStepDots();
    $('card').classList.toggle('is-paused', state.autoPaused);

    var card = state.session.current();
    var favorites = Storage.loadFavorites();
    $('fav-btn').setAttribute('aria-pressed',
      card && favorites[card.word.id] === true ? 'true' : 'false');

    playStep();
  }

  /**
   * いまの段階を再生する。読み上げてから自動送りの計測を始める。
   * 一時停止中は読み上げも計測もせず、その場で止めたままにする。
   */
  function playStep() {
    clearAutoTimer();

    if (state.autoPaused) {
      stopSpeaking();
      return;
    }

    var step = state.steps && state.steps[state.stepIndex];
    if (state.settings.speech && step && step.speech) {
      speakSequence(step.speech, scheduleAuto);
    } else {
      stopSpeaking();
      scheduleAuto();
    }
  }

  /**
   * タップでその場を一時停止し、もう一度タップで再開する。
   * 止めている間は読み上げも自動送りも動かず、表示はそのまま残る。
   */
  function togglePause() {
    state.autoPaused = !state.autoPaused;
    $('card').classList.toggle('is-paused', state.autoPaused);
    renderAutoButton();
    playStep();
  }

  // ---------- 自動めくり ----------

  function clearAutoTimer() {
    if (state.autoTimer) {
      clearTimeout(state.autoTimer);
      state.autoTimer = null;
    }
    var fill = $('card-timer-fill');
    fill.style.transition = 'none';
    fill.style.width = '0%';
    $('card-timer').hidden = true;
  }

  function scheduleAuto() {
    clearAutoTimer();
    if (!state.settings.autoAdvance || state.autoPaused || state.screen !== 'study') return;

    var seconds = state.settings.autoSeconds;
    var timer = $('card-timer');
    var fill = $('card-timer-fill');
    timer.hidden = false;
    fill.style.transition = 'none';
    fill.style.width = '0%';

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        fill.style.transition = 'width ' + seconds + 's linear';
        fill.style.width = '100%';
      });
    });

    state.autoTimer = setTimeout(function () {
      state.autoTimer = null;
      advance({ auto: true });
    }, seconds * 1000);
  }

  var PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5v14M14.5 5v14"/></svg>';
  var PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>';

  function renderAutoButton() {
    var on = state.settings.autoAdvance && !state.autoPaused;
    $('auto-btn').setAttribute('aria-pressed', on ? 'true' : 'false');
    $('auto-btn').innerHTML = on ? PAUSE_ICON : PLAY_ICON;
  }

  function toggleAuto() {
    if (!state.settings.autoAdvance) {
      // 設定でオフの場合はこの場でオンにする
      state.settings = Storage.saveSettings(
        Object.assign({}, state.settings, { autoAdvance: true }));
      state.autoPaused = true; // 直後の togglePause で解除される
    }
    togglePause();
  }

  /**
   * 次の段階へ進む。最後の段階から先へ進むときは、
   * 手動なら何もせず判定を待ち、自動なら記録せずに再出題へまわす。
   */
  function advance(options) {
    var opts = options || {};
    if (!state.session || !state.session.current()) return;

    if (state.stepIndex < state.steps.length - 1) {
      state.stepIndex++;
      renderSteps();
      return;
    }

    if (!opts.auto) return; // 手動では最後の段階で止まり、判定を待つ

    // 一定時間なにも操作されなかったときは、判定せずに次の単語へ移る
    nextWord();
  }

  /** 左スワイプ / ‹ : 直前に見ていた単語に戻る（判定はやり直せる） */
  function prevWord() {
    var session = state.session;
    if (!session) return;
    if (!session.hasPrevious()) return;
    clearAutoTimer();
    stopSpeaking();
    session.previous();
    renderCard();
  }

  /** 右スワイプ / › : 判定せずに次の単語へ（この単語はあとでもう一度出る） */
  function nextWord() {
    var session = state.session;
    if (!session || !session.current()) return;
    clearAutoTimer();
    stopSpeaking();
    session.skip();
    renderCard();
  }

  function judge(isCorrect) {
    var session = state.session;
    if (!session || !session.current()) return;

    clearAutoTimer();
    stopSpeaking();

    var result = session.answer(isCorrect);
    if (!result) return;

    flashCard(isCorrect ? 'is-correct' : 'is-wrong');

    if (result.complete) finishSession();
    else renderCard();
  }

  /**
   * セットを終えたときの処理。
   * 指定した語数すべてに 〇 がついたら、まだ残っている単語で次のセットを始める。
   * もう残っていなければ結果を出す。
   */
  function finishSession() {
    var session = state.session;
    if (!session) return;

    clearAutoTimer();
    stopSpeaking();

    var stats = session.stats();
    var saved = Storage.recordSession(session.cards, stats);

    // 学習済みは scopeWords() から外れるので、残りがあれば次のセットへ
    if (state.screen === 'study' && scopeWords().length) {
      startSession();
      return;
    }

    $('result-sub').textContent = (state.list ? state.list.name : state.deck.name) +
      ' · ' + SCOPE_LABELS[state.scope];
    $('result-total').textContent = stats.learned + ' / ' + stats.total + ' 語';
    $('result-answered').textContent = stats.answered + ' 回';
    $('result-accuracy').textContent = Math.round(stats.accuracy * 100) + '%';
    $('result-time').textContent = formatDuration(stats.elapsedMs);
    $('result-streak').textContent = saved.stats.streakDays + ' 日';

    state.session = null;
    showScreen('result');
  }

  // ---------- ジェスチャー ----------

  // ここまで動かしたらスワイプとみなす距離（px）と、スワイプと認める時間（ms）
  var SWIPE_MIN = 44;
  var SWIPE_MAX_MS = 900;
  // 指の動きをカードに反映させるときの控えめな追従率と、その上限（px）
  var DRAG_RATIO = 0.32;
  var DRAG_MAX = 60;

  var swipe = { id: null, x: 0, y: 0, at: 0, dir: null, handled: false };

  /** 直前のスワイプで click が起きた場合は、その click を無視する */
  function swipeConsumedClick() {
    if (!swipe.handled) return false;
    swipe.handled = false;
    return true;
  }

  function swipeDirection(dx, dy) {
    var adx = Math.abs(dx);
    var ady = Math.abs(dy);
    if (Math.max(adx, ady) < SWIPE_MIN) return null;
    if (ady >= adx) return dy < 0 ? 'up' : 'down';
    return dx < 0 ? 'left' : 'right';
  }

  function armMark(dir) {
    $('correct-btn').classList.toggle('is-armed', dir === 'up');
    $('wrong-btn').classList.toggle('is-armed', dir === 'down');
  }

  function dragCard(dx, dy) {
    var card = $('card');
    function clamp(value) {
      return Math.max(-DRAG_MAX, Math.min(DRAG_MAX, value * DRAG_RATIO));
    }
    if (dx === 0 && dy === 0) {
      card.classList.remove('is-dragging');
      card.style.transform = '';
      return;
    }
    card.classList.add('is-dragging');
    card.style.transform = 'translate(' + clamp(dx) + 'px, ' + clamp(dy) + 'px)';
  }

  function endSwipe() {
    swipe.id = null;
    swipe.dir = null;
    armMark(null);
    dragCard(0, 0);
  }

  /**
   * 上スワイプ = 〇、下スワイプ = ✕、左スワイプ = 前の単語、右スワイプ = 次の単語。
   * 画面上のアイコンの位置と向きをそろえてある。
   */
  function runSwipe(dir) {
    if (dir === 'up') judge(true);
    else if (dir === 'down') judge(false);
    else if (dir === 'left') prevWord();
    else if (dir === 'right') nextWord();
  }

  /**
   * pointerdown だけを面で受け、その後の move / up は window で追う。
   * setPointerCapture を使うと click の宛先が面に移ってしまい、
   * カードや 〇 / ✕ のタップが効かなくなるため、こちらの形にしている。
   */
  function bindGestures(surface) {
    surface.addEventListener('pointerdown', function (event) {
      if (swipe.id !== null) return;
      swipe.id = event.pointerId;
      swipe.x = event.clientX;
      swipe.y = event.clientY;
      swipe.at = Date.now();
      swipe.dir = null;
      swipe.handled = false;
    });

    window.addEventListener('pointermove', function (event) {
      if (swipe.id !== event.pointerId) return;
      var dx = event.clientX - swipe.x;
      var dy = event.clientY - swipe.y;
      swipe.dir = swipeDirection(dx, dy);
      armMark(swipe.dir);
      dragCard(dx, dy);
    });

    window.addEventListener('pointerup', function (event) {
      if (swipe.id !== event.pointerId) return;
      var dir = swipeDirection(event.clientX - swipe.x, event.clientY - swipe.y);
      var inTime = Date.now() - swipe.at <= SWIPE_MAX_MS;
      endSwipe();
      if (!dir || !inTime) return;
      // 続けて起きる click（カードや 〇 / ✕ のタップ）は打ち消す。
      // click が来ない場合もあるので、少し経ったら自分で下ろす。
      swipe.handled = true;
      setTimeout(function () { swipe.handled = false; }, 400);
      runSwipe(dir);
    });

    window.addEventListener('pointercancel', function (event) {
      if (swipe.id === event.pointerId) endSwipe();
    });
  }

  // ---------- 単語一覧 ----------

  function openList() {
    state.query = '';
    state.filter = 'all';
    state.listLimit = LIST_PAGE;
    $('search-input').value = '';
    renderList();
    showScreen('list');
  }

  function visibleWords() {
    var list = state.list;
    if (!list) return [];
    var progress = Storage.loadProgress();
    var favorites = Storage.loadFavorites();
    var query = state.query.trim().toLowerCase();

    return list.words.filter(function (word) {
      var stat = progress[word.id] || { correct: 0, wrong: 0, learned: false };
      if (state.filter === 'learned' && !stat.learned) return false;
      if (state.filter === 'unlearned' && stat.learned) return false;
      if (state.filter === 'weak' && !(stat.wrong > 0 && !stat.learned)) return false;
      if (state.filter === 'fav' && !favorites[word.id]) return false;
      if (!query) return true;
      var haystack = [word.term, word.reading, word.meaning, word.example, word.exampleJa].join(' ');
      return haystack.toLowerCase().indexOf(query) >= 0;
    });
  }

  function renderList() {
    if (!state.list) return;
    var progress = Storage.loadProgress();
    var favorites = Storage.loadFavorites();
    var words = visibleWords();
    var list = $('word-list');
    list.innerHTML = '';

    Array.prototype.forEach.call($('filter-chips').children, function (chip) {
      chip.classList.toggle('is-active', chip.dataset.filter === state.filter);
    });

    if (!state.listLimit) state.listLimit = LIST_PAGE;
    var shown = words.slice(0, state.listLimit);
    $('list-count').textContent = state.list.name + ' · ' + words.length + ' 語' +
      (shown.length < words.length ? '（' + shown.length + ' 語を表示中）' : '');
    $('list-more-btn').hidden = shown.length >= words.length;
    $('list-more-btn').textContent = 'さらに表示（残り ' + (words.length - shown.length) + ' 語）';

    if (!words.length) {
      var empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = '該当する単語がありません。';
      list.appendChild(empty);
      return;
    }

    shown.forEach(function (word) {
      var stat = progress[word.id] || { correct: 0, wrong: 0, learned: false };
      var stateClass = stat.learned ? 'is-learned' : (stat.wrong > 0 ? 'is-weak' : '');
      var isFav = favorites[word.id] === true;

      var li = document.createElement('li');
      li.className = 'word-row';
      li.innerHTML =
        '<span class="word-state ' + stateClass + '"></span>' +
        '<span class="word-main">' +
          '<span class="word-term">' + escapeHtml(word.term) +
            (word.custom ? '<span class="badge">自作</span>' : '') +
            (word.reading ? '<span class="badge">' + escapeHtml(word.reading) + '</span>' : '') +
          '</span>' +
          '<span class="word-meaning">' + escapeHtml(word.meaning) + '</span>' +
          (word.example ? '<span class="word-example">' + escapeHtml(word.example) + '</span>' : '') +
        '</span>';

      var favBtn = document.createElement('button');
      favBtn.type = 'button';
      favBtn.className = 'row-btn' + (isFav ? ' is-on' : '');
      favBtn.textContent = isFav ? '★' : '☆';
      favBtn.setAttribute('aria-label', 'お気に入り');
      favBtn.addEventListener('click', function () {
        Storage.toggleFavorite(word.id);
        renderList();
      });

      var speakBtn = document.createElement('button');
      speakBtn.type = 'button';
      speakBtn.className = 'row-btn';
      speakBtn.textContent = '🔊';
      speakBtn.setAttribute('aria-label', '読み上げ');
      speakBtn.addEventListener('click', function () {
        speakSequence([{ text: word.term, ja: false }]);
      });

      li.appendChild(favBtn);
      li.appendChild(speakBtn);

      if (word.custom) {
        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'row-btn';
        editBtn.textContent = '✎';
        editBtn.setAttribute('aria-label', '編集');
        editBtn.addEventListener('click', function () { openEditor(word); });
        li.appendChild(editBtn);
      }

      list.appendChild(li);
    });
  }

  // ---------- 単語の追加・編集 ----------

  function openEditor(word) {
    state.editing = word ? { listId: word.listId, term: word.term } : null;
    $('edit-title').textContent = word ? '単語を編集' : '単語を追加';
    $('edit-term').value = word ? word.term : '';
    $('edit-reading').value = word ? (word.reading || '') : '';
    $('edit-meaning').value = word ? word.meaning : '';
    $('edit-example').value = word ? (word.example || '') : '';
    $('edit-example-ja').value = word ? (word.exampleJa || '') : '';
    $('edit-error').textContent = '';
    $('edit-delete-btn').hidden = !word;
    showScreen('edit');
    $('edit-term').focus();
  }

  function saveWord() {
    if (!state.list) return;
    var result = Storage.saveCustomWord(state.list.id, {
      term: $('edit-term').value,
      reading: $('edit-reading').value,
      meaning: $('edit-meaning').value,
      example: $('edit-example').value,
      exampleJa: $('edit-example-ja').value
    }, state.editing ? state.editing.term : null);

    if (!result.ok) {
      $('edit-error').textContent = result.reason === 'duplicate'
        ? 'その単語はすでに登録されています。'
        : '単語と日本語訳は必須です。';
      return;
    }

    refreshDecks();
    state.editing = null;
    renderList();
    state.history.pop();
    showScreen('list', { replace: true });
  }

  function deleteWord() {
    if (!state.editing) return;
    if (!window.confirm('「' + state.editing.term + '」を削除しますか？')) return;
    Storage.deleteCustomWord(state.editing.listId, state.editing.term);
    refreshDecks();
    state.editing = null;
    renderList();
    state.history.pop();
    showScreen('list', { replace: true });
  }

  // ---------- 設定 ----------

  function fillSettingsForm() {
    $('set-word-count').value = state.settings.wordCount;
    $('set-direction').value = state.settings.direction;
    $('set-order').value = state.settings.order;
    $('set-theme').value = state.settings.theme;
    $('set-speech').checked = state.settings.speech;
    $('set-auto').checked = state.settings.autoAdvance;
    $('set-auto-seconds').value = state.settings.autoSeconds;
  }

  function applySettingsForm() {
    state.settings = Storage.saveSettings({
      wordCount: $('set-word-count').value,
      direction: $('set-direction').value,
      order: $('set-order').value,
      theme: $('set-theme').value,
      speech: $('set-speech').checked,
      autoAdvance: $('set-auto').checked,
      autoSeconds: $('set-auto-seconds').value
    });
    fillSettingsForm();
    applyTheme();
  }

  function openSettings() {
    fillSettingsForm();
    showScreen('settings');
  }

  function exportData() {
    var data = JSON.stringify(Storage.exportData(), null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'flashcards-backup-' + Storage.todayKey() + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    $('data-hint').textContent = 'バックアップを書き出しました。';
  }

  function importData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (err) {
        $('data-hint').textContent = '読み込みに失敗しました（JSON として解析できません）。';
        return;
      }
      var result = Storage.importData(parsed);
      if (!result.ok) {
        $('data-hint').textContent = '読み込みに失敗しました。';
        return;
      }
      state.settings = Storage.loadSettings();
      refreshDecks();
      fillSettingsForm();
      applyTheme();
      $('data-hint').textContent = 'バックアップを読み込みました。';
    };
    reader.readAsText(file);
  }

  // ---------- イベント ----------

  function bind() {
    $('back-btn').addEventListener('click', goBack);
    $('study-back-btn').addEventListener('click', goBack);
    $('settings-btn').addEventListener('click', openSettings);
    $('settings-done-btn').addEventListener('click', goBack);

    // デッキ画面
    $('list-select').addEventListener('change', function (event) {
      selectList(event.target.value);
    });

    $('scope-group').addEventListener('click', function (event) {
      var button = event.target.closest('[data-scope]');
      if (!button) return;
      state.scope = button.dataset.scope;
      renderDeck();
    });

    $('count-presets').addEventListener('click', function (event) {
      var chip = event.target.closest('[data-count]');
      if (!chip || chip.disabled) return;
      var max = Math.max(1, scopeWords().length);
      $('deck-word-count').value = chip.dataset.count === 'all' ? max : chip.dataset.count;
      renderDeck();
    });

    $('count-minus').addEventListener('click', function () {
      $('deck-word-count').value = Math.max(1, deckCount() - 1);
      renderDeck();
    });

    $('count-plus').addEventListener('click', function () {
      $('deck-word-count').value = deckCount() + 1;
      renderDeck();
    });

    $('deck-word-count').addEventListener('change', renderDeck);
    $('start-btn').addEventListener('click', startSession);
    $('open-list-btn').addEventListener('click', openList);

    // 学習画面
    // タップでその場を一時停止、もう一度タップで再開
    $('card').addEventListener('click', function () {
      if (swipeConsumedClick()) return;
      togglePause();
    });
    $('card').addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation(); // 画面全体の Space（次の段階）と重ねない
        togglePause();
      }
    });
    $('correct-btn').addEventListener('click', function () {
      if (swipeConsumedClick()) return;
      judge(true);
    });
    $('wrong-btn').addEventListener('click', function () {
      if (swipeConsumedClick()) return;
      judge(false);
    });
    $('auto-btn').addEventListener('click', toggleAuto);

    bindGestures($('study-body'));

    $('speak-btn').addEventListener('click', function () {
      var step = state.steps[state.stepIndex];
      var card = state.session && state.session.current();
      if (!card || !step) return;
      // いまの段階の読み上げをやり直す（終わったら自動めくりを測り直す）
      speakSequence(step.speech || [{ text: card.word.term, ja: false }], scheduleAuto);
    });

    $('fav-btn').addEventListener('click', function () {
      var card = state.session && state.session.current();
      if (!card) return;
      var isFav = Storage.toggleFavorite(card.word.id);
      $('fav-btn').setAttribute('aria-pressed', isFav ? 'true' : 'false');
    });

    // 結果画面
    $('again-btn').addEventListener('click', function () {
      refreshDecks();
      renderDeck();
      state.history.pop();
      showScreen('deck', { replace: true });
      startSession();
    });

    $('result-home-btn').addEventListener('click', function () {
      state.history = [];
      renderHome();
      showScreen('home', { replace: true });
    });

    // 単語一覧
    $('search-input').addEventListener('input', function (event) {
      state.query = event.target.value;
      state.listLimit = LIST_PAGE;
      renderList();
    });

    $('filter-chips').addEventListener('click', function (event) {
      var chip = event.target.closest('[data-filter]');
      if (!chip) return;
      state.filter = chip.dataset.filter;
      state.listLimit = LIST_PAGE;
      renderList();
    });

    $('list-more-btn').addEventListener('click', function () {
      state.listLimit += LIST_PAGE;
      renderList();
    });

    $('add-word-btn').addEventListener('click', function () { openEditor(null); });
    $('edit-save-btn').addEventListener('click', saveWord);
    $('edit-delete-btn').addEventListener('click', deleteWord);

    // 設定
    $('set-theme').addEventListener('change', function () {
      state.settings.theme = $('set-theme').value;
      applyTheme();
    });

    $('export-btn').addEventListener('click', exportData);
    $('import-btn').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', function (event) {
      importData(event.target.files && event.target.files[0]);
      event.target.value = '';
    });

    $('reset-btn').addEventListener('click', function () {
      if (!window.confirm('すべての学習進捗と統計を削除します。よろしいですか？')) return;
      Storage.resetProgress();
      $('data-hint').textContent = '学習進捗をリセットしました。';
    });

    // キーボード
    document.addEventListener('keydown', function (event) {
      if (state.screen !== 'study') return;
      var tag = (event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      // スワイプと同じ向きの割り当て（↑ = 〇、↓ = ✕、← = 前、→ = 次）
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        advance();
      } else if (event.key === 'ArrowUp' || event.key === '2') {
        event.preventDefault();
        judge(true);
      } else if (event.key === 'ArrowDown' || event.key === '1') {
        event.preventDefault();
        judge(false);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevWord();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextWord();
      } else if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        toggleAuto();
      }
    });

    // タブが非表示になったら自動めくりを止める
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearAutoTimer();
      else if (state.screen === 'study') scheduleAuto();
    });
  }

  // ---------- 起動 ----------

  applyTheme();
  bind();
  renderHome();
  showScreen('home', { replace: true });
})();
