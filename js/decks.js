/**
 * 単語帳データ。
 *
 * 1 単語は以下の 4 つを持ち、この順番で提示される。
 *   term      … 単語
 *   meaning   … 日本語訳
 *   example   … その単語を含む例文
 *   exampleJa … 例文の日本語訳
 *
 * reading（発音・ピンインなど）は任意。
 * ID は term から自動生成されるため、途中に単語を挿入しても進捗はずれない。
 */
(function (global) {
  'use strict';

  var DECKS = [
    {
      id: 'en',
      code: 'EN',
      lang: 'en-US',
      name: '英語',
      words: [
        { term: 'abandon', reading: 'əˈbændən', meaning: '見捨てる、放棄する', example: 'They had to abandon the car in the snow.', exampleJa: '彼らは雪の中に車を置いていくしかなかった。' },
        { term: 'ability', reading: 'əˈbɪləti', meaning: '能力', example: 'She has the ability to solve hard problems.', exampleJa: '彼女は難しい問題を解く能力がある。' },
        { term: 'accept', reading: 'əkˈsept', meaning: '受け入れる', example: 'Please accept my apology.', exampleJa: 'どうか私の謝罪を受け入れてください。' },
        { term: 'accurate', reading: 'ˈækjərət', meaning: '正確な', example: 'His report was accurate and clear.', exampleJa: '彼の報告は正確で分かりやすかった。' },
        { term: 'achieve', reading: 'əˈtʃiːv', meaning: '達成する', example: 'We achieved our goal last month.', exampleJa: '私たちは先月、目標を達成した。' },
        { term: 'admit', reading: 'ədˈmɪt', meaning: '認める', example: 'He admitted that he was wrong.', exampleJa: '彼は自分が間違っていたと認めた。' },
        { term: 'advantage', reading: 'ədˈvæntɪdʒ', meaning: '利点、強み', example: 'Speaking two languages is a big advantage.', exampleJa: '2 か国語を話せるのは大きな強みだ。' },
        { term: 'afford', reading: 'əˈfɔːrd', meaning: '〜する余裕がある', example: "I can't afford a new laptop this year.", exampleJa: '今年は新しいノートパソコンを買う余裕がない。' },
        { term: 'allow', reading: 'əˈlaʊ', meaning: '許可する', example: "My parents don't allow me to stay out late.", exampleJa: '両親は私が夜遅くまで外にいるのを許さない。' },
        { term: 'ancient', reading: 'ˈeɪnʃənt', meaning: '古代の', example: 'We visited an ancient temple in Kyoto.', exampleJa: '私たちは京都で古代の寺院を訪れた。' },
        { term: 'anxious', reading: 'ˈæŋkʃəs', meaning: '不安な、切望して', example: 'She felt anxious before the interview.', exampleJa: '彼女は面接の前に不安を感じた。' },
        { term: 'appreciate', reading: 'əˈpriːʃieɪt', meaning: '感謝する、価値を認める', example: 'I really appreciate your help.', exampleJa: 'あなたの助けに本当に感謝しています。' },
        { term: 'approach', reading: 'əˈproʊtʃ', meaning: '近づく、取り組み方', example: 'A car approached the gate slowly.', exampleJa: '1 台の車がゆっくりと門に近づいた。' },
        { term: 'argue', reading: 'ˈɑːrɡjuː', meaning: '議論する、言い争う', example: 'They often argue about money.', exampleJa: '彼らはよくお金のことで言い争う。' },
        { term: 'arrange', reading: 'əˈreɪndʒ', meaning: '手配する、並べる', example: 'I arranged the meeting for Friday.', exampleJa: '私は会議を金曜日に手配した。' },
        { term: 'attempt', reading: 'əˈtempt', meaning: '試みる、試み', example: 'He made one last attempt to fix it.', exampleJa: '彼はそれを直そうと最後の試みをした。' },
        { term: 'available', reading: 'əˈveɪləbl', meaning: '利用できる、手が空いた', example: 'The doctor is not available today.', exampleJa: 'その医師は今日は手が空いていない。' },
        { term: 'avoid', reading: 'əˈvɔɪd', meaning: '避ける', example: 'Try to avoid eating late at night.', exampleJa: '夜遅くに食べるのは避けるようにしなさい。' },
        { term: 'aware', reading: 'əˈwer', meaning: '気づいている', example: "I wasn't aware of the new rule.", exampleJa: '私は新しい規則に気づいていなかった。' },
        { term: 'balance', reading: 'ˈbæləns', meaning: '均衡、残高', example: 'Check the balance in your account.', exampleJa: '口座の残高を確認してください。' },
        { term: 'behavior', reading: 'bɪˈheɪvjər', meaning: '行動、ふるまい', example: 'His behavior at the party surprised us.', exampleJa: 'パーティーでの彼のふるまいには驚いた。' },
        { term: 'benefit', reading: 'ˈbenɪfɪt', meaning: '利益、恩恵', example: 'Regular exercise has many benefits.', exampleJa: '定期的な運動には多くの利点がある。' },
        { term: 'borrow', reading: 'ˈbɑːroʊ', meaning: '借りる', example: 'Can I borrow your umbrella?', exampleJa: '傘を借りてもいいですか。' },
        { term: 'brief', reading: 'briːf', meaning: '短い、簡潔な', example: 'She gave a brief explanation.', exampleJa: '彼女は簡潔な説明をした。' },
        { term: 'capable', reading: 'ˈkeɪpəbl', meaning: '能力がある', example: 'He is capable of leading the team.', exampleJa: '彼はチームを率いる能力がある。' },
        { term: 'cause', reading: 'kɔːz', meaning: '原因、引き起こす', example: 'The rain caused a long delay.', exampleJa: '雨が長い遅れを引き起こした。' },
        { term: 'challenge', reading: 'ˈtʃælɪndʒ', meaning: '課題、挑戦する', example: 'Learning Chinese is a real challenge.', exampleJa: '中国語を学ぶのは本当に大変な挑戦だ。' },
        { term: 'charge', reading: 'tʃɑːrdʒ', meaning: '請求する、充電する', example: 'They charged me twice for the same meal.', exampleJa: '同じ食事の代金を二重に請求された。' },
        { term: 'claim', reading: 'kleɪm', meaning: '主張する、要求する', example: 'He claims that he saw the accident.', exampleJa: '彼はその事故を見たと主張している。' },
        { term: 'comfortable', reading: 'ˈkʌmftəbl', meaning: '快適な', example: 'This chair is very comfortable.', exampleJa: 'この椅子はとても快適だ。' },
        { term: 'compare', reading: 'kəmˈper', meaning: '比較する', example: "Let's compare the two plans.", exampleJa: '2 つの案を比較しよう。' },
        { term: 'complain', reading: 'kəmˈpleɪn', meaning: '不平を言う', example: 'She complained about the noise.', exampleJa: '彼女は騒音について不平を言った。' },
        { term: 'concern', reading: 'kənˈsɜːrn', meaning: '心配、関係する', example: 'Your safety is my main concern.', exampleJa: 'あなたの安全が私の一番の気がかりだ。' },
        { term: 'confident', reading: 'ˈkɑːnfɪdənt', meaning: '自信がある', example: "I'm confident that we can win.", exampleJa: '私たちは勝てると確信している。' },
        { term: 'consider', reading: 'kənˈsɪdər', meaning: '検討する、みなす', example: 'Please consider my proposal.', exampleJa: '私の提案を検討してください。' },
        { term: 'contain', reading: 'kənˈteɪn', meaning: '含む', example: 'This drink contains a lot of sugar.', exampleJa: 'この飲み物は砂糖を多く含んでいる。' },
        { term: 'continue', reading: 'kənˈtɪnjuː', meaning: '続ける', example: 'We continued walking in the rain.', exampleJa: '私たちは雨の中を歩き続けた。' },
        { term: 'convenient', reading: 'kənˈviːniənt', meaning: '便利な、都合のよい', example: 'The store is convenient for me.', exampleJa: 'その店は私にとって便利だ。' },
        { term: 'crowd', reading: 'kraʊd', meaning: '群衆', example: 'A large crowd gathered at the station.', exampleJa: '大勢の人が駅に集まった。' },
        { term: 'curious', reading: 'ˈkjʊriəs', meaning: '好奇心が強い', example: 'The children were curious about the machine.', exampleJa: '子どもたちはその機械に興味津々だった。' },
        { term: 'decide', reading: 'dɪˈsaɪd', meaning: '決める', example: 'We decided to leave early.', exampleJa: '私たちは早く出発することに決めた。' },
        { term: 'decrease', reading: 'dɪˈkriːs', meaning: '減少する', example: 'Sales decreased last winter.', exampleJa: '売上は昨冬に減少した。' },
        { term: 'deliver', reading: 'dɪˈlɪvər', meaning: '配達する、届ける', example: 'They deliver bread every morning.', exampleJa: '彼らは毎朝パンを配達する。' },
        { term: 'demand', reading: 'dɪˈmænd', meaning: '要求する、需要', example: 'The workers demanded better pay.', exampleJa: '労働者たちはより良い賃金を要求した。' },
        { term: 'depend', reading: 'dɪˈpend', meaning: '頼る、次第である', example: 'It depends on the weather.', exampleJa: 'それは天気次第だ。' },
        { term: 'describe', reading: 'dɪˈskraɪb', meaning: '描写する、説明する', example: 'Can you describe the man you saw?', exampleJa: '見かけた男性の特徴を説明できますか。' },
        { term: 'develop', reading: 'dɪˈveləp', meaning: '発展させる、開発する', example: 'The city developed very quickly.', exampleJa: 'その都市は非常に速く発展した。' },
        { term: 'difficult', reading: 'ˈdɪfɪkəlt', meaning: '難しい', example: 'This question is too difficult for me.', exampleJa: 'この問題は私には難しすぎる。' },
        { term: 'discover', reading: 'dɪˈskʌvər', meaning: '発見する', example: 'Scientists discovered a new planet.', exampleJa: '科学者たちは新しい惑星を発見した。' },
        { term: 'divide', reading: 'dɪˈvaɪd', meaning: '分ける', example: "Let's divide the work between us.", exampleJa: '仕事を二人で分けよう。' },
        { term: 'doubt', reading: 'daʊt', meaning: '疑う、疑い', example: 'I doubt he will come on time.', exampleJa: '彼が時間どおりに来るとは思えない。' },
        { term: 'eager', reading: 'ˈiːɡər', meaning: '熱心な、切望して', example: 'She is eager to start the new job.', exampleJa: '彼女は新しい仕事を始めたくてたまらない。' },
        { term: 'effort', reading: 'ˈefərt', meaning: '努力', example: 'It took a lot of effort to finish.', exampleJa: '終わらせるのに多くの努力が必要だった。' },
        { term: 'encourage', reading: 'ɪnˈkɜːrɪdʒ', meaning: '励ます、促す', example: 'My teacher encouraged me to try again.', exampleJa: '先生は私にもう一度やってみるよう励ましてくれた。' },
        { term: 'environment', reading: 'ɪnˈvaɪrənmənt', meaning: '環境', example: 'We must protect the environment.', exampleJa: '私たちは環境を守らなければならない。' },
        { term: 'escape', reading: 'ɪˈskeɪp', meaning: '逃げる', example: 'The cat escaped through the window.', exampleJa: '猫は窓から逃げ出した。' },
        { term: 'essential', reading: 'ɪˈsenʃl', meaning: '不可欠な', example: 'Water is essential for life.', exampleJa: '水は生命に不可欠だ。' },
        { term: 'estimate', reading: 'ˈestɪmeɪt', meaning: '見積もる', example: 'They estimated the cost at 500 dollars.', exampleJa: '彼らは費用を 500 ドルと見積もった。' },
        { term: 'evidence', reading: 'ˈevɪdəns', meaning: '証拠', example: 'There is no evidence for that story.', exampleJa: 'その話には証拠がない。' },
        { term: 'familiar', reading: 'fəˈmɪliər', meaning: 'よく知っている、なじみの', example: 'This song sounds familiar to me.', exampleJa: 'この曲は聞き覚えがある。' }
      ]
    },
    {
      id: 'zh',
      code: 'ZH',
      lang: 'zh-CN',
      name: '中国語',
      words: [
        { term: '家', reading: 'jiā', meaning: '家', example: '我家离车站很近。', exampleJa: '私の家は駅から近い。' },
        { term: '水', reading: 'shuǐ', meaning: '水', example: '请给我一杯水。', exampleJa: '水を一杯ください。' },
        { term: '工作', reading: 'gōngzuò', meaning: '仕事', example: '我的工作九点开始。', exampleJa: '私の仕事は 9 時に始まる。' },
        { term: '城市', reading: 'chéngshì', meaning: '都市', example: '这座城市很安静。', exampleJa: 'この都市はとても静かだ。' },
        { term: '朋友', reading: 'péngyou', meaning: '友達', example: '我和朋友去看电影。', exampleJa: '私は友達と映画を見に行く。' },
        { term: '吃', reading: 'chī', meaning: '食べる', example: '我们一起吃饭吧。', exampleJa: '一緒にご飯を食べよう。' },
        { term: '喝', reading: 'hē', meaning: '飲む', example: '我每天早上喝咖啡。', exampleJa: '私は毎朝コーヒーを飲む。' },
        { term: '说', reading: 'shuō', meaning: '話す', example: '你会说中文吗？', exampleJa: '中国語を話せますか。' },
        { term: '写', reading: 'xiě', meaning: '書く', example: '我想写一封信。', exampleJa: '手紙を 1 通書きたい。' },
        { term: '读', reading: 'dú', meaning: '読む', example: '我晚上读报纸。', exampleJa: '私は夜に新聞を読む。' },
        { term: '住', reading: 'zhù', meaning: '住む', example: '我住在北京。', exampleJa: '私は北京に住んでいる。' },
        { term: '书', reading: 'shū', meaning: '本', example: '这本书很有意思。', exampleJa: 'この本はとても面白い。' },
        { term: '饭', reading: 'fàn', meaning: 'ご飯、食事', example: '饭已经好了。', exampleJa: 'ご飯はもうできている。' },
        { term: '早上', reading: 'zǎoshang', meaning: '朝', example: '我早上六点起床。', exampleJa: '私は朝 6 時に起きる。' },
        { term: '晚上', reading: 'wǎnshang', meaning: '夜', example: '他晚上工作。', exampleJa: '彼は夜に働く。' },
        { term: '白天', reading: 'báitiān', meaning: '昼間', example: '白天这里很热闹。', exampleJa: '昼間ここはとてもにぎやかだ。' },
        { term: '大', reading: 'dà', meaning: '大きい', example: '他们的房子很大。', exampleJa: '彼らの家はとても大きい。' },
        { term: '小', reading: 'xiǎo', meaning: '小さい', example: '我养了一只小狗。', exampleJa: '私は小さい犬を飼っている。' },
        { term: '漂亮', reading: 'piàoliang', meaning: 'きれいな', example: '这条裙子真漂亮。', exampleJa: 'このスカートは本当にきれいだ。' },
        { term: '贵', reading: 'guì', meaning: '(値段が)高い', example: '这块手表太贵了。', exampleJa: 'この腕時計は高すぎる。' },
        { term: '便宜', reading: 'piányi', meaning: '安い', example: '我找到了一家便宜的旅馆。', exampleJa: '安い宿を見つけた。' },
        { term: '快', reading: 'kuài', meaning: '速い', example: '这趟火车很快。', exampleJa: 'この列車はとても速い。' },
        { term: '慢', reading: 'màn', meaning: '遅い', example: '请说得慢一点。', exampleJa: 'もう少しゆっくり話してください。' },
        { term: '总是', reading: 'zǒngshì', meaning: 'いつも', example: '他总是迟到。', exampleJa: '彼はいつも遅刻する。' },
        { term: '从不', reading: 'cóngbù', meaning: '決して〜ない', example: '我从不喝酒。', exampleJa: '私は決してお酒を飲まない。' },
        { term: '现在', reading: 'xiànzài', meaning: '今', example: '我现在不能说话。', exampleJa: '今は話せない。' },
        { term: '以后', reading: 'yǐhòu', meaning: '後で', example: '我以后再打给你。', exampleJa: '後でまた電話するね。' },
        { term: '学习', reading: 'xuéxí', meaning: '学ぶ', example: '我想学习做菜。', exampleJa: '料理を習いたい。' },
        { term: '教', reading: 'jiāo', meaning: '教える', example: '她教数学。', exampleJa: '彼女は数学を教えている。' },
        { term: '明白', reading: 'míngbai', meaning: '理解する', example: '我不明白这个词。', exampleJa: 'この単語が分からない。' },
        { term: '想要', reading: 'xiǎngyào', meaning: '欲しい、〜したい', example: '我想要一杯咖啡。', exampleJa: 'コーヒーが 1 杯欲しい。' },
        { term: '能', reading: 'néng', meaning: '〜できる', example: '我今天不能去。', exampleJa: '今日は行けない。' },
        { term: '知道', reading: 'zhīdào', meaning: '知っている', example: '我不知道他的电话号码。', exampleJa: '彼の電話番号を知らない。' },
        { term: '认识', reading: 'rènshi', meaning: '(面識が)ある、見知っている', example: '我认识他很多年了。', exampleJa: '私は彼と知り合って何年にもなる。' },
        { term: '路', reading: 'lù', meaning: '道', example: '这条路很宽。', exampleJa: 'この道はとても広い。' },
        { term: '车', reading: 'chē', meaning: '車', example: '我的车很旧了。', exampleJa: '私の車はとても古い。' },
        { term: '钱', reading: 'qián', meaning: 'お金', example: '我没有足够的钱。', exampleJa: '十分なお金がない。' },
        { term: '家人', reading: 'jiārén', meaning: '家族', example: '我的家人住在乡下。', exampleJa: '私の家族は田舎に住んでいる。' },
        { term: '幸福', reading: 'xìngfú', meaning: '幸せな', example: '他们过得很幸福。', exampleJa: '彼らは幸せに暮らしている。' },
        { term: '累', reading: 'lèi', meaning: '疲れた', example: '工作以后我很累。', exampleJa: '仕事のあと私はとても疲れている。' }
      ]
    },
    {
      id: 'es',
      code: 'ES',
      lang: 'es-ES',
      name: 'スペイン語',
      words: [
        { term: 'la casa', meaning: '家', example: 'Mi casa está cerca de la estación.', exampleJa: '私の家は駅の近くにある。' },
        { term: 'el agua', meaning: '水', example: '¿Puedes traerme un vaso de agua?', exampleJa: '水を一杯持ってきてくれる？' },
        { term: 'el trabajo', meaning: '仕事', example: 'Mi trabajo empieza a las nueve.', exampleJa: '私の仕事は 9 時に始まる。' },
        { term: 'la ciudad', meaning: '都市、町', example: 'Esta ciudad es muy tranquila.', exampleJa: 'この町はとても静かだ。' },
        { term: 'el amigo', meaning: '友達', example: 'Voy al cine con un amigo.', exampleJa: '友達と映画に行く。' },
        { term: 'comer', meaning: '食べる', example: 'Vamos a comer algo ligero.', exampleJa: '軽く何か食べよう。' },
        { term: 'beber', meaning: '飲む', example: 'Bebo café todas las mañanas.', exampleJa: '私は毎朝コーヒーを飲む。' },
        { term: 'hablar', meaning: '話す', example: '¿Hablas español?', exampleJa: 'スペイン語を話しますか。' },
        { term: 'escribir', meaning: '書く', example: 'Quiero escribir una carta.', exampleJa: '手紙を書きたい。' },
        { term: 'leer', meaning: '読む', example: 'Leo el periódico por la noche.', exampleJa: '私は夜に新聞を読む。' },
        { term: 'vivir', meaning: '住む、生きる', example: 'Vivo en Madrid desde 2020.', exampleJa: '私は 2020 年からマドリードに住んでいる。' },
        { term: 'el libro', meaning: '本', example: 'Este libro es muy interesante.', exampleJa: 'この本はとても面白い。' },
        { term: 'la comida', meaning: '食事、食べ物', example: 'La comida ya está lista.', exampleJa: '食事の用意はもうできている。' },
        { term: 'la mañana', meaning: '朝、午前', example: 'Mañana por la mañana tengo clase.', exampleJa: '明日の朝は授業がある。' },
        { term: 'la noche', meaning: '夜', example: 'Trabajo por la noche.', exampleJa: '私は夜に働く。' },
        { term: 'el día', meaning: '日、昼', example: 'Hoy es un día perfecto.', exampleJa: '今日は完璧な日だ。' },
        { term: 'grande', meaning: '大きい', example: 'Su casa es muy grande.', exampleJa: '彼らの家はとても大きい。' },
        { term: 'pequeño', meaning: '小さい', example: 'Tengo un perro pequeño.', exampleJa: '私は小さい犬を飼っている。' },
        { term: 'bonito', meaning: 'きれいな、かわいい', example: 'Qué vestido tan bonito.', exampleJa: 'なんてきれいなワンピースだろう。' },
        { term: 'caro', meaning: '(値段が)高い', example: 'Este reloj es demasiado caro.', exampleJa: 'この時計は高すぎる。' },
        { term: 'barato', meaning: '安い', example: 'Encontré un hotel barato.', exampleJa: '安いホテルを見つけた。' },
        { term: 'rápido', meaning: '速い', example: 'El tren es muy rápido.', exampleJa: 'その電車はとても速い。' },
        { term: 'despacio', meaning: 'ゆっくりと', example: 'Habla más despacio, por favor.', exampleJa: 'もっとゆっくり話してください。' },
        { term: 'siempre', meaning: 'いつも', example: 'Siempre llego temprano.', exampleJa: '私はいつも早く着く。' },
        { term: 'nunca', meaning: '決して〜ない', example: 'Nunca he estado en México.', exampleJa: 'メキシコには行ったことがない。' },
        { term: 'ahora', meaning: '今', example: 'Ahora no puedo hablar.', exampleJa: '今は話せない。' },
        { term: 'después', meaning: '後で', example: 'Te llamo después.', exampleJa: '後で電話するね。' },
        { term: 'aprender', meaning: '学ぶ', example: 'Quiero aprender a cocinar.', exampleJa: '料理を習いたい。' },
        { term: 'enseñar', meaning: '教える', example: 'Ella enseña matemáticas.', exampleJa: '彼女は数学を教えている。' },
        { term: 'entender', meaning: '理解する', example: 'No entiendo esta palabra.', exampleJa: 'この単語が分からない。' },
        { term: 'querer', meaning: '欲しい、〜したい', example: 'Quiero un café, por favor.', exampleJa: 'コーヒーをください。' },
        { term: 'poder', meaning: '〜できる', example: 'No puedo ir hoy.', exampleJa: '今日は行けない。' },
        { term: 'saber', meaning: '(知識として)知っている', example: 'No sé su número.', exampleJa: '彼の番号を知らない。' },
        { term: 'conocer', meaning: '(面識が)ある、知り合う', example: 'Quiero conocer a tu hermana.', exampleJa: 'あなたの妹さんと知り合いになりたい。' },
        { term: 'la calle', meaning: '通り', example: 'Hay mucho ruido en la calle.', exampleJa: '通りはとてもうるさい。' },
        { term: 'el coche', meaning: '車', example: 'Mi coche es muy viejo.', exampleJa: '私の車はとても古い。' },
        { term: 'el dinero', meaning: 'お金', example: 'No tengo dinero suficiente.', exampleJa: '十分なお金がない。' },
        { term: 'la familia', meaning: '家族', example: 'Mi familia vive en el campo.', exampleJa: '私の家族は田舎に住んでいる。' },
        { term: 'feliz', meaning: '幸せな', example: 'Estoy muy feliz hoy.', exampleJa: '今日はとても幸せだ。' },
        { term: 'cansado', meaning: '疲れた', example: 'Estoy cansado después del trabajo.', exampleJa: '仕事のあとで疲れている。' }
      ]
    },
    {
      id: 'fr',
      code: 'FR',
      lang: 'fr-FR',
      name: 'フランス語',
      words: [
        { term: 'la maison', meaning: '家', example: 'Ma maison est près de la gare.', exampleJa: '私の家は駅の近くにある。' },
        { term: "l'eau", reading: 'f.', meaning: '水', example: "Je voudrais un verre d'eau.", exampleJa: '水を一杯ください。' },
        { term: 'le travail', meaning: '仕事', example: "J'aime mon travail.", exampleJa: '私は自分の仕事が好きだ。' },
        { term: 'la ville', meaning: '都市、町', example: 'Cette ville est très calme.', exampleJa: 'この町はとても静かだ。' },
        { term: "l'ami", reading: 'm.', meaning: '友達', example: 'Je vais au cinéma avec un ami.', exampleJa: '友達と映画に行く。' },
        { term: 'manger', meaning: '食べる', example: 'On mange à midi.', exampleJa: '私たちは正午に食べる。' },
        { term: 'boire', meaning: '飲む', example: 'Je bois du café le matin.', exampleJa: '私は朝コーヒーを飲む。' },
        { term: 'parler', meaning: '話す', example: 'Vous parlez français ?', exampleJa: 'フランス語を話しますか。' },
        { term: 'écrire', meaning: '書く', example: 'Je veux écrire une lettre.', exampleJa: '手紙を書きたい。' },
        { term: 'lire', meaning: '読む', example: 'Je lis avant de dormir.', exampleJa: '私は寝る前に本を読む。' },
        { term: 'habiter', meaning: '住む', example: "J'habite à Lyon.", exampleJa: '私はリヨンに住んでいる。' },
        { term: 'le livre', meaning: '本', example: 'Ce livre est passionnant.', exampleJa: 'この本はとても面白い。' },
        { term: 'le repas', meaning: '食事', example: 'Le repas est prêt.', exampleJa: '食事の用意ができた。' },
        { term: 'le matin', meaning: '朝', example: 'Je cours le matin.', exampleJa: '私は朝に走る。' },
        { term: 'la nuit', meaning: '夜', example: 'Il travaille la nuit.', exampleJa: '彼は夜に働く。' },
        { term: 'le jour', meaning: '日、昼間', example: 'Quel beau jour !', exampleJa: 'なんていい日だろう。' },
        { term: 'grand', meaning: '大きい', example: 'Il habite dans une grande maison.', exampleJa: '彼は大きな家に住んでいる。' },
        { term: 'petit', meaning: '小さい', example: "J'ai un petit chien.", exampleJa: '私は小さい犬を飼っている。' },
        { term: 'beau', meaning: '美しい', example: 'Quel beau paysage !', exampleJa: 'なんて美しい景色だろう。' },
        { term: 'cher', meaning: '(値段が)高い、親愛な', example: 'Ce manteau est trop cher.', exampleJa: 'このコートは高すぎる。' },
        { term: 'vite', meaning: '速く', example: 'Ne parle pas si vite.', exampleJa: 'そんなに速く話さないで。' },
        { term: 'lentement', meaning: 'ゆっくりと', example: "Parlez plus lentement, s'il vous plaît.", exampleJa: 'もっとゆっくり話してください。' },
        { term: 'toujours', meaning: 'いつも', example: 'Il arrive toujours en retard.', exampleJa: '彼はいつも遅れて来る。' },
        { term: 'jamais', meaning: '決して〜ない', example: "Je ne suis jamais allé en Espagne.", exampleJa: '私はスペインに行ったことがない。' },
        { term: 'maintenant', meaning: '今', example: 'Je ne peux pas parler maintenant.', exampleJa: '今は話せない。' },
        { term: 'plus tard', meaning: '後で', example: "Je t'appelle plus tard.", exampleJa: '後で電話するね。' },
        { term: 'apprendre', meaning: '学ぶ', example: 'Je veux apprendre à cuisiner.', exampleJa: '料理を習いたい。' },
        { term: 'enseigner', meaning: '教える', example: 'Elle enseigne les mathématiques.', exampleJa: '彼女は数学を教えている。' },
        { term: 'comprendre', meaning: '理解する', example: 'Je ne comprends pas ce mot.', exampleJa: 'この単語が分からない。' },
        { term: 'vouloir', meaning: '欲しい、〜したい', example: 'Je voudrais un café.', exampleJa: 'コーヒーをお願いします。' },
        { term: 'pouvoir', meaning: '〜できる', example: "Je ne peux pas venir aujourd'hui.", exampleJa: '今日は行けない。' },
        { term: 'savoir', meaning: '(知識として)知っている', example: 'Je ne sais pas son numéro.', exampleJa: '彼の番号を知らない。' },
        { term: 'connaître', meaning: '(面識が)ある、知っている', example: 'Je connais bien ce quartier.', exampleJa: '私はこの地区をよく知っている。' },
        { term: 'la rue', meaning: '通り', example: 'Il y a beaucoup de bruit dans la rue.', exampleJa: '通りはとてもうるさい。' },
        { term: 'la voiture', meaning: '車', example: 'Ma voiture est très vieille.', exampleJa: '私の車はとても古い。' },
        { term: "l'argent", reading: 'm.', meaning: 'お金', example: "Je n'ai pas assez d'argent.", exampleJa: '十分なお金がない。' },
        { term: 'la famille', meaning: '家族', example: 'Ma famille habite à la campagne.', exampleJa: '私の家族は田舎に住んでいる。' },
        { term: 'heureux', meaning: '幸せな', example: "Je suis très heureux aujourd'hui.", exampleJa: '今日はとても幸せだ。' },
        { term: 'fatigué', meaning: '疲れた', example: 'Je suis fatigué après le travail.', exampleJa: '仕事のあとで疲れている。' },
        { term: 'le temps', meaning: '時間、天気', example: "Je n'ai pas le temps.", exampleJa: '時間がない。' }
      ]
    }
  ];

  function decorate(deck, word, isCustom) {
    return {
      id: deck.id + ':' + word.term,
      deckId: deck.id,
      term: word.term,
      reading: word.reading || '',
      meaning: word.meaning,
      example: word.example || '',
      exampleJa: word.exampleJa || '',
      custom: isCustom === true
    };
  }

  DECKS.forEach(function (deck) {
    deck.words = deck.words.map(function (word) {
      return decorate(deck, word, false);
    });
  });

  function getDeck(deckId) {
    return DECKS.filter(function (deck) {
      return deck.id === deckId;
    })[0] || null;
  }

  /**
   * 収録単語に自作単語を足したデッキ一覧を返す。
   * @param {Object} customMap { [deckId]: [{term, reading, meaning, example, exampleJa}] }
   */
  function withCustom(customMap) {
    var custom = customMap || {};
    return DECKS.map(function (deck) {
      var extra = (custom[deck.id] || [])
        .filter(function (word) { return word && word.term && word.meaning; })
        .map(function (word) { return decorate(deck, word, true); });

      var seen = {};
      var words = deck.words.concat(extra).filter(function (word) {
        if (seen[word.id]) return false;
        seen[word.id] = true;
        return true;
      });

      return {
        id: deck.id,
        code: deck.code,
        lang: deck.lang,
        name: deck.name,
        words: words
      };
    });
  }

  var api = { DECKS: DECKS, getDeck: getDeck, withCustom: withCustom };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.Decks = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
