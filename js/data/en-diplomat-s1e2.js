/**
 * The Diplomat S1E2
 * 海外ドラマ「The Diplomat」シーズン1 第2話「Don't Call It a Kidnapping」の台詞から拾った語彙・慣用句
 *
 * 1 語は [term, reading, meaning, example, exampleJa] の配列。
 * reading は発音・ピンインなど（この一覧では使っていないので空文字）。
 */
(function (global) {
  'use strict';

  var WORDS = [
    ['air-gapped', '', '（通信網から）物理的に遮断・隔離された状態（本来はITセキュリティ用語、ここでは携帯電話を切り離したかを尋ねる）', 'Air-gapped? -Yeah.', '通信は遮断してある？-ああ。'],
    ['banana bag', '', 'ビタミン入りの点滴液（黄色いことから俗にこう呼ばれる、二日酔いなどの応急処置に使う）', 'Do they do banana bags here?', 'ここでも「バナナバッグ」（ビタミン点滴）ってやってくれるの？'],
    ['have the sac to do something', '', '～するだけの度胸・根性がある（下品な俗語）', 'They don\'t have the sac to hold people long enough to simulate a real event.', '本物さながらの模擬訓練をするほどの度胸は、彼らにはない。'],
    ['throw something together', '', '急いで（間に合わせで）用意する', 'Maybe Chet asked you to throw something together.', 'チェットが急ごしらえで何か用意させたのかもしれない。'],
    ['get a run-around', '', 'たらい回しにされる、はぐらかされる', 'FBI\'s gonna get a run-around, right?', 'FBIはたらい回しにされるだけだろう？'],
    ['under-baked', '', '（情報・計画などが）まだ十分に練られていない、生煮えの', 'It\'s under-baked, but if it holds up, I\'ll bring it in.', 'まだ生煮えの情報だけど、裏が取れたら持ってくるわ。'],
    ['it quacks like a duck', '', '状況証拠からしてほぼ間違いない（「アヒルのように鳴くならアヒルだ」という諺の応用）', 'It quacks like a duck, Ms. Park. We must consider the possibility it might be one.', '状況はアヒルのように鳴いていますよ、パークさん。本当にアヒルである可能性も考えないと。'],
    ['die on the vine', '', '（計画などが）実現せずに立ち消えになる', 'Tried to get a hotline going, once upon a time. Died on the vine.', 'かつてホットラインを作ろうとしたことがあったが、実現せず立ち消えになった。'],
    ['cut a figure', '', '（人が）目立つ・印象的な姿を見せる', 'Cuts a figure, doesn\'t he?', 'なかなか様になっているでしょう、彼？'],
    ['on the naughty step', '', 'お叱りを受けて干されている状態（本来は子供のしつけ用語、ここでは政界で干されている意味で転用）', 'I thought you were... On the Naughty Step?', 'てっきりあなたは……政界で干されているのかと思っていました。'],
    ['revile someone', '', '（人を）ひどく非難する、口を極めて罵る', 'They revile me in public, but I can\'t seem to get them off my telephone.', '表向きは私を口を極めて罵るくせに、裏では電話が絶えないの。'],
    ['bromide', '', '（中身のない）決まり文句、当たり障りのない紋切り型の発言', 'Beyond bromides so assiduously scrubbed of meaning, you\'ll think you were hearing the wind.', '意味が徹底的に抜き取られた紋切り型の言葉以外、何も出てこないでしょうね。'],
    ['give no quarter', '', '情け容赦しない、徹底的にやる', 'In their defense, we shall give no quarter.', '彼らの弔いのために、我々は一切容赦しない。'],
    ['not flag nor fail', '', 'ひるむことも力尽きることもない（演説調の格式高い表現）', 'We shall not flag nor fail as we hunt down the source of this barbaric attack.', 'この蛮行の元凶を追い詰めるまで、我々はひるむことも力尽きることもない。'],
    ['have the spine to do something', '', '～するだけの気骨・胆力がある', 'You don\'t even have the spine to say their name.', '彼らの名前を口にする気骨すらないのか。'],
    ['throw gasoline on the fire', '', '火に油を注ぐ、事態を悪化させる', 'This guy\'s throwing gasoline all over the fire.', 'この男は、事態にさらに油を注いでいる。'],
    ['give someone a heads up', '', '（人に）事前に知らせる、注意喚起する', 'Call State. Give them a heads up.', '国務省に電話して、前もって知らせておいて。'],
    ['meet the moment', '', 'その局面にふさわしい振る舞いをする、期待に応える', 'The PM appears to have met the moment.', '首相はこの局面にふさわしい対応を見せたようだ。'],
    ['punch line', '', '物笑いの種、笑いの対象（本来は「オチ」の意）', 'He was a punch line. Now he\'s Churchill.', '彼は物笑いの種だったのに、今やチャーチルのようだ。'],
    ['bellicose', '', '好戦的な', 'He\'s resoundingly answered that in the bellicose affirmative.', '彼は好戦的な形で、はっきりと「イエス」と答えてみせた。'],
    ['undercooked intelligence', '', '十分な裏取りをしていない、生煮えの情報', 'I have pretty strong feelings about undercooked intelligence.', '生煮えの情報に対しては、かなり強い抵抗感があるんだ。'],
    ['jaw-dropping', '', '度肝を抜くような、驚くべき', 'Mixed experiences with jaw-dropping stories that come from Hal.', 'ハルが持ち込む度肝を抜くような話には、賛否入り混じった経験があってね。'],
    ['commandeer something', '', '（軍・当局などが乗り物などを）強制的に接収する、徴発する', 'He did that by commandeering a plane that was meant to evacuate Afghans.', 'アフガニスタン人避難用の飛行機を強引に接収することで、それをやってのけた。'],
    ['tongues will start to wag', '', '噂・陰口が広まり始める', 'Tongues will start to wag.', 'あちこちで噂が立ち始めるわよ。'],
    ['buttonhole someone', '', '（人を）呼び止めてしつこく話し込む', 'Buttonhole the president as soon as he arrives and you talk him out of the lunch.', '大統領が到着したらすぐに捕まえて、昼食会を思いとどまらせて。'],
    ['bottom out', '', 'どん底の状態になる、消耗しきる', 'Eat something. You\'ve been bottoming out.', '何か食べて。もう限界まで消耗しているんだから。'],
    ['hock up a war whoop', '', '（不快な発言・雄叫びなどを）吐き散らす（軽蔑的な言い回し）', 'Just hocked up an Islamophobic war whoop.', 'イスラム嫌悪丸出しの雄叫びを吐き散らしたばかりだ。'],
    ['an offering like a dead squirrel on the doorstep', '', 'ありがた迷惑な献上品、押しつけがましい誠意の証（猫が獲物を見せびらかす様子の比喩）', 'It was an offering, like a dead squirrel on the doorstep.', 'それはまるで、玄関先に置かれた死んだリスのような（ありがた迷惑な）贈り物だった。'],
    ['put one\'s neck on a rail', '', '自ら危険を承知で身を危うくする（"stick one\'s neck out"の変奏表現）', 'Shahin put his neck on a rail.', 'シャヒンは自分の首を危険にさらしたのよ。'],
    ['hat tip', '', '（皮肉交じりに）～のおかげ、～に敬意を表して', 'I was almost fired by the secretary of state on day one. Hat tip, Hal Wyler.', '初日にもう少しで国務長官にクビにされかけた。それもこれも、ハル・ワイラーのおかげでね。'],
    ['eclipse someone', '', '（人の存在感などを）覆い隠す、影を薄くする', 'My DCM thinks I\'m so upset you\'ve eclipsed me.', '首席公使は、あなたに存在感を奪われて私が動揺していると思っている。'],
    ['dot all one\'s I\'s', '', '細部まで抜かりなく仕上げる（"dot the I\'s and cross the T\'s"の口語的な言い方）', 'I asked them to dot all their I\'s before they brought it to you.', 'あなたに話を持って行く前に、細部まで抜かりなく詰めておくよう頼んだんだ。'],
    ['he made his bed, now let him lie in it', '', '自業自得だ、自分で蒔いた種は自分で刈り取れ（ことわざ）', 'I\'m not sure "he made his bed, now let\'s let him lie in it" is the best thing for global stability.', '「自業自得だから放っておけ」というのが、世界の安定にとって最善の道とは思えません。'],
    ['muscle through something', '', '力任せに乗り切る、強引にやり遂げる', 'We\'ll have to muscle through on our own.', '我々だけで力任せに乗り切るしかない。'],
    ['person of interest', '', '重要参考人（捜査用語）', 'The stylist is now a person of interest in the biggest security breach we\'ve had.', 'あのスタイリストは今や、うちで最大の警備侵害事件の重要参考人になっている。'],
    ['a counter-indication surfaced', '', 'それに反する兆候・情報が浮上した（医学用語contraindicationのもじり的用法）', 'A counter-indication surfaced. Too raw to report, but it came in through a credible source.', 'それに反する情報が浮上した。まだ報告するには生煮えだけど、信頼できる筋からのものよ。'],
    ['troll for something', '', '（衛星などが）情報を探るように捜索する', 'They had a satellite trolling for...', '彼らは……を探るための衛星を使っていた。'],
    ['reverse-engineer something', '', '（技術などを）分解・分析して模倣する', 'The Iranians have reverse-engineered the Chinese 802 missile.', 'イランは中国製802ミサイルを分解・分析して模倣したものだ。'],
    ['wordsmith', '', '言葉巧みな人、文章の名手（ここは皮肉交じりに使用）', 'Wordsmith.', '言葉の魔術師ってわけね（皮肉）。'],
    ['troop surge', '', '（戦地への）米軍の増派', 'He\'s not standing behind the president when announcing a troop surge.', '彼は大統領が増派を発表する時に、隣に立つような立場の人間じゃない。'],
    ['a hotline', '', '（緊急連絡用の）ホットライン、直通回線', 'Tried to get a hotline going, once upon a time, like the red phone with the Soviets.', 'かつて、ソ連との赤電話のようなホットラインを作ろうとしたことがある。'],
    ['moratorium on something', '', '（一時的な）停止、猶予', 'I\'m not sure a one-day moratorium on American bluster merits thanks.', 'アメリカの空威張りがたった1日止まったくらいで、感謝されるべきかは分からないわ。'],
    ['bluster', '', '空威張り、虚勢', 'I\'m not sure a one-day moratorium on American bluster merits thanks.', 'アメリカの空威張りがたった1日止まったくらいで、感謝されるべきかは分からないわ。'],
    ['come on the heels of something', '', '～の直後に、すぐ後を追って', 'Had it not been on the heels of the carrier attack.', '空母への攻撃の直後でさえなければ。'],
    ['a live issue', '', '現在進行中の懸案事項', 'Sources tell us that revenge for Soleimani is a live issue.', 'ソレイマーニへの報復は今なお現実の懸案だという情報がある。'],
    ['vet something', '', '（情報・人物の身元などを）審査する、裏取りする', 'Until we vet it, no one. I don\'t whisper unverified information.', '裏取りが済むまでは、誰にも話さない。裏の取れていない情報を漏らしたりしないの。'],
    ['whisper something up the chain', '', '（情報を）上層部にこっそり伝える', 'Not gonna whisper it up the chain?', '上層部にこっそり伝えるつもりはないの？'],
    ['dumb broad', '', '間抜けな女（軽蔑的なスラング）', 'Makes me look like a dumb broad.', 'それでは私が間抜けな女に見えてしまう。'],
    ['buy-in', '', '（特に上層部からの）賛同、了承', 'Which means he had buy-in from somebody with a lot of wasta.', 'つまり、かなりの影響力（コネ）を持つ人物から了承を得ていたということだ。'],
    ['wasta', '', 'コネ、人脈による裏の影響力（中東由来の口語表現）', 'Which means he had buy-in from somebody with a lot of wasta.', 'つまり、かなりの裏のコネを持つ人物から了承を得ていたということだ。'],
    ['freelance a call to somewhere', '', '（許可なく）独断で連絡を取る', 'If you freelance lob a call to a country with whom we have no diplomatic relations, it\'s a federal offense.', '国交のない国に勝手に電話をかけたりしたら、それは連邦法違反になる。'],
    ['a blanket no', '', '一切の例外を認めない完全な拒否', 'It wasn\'t a blanket no.', '完全に拒否したわけじゃなかったのよ。'],
    ['bubble-wrapped', '', '（プチプチ梱包材のように）過保護なまでに厳重に守られた', 'She\'s gonna be bubble-wrapped. Double the security, twice as visible.', '彼女は厳重に保護される。警備は倍にして、目立つようにもする。'],
    ['is this Charm School', '', '（皮肉って）ここはお上品な作法を教える学校か（訓練が甘いことへの当てこすり）', 'This isn\'t Charm School, right?', 'ここは行儀作法を教える学校じゃないでしょう？'],
    ['slink off', '', 'こそこそと姿を消す、逃げるように立ち去る', 'I realize it looks like he\'s slinking off with a hot young thing.', '彼が若い女とこそこそ姿を消したように見えるのは分かってる。'],
    ['if I were in your shoes', '', 'もし私があなたの立場だったら', 'If I were in your shoes, I would find the RSO.', '私があなたの立場なら、警備担当官を探すでしょうね。'],
    ['generate hysteria', '', '混乱・パニックを煽る', 'We\'re gonna bring in MI5. -That\'ll just generate more hysteria.', 'MI5を呼ぶ。-それは単に混乱を煽るだけよ。'],
    ['a stand-up guy', '', '筋の通った、信頼できる人物', 'You write it, I refuse to accept it. Makes you look like a stand-up guy.', '辞表を書いても私が受理しなければ、あなたは筋の通った人間に見える。']
  ];

  var LIST = {
    id: 'en-diplomat-s1e2',
    deckId: 'en',
    name: 'The Diplomat S1E2',
    note: '「The Diplomat」S1E2「Don\'t Call It a Kidnapping」の語彙・慣用句',
    words: WORDS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LIST;
  } else {
    global.WordLists = global.WordLists || {};
    global.WordLists[LIST.id] = LIST;
  }
})(typeof window !== 'undefined' ? window : globalThis);
