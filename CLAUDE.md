# このリポジトリで作業するときの決まり

iPhone 向けのフラッシュカードアプリ（ビルド不要のバニラ JavaScript / オフライン対応 PWA）。

## 語彙リストを作るとき

`netflix-subs-to-vocab` スキルで字幕から語彙リストを作る場合：

1. 抽出器は**このリポジトリの `tools/extract_vocab.py` を使う**（同じものを同梱している）。
2. 例文は **`vocab/EXAMPLES.md` に従って書く**。考え方は——
   **語彙リストはコアの骨組み、例文はそこに語を上乗せする場**。
   例文には**リストに無い語**を 1〜2 語わざと入れ（例文全体の 8 割以上）、
   その語と訳を TSV の **5 列目**に書く。アプリが下線を引いて意味を添える。
3. 書き終えたら必ず点検する。80% を下回る・5 列目の語が例文に無い・
   おまけがリストの見出し語だった場合は、終了コード 1 で落ちる。

   ```sh
   node tools/check-examples.js vocab/<lang>_<title>.tsv --list
   awk -F'\t' 'NF!=5{print "BAD "NR}' vocab/<lang>_<title>.tsv
   ```

4. 出力は**タブ区切り・ヘッダーなし・5 列**
   （単語 / 日本語訳 / 例文 / 例文の日本語訳 / おまけの語 `語=訳; 語=訳`）。
   保存先は `vocab/<lang>_<title>.tsv`。5 列目を落とした 4 列の古い形も読める。

## コードを触るとき

- ビルドは無い。`npm start`（`python3 -m http.server 8080`）で開いて確かめる。
- 変更したら `npm test`（`node --test`）を通す。
- `js/tsv.js` `js/session.js` `js/links.js` `js/plan.js` は **DOM に依存させない**（Node のテストから読んでいる）。
- カードを「何の順で見せ、何を読み上げるか」は `js/plan.js` が決める。app.js に直接書かない。
- `js/data/*.js` の単語データは**書き換えない**。語数を変えたときは `js/library.js` の
  `BUILTIN` の `count` も直す（テストが照合している）。
- ファイルを増やしたら `sw.js` の `SHELL` に加え、`VERSION` を上げる。
- アイコンを作り直すときは `npm run icons`。
