/**
 * 画面の組み立てとイベント処理。
 */
(function () {
  'use strict';

  var DECKS = window.Decks.DECKS;
  var getDeck = window.Decks.getDeck;
  var Storage = window.AppStorage;
  var StudySession = window.Study.StudySession;
  var pickWords = window.Study.pickWords;

  var DIRECTION_LABELS = {
    'term-first': '単語 → 意味',
    'meaning-first': '意味 → 単語',
    'mixed': 'ランダム'
  };

  var ORDER_LABELS = {
    'unlearned-first': '未学習・苦手を優先',
    'random': 'ランダム',
    'weak-first': '間違えた回数が多い順'
  };

  var el = {};
  ['back-btn', 'settings-btn', 'deck-list', 'home-word-count', 'open-settings-link',
    'setup-deck-name', 'setup-word-count', 'count-minus', 'count-plus', 'setup-count-hint',
    'setup-total', 'setup-learned', 'setup-streak', 'setup-order', 'start-btn',
    'progress-fill', 'progress-text', 'queue-text', 'card', 'card-label', 'card-question',
    'card-answer', 'card-reading', 'card-meaning', 'card-hint', 'reveal-btn', 'judge-row',
    'wrong-btn', 'correct-btn', 'streak-note', 'quit-btn',
    'done-total', 'done-answered', 'done-accuracy', 'done-time', 'again-btn', 'home-btn',
    'settings-word-count', 'settings-streak', 'settings-direction', 'settings-order',
    'reset-btn', 'reset-hint', 'settings-done-btn'
  ].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  var SCREENS = ['home', 'setup', 'study', 'done', 'settings'];

  var state = {
    screen: 'home',
    settings: Storage.loadSettings(),
    deck: null,
    session: null,
    revealed: false,
    /** 設定画面に入る前の画面（戻り先） */
    previousScreen: 'home'
  };

  // ---------- 画面遷移 ----------

  function showScreen(name) {
    state.screen = name;
    SCREENS.forEach(function (screen) {
      document.getElementById('screen-' + screen).hidden = (screen !== name);
    });
    el['back-btn'].hidden = (name === 'home');
    el['settings-btn'].hidden = (name === 'settings' || name === 'study');
    window.scrollTo(0, 0);
  }

  function goBack() {
    if (state.screen === 'settings') {
      applySettingsForm();
      showScreen(state.previousScreen === 'study' ? 'home' : state.previousScreen);
      renderHome();
      if (state.deck) renderSetup();
    } else if (state.screen === 'study') {
      if (window.confirm('学習を中断してホームに戻りますか？ 途中の結果は記録されません。')) {
        state.session = null;
        showScreen('home');
        renderHome();
      }
    } else {
      showScreen('home');
      renderHome();
    }
  }

  // ---------- ホーム（言語選択） ----------

  function deckStats(deck) {
    var progress = Storage.loadProgress();
    var learned = deck.words.filter(function (word) {
      var stat = progress[word.id];
      return stat && stat.learned;
    }).length;
    return { total: deck.words.length, learned: learned };
  }

  function renderHome() {
    el['home-word-count'].textContent = state.settings.wordCount;
    el['deck-list'].innerHTML = '';

    DECKS.forEach(function (deck) {
      var stats = deckStats(deck);
      var percent = stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;

      var li = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'deck-btn';
      button.innerHTML =
        '<div class="deck-name"><span class="deck-emoji">' + deck.emoji + '</span>' + deck.name + '</div>' +
        '<div class="deck-meta">' + stats.total + ' 語中 ' + stats.learned + ' 語 学習済み（' + percent + '%）</div>' +
        '<div class="deck-progress"><span style="width:' + percent + '%"></span></div>';
      button.addEventListener('click', function () {
        selectDeck(deck.id);
      });
      li.appendChild(button);
      el['deck-list'].appendChild(li);
    });
  }

  // ---------- 出題数の確認 ----------

  function selectDeck(deckId) {
    state.deck = getDeck(deckId);
    if (!state.deck) return;
    el['setup-word-count'].value = Math.min(state.settings.wordCount, state.deck.words.length);
    renderSetup();
    showScreen('setup');
  }

  function renderSetup() {
    var deck = state.deck;
    if (!deck) return;
    var stats = deckStats(deck);
    var max = deck.words.length;

    el['setup-deck-name'].textContent = deck.emoji + ' ' + deck.name;
    el['setup-word-count'].max = max;
    el['setup-total'].textContent = max + ' 語';
    el['setup-learned'].textContent = stats.learned + ' 語';
    el['setup-streak'].textContent = state.settings.requiredStreak + ' 回連続で正解';
    el['setup-order'].textContent = ORDER_LABELS[state.settings.order];
    el['setup-count-hint'].textContent =
      '1 〜 ' + max + ' 語まで指定できます（設定のデフォルト: ' + state.settings.wordCount + ' 語）。';
  }

  function setupCount() {
    var max = state.deck ? state.deck.words.length : 1;
    var value = parseInt(el['setup-word-count'].value, 10);
    if (isNaN(value)) value = state.settings.wordCount;
    return Math.min(max, Math.max(1, value));
  }

  function stepCount(delta) {
    el['setup-word-count'].value = Math.min(
      state.deck.words.length,
      Math.max(1, setupCount() + delta)
    );
  }

  // ---------- 学習 ----------

  function startSession() {
    var count = setupCount();
    el['setup-word-count'].value = count;

    var words = pickWords(state.deck.words, count, {
      order: state.settings.order,
      progress: Storage.loadProgress()
    });

    state.session = new StudySession({
      words: words,
      requiredStreak: state.settings.requiredStreak,
      direction: state.settings.direction
    });

    state.revealed = false;
    el['streak-note'].textContent = '';
    showScreen('study');
    renderCard();
  }

  function renderProgress() {
    var session = state.session;
    var stats = session.stats();
    var percent = stats.total ? (stats.learned / stats.total) * 100 : 0;
    el['progress-fill'].style.width = percent + '%';
    el['progress-text'].textContent = stats.learned + ' / ' + stats.total + ' 語 学習済み';
    el['queue-text'].textContent = '残り ' + session.queue.length + ' 枚';
  }

  function renderCard() {
    var session = state.session;
    if (!session) return;

    renderProgress();

    var face = session.currentFace();
    if (!face) {
      finishSession();
      return;
    }

    state.revealed = false;
    el['card-label'].textContent = face.questionLabel;
    el['card-question'].textContent = face.question;
    el['card-reading'].textContent = face.reading;
    el['card-meaning'].textContent = face.answer;
    el['card-answer'].hidden = true;
    el['card-hint'].hidden = false;
    el['reveal-btn'].hidden = false;
    el['judge-row'].hidden = true;
  }

  function reveal() {
    if (!state.session || state.revealed || !state.session.current()) return;
    state.revealed = true;
    el['card-answer'].hidden = false;
    el['card-hint'].hidden = true;
    el['reveal-btn'].hidden = true;
    el['judge-row'].hidden = false;
  }

  function judge(isCorrect) {
    if (!state.session || !state.revealed) return;

    var required = state.session.requiredStreak;
    var result = state.session.answer(isCorrect);
    if (!result) return;

    if (result.learned) {
      el['streak-note'].textContent = '✅ 「' + result.card.word.term + '」を学習済みにしました。';
    } else if (isCorrect) {
      el['streak-note'].textContent =
        '👍 正解（連続 ' + result.card.streak + ' / ' + required + ' 回）。あと ' +
        (required - result.card.streak) + ' 回で学習済みです。';
    } else {
      el['streak-note'].textContent = '🔁 「' + result.card.word.term + '」はもう一度出題します。';
    }

    if (result.complete) {
      finishSession();
    } else {
      renderCard();
    }
  }

  function formatDuration(ms) {
    var totalSeconds = Math.max(0, Math.round(ms / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes ? minutes + ' 分 ' + seconds + ' 秒' : seconds + ' 秒';
  }

  function finishSession() {
    var session = state.session;
    if (!session) return;

    Storage.recordSession(session.cards);
    var stats = session.stats();

    el['done-total'].textContent = stats.learned + ' / ' + stats.total + ' 語';
    el['done-answered'].textContent = stats.answered + ' 回';
    el['done-accuracy'].textContent = Math.round(stats.accuracy * 100) + '%';
    el['done-time'].textContent = formatDuration(stats.elapsedMs);

    showScreen('done');
    renderHome();
  }

  // ---------- 設定 ----------

  function openSettings() {
    state.previousScreen = state.screen;
    el['settings-word-count'].value = state.settings.wordCount;
    el['settings-streak'].value = state.settings.requiredStreak;
    el['settings-direction'].value = state.settings.direction;
    el['settings-order'].value = state.settings.order;
    el['reset-hint'].textContent = '単語ごとの正解・不正解の記録と学習済み状態を消去します。';
    showScreen('settings');
  }

  function applySettingsForm() {
    state.settings = Storage.saveSettings({
      wordCount: el['settings-word-count'].value,
      requiredStreak: el['settings-streak'].value,
      direction: el['settings-direction'].value,
      order: el['settings-order'].value
    });
    // 範囲外の値を入れていた場合は補正後の値を表示に戻す
    el['settings-word-count'].value = state.settings.wordCount;
    el['settings-streak'].value = state.settings.requiredStreak;
  }

  function closeSettings() {
    applySettingsForm();
    var target = state.previousScreen === 'study' ? 'home' : state.previousScreen;
    renderHome();
    if (target === 'setup' && state.deck) {
      el['setup-word-count'].value = Math.min(state.settings.wordCount, state.deck.words.length);
      renderSetup();
    }
    showScreen(target);
  }

  // ---------- イベント ----------

  el['settings-btn'].addEventListener('click', openSettings);
  el['open-settings-link'].addEventListener('click', openSettings);
  el['settings-done-btn'].addEventListener('click', closeSettings);
  el['back-btn'].addEventListener('click', goBack);

  el['count-minus'].addEventListener('click', function () { stepCount(-1); });
  el['count-plus'].addEventListener('click', function () { stepCount(1); });
  el['setup-word-count'].addEventListener('blur', function () {
    el['setup-word-count'].value = setupCount();
  });
  el['start-btn'].addEventListener('click', startSession);

  el['card'].addEventListener('click', reveal);
  el['card'].addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      reveal();
    }
  });
  el['reveal-btn'].addEventListener('click', reveal);
  el['correct-btn'].addEventListener('click', function () { judge(true); });
  el['wrong-btn'].addEventListener('click', function () { judge(false); });
  el['quit-btn'].addEventListener('click', goBack);

  el['again-btn'].addEventListener('click', function () {
    if (!state.deck) {
      showScreen('home');
      return;
    }
    renderSetup();
    showScreen('setup');
  });

  el['home-btn'].addEventListener('click', function () {
    renderHome();
    showScreen('home');
  });

  el['reset-btn'].addEventListener('click', function () {
    if (!window.confirm('すべての学習進捗を削除します。よろしいですか？')) return;
    Storage.resetProgress();
    renderHome();
    if (state.deck) renderSetup();
    el['reset-hint'].textContent = '学習進捗をリセットしました。';
  });

  document.addEventListener('keydown', function (event) {
    if (state.screen !== 'study') return;
    var tag = (event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

    if (!state.revealed && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      reveal();
      return;
    }
    if (state.revealed) {
      if (event.key === 'ArrowRight' || event.key === '2') {
        event.preventDefault();
        judge(true);
      } else if (event.key === 'ArrowLeft' || event.key === '1') {
        event.preventDefault();
        judge(false);
      }
    }
  });

  // ---------- 起動 ----------

  renderHome();
  showScreen('home');
})();
