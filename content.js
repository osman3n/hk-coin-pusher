/* 一蚊雞 — content.js
 * All game data: stages, people, props, machine lines.
 * Plain global, no modules (must work from file://).
 */
(function (G) {
  'use strict';

  // ── 七個人 ─────────────────────────────────────────────────────────────
  // Recurring across stages so the player watches them age.
  var PEOPLE = {
    jan: { name: '阿珍', trad: '阿珍', note: '工廠妹 → 電子廠 → K 房' },
    keung: { name: '強哥', trad: '強哥', note: '的士司機，九龍城大' },
    chan: { name: '陳伯', trad: '陳伯', note: '樓下士多老闆' },
    man: { name: '阿文', trad: '阿文', note: '1997 走，2003 返' },
    yi: { name: '阿儀', trad: '阿儀', note: '護士' },
    hong: { name: '阿康', trad: '阿康', note: '大學生，夾公仔</br>' },
    ho: { name: '阿豪', trad: '阿豪', note: '外賣仔 → 物流' }
  };

  // ── 七個階段 ────────────────────────────────────────────────────────────
  // big = must all be collected. small = bonus.
  var STAGES = [
    {
      id: 's1972', year: 1972, name: '清潔．隧道',
      sub: '海底隧道通車．垃圾蟲出動',
      shop: '士多',
      palette: { shell: 0x6b4a2f, trim: 0x2a1d12, glow: 0xffb347, sign: 0xd9a441 },
      open: '部機新返嚟，貼紙都未撕。',
      done: '燈光管閃兩下先著。有人喺下面叫：唔該一包煙。',
      big: ['sodaCase', 'crtTv', 'mahjongTable'],
      small: ['lapSapChung', 'minibusSign', 'hongLokKei', 'lukBo', 'newspaper', 'chalkHopscotch']
    },
    {
      id: 's1980', year: 1980, name: '地鐵．霓虹',
      sub: '地鐵通車．前途開始講',
      shop: '電器舖',
      palette: { shell: 0x8d8d93, trim: 0x1a1a1e, glow: 0xff4d6d, sign: 0xff6b5e },
      open: '翻新咗。有霓虹，有電子聲。',
      done: '霓虹牌著咗，隔籬街都見到。',
      big: ['neonSign', 'arcadeCab', 'cassetteDeck'],
      small: ['brickPhone', 'redWhiteBlue', 'mtrTicket', 'sharkFinBowl', 'yukLong', 'digitalWatch']
    },
    {
      id: 's1997', year: 1997, name: '回歸．啟德',
      sub: '八達通．機場搬走',
      shop: '機舖',
      palette: { shell: 0x2f4a5c, trim: 0x101820, glow: 0x4ecdc4, sign: 0x4ecdc4 },
      open: '換咗花紋膠板。數碼計數。',
      done: '捲閘升起，入面有街機聲。',
      big: ['kaiTakPlane', 'emigrationCase', 'karaokeCabinet'],
      small: ['arcadeToken', 'yesCard', 'tamagotchi', 'pager', 'octopus', 'cantoTape']
    },
    {
      id: 's2003', year: 2003, name: '沙士．自由行',
      sub: '口罩．迪士尼．鐘樓',
      shop: '網吧',
      palette: { shell: 0x4a4a4a, trim: 0x141414, glow: 0x9bb8ff, sign: 0x9bb8ff },
      open: '金屬殼。有支消毒液喺側邊。',
      done: '藍色燈，煙霧，屏幕一排排。',
      big: ['starFerryClock', 'disneyCastle', 'internetCafePc'],
      small: ['mask', 'flipPhone', 'mp3Player', 'weddingCard', 'milkPowder', 'eDictionary']
    },
    {
      id: 's2010', year: 2010, name: '智能電話．排隊',
      sub: '人人都排隊等一樣嘢',
      shop: '手機舖',
      palette: { shell: 0x1e1e22, trim: 0x0a0a0c, glow: 0x7ee787, sign: 0x7ee787 },
      open: '觸控螢幕。LED 燈帶。有部機掃 QR。',
      done: '白光，玻璃門，職員企喺門口。',
      big: ['clawMachine', 'bubbleTeaSign', 'lightStickBoard'],
      small: ['smartphone', 'taobaoParcel', 'lightStick', 'sharedBike', 'phoneOctopus', 'returnBox']
    },
    {
      id: 's2020', year: 2020, name: '疫情．兩餸飯',
      sub: '膠板．消費券．外賣',
      shop: '兩餸飯舖',
      palette: { shell: 0x3a3a3a, trim: 0x121212, glow: 0xffd166, sign: 0xffd166 },
      open: '無接觸支付。有塊膠板。',
      done: '發熱燈著，八個盤。阿姐問要唔要飯。',
      big: ['loengSungCounter', 'deliveryBox', 'voucherPoster'],
      small: ['mask2', 'ratTest', 'homeReturnCard', 'rubbishBag', 'bubbleCup', 'onlineLessonHeadset']
    },
    {
      id: 's2026', year: 2026, name: '而家',
      sub: '玻璃．4K．App',
      shop: '便利店',
      palette: { shell: 0xe8e8ea, trim: 0x2a2a2e, glow: 0x5eb9ff, sign: 0x5eb9ff },
      open: '玻璃。4K。有個 App。有個復古模式。',
      done: '自動門開，叮噹。',
      big: ['northboundCase', 'concertBoard', 'paymentTerminal'],
      small: ['aiBot', 'taobaoBox', 'loengSungBag', 'concertStub', 'massageVoucher', 'oldOctopus']
    }
  ];

  // ── 道具 ────────────────────────────────────────────────────────────────
  // build(ctx) returns a THREE.Object3D built from primitives only.
  // Materials come from a shared palette so the whole set reads as one toy.
  var PROPS = {
    // ═══ 1972 ═══
    sodaCase: {
      name: '汽水櫃', jyut: 'hei3 seoi2 gwai6', en: 'Soda crate',
      owner: 'jan', big: true, weight: 2.2, radius: 0.115,
      year: 1972,
      use: '汽水唔放雪櫃，放一個鐵箱：上面一支支玻璃樽浸住冰水，下面開個窿漏水。買一支，飲完把空樽交返去，伙記數過先找返幾毫子。',
      fact: '按樽每個玻璃樽退五毫——七十年代一支細玻璃樽汽水本身都係幾毫子，所以飲完唔還樽，等於蝕咗半支水。',
      mem: '阿爸放工帶我落樓下，一樽綠寶，兩支飲管。<b>我一直以為係因為我乖。</b>後來先知道，佢係想遲啲返屋企。'
    },
    crtTv: {
      name: '大牛龜電視機', jyut: 'daai6 ngau4 gwai1 din6 si6 gei1', en: 'Boxy CRT television',
      owner: 'jan', big: true, weight: 2.4, radius: 0.12,
      year: 1972,
      use: '一部機擺喺廳中央，上面蓋一塊繡花布，天線用錫紙包住。轉台要行去機前面扭掣，所以「遙控」係一個屋企人。',
      fact: '香港第一個電視台（麗的映聲，1957 年）係收費有線電視，要接線入屋、要交月費；免費無線電視要等到 1967 年無綫開台。',
      mem: '阿爸做夜班看更，日頭瞓覺，夜晚出去。我哋食飯望住部機，阿媽話<b>食完先准睇</b>。其實部機成日壞。'
    },
    mahjongTable: {
      name: '麻雀枱', jyut: 'maa4 zoek3 toi2', en: 'Mahjong table',
      owner: 'chan', big: true, weight: 2.6, radius: 0.125,
      year: 1972,
      use: '摺枱打開，四張凳，一副牌，四個鐘。輸贏記在紙上，一個月結一次；屋企細，所以打完要收枱食飯。',
      fact: '香港的麻雀館 1956 年合法化，牌照數目一直封頂在 144 個——剛好等於一副麻雀的牌數。',
      mem: '開枱要搬枱，搬完先發現<b>少咗隻東</b>。搵足半個鐘，最後喺我個袋度。冇人信我。'
    },
    lapSapChung: {
      name: '垃圾蟲', jyut: 'laap6 saap3 cung4', en: 'Litterbug mascot', owner: null,
      year: 1972,
      use: '政府 1972 年「清潔香港」運動的吉祥物，出現在電視、海報、垃圾桶和學童的習作紙上。小朋友見到人亂拋垃圾，會指住佢嗌「垃圾蟲！」',
      fact: '垃圾蟲本來係反面教材——設計成綠色、有釘、惹人厭，用來嚇人唔好亂拋垃圾。結果全港小朋友愛上佢，政府唯有讓佢一直紅落去。',
      mem: '綠色，有釘，笑得好假。<b>成個七十年代嘅香港都被佢盯住。</b>'
    },
    minibusSign: {
      name: '紅色小巴牌', jyut: 'hung4 sik1 siu2 baa1', en: 'Red minibus plate', owner: null,
      year: 1972,
      use: '紅色小巴冇站，手一揮就停，落車位由乘客自己嗌。車頭擋風玻璃放一塊白底紅字牌，寫住目的地，司機自己寫、自己貼。',
      fact: '紅色小巴的數目自 1970 年代起被政府凍結，唔可以再增；今日全港公共小巴的法定上限係 4,350 輛，紅巴佔的只會越來越少。',
      mem: '手寫字，一塊一塊。<b>寫字嘅人退休之後，冇人接。</b>'
    },
    hongLokKei: {
      name: '康樂棋', jyut: 'hong1 lok6 kei2', en: 'Chinese ludo', owner: null,
      year: 1972,
      use: '一張紙棋盤攤在飯桌上，每人一枚棋子（多數係波子），輪流擲骰，行到指定格就前進或者後退。最快到終點嗰個贏。',
      fact: '康樂棋棋盤有一百格，背景畫的係一個遊樂場：打羽毛球、放紙飛機、滑滑梯——一副紙棋，就當一個公園用。',
      mem: '打波子，一家人擠喺客廳。<b>永遠有人話你出千。</b>'
    },
    lukBo: {
      name: '綠寶橙汁', jyut: 'luk6 bou2 caang4 zap1', en: 'Green Spot orange', owner: null,
      year: 1972,
      use: '一樽玻璃裝橙汁，同可樂一齊排在士多的冰水櫃裡。開樽要開瓶器，飲完樽要還，唔還就蝕按金。',
      fact: '綠寶（Green Spot）其實係 1930 年代的美國品牌，在香港由本地代理入樽、自己賣廣告，所以香港人一直當佢係本地汽水。',
      mem: '玻璃樽，要還。<b>夏天嘅味道，同埋手指黏黏嘅感覺。</b>'
    },
    newspaper: {
      name: '報紙檔', jyut: 'bou3 zi2 dong3', en: 'Newspaper stand', owner: null,
      year: 1972,
      use: '街口一塊木板加兩隻鐵架，報紙摺成三分一夾在釘上，一份一份賣。檔主順手賣香煙、火柴、馬經。',
      fact: '七十年代香港仲有「晚報」——《星島晚報》《華僑晚報》下午出版，所以一個報紙檔一日要做兩輪生意，早上賣日報，四點後賣晚報。',
      mem: '摺起夾喺釘上面，一份一份賣。<b>老闆記得邊個睇邊份。</b>'
    },
    chalkHopscotch: {
      name: '跳飛機粉筆', jyut: 'tiu3 fei1 gei1 fan2 bat1', en: 'Hopscotch chalk', owner: null,
      year: 1972,
      use: '一支粉筆，在屋邨走廊或者球場水泥地畫九格，數字寫大啲，然後單腳跳。落雨就冇，第二日再畫。',
      fact: '香港舊式徙置大廈用長走廊設計，一條走廊貫通幾十伙；所以走廊同時係晾衫地方、單車場同跳飛機的畫布。',
      mem: '樓下走廊，粉筆一畫，<b>成條街都係你嘅。</b>落雨就冇。'
    },

    // ═══ 1980 ═══
    neonSign: {
      name: '霓虹招牌', jyut: 'ngai4 hung4 baai4 zoeng1', en: 'Neon sign',
      owner: 'keung', big: true, weight: 2.3, radius: 0.12,
      year: 1980,
      use: '招牌橫伸出馬路，一個字一個字疊上去，藥房、酒樓、夜總會靠佢指路。落雨時霓虹反光在濕地上，一條街變成兩層。',
      fact: '霓虹招牌由師傅用玻璃管在火頭上逐段屈出來，一間舖的招牌可以掛足四十年；屋宇署 2009 年起用一年時間清拆五千個棄置招牌，實際拆了五千五百個——這門手藝現在只剩幾間廠。',
      mem: '我住嗰條街，夜晚唔使開燈。<b>有一次停電，全條街黑咗，好多人行出嚟。</b>我第一次覺得，原來我哋係一齊住。'
    },
    arcadeCab: {
      name: '街機', jyut: 'gaai1 gei1', en: 'Arcade cabinet',
      owner: 'keung', big: true, weight: 2.5, radius: 0.125,
      year: 1980,
      use: '機舖在樓上或者地庫，一入去黑，只有螢幕光。入錢、按掣、爆機之後，旁邊的人會替你高興三秒。',
      fact: '遊戲機中心牌照訂明：穿校服的不得進場，而且不可以按遊戲成績送獎品、獎金或者退款。所以香港機舖從來唔派公仔，只賣你一個高分。',
      mem: '放學唔返屋企，企喺機舖睇人打。<b>俾人趕就換間，一日可以去五間。</b>我從來冇錢玩。'
    },
    cassetteDeck: {
      name: '卡式錄音機', jyut: 'kaa1 sik1 luk6 jam1 gei1', en: 'Cassette recorder',
      owner: 'jan', big: true, weight: 2.1, radius: 0.11,
      year: 1980,
      use: '一邊聽收音機，一邊用手指按住錄音掣，一有廣告就鬆手。錄好的帶上寫滿歌名，倒帶要用鉛筆。',
      fact: '八十年代香港的翻版錄音帶係街邊生意：高峰期估計過百檔街頭賣帶、十萬盒翻版帶流通，海關真正要拉的是背後幾十間地下複製工場。',
      mem: '錄歌要等收音機播，<b>一有廣告就嬲。</b>錄咗三個月，一疊帶，寫滿歌名。'
    },
    brickPhone: {
      name: '大哥大', jyut: 'daai6 go1 daai6', en: 'Brick phone', owner: null,
      year: 1980,
      use: '一部機連電池重過一公斤，出街要用手提袋裝住。通話費按分鐘計，所以每句話都好短。',
      fact: '香港第一批「大哥大」係 1984 年由和記傳訊引入的 Motorola DynaTAC 8000X，售價以萬元計；同一時期，一個普通工人的月薪只係幾千元。',
      mem: '一萬幾蚊。<b>攞出嚟即係身份，攞唔出即係唔係。</b>'
    },
    redWhiteBlue: {
      name: '紅白藍袋', jyut: 'hung4 baak6 laam4 doi2', en: 'Red-white-blue bag', owner: null,
      year: 1980,
      use: '搬屋、回鄉、開檔都用佢：三色膠布縫成，一袋裝得落一個家庭半年的家當，拉鏈一拉抬上肩就走。',
      fact: '紅白藍膠袋 1960 年代已經在香港出現，最初大量用來裝貨返大陸探親；因為平、防水、夠大，佢由「窮」的符號變成設計系的題目。',
      mem: '便宜，周圍都係。<b>然後有人話佢係設計，我突然覺得自己屋企好有型。</b>'
    },
    mtrTicket: {
      name: '地鐵儲值票', jyut: 'dei6 tit3 cyu5 zik6 piu3', en: 'MTR stored-value ticket', owner: null,
      year: 1980,
      use: '一張紙卡，入閘插進去，出閘再插，票值用完就買過。有人用完唔丟，夾在書裡當書籤。',
      fact: '地鐵 1981 年推出通用儲值票，票值由三十元到二百元；1997 年八達通面世，儲值票在 1998 年 8 月 31 日停止發售。',
      mem: '一張紙，用完要買過。<b>有人儲起佢當書籤。</b>'
    },
    sharkFinBowl: {
      name: '魚翅撈飯碗', jyut: 'jyu4 ci3 laau1 faan6 wun2', en: 'Shark-fin rice bowl', owner: null,
      year: 1980,
      use: '一大碗紅燒翅，上面一羹蟹肉，直接倒落白飯。唔係為咗味道，係為咗坐在對面嗰個人見到。',
      fact: '「魚翅撈飯」出自 1970 年代初的香港股市狂潮：魚翅本身淡，要撈飯才夠飽，撈得起就係身份。股市一散，這道菜就變成一個笑話。',
      mem: '牛市嘅笑話，<b>笑到成個時代都有名。</b>'
    },
    yukLong: {
      name: '玉郎漫畫', jyut: 'juk6 long4 maan6 waa2', en: 'Pulp comic', owner: null,
      year: 1980,
      use: '薄薄一本，三十頁，坐在租書檔的矮凳上睇——唔係買，係租，睇完放回。老闆娘會計時，睇得太慢會咳一聲。',
      fact: '玉郎集團 1986 年上市，係香港第一間上市的漫畫公司；1987 年股災之後，創辦人黃玉郎被控造假賬，1991 年入獄。',
      mem: '印刷廠三班制。<b>一毫子睇一次，老闆娘會趕你。</b>'
    },
    digitalWatch: {
      name: '電子錶', jyut: 'din6 zi2 biu1', en: 'Digital watch', owner: null,
      year: 1980,
      use: '黑色膠帶，紅色數字，有計數機、有鬧鐘、有「嗶嗶」聲。上堂放在抽屜裡按，老師一聽就知。',
      fact: '香港的鐘錶出口額由 1980 年的 62.88 億港元升到 1989 年的 173.55 億；高峰期香港係全球手錶出口量最大的地方——你手上那隻便宜電子錶，多數係香港裝配的。',
      mem: '有計數機。<b>上堂偷偷玩，老師沒收咗三隻。</b>'
    },

    // ═══ 1997 ═══
    kaiTakPlane: {
      name: '啟德飛機', jyut: 'kai2 dak1 gei1', en: 'Kai Tak 747',
      owner: 'keung', big: true, weight: 2.4, radius: 0.125,
      year: 1997,
      use: '飛機由九龍城上空低飛入啟德，機輪擦過大廈天台；住客靠電視雪花知道邊一班機到。',
      fact: '啟德的 13 跑道要飛機在九龍塘上空做一個約 47 度右轉，降到三百米才對正跑道，機師靠山上那塊黑白格仔板判斷幾時轉。',
      mem: '飛機飛過，電視會雪花，<b>全屋一齊嗌。</b>後來機場搬走，我第一次覺得，靜係一種聲音。'
    },
    emigrationCase: {
      name: '移民行李箱', jyut: 'ji4 man4 hang4 lei5 seung1', en: 'Emigration suitcase',
      owner: 'man', big: true, weight: 2.2, radius: 0.115,
      year: 1997,
      use: '一個大篋、兩張機票、一疊文件；機場送機的人比走的人多，揮手之後要等好久才有人肯動。',
      fact: '香港政府估計 1987 至 1996 年間約有五十萬人移居外地，等於全港人口百分之八——大部分去加拿大和澳洲。',
      mem: '表哥走嗰日，機場合照。<b>我當時十二歲，覺得佢好威。</b>之後三十年冇見。'
    },
    karaokeCabinet: {
      name: '卡拉OK 電視櫃', jyut: 'kaa1 laa1 OK din6 si6 gwai6', en: 'Karaoke cabinet',
      owner: 'jan', big: true, weight: 2.5, radius: 0.125,
      year: 1997,
      use: '一部電視、一部卡拉 OK 機、兩支有線咪；點歌要打編號，畫面係風景加字幕。唱到走音，全場拍手。',
      fact: '1997 年 1 月，尖沙咀寶勒巷一間卡拉 OK 被縱火，十七人死亡；之後香港的娛樂場所被加裝逃生通道和消防規格。',
      mem: '唱到走音，全場拍手，<b>我以為自己好紅。</b>第二次去，我先知道佢哋係禮貌。'
    },
    arcadeToken: {
      name: '冒險樂園代幣', jyut: 'mou6 him2 lok6 jyun4 doi6 bai6', en: 'Arcade token', owner: null,
      year: 1997,
      use: '一個硬幣換一個遊戲，或者換一張票；票儲起來可以換禮物。禮物永遠比票的價錢便宜。',
      fact: '香港有兩種牌：遊戲機中心牌照不准送獎品，「有獎娛樂遊戲」牌照可以送禮物但不可以送現金；同一間舖可以兩張牌都有。',
      mem: '1994 年，上水名都第一間。<b>你玩緊嗰部機，就係由呢個年代開始。</b>'
    },
    yesCard: {
      name: 'Yes! Card', jyut: 'jet1 si2 kaat1', en: 'Yes! Card', owner: null,
      year: 1997,
      use: '一張卡片大小的偶像相，一元一張，從《Yes!》雜誌的贈品變成獨立生意。買回來夾在文件夾，重複的拿去同人換。',
      fact: 'Yes! Card 最初一元一張，出到第六十四期加到兩元；佢由《Yes!》雜誌出版，係香港第一代「用零用錢買的偶像」。',
      mem: '每個少年嘅第一個經濟體。<b>閃卡可以換三張普通卡。</b>'
    },
    tamagotchi: {
      name: '他媽哥池', jyut: 'taa1 maa1 go1 ci4', en: 'Tamagotchi', owner: null,
      year: 1997,
      use: '一隻電子蛋，掛在書包上，三個掣：餵、玩、清潔。上堂偷餵，老師行過就收手。',
      fact: '1997 年他媽哥池出過香港特別版，機殼上印住「香港」兩個字；這隻蛋今日係 M+ 博物館的藏品。',
      mem: '電子蛋，上堂偷餵。<b>死過四隻，每次都話係意外。</b>'
    },
    pager: {
      name: '傳呼機', jyut: 'cyun4 fu1 gei1', en: 'Pager', owner: null,
      year: 1997,
      use: '機響，搵電話，全城跑：士多、酒樓、街邊電話亭，排隊。覆機係一種禮貌。',
      fact: '傳呼機在香港高峰期一年有過百萬用戶；到 2026 年 3 月，全港只剩三個傳呼系統、二十五部接收器仍然運作。',
      mem: '機響，搵電話，全城跑。<b>嗰陣時，覆機係一種禮貌。</b>'
    },
    octopus: {
      name: '八達通', jyut: 'baat3 daat6 tung1', en: 'Octopus card', owner: null,
      year: 1997,
      use: '一張卡，拍一下就入閘，唔使找零錢；增值去便利店或者地鐵客務中心。掉失可以報失，但多數人選擇再買一張。',
      fact: '八達通 1997 年 9 月 1 日推出，到 2017 年市面流通超過三千四百五十萬張，等於每人平均五張、每日交易超過一千三百萬宗。',
      mem: '1997。<b>到今日都係全世界最乾淨嘅車票。</b>'
    },
    cantoTape: {
      name: '四大天王卡式帶', jyut: 'sei3 daai6 tin1 wong4', en: 'Cantopop cassette', owner: null,
      year: 1997,
      use: '一面五首，A 面播完要反帶；街邊買的多數係翻版，五元一盒，封面印刷模糊。',
      fact: '「四大天王」係 1992 年香港傳媒封出來的稱號（劉德華、張學友、郭富城、黎明），唔係四個人自己組的團；之後十幾年，這個詞被借去形容任何行業最紅的四個人。',
      mem: '一面五首，<b>倒帶要用鉛筆。</b>'
    },

    // ═══ 2003 ═══
    starFerryClock: {
      name: '天星鐘樓', jyut: 'tin1 sing1 zung1 lau4', en: 'Star Ferry clock tower',
      owner: 'yi', big: true, weight: 2.5, radius: 0.125,
      year: 2003,
      use: '放工坐天星過海，出閘望一眼鐘樓，再行去巴士站。情侶約在鐘樓下面等，因為那是唯一唔需要講地址的地方。',
      fact: '愛丁堡廣場的鐘樓有 48 年歷史，2006 年清拆，抗議的人當佢係「中環最後一座公共時鐘」。',
      mem: '拆嗰晚，好多人企喺度睇，<b>冇人出聲。</b>我啱啱落夜班，企喺最後面。'
    },
    disneyCastle: {
      name: '迪士尼城堡', jyut: 'dik6 si6 nei4 sing4 bou2', en: 'Disneyland castle',
      owner: 'yi', big: true, weight: 2.3, radius: 0.12,
      year: 2003,
      use: '一日門票，排隊兩個鐘，入到去先發現城堡比想像中細。買一個米奇頭氣球，離場時已經漏氣。',
      fact: '香港迪士尼在竹篙灣填海三百公頃建成，2005 年 9 月 12 日開幕，開幕時係全世界最小的迪士尼樂園。',
      mem: '開幕嗰日排咗四個鐘，<b>入到去落雨。</b>我妹喊，我買咗把遮，好貴。'
    },
    internetCafePc: {
      name: '網吧電腦', jyut: 'mong5 baa1 din6 nou5', en: 'Internet cafe PC',
      owner: 'man', big: true, weight: 2.4, radius: 0.12,
      year: 2003,
      use: '通宵十二蚊，一間房幾十部機，煙霧、即食麵味、槍聲。有人睡在椅子上，有人打到天光直接返學。',
      fact: '香港網吧在 2001 年底高峰期有大約六百間，之後打價格戰，五年內只剩低一百間左右。',
      mem: '通宵十二蚊，打到天光，<b>返學照去。</b>老細會幫我哋睇水。'
    },
    mask: {
      name: '口罩', jyut: 'gau2 zaau3', en: 'Face mask', owner: null,
      year: 2003,
      use: '一日換一個，N95 留給醫院；街上人人一塊，講話要靠眼神同手勢。',
      fact: '2003 年沙士，香港共有 1,755 人染病、299 人死亡；口罩由醫院用品變成全城日用品，只用咗幾個星期。',
      mem: '全城戴，缺貨，排隊。<b>有人喺街邊賣，一盒三百。</b>'
    },
    flipPhone: {
      name: '翻蓋手機', jyut: 'faan1 goi3 sau2 gei1', en: 'Flip phone', owner: null,
      year: 2003,
      use: '合上「啪」一聲，係一種表演。換殼、換鈴聲、用紅外線傳一張相給隔籬嗰個人。',
      fact: '香港的電話號碼 1995 年 1 月 1 日由七位加到八位：家居電話前面加「2」、傳呼機加「7」、手機加「9」，三種號碼一眼分得出。',
      mem: 'Nokia。貪食蛇，換殼。<b>合上嗰下「啪」聲，係一種表演。</b>'
    },
    mp3Player: {
      name: 'MP3 機', jyut: 'em1 pi1 saam1 gei1', en: 'MP3 player', owner: null,
      year: 2003,
      use: '一條白色耳機線，一千首歌，用電腦拖進去。線永遠打結，打結永遠解唔開。',
      fact: '2005 年 11 月，香港男子陳乃明（網名「古惑天王」）因為在網上用 BitTorrent 發放電影被判監三個月，係全球第一宗 BT 侵權入獄案——那年頭，一部 MP3 機加一條寬頻線，就係整個唱片業的敵人。',
      mem: '一千首，白色耳機線。<b>條線永遠打結。</b>'
    },
    weddingCard: {
      name: '囍帖', jyut: 'hei2 tip3', en: 'Wedding invitation', owner: null,
      year: 2003,
      use: '一張紅色燙金卡，印住新人名字、酒樓名、時間。派帖要親手派，收帖要計人情。',
      fact: '香港的「囍帖街」係灣仔利東街，全盛時期幾十間印刷舖排滿一條街；2000 年代重建之後，只剩幾間搬了入商場。',
      mem: '喜帖街。印刷、燙金，<b>成條街都係紅色。</b>'
    },
    milkPowder: {
      name: '奶粉罐', jyut: 'naai5 fan2 gun2', en: 'Milk powder tin', owner: null,
      year: 2003,
      use: '自由行旅客拖住行李箱，一罐一罐買，藥房門口排隊。本地媽媽買唔到，於是有了「限奶令」。',
      fact: '2013 年 3 月 1 日起，離開香港的人每人只可以帶 1.8 公斤（約兩罐）配方奶粉；違例罰款五十萬、監禁兩年。',
      mem: '自由行，藥房，拖篋。<b>一罐可以賣返去。</b>'
    },
    eDictionary: {
      name: '電子辭典', jyut: 'din6 zi2 ci4 din2', en: 'Electronic dictionary', owner: null,
      year: 2003,
      use: '一部掌上機，查字、發音、英漢漢英；同時有十幾個小遊戲，成績永遠比英文進步得快。',
      fact: '香港的電子辭典由權智（Group Sense）帶起，第一代「快譯通」1989 年推出——比智能手機早二十年出現在學生的書包裡。',
      mem: '查一個字，玩三個小遊戲。<b>成績冇進步，但小遊戲爆機。</b>'
    },

    // ═══ 2010 ═══
    clawMachine: {
      name: '夾公仔機', jyut: 'gaap3 gung1 zai2 gei1', en: 'Claw machine',
      owner: 'hong', big: true, weight: 2.5, radius: 0.125,
      year: 2010,
      use: '入兩蚊，控兩個掣，爪一開一合。爪永遠鬆，公仔永遠差一厘米。',
      fact: '香港冇專門法例規管夾公仔機；2021 年高等法院裁定夾公仔機店唔需要「公眾娛樂場所」牌照，之後街邊一間接一間開。',
      mem: '夾咗三百蚊，<b>隻公仔淘寶二十九蚊。</b>我知，但我仲夾。'
    },
    bubbleTeaSign: {
      name: '珍珠奶茶招牌', jyut: 'zan1 zyu1 naai5 caa4', en: 'Bubble tea sign',
      owner: 'hong', big: true, weight: 2.2, radius: 0.115,
      year: 2010,
      use: '排隊四十分鐘，點半糖少冰，杯身有記號，飲三口，影相，然後掉。',
      fact: '珍珠奶茶 1990 年代初由台灣品牌帶入香港，第一批連鎖店（例如休閒小站）開得很快；二十年後，這條隊變成香港的街景。',
      mem: '排四十分鐘，飲三口，影相，<b>然後掉。</b>我女朋友話，排隊係為咗一齊排。'
    },
    lightStickBoard: {
      name: '韓團應援燈牌', jyut: 'hon4 tyun4 jing3 wun4 dang1 paai4', en: 'K-pop light banner',
      owner: 'yi', big: true, weight: 2.1, radius: 0.11,
      year: 2010,
      use: '一塊發光牌，寫住團名同成員名，舉高過頭。全場同一秒亮起，似一片會唱歌的牆。',
      fact: '香港體育館的場館規則寫明：燈牌不可以大過 40cm × 50cm，帶入場的物品一律限 40 × 50 × 20cm——你舉嗰塊牌有尺寸上限，唔係想幾大就幾大。',
      mem: '全場一片粉紅色，<b>我嗌到冇聲。</b>我媽問我嗌乜，我話你唔會明。'
    },
    smartphone: {
      name: '智能電話', jyut: 'zi3 nang4 din6 waa2', en: 'Smartphone', owner: null,
      year: 2010,
      use: '一部機取代咗相機、地圖、八達通、報紙、遊戲機；同時取代咗等車時發呆的權利。',
      fact: '政府統計處的調查：十歲及以上人士擁有智能手機的比例，2018 年 89.8%、2020 年 92.1%、2022 年 97.1%；但手機支付要到 2020 年代才追上八達通——因為一張卡本來已經很好用。',
      mem: '一部機，取代咗上面所有嘢。<b>包括上面所有嘢嘅樂趣。</b>'
    },
    taobaoParcel: {
      name: '淘寶包裹', jyut: 'tou4 bou2 baau1 gwo2', en: 'Taobao parcel', owner: null,
      year: 2010,
      use: '集運：貨先送去大陸的倉，再一箱寄來香港，郵費按公斤計。等兩星期，拆箱嗰下係整個月最開心。',
      fact: '香港係自由港：一般貨品入口唔收關稅，只有煙、酒、電油同甲醇要打稅——所以淘寶包裹過關冇稅單，集運公司收你的每一蚊，都係運費。',
      mem: '集運，郵費，等兩星期。<b>拆開嗰下係整個月最開心。</b>'
    },
    lightStick: {
      name: '應援手燈', jyut: 'jing3 wun4 sau2 dang1', en: 'Light stick', owner: null,
      year: 2010,
      use: '一支手燈，開關、換色、跟節拍閃。全場同一秒舉起，似排練過。',
      fact: '香港體育館（紅館）1983 年 4 月 27 日開幕，係香港第一個大型室內場館；舞台擺中間、四面觀眾，所以全場一齊舉燈，係場館設計出嚟的效果。',
      mem: '韓團，紅館，<b>全場同一秒舉起。</b>'
    },
    sharedBike: {
      name: '共享單車', jyut: 'gung6 hoeng2 daan1 ce1', en: 'Shared bike', owner: null,
      year: 2010,
      use: '掃碼解鎖，半小時幾蚊，踩去地鐵站就泊在路邊。然後單車越泊越多，變成行人路上的障礙物。',
      fact: '香港第一間共享單車 GoBee.Bike 2017 年 4 月 20 日開業，兩日後已經有車被人掉落城門河；公司 2018 年 7 月宣布結束香港業務，服務到 7 月 17 日——由開業到清盤，一共十五個月。',
      mem: '擺滿天橋底，然後冇人理。<b>有人將佢哋疊成一座塔。</b>'
    },
    phoneOctopus: {
      name: '手機八達通', jyut: 'sau2 gei1 baat3 daat6 tung1', en: 'Octopus in phone', owner: null,
      year: 2010,
      use: '把卡塞入電話殼，或者用 App 加一張虛擬卡；拍機變成拍電話。',
      fact: '八達通可以負數，最多負三十五元——那叫「備用餘額」，設計出來係讓你出閘時唔會被閘機夾住。',
      mem: '拍機變拍電話。<b>有一次冇電，全城幫唔到你。</b>'
    },
    returnBox: {
      name: '網購退貨箱', jyut: 'mong5 gau3 teoi3 fo3', en: 'Returns box', owner: null,
      year: 2010,
      use: '買錯、買多、買完唔想要，就去便利店或者智能櫃寄回。退貨比買貨更需要計劃。',
      fact: '香港法例冇規定網購要有冷靜期：消委會 2018 年的研究指出，除了少數受監管行業，商戶冇義務讓你退貨——退唔退到，睇間舖自己寫的條款。',
      mem: '買咗唔要，退咗再買。<b>物流公司多謝你。</b>'
    },

    // ═══ 2020 ═══
    loengSungCounter: {
      name: '兩餸飯玻璃櫃', jyut: 'loeng5 sung3 faan6', en: 'Two-dish rice counter',
      owner: 'ho', big: true, weight: 2.6, radius: 0.13,
      year: 2020,
      use: '玻璃櫃後面八個盤，兩餸或者三餸，阿姐用大羹舀，飯另計。三十五蚊，十分鐘食完。',
      fact: '兩餸飯 2021 年底大約一百間，2022 年 2 月三百三十間，到 2023 年 8 月已經超過五百間——係疫情期間開得最快的一種食肆。',
      mem: '三十五蚊，三餸，<b>阿姐問我要唔要飯。</b>我話要，佢加咗一大羹。我冇講多謝，因為趕時間。'
    },
    deliveryBox: {
      name: '外賣保溫箱', jyut: 'ngoi6 maai6 bou2 wan1 soeng1', en: 'Delivery hotbox',
      owner: 'ho', big: true, weight: 2.3, radius: 0.12,
      year: 2020,
      use: '一個保溫箱，綁在電單車後面或者背在肩上；平台派單，時間以分鐘計。',
      fact: '平台一直把外賣車手當作「自僱」，所以冇僱員福利、冇工傷補償；2021 年 11 月，foodpanda 車手就因為每單工錢被削而發起罷工。',
      mem: '九樓，冇電梯，<b>兩個月瘦咗十磅。</b>客人問我點解咁慢。'
    },
    voucherPoster: {
      name: '消費券海報', jyut: 'siu1 fai3 hyun3 hoi2 bou3', en: 'Voucher poster',
      owner: 'chan', big: true, weight: 2.1, radius: 0.11,
      year: 2020,
      use: '政府 2021 年派消費券，分幾期入落支付工具；店舖貼海報，寫明收邊一種。',
      fact: '2021 年的消費券總額五千元，分兩至三期發放，只可以用四款指定支付工具：八達通、支付寶香港、Tap & Go、微信支付香港。',
      mem: '五千蚊，買咗部電話，<b>剩返三百。</b>阿爺話佢嗰代冇呢啲嘢，但佢都有去排。'
    },
    mask2: {
      name: '口罩（彩色）', jyut: 'gau2 zaau3', en: 'Coloured mask', owner: null,
      year: 2020,
      use: '彩色口罩，配衫、配心情；有人一整櫃，按星期幾排好。',
      fact: '香港 2020 年 7 月起強制在公眾地方戴口罩，違例定額罰款五千元；口罩令一直維持到 2023 年 3 月 1 日才全面取消，前後超過兩年半。',
      mem: '後來有顏色。<b>有人襯衫，有人襯心情。</b>'
    },
    ratTest: {
      name: '快速測試', jyut: 'faai3 cuk1 cak1 si3', en: 'Rapid test', owner: null,
      year: 2020,
      use: '撩鼻子、撩喉嚨，等十五分鐘，睇兩條線。一條線世界照轉，兩條線全屋停擺。',
      fact: '2022 年 4 月，香港搞咗三日「全民快速抗原測試」，市民自願上報，最後只找到三千多宗陽性。',
      mem: '兩條線，全屋停擺。<b>一條線，世界照轉。</b>'
    },
    homeReturnCard: {
      name: '回鄉卡', jyut: 'wui4 hoeng1 kaat1', en: 'Home Return Permit', owner: null,
      year: 2020,
      use: '一張卡，過關用。回鄉證要續期，續期要預約，預約要排隊。',
      fact: '回鄉證（港澳居民來往內地通行證）由廣東省公安廳簽發，有效期十年；2023 年通關之後，續證的人龍排到辦事處門外。',
      mem: '北上，按摩，飲茶，買餸。<b>星期六朝早過關，晚上返嚟。</b>'
    },
    rubbishBag: {
      name: '垃圾徵費指定袋', jyut: 'laap6 saap3 zing1 fai3 zi2 ding6 doi2', en: 'Rubbish bag', owner: null,
      year: 2020,
      use: '垃圾要入指定袋，袋要在超市買，價錢按容量。政策一改再改，袋一直放在櫃桶。',
      fact: '垃圾徵費原定 2024 年 8 月 1 日實施，指定袋已經印好、上架發售；結果 5 月 27 日政府宣布無限期押後，袋就由必需品變成紀念品。',
      mem: '買咗個袋，政策冇咗。<b>袋仲喺櫃桶。</b>'
    },
    bubbleCup: {
      name: '手搖飲品杯', jyut: 'sau2 jiu4 jam2 ban2 bui1', en: 'Bubble tea cup', owner: null,
      year: 2020,
      use: '一杯手搖飲品，半糖少冰，封口機壓一層膠膜，飲管一插。飲完杯同蓋分開丟。',
      fact: '2024 年 4 月 22 日起，香港禁止食肆提供即棄膠餐具同膠飲管；手搖店改派紙飲管，客人第一句抱怨係「會溶」。',
      mem: '半糖少冰，膠杯，飲管。<b>飲完唔知掉邊。</b>'
    },
    onlineLessonHeadset: {
      name: '網課耳機', jyut: 'mong5 fo3 ji5 gei1', en: 'Online class headset', owner: null,
      year: 2020,
      use: '一副耳機、一個鏡頭、一個會議號碼。老師對住空氣講書，學生全部關鏡頭。',
      fact: '2020 年 1 月 25 日教育局宣布停課，之後一再延期——由「不早於三月十六日」到「不早於四月二十日」；那半年，香港學生的課室是一個熒幕。',
      mem: '老師對住空氣講書，<b>同學全部熄鏡頭。</b>'
    },

    // ═══ 2026 ═══
    northboundCase: {
      name: '北上行李箱', jyut: 'bak1 soeng5 hang4 lei5 seung1', en: 'Northbound suitcase',
      owner: 'ho', big: true, weight: 2.4, radius: 0.125,
      year: 2026,
      use: '星期六朝早過關，晚上返嚟；行李箱裡係日用品、藥、超市貨。有人去深圳按腳，有人去東莞買餸。',
      fact: '「港車北上」2023 年 7 月 1 日實施，香港私家車可以經港珠澳大橋入廣東；假日大橋的車龍，係香港人週末的新邊境。',
      mem: '星期六朝早過關，晚上返嚟，<b>行李箱滿晒。</b>我而家做物流，送嘅就係呢啲箱。'
    },
    concertBoard: {
      name: '演唱會應援牌', jyut: 'jin2 ceong3 wui2 jing3 wun4 paai4', en: 'Concert banner',
      owner: 'yi', big: true, weight: 2.2, radius: 0.115,
      year: 2026,
      use: '一塊應援牌，寫住名字同一句話，舉高。搶飛靠網速，搶唔到就在二手平台付溢價。',
      fact: '啟德體育園 2025 年 3 月開幕，主場館有五萬個座位——1998 年關閉的啟德機場，二十七年後變成香港最大的演唱會場地。',
      mem: '搶飛搶咗三個鐘，入到場喊咗。<b>我媽問我喊乜，我話你唔會明。</b>佢話，我明。'
    },
    paymentTerminal: {
      name: '電子支付終端', jyut: 'din6 zi2 zi1 fu6 zung1 dyun1', en: 'Payment terminal',
      owner: 'chan', big: true, weight: 2.0, radius: 0.105,
      year: 2026,
      use: '一部機，貼住一排 QR code，收 Alipay、WeChat Pay、八達通、信用卡。貼咗三年，仲有客人問「得唔得架？」',
      fact: '轉數快（FPS）2018 年 9 月 17 日由金管局推出，可以用手機號碼即時過數；但香港人真正習慣掃碼付款要等到 2020 年代——之前八達通食咗交通同小額，信用卡食咗大額，中間一直係現金。',
      mem: '貼咗三年，<b>冇人知個 code 係乜。</b>有人掃完會問：得唔得架？'
    },
    aiBot: {
      name: 'AI 聊天機械人', jyut: 'AI liu4 tin1 gei1 haai6 jan4', en: 'AI chatbot', owner: null,
      year: 2026,
      use: '打一句問題，等三秒，得到一段好似答案的文字。用佢寫信、寫功課、寫辭職信。',
      fact: '香港大學 2023 年 2 月禁止學生用 ChatGPT 做功課，係香港第一間；之後一年，幾乎每間大學都出咗自己的 AI 指引。',
      mem: '你問佢香港邊度好玩，<b>佢答你以上全部。</b>'
    },
    taobaoBox: {
      name: '淘寶集運箱', jyut: 'tou4 bou2 zaap6 wan6 soeng1', en: 'Taobao consolidation box', owner: null,
      year: 2026,
      use: '一箱二十件，來自唔同店舖，集運到同一個地址。拆箱之後，紙箱疊在走廊等回收。',
      fact: '「包郵到港」唔係郵政服務，而係一條貨車路線：貨物先入東莞或深圳的集運倉合併，再用貨車經口岸運落香港——你以為係郵寄，其實係物流公司的車隊。',
      mem: '一箱二十件，<b>十九件唔記得自己買過。</b>'
    },
    loengSungBag: {
      name: '兩餸飯外賣袋', jyut: 'loeng5 sung3 faan6 ngoi6 maai6 doi2', en: 'Two-dish takeaway bag', owner: null,
      year: 2026,
      use: '一個膠袋，兩個發泡膠盒，飯同餸分開裝。三十五蚊，而家四十。',
      fact: '「香港兩餸飯關注組」的 Facebook 地圖由 2021 年底開始記錄，到 2023 年 8 月已經標了 527 間店、七萬幾個成員——一個群組，變成全港最齊的兩餸飯名單。',
      mem: '三十五蚊，<b>而家四十。</b>'
    },
    concertStub: {
      name: '演唱會票尾', jyut: 'jin2 ceong3 wui2 piu3 mei5', en: 'Concert ticket stub', owner: null,
      year: 2026,
      use: '一張紙尾，印住座位、日期、價錢。電子票之後，這張紙變成要自己印，或者永遠唔會存在。',
      fact: '香港法例禁止高於面值轉售門票——《公眾娛樂場所條例》第 6 條，最高罰款二千元；但康文署在兩年間的執法記錄係零宗檢控，所以「黃牛」一直存在。',
      mem: '電子票之後，<b>呢張變咗收藏品。</b>'
    },
    massageVoucher: {
      name: '北上按摩券', jyut: 'bak1 soeng5 on3 mou4 hyun3', en: 'Massage voucher', owner: null,
      year: 2026,
      use: '兩個鐘，一百蚊，按腳加推油；師傅會問你「大力啲定細力啲」。',
      fact: '香港的按摩院受《按摩院條例》規管：向異性提供全身按摩，或者按摩範圍由肩以下到膝以上的場所，都要向警方牌照課領牌——一張按摩床，在香港係受監管的場所。',
      mem: '兩個鐘，一百蚊。<b>有人話平過香港，有人話唔敢去。</b>'
    },
    oldOctopus: {
      name: '舊式八達通', jyut: 'gau6 sik1 baat3 daat6 tung1', en: 'Old Octopus card', owner: null,
      year: 2026,
      use: '一張舊卡，卡面係自己張相，背面有編號。換咗電話之後，卡仲在抽屜裡。',
      fact: '八達通 2020 年代推出「樂悠咭」，六十歲以上才可以申請，用兩元搭車；普通的長者八達通唔在此列，要換卡。',
      mem: '卡面有張相，<b>相入面嗰個人已經唔係你。</b>'
    }
  };

  // ── 部機把聲 ────────────────────────────────────────────────────────────
  // Short, dry, in the machine's voice. Cantonese.
  var MACHINE = {
    idle: [
      '老細，慢慢嚟。',
      '你估我唔知你想點。',
      '呢個位，好多人試過。',
      '我 1972 年出廠。你嗰陣仲未出世。',
      '後面嗰啲銀，唔關我事。',
      '你拍我，我就叫管理處。',
      '我唔會壞。我已經壞過七次。'
    ],
    byStage: {
      s1972: ['部機新返嚟，貼紙都未撕。', '嗰陣時，一蚊可以買到嘢。'],
      s1980: ['翻新咗。有霓虹，有電子聲。', '呢個年代，人人都趕住去邊。'],
      s1997: ['換咗花紋膠板。數碼計數。', '有人走，有人留。我兩樣都見過。'],
      s2003: ['金屬殼。有支消毒液喺側邊。', '嗰排，好少人敢摸我。'],
      s2010: ['觸控螢幕。冇人再問我幾點。', '人人都望住自己嗰部機。'],
      s2020: ['無接觸支付。有塊膠板。', '我而家要消毒先可以開工。'],
      s2026: ['玻璃。4K。有個 App。', '我有個復古模式。冇人用。']
    },
    slap: [
      '喂。',
      '你拍我，我唔會快啲。',
      '管理處電話：2888 0000。你打。',
      '痛。我唔係機器，我係老機器。',
      '再拍，我報警。'
    ],
    win: ['攞去。', '你贏。今次。', '唔好話我冇提醒你。'],
    bigFall: ['呢件嘢，有人等咗好耐。', '小心啲。佢有故事。'],
    empty: ['冇銀喇。','你仲有？','我唔會幫你。'],
    lost: [
      '跌落去喇。側邊冇窿。',
      '嗰邊，唔計數。',
      '睇住個窿先。',
      '枱面好大。窿好窄。'
    ]
  };

  // ── 故事線 ──────────────────────────────────────────────────────────────
  // 七個階段，七個人，同一個機底。一分鐘讀完。
  var STORY = {
    title: '樓梯底嗰一蚊',
    premise: '一部推銀機 1972 年擺到而家，跌入機底嘅嘢冇人執返。',
    beats: [
      { stage: 's1972', line: '阿珍買完汽水，找返個一蚊，手一滑碌入機底。蹲低掂唔到，趕住返廠。' },
      { stage: 's1980', line: '抬機翻新，阿珍嗰個一蚊仲喺機底。強哥講俾老闆聽，老闆話由得佢。' },
      { stage: 's1997', line: '阿文上機前打最後一局，啲銀跌晒落機底。佢話唔要喇，拉行李走。' },
      { stage: 's2003', line: '阿儀抹機，機底掃出一堆銀。佢冇交去櫃面，掃返入去，繼續抹。' },
      { stage: 's2010', line: '阿康影低機底個窿，貼上網。幾百個留言，一個都冇嚟。' },
      { stage: 's2020', line: '阿豪喺機邊食兩餸飯，個一蚊跌咗落去。佢望一眼，繼續食。' },
      { stage: 's2026', line: '陳伯嚟交鎖匙，部機要搬。抬開機，最底係阿珍 1972 年嘅一蚊。' }
    ],
    ending: {
      line: '樓梯底，七個人，一堆冇人攞返嘅嘢。',
      text: '部機抬走之前講咗一句：對唔住，我找唔到數。之後自動門開，叮噹一聲，同第一日一樣。'
    }
  };

  // Defaults so no prop silently inherits a weight of 1 and behaves like a coin
  // in the physics. Small finds are light and shoveable; big items are set above.
  Object.keys(PROPS).forEach(function (id) {
    var d = PROPS[id];
    if (!d.weight) d.weight = d.big ? 2.3 : 1.35;
    if (!d.radius) d.radius = d.big ? 0.118 : 0.072;
  });

  G.CONTENT = { PEOPLE: PEOPLE, STAGES: STAGES, PROPS: PROPS, MACHINE: MACHINE, STORY: STORY };
})(window);
