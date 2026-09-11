'use strict';
const test = require('node:test');
const assert = require('node:assert');
const plan = require('../js/plan.js');

const CARD = {
  term: 'get away with',
  meaning: 'やり過ごす',
  example: 'You won\'t get away with a lie this clumsy.',
  exampleJa: 'こんな下手なうそでは、ただでは済まない。'
};
const NO_EXAMPLE = { term: 'shipment', meaning: '積み荷', example: '', exampleJa: '' };
const L = { lang: 'en-US', ja: 'ja-JP' };

// --- 見せる順 ---

test('既定は 例文 → 単語 → 訳', () => {
  assert.deepStrictEqual(
    plan.stages(CARD, { mode: 'full', direction: 'example-first' }),
    ['example', 'term', 'meaning']
  );
});

test('単語から始める並び', () => {
  assert.deepStrictEqual(
    plan.stages(CARD, { mode: 'full', direction: 'term-first' }),
    ['term', 'meaning', 'example']
  );
});

test('訳から始める並び', () => {
  assert.deepStrictEqual(
    plan.stages(CARD, { mode: 'full', direction: 'meaning-first' }),
    ['meaning', 'term', 'example']
  );
});

test('例文の無い語は、並びに関わらず 2 段階', () => {
  assert.deepStrictEqual(plan.stages(NO_EXAMPLE, { mode: 'full', direction: 'example-first' }), ['term', 'meaning']);
  assert.deepStrictEqual(plan.stages(NO_EXAMPLE, { mode: 'full', direction: 'meaning-first' }), ['meaning', 'term']);
});

test('単語だけモードは、例文があっても 単語 → 訳 の 2 段階', () => {
  assert.deepStrictEqual(plan.stages(CARD, { mode: 'quick', direction: 'example-first' }), ['term', 'meaning']);
  assert.deepStrictEqual(plan.stages(CARD, { mode: 'quick', direction: 'term-first' }), ['term', 'meaning']);
});

test('単語だけモードでも、訳から始める並びは効く', () => {
  assert.deepStrictEqual(plan.stages(CARD, { mode: 'quick', direction: 'meaning-first' }), ['meaning', 'term']);
});

// --- 読み上げ ---

const say = (role, opts) => plan.speech(CARD, role, Object.assign({}, L, opts)).map((s) => s.t);

test('既定の読み上げは 例文 → 例文の訳 → 単語 → 訳', () => {
  const o = { mode: 'full', direction: 'example-first', ttsPlan: 'full' };
  assert.deepStrictEqual(say('example', o), [CARD.example, CARD.exampleJa]);
  assert.deepStrictEqual(say('term', o), [CARD.term]);
  assert.deepStrictEqual(say('meaning', o), [CARD.meaning]);
});

test('単語から始める並びでは、例文の段階で例文をもう一度読む', () => {
  const o = { mode: 'full', direction: 'term-first', ttsPlan: 'full' };
  assert.deepStrictEqual(say('example', o), [CARD.example, CARD.exampleJa, CARD.example]);
});

test('読み上げる言語が使い分けられている', () => {
  const steps = plan.speech(CARD, 'example', Object.assign({ mode: 'full', direction: 'example-first', ttsPlan: 'full' }, L));
  assert.deepStrictEqual(steps.map((s) => s.l), ['en-US', 'ja-JP']);
  assert.strictEqual(plan.speech(CARD, 'meaning', Object.assign({ ttsPlan: 'full' }, L))[0].l, 'ja-JP');
});

test('「例文の訳はとばす」', () => {
  assert.deepStrictEqual(say('example', { mode: 'full', direction: 'example-first', ttsPlan: 'short' }), [CARD.example]);
});

test('「現地語だけ」は訳を読まない', () => {
  const o = { mode: 'full', direction: 'example-first', ttsPlan: 'target' };
  assert.deepStrictEqual(say('example', o), [CARD.example]);
  assert.deepStrictEqual(say('term', o), [CARD.term]);
  assert.deepStrictEqual(say('meaning', o), []);
});

test('「単語だけ」は単語しか読まない', () => {
  const o = { mode: 'full', direction: 'example-first', ttsPlan: 'word' };
  assert.deepStrictEqual(say('term', o), [CARD.term]);
  assert.deepStrictEqual(say('meaning', o), []);
  assert.deepStrictEqual(say('example', o), []);
});

test('単語だけモードは 単語 → 訳 だけを読み、例文は読まない', () => {
  const o = { mode: 'quick', direction: 'term-first', ttsPlan: 'full' };
  assert.deepStrictEqual(say('term', o), [CARD.term]);
  assert.deepStrictEqual(say('meaning', o), [CARD.meaning]);
  assert.deepStrictEqual(say('example', o), [], '単語だけモードでは例文を読まない');
});

test('単語だけモードでも「単語だけ」を選べば訳も読まない', () => {
  const o = { mode: 'quick', direction: 'term-first', ttsPlan: 'word' };
  assert.deepStrictEqual(say('term', o), [CARD.term]);
  assert.deepStrictEqual(say('meaning', o), []);
});

