#!/usr/bin/env node
/**
 * 語彙リスト（TSV）の例文を点検する。
 *
 *   node tools/check-examples.js vocab/en_papel_s1.tsv
 *   node tools/check-examples.js vocab/es_papel.tsv --lang es --list
 *
 * 語彙リストは覚えるべき骨組み。例文はそこに語を上乗せする場所なので、
 * 例文には**リストに無い語**をわざと入れ、5 列目にその語と訳を書く。
 * ここではその上乗せがどれだけできているかを数える。
 *
 *   単語 ⇥ 日本語訳 ⇥ 例文 ⇥ 例文の日本語訳 ⇥ おまけの語（語=訳; 語=訳）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const tsv = require(path.join(__dirname, '..', 'js', 'tsv.js'));
const links = require(path.join(__dirname, '..', 'js', 'links.js'));

const TARGET_RATIO = 0.8;   // 8 割の例文におまけの語を入れたい

function main(argv) {
  const files = argv.filter((a) => !a.startsWith('--'));
  const showList = argv.includes('--list');
  const langArg = (argv.find((a) => a.startsWith('--lang=')) || '').split('=')[1] ||
    (argv.includes('--lang') ? argv[argv.indexOf('--lang') + 1] : '');

  if (!files.length) {
    console.error('使い方: node tools/check-examples.js <file.tsv> [--lang en|zh|es|fr] [--list]');
    process.exit(2);
  }

  let bad = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const { cards, skipped } = tsv.parse(text);
    if (!cards.length) {
      console.error(`${file}: 読み取れる行がありません`);
      process.exit(1);
    }
    const lang = langArg || tsv.nameFromFile(file).lang || tsv.detectLang(cards);
    const headwords = new Set(cards.map((c) => c.term.toLowerCase()));

    const noExample = [];
    const noExtra = [];
    const notFound = [];   // 5 列目にあるのに例文の中に見当たらない
    const inList = [];     // 5 列目なのにリストの見出し語（上乗せになっていない）
    const tooLong = [];
    let withExtra = 0;
    let extraTotal = 0;

    cards.forEach((c, i) => {
      if (!c.example) return noExample.push(c.term);

      const len = lang === 'zh' ? c.example.length : c.example.split(/\s+/).length;
      const cap = lang === 'zh' ? 28 : 16;
      if (len > cap) tooLong.push(`${c.term} (${len})`);

      const extras = c.extras || [];
      if (!extras.length) return noExtra.push(c.term);

      const hits = links.findExtras(c.example, extras, lang);
      const found = new Set(hits.map((h) => h.id));
      extras.forEach((e, k) => {
        if (!found.has(k)) notFound.push(`${c.term} → ${e.term}`);
        if (headwords.has(e.term.toLowerCase())) inList.push(`${c.term} → ${e.term}`);
        if (!e.meaning) notFound.push(`${c.term} → ${e.term}（訳が無い）`);
      });
      if (hits.length) { withExtra++; extraTotal += hits.length; }
    });

    const withExample = cards.length - noExample.length;
    const ratio = withExample ? withExtra / withExample : 0;
    const ok = ratio >= TARGET_RATIO && !notFound.length && !inList.length;
    if (!ok) bad = 1;

    console.log(`\n${path.basename(file)}  [${lang}]`);
    console.log(`  語数              ${cards.length}${skipped.length ? `（飛ばした行 ${skipped.length}）` : ''}`);
    console.log(`  例文あり          ${withExample}${noExample.length ? `（無し ${noExample.length}）` : ''}`);
    console.log(`  おまけの語あり    ${withExtra} / ${withExample}  ${Math.round(ratio * 100)}%` +
      (ratio < TARGET_RATIO ? `  ← ${Math.round(TARGET_RATIO * 100)}% を下回っています` : '  ✓'));
    console.log(`  1 文あたり        ${withExtra ? (extraTotal / withExtra).toFixed(1) : '0'} 語`);
    if (notFound.length) console.log(`  例文に見当たらない ${notFound.length} 件  ← 直してください`);
    if (inList.length) console.log(`  リストにある語     ${inList.length} 件  ← おまけはリスト外の語にしてください`);
    if (tooLong.length) console.log(`  長すぎる例文      ${tooLong.length} 件`);

    if (showList) {
      if (noExample.length) console.log(`\n  例文が無い語:\n    ${noExample.join(', ')}`);
      if (noExtra.length) console.log(`\n  おまけの語が無い例文:\n    ${noExtra.join(', ')}`);
      if (notFound.length) console.log(`\n  例文に見当たらないおまけの語:\n    ${notFound.join('\n    ')}`);
      if (inList.length) console.log(`\n  リストの見出し語をおまけに入れている:\n    ${inList.join('\n    ')}`);
      if (tooLong.length) console.log(`\n  長すぎる例文:\n    ${tooLong.join(', ')}`);
    }
  }
  console.log('');
  process.exit(bad);
}

main(process.argv.slice(2));
