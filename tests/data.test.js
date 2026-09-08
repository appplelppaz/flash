'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'js', 'data');

const files = fs.readdirSync(DATA).filter((f) => f.endsWith('.js'));

test('収録リストのファイルがある', () => {
  assert.ok(files.length >= 4, '単語リストのファイルが足りない');
});

for (const file of files) {
  const list = require(path.join(DATA, file));

  test(`${file}: 形が正しい`, () => {
    assert.ok(list.id && list.deckId && list.name, 'id / deckId / name が要る');
    assert.ok(Array.isArray(list.words) && list.words.length > 0, 'words が空');
  });

  test(`${file}: 1 語は [term, reading, meaning, example, exampleJa]`, () => {
    list.words.forEach((w, i) => {
      const where = `${file} の ${i + 1} 語目`;
      assert.ok(Array.isArray(w), `${where} が配列でない`);
      assert.strictEqual(w.length, 5, `${where} の要素数が 5 でない`);
      w.forEach((cell) => assert.strictEqual(typeof cell, 'string', `${where} に文字列でない値`));
      assert.ok(w[0].trim(), `${where} の単語が空`);
      assert.ok(w[2].trim(), `${where} の訳が空`);
    });
  });

  test(`${file}: 例文にはその単語が入っている（英・西・仏）`, () => {
    if (list.deckId === 'zh') return;
    let missing = 0;
    list.words.forEach((w) => {
      if (!w[3]) return;
      const head = w[0].toLowerCase().split(/[\s(]/)[0].replace(/[^\p{L}]/gu, '');
      if (head.length < 4) return;
      if (!w[3].toLowerCase().includes(head.slice(0, Math.max(4, head.length - 3)))) missing++;
    });
    const ratio = missing / list.words.length;
    assert.ok(ratio < 0.25, `${file}: 例文に単語が入っていない割合が高い (${Math.round(ratio * 100)}%)`);
  });

  test(`${file}: 同じ語が二度出てこない`, () => {
    // 大文字小文字だけ違って意味が異なる語（es の en serio「真剣に」/「本当に」など）は別の項目として認める。
    // 同じ綴り、または綴りも訳も同じものは重複とみなす。
    const seen = new Map();
    const dups = [];
    list.words.forEach((w, i) => {
      const exact = w[0];
      const loose = w[0].toLowerCase();
      if (seen.has(exact)) {
        dups.push(`${w[0]} (${seen.get(exact) + 1} 行目と ${i + 1} 行目)`);
      } else if (seen.has(loose) && list.words[seen.get(loose)][2] === w[2]) {
        dups.push(`${w[0]} (${seen.get(loose) + 1} 行目と ${i + 1} 行目・訳も同じ)`);
      }
      if (!seen.has(exact)) seen.set(exact, i);
      if (!seen.has(loose)) seen.set(loose, i);
    });
    assert.deepStrictEqual(dups, [], `重複: ${dups.slice(0, 5).join(', ')}`);
  });
}

test('library.js が持つ語数が実データと合っている', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'library.js'), 'utf8');
  const re = /\{ id: '([^']+)', name: '[^']*', lang: '([^']+)', count: (\d+), src: '([^']+)'/g;
  let m;
  let checked = 0;
  while ((m = re.exec(src))) {
    const [, id, lang, count, srcPath] = m;
    const list = require(path.join(ROOT, srcPath));
    assert.strictEqual(list.id, id, `${srcPath} の id が違う`);
    assert.strictEqual(list.deckId, lang, `${srcPath} の言語が違う`);
    assert.strictEqual(list.words.length, Number(count), `${id} の語数が library.js と合わない（実際は ${list.words.length}）`);
    checked++;
  }
  assert.strictEqual(checked, 4, '収録リストの数が 4 でない');
});