test('中身の無い欄は読み上げに入らない', () => {
  const bare = { term: 'x', meaning: '', example: '', exampleJa: '' };
  const o = Object.assign({ mode: 'full', direction: 'example-first', ttsPlan: 'full' }, L);
  assert.deepStrictEqual(plan.speech(bare, 'meaning', o), []);
  assert.deepStrictEqual(plan.speech(bare, 'example', o), []);
  assert.deepStrictEqual(plan.speech(null, 'term', o), []);
});

test('単語だけモードでは例文まわりを画面に出さない', () => {
  assert.strictEqual(plan.showsExample({ mode: 'quick' }), false);
  assert.strictEqual(plan.showsExample({ mode: 'full' }), true);
  assert.strictEqual(plan.showsExample(), true);
});

test('見せる段階と読み上げが噛み合っている（読む物の無い段階を作らない）', () => {
  for (const mode of ['full', 'quick']) {
    for (const direction of ['example-first', 'term-first', 'meaning-first']) {
      const opts = Object.assign({ mode, direction, ttsPlan: 'full' }, L);
      const roles = plan.stages(CARD, opts);
      assert.ok(roles.length >= 2, `${mode}/${direction}: 段階が足りない`);
      assert.strictEqual(new Set(roles).size, roles.length, `${mode}/${direction}: 段階が重複している`);
      roles.forEach((role) => {
        assert.ok(plan.speech(CARD, role, opts).length > 0, `${mode}/${direction}/${role}: 読む物が無い`);
      });
      if (mode === 'quick') assert.ok(!roles.includes('example'), '単語だけモードに例文が混ざっている');
    }
  }
});

// --- 繰り返し（覚えるために同じものを続けて言う） ---

test('繰り返し 2 回で、単語と訳をそれぞれ 2 回続けて言う', () => {
  const o = Object.assign({ mode: 'full', direction: 'example-first', ttsPlan: 'full', repeat: 2 }, L);
  assert.deepStrictEqual(plan.speech(CARD, 'term', o).map((s) => s.t), [CARD.term, CARD.term]);
  assert.deepStrictEqual(plan.speech(CARD, 'meaning', o).map((s) => s.t), [CARD.meaning, CARD.meaning]);
});

test('繰り返しは「まとめて 2 周」ではなく「その場で 2 回」', () => {
  const o = Object.assign({ mode: 'full', direction: 'example-first', ttsPlan: 'full', repeat: 2 }, L);
  assert.deepStrictEqual(
    plan.speech(CARD, 'example', o).map((s) => s.t),
    [CARD.example, CARD.example, CARD.exampleJa, CARD.exampleJa],
    '例文 → 例文 → 訳 → 訳 の順'
  );
});

test('繰り返しを付けたら、締めの例文は足さない（既に 2 回言っている）', () => {
  const one = Object.assign({ mode: 'full', direction: 'term-first', ttsPlan: 'full', repeat: 1 }, L);
  const two = Object.assign({}, one, { repeat: 2 });
  assert.deepStrictEqual(plan.speech(CARD, 'example', one).map((s) => s.t),
    [CARD.example, CARD.exampleJa, CARD.example]);
  assert.deepStrictEqual(plan.speech(CARD, 'example', two).map((s) => s.t),
    [CARD.example, CARD.example, CARD.exampleJa, CARD.exampleJa]);
});

test('単語だけモードでも繰り返しが効く', () => {
  const o = Object.assign({ mode: 'quick', direction: 'term-first', ttsPlan: 'full', repeat: 2 }, L);
  assert.deepStrictEqual(plan.speech(CARD, 'term', o).map((s) => s.t), [CARD.term, CARD.term]);
  assert.deepStrictEqual(plan.speech(CARD, 'example', o), [], '例文は読まないまま');
});

test('読み上げない範囲は、繰り返しても増えない', () => {
  const o = Object.assign({ mode: 'full', direction: 'example-first', ttsPlan: 'word', repeat: 2 }, L);
  assert.deepStrictEqual(plan.speech(CARD, 'meaning', o), []);
  assert.deepStrictEqual(plan.speech(CARD, 'example', o), []);
  assert.deepStrictEqual(plan.speech(CARD, 'term', o).map((s) => s.t), [CARD.term, CARD.term]);
});

test('繰り返しの回数は 1〜3 に収める', () => {
  const at = (repeat) => plan.speech(CARD, 'term',
    Object.assign({ mode: 'full', direction: 'example-first', ttsPlan: 'full', repeat }, L)).length;
  assert.strictEqual(at(undefined), 1);
  assert.strictEqual(at(0), 1);
  assert.strictEqual(at(-5), 1);
  assert.strictEqual(at(3), 3);
  assert.strictEqual(at(99), 3);
});

test('繰り返しは読み上げだけ。見せる段階は増えない', () => {
  const one = plan.stages(CARD, { mode: 'full', direction: 'example-first', repeat: 1 });
  const two = plan.stages(CARD, { mode: 'full', direction: 'example-first', repeat: 2 });
  assert.deepStrictEqual(two, one);
});
