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
      mem: '阿爸放工帶我落樓下，一樽綠寶，兩支飲管。<b>我一直以為係因為我乖。</b>後來先知道，佢係想遲啲返屋企。'
    },
    crtTv: {
      name: '大牛龜電視機', jyut: 'daai6 ngau4 gwai1 din6 si6 gei1', en: 'Boxy CRT television',
      owner: 'jan', big: true, weight: 2.4, radius: 0.12,
      mem: '阿爸做夜班看更，日頭瞓覺，夜晚出去。我哋食飯望住部機，阿媽話<b>食完先准睇</b>。其實部機成日壞。'
    },
    mahjongTable: {
      name: '麻雀枱', jyut: 'maa4 zoek3 toi2', en: 'Mahjong table',
      owner: 'chan', big: true, weight: 2.6, radius: 0.125,
      mem: '開枱要搬枱，搬完先發現<b>少咗隻東</b>。搵足半個鐘，最後喺我個袋度。冇人信我。'
    },
    lapSapChung: {
      name: '垃圾蟲', jyut: 'laap6 saap3 cung4', en: 'Litterbug mascot', owner: null,
      mem: '綠色，有釘，笑得好假。<b>成個七十年代嘅香港都被佢盯住。</b>'
    },
    minibusSign: {
      name: '紅色小巴牌', jyut: 'hung4 sik1 siu2 baa1', en: 'Red minibus plate', owner: null,
      mem: '手寫字，一塊一塊。<b>寫字嘅人退休之後，冇人接。</b>'
    },
    hongLokKei: {
      name: '康樂棋', jyut: 'hong1 lok6 kei2', en: 'Chinese ludo', owner: null,
      mem: '打波子，一家人擠喺客廳。<b>永遠有人話你出千。</b>'
    },
    lukBo: {
      name: '綠寶橙汁', jyut: 'luk6 bou2 caang4 zap1', en: 'Green Spot orange', owner: null,
      mem: '玻璃樽，要還。<b>夏天嘅味道，同埋手指黏黏嘅感覺。</b>'
    },
    newspaper: {
      name: '報紙檔', jyut: 'bou3 zi2 dong3', en: 'Newspaper stand', owner: null,
      mem: '摺起夾喺釘上面，一份一份賣。<b>老闆記得邊個睇邊份。</b>'
    },
    chalkHopscotch: {
      name: '跳飛機粉筆', jyut: 'tiu3 fei1 gei1 fan2 bat1', en: 'Hopscotch chalk', owner: null,
      mem: '樓下走廊，粉筆一畫，<b>成條街都係你嘅。</b>落雨就冇。'
    },

    // ═══ 1980 ═══
    neonSign: {
      name: '霓虹招牌', jyut: 'ngai4 hung4 baai4 zoeng1', en: 'Neon sign',
      owner: 'keung', big: true, weight: 2.3, radius: 0.12,
      mem: '我住嗰條街，夜晚唔使開燈。<b>有一次停電，全條街黑咗，好多人行出嚟。</b>我第一次覺得，原來我哋係一齊住。'
    },
    arcadeCab: {
      name: '街機', jyut: 'gaai1 gei1', en: 'Arcade cabinet',
      owner: 'keung', big: true, weight: 2.5, radius: 0.125,
      mem: '放學唔返屋企，企喺機舖睇人打。<b>俾人趕就換間，一日可以去五間。</b>我從來冇錢玩。'
    },
    cassetteDeck: {
      name: '卡式錄音機', jyut: 'kaa1 sik1 luk6 jam1 gei1', en: 'Cassette recorder',
      owner: 'jan', big: true, weight: 2.1, radius: 0.11,
      mem: '錄歌要等收音機播，<b>一有廣告就嬲。</b>錄咗三個月，一疊帶，寫滿歌名。'
    },
    brickPhone: {
      name: '大哥大', jyut: 'daai6 go1 daai6', en: 'Brick phone', owner: null,
      mem: '一萬幾蚊。<b>攞出嚟即係身份，攞唔出即係唔係。</b>'
    },
    redWhiteBlue: {
      name: '紅白藍袋', jyut: 'hung4 baak6 laam4 doi2', en: 'Red-white-blue bag', owner: null,
      mem: '便宜，周圍都係。<b>然後有人話佢係設計，我突然覺得自己屋企好有型。</b>'
    },
    mtrTicket: {
      name: '地鐵儲值票', jyut: 'dei6 tit3 cyu5 zik6 piu3', en: 'MTR stored-value ticket', owner: null,
      mem: '一張紙，用完要買過。<b>有人儲起佢當書籤。</b>'
    },
    sharkFinBowl: {
      name: '魚翅撈飯碗', jyut: 'jyu4 ci3 laau1 faan6 wun2', en: 'Shark-fin rice bowl', owner: null,
      mem: '牛市嘅笑話，<b>笑到成個時代都有名。</b>'
    },
    yukLong: {
      name: '玉郎漫畫', jyut: 'juk6 long4 maan6 waa2', en: 'Pulp comic', owner: null,
      mem: '印刷廠三班制。<b>一毫子睇一次，老闆娘會趕你。</b>'
    },
    digitalWatch: {
      name: '電子錶', jyut: 'din6 zi2 biu1', en: 'Digital watch', owner: null,
      mem: '有計數機。<b>上堂偷偷玩，老師沒收咗三隻。</b>'
    },

    // ═══ 1997 ═══
    kaiTakPlane: {
      name: '啟德飛機', jyut: 'kai2 dak1 gei1', en: 'Kai Tak 747',
      owner: 'keung', big: true, weight: 2.4, radius: 0.125,
      mem: '飛機飛過，電視會雪花，<b>全屋一齊嗌。</b>後來機場搬走，我第一次覺得，靜係一種聲音。'
    },
    emigrationCase: {
      name: '移民行李箱', jyut: 'ji4 man4 hang4 lei5 seung1', en: 'Emigration suitcase',
      owner: 'man', big: true, weight: 2.2, radius: 0.115,
      mem: '表哥走嗰日，機場合照。<b>我當時十二歲，覺得佢好威。</b>之後三十年冇見。'
    },
    karaokeCabinet: {
      name: '卡拉OK 電視櫃', jyut: 'kaa1 laa1 OK din6 si6 gwai6', en: 'Karaoke cabinet',
      owner: 'jan', big: true, weight: 2.5, radius: 0.125,
      mem: '唱到走音，全場拍手，<b>我以為自己好紅。</b>第二次去，我先知道佢哋係禮貌。'
    },
    arcadeToken: {
      name: '冒險樂園代幣', jyut: 'mou6 him2 lok6 jyun4 doi6 bai6', en: 'Arcade token', owner: null,
      mem: '1994 年，上水名都第一間。<b>你玩緊嗰部機，就係由呢個年代開始。</b>'
    },
    yesCard: {
      name: 'Yes! Card', jyut: 'jet1 si2 kaat1', en: 'Yes! Card', owner: null,
      mem: '每個少年嘅第一個經濟體。<b>閃卡可以換三張普通卡。</b>'
    },
    tamagotchi: {
      name: '他媽哥池', jyut: 'taa1 maa1 go1 ci4', en: 'Tamagotchi', owner: null,
      mem: '電子蛋，上堂偷餵。<b>死過四隻，每次都話係意外。</b>'
    },
    pager: {
      name: '傳呼機', jyut: 'cyun4 fu1 gei1', en: 'Pager', owner: null,
      mem: '機響，搵電話，全城跑。<b>嗰陣時，覆機係一種禮貌。</b>'
    },
    octopus: {
      name: '八達通', jyut: 'baat3 daat6 tung1', en: 'Octopus card', owner: null,
      mem: '1997。<b>到今日都係全世界最乾淨嘅車票。</b>'
    },
    cantoTape: {
      name: '四大天王卡式帶', jyut: 'sei3 daai6 tin1 wong4', en: 'Cantopop cassette', owner: null,
      mem: '一面五首，<b>倒帶要用鉛筆。</b>'
    },

    // ═══ 2003 ═══
    starFerryClock: {
      name: '天星鐘樓', jyut: 'tin1 sing1 zung1 lau4', en: 'Star Ferry clock tower',
      owner: 'yi', big: true, weight: 2.5, radius: 0.125,
      mem: '拆嗰晚，好多人企喺度睇，<b>冇人出聲。</b>我啱啱落夜班，企喺最後面。'
    },
    disneyCastle: {
      name: '迪士尼城堡', jyut: 'dik6 si6 nei4 sing4 bou2', en: 'Disneyland castle',
      owner: 'yi', big: true, weight: 2.3, radius: 0.12,
      mem: '開幕嗰日排咗四個鐘，<b>入到去落雨。</b>我妹喊，我買咗把遮，好貴。'
    },
    internetCafePc: {
      name: '網吧電腦', jyut: 'mong5 baa1 din6 nou5', en: 'Internet cafe PC',
      owner: 'man', big: true, weight: 2.4, radius: 0.12,
      mem: '通宵十二蚊，打到天光，<b>返學照去。</b>老細會幫我哋睇水。'
    },
    mask: {
      name: '口罩', jyut: 'gau2 zaau3', en: 'Face mask', owner: null,
      mem: '全城戴，缺貨，排隊。<b>有人喺街邊賣，一盒三百。</b>'
    },
    flipPhone: {
      name: '翻蓋手機', jyut: 'faan1 goi3 sau2 gei1', en: 'Flip phone', owner: null,
      mem: 'Nokia。貪食蛇，換殼。<b>合上嗰下「啪」聲，係一種表演。</b>'
    },
    mp3Player: {
      name: 'MP3 機', jyut: 'em1 pi1 saam1 gei1', en: 'MP3 player', owner: null,
      mem: '一千首，白色耳機線。<b>條線永遠打結。</b>'
    },
    weddingCard: {
      name: '囍帖', jyut: 'hei2 tip3', en: 'Wedding invitation', owner: null,
      mem: '喜帖街。印刷、燙金，<b>成條街都係紅色。</b>'
    },
    milkPowder: {
      name: '奶粉罐', jyut: 'naai5 fan2 gun2', en: 'Milk powder tin', owner: null,
      mem: '自由行，藥房，拖篋。<b>一罐可以賣返去。</b>'
    },
    eDictionary: {
      name: '電子辭典', jyut: 'din6 zi2 ci4 din2', en: 'Electronic dictionary', owner: null,
      mem: '查一個字，玩三個小遊戲。<b>成績冇進步，但小遊戲爆機。</b>'
    },

    // ═══ 2010 ═══
    clawMachine: {
      name: '夾公仔機', jyut: 'gaap3 gung1 zai2 gei1', en: 'Claw machine',
      owner: 'hong', big: true, weight: 2.5, radius: 0.125,
      mem: '夾咗三百蚊，<b>隻公仔淘寶二十九蚊。</b>我知，但我仲夾。'
    },
    bubbleTeaSign: {
      name: '珍珠奶茶招牌', jyut: 'zan1 zyu1 naai5 caa4', en: 'Bubble tea sign',
      owner: 'hong', big: true, weight: 2.2, radius: 0.115,
      mem: '排四十分鐘，飲三口，影相，<b>然後掉。</b>我女朋友話，排隊係為咗一齊排。'
    },
    lightStickBoard: {
      name: '韓團應援燈牌', jyut: 'hon4 tyun4 jing3 wun4 dang1 paai4', en: 'K-pop light banner',
      owner: 'yi', big: true, weight: 2.1, radius: 0.11,
      mem: '全場一片粉紅色，<b>我嗌到冇聲。</b>我媽問我嗌乜，我話你唔會明。'
    },
    smartphone: {
      name: '智能電話', jyut: 'zi3 nang4 din6 waa2', en: 'Smartphone', owner: null,
      mem: '一部機，取代咗上面所有嘢。<b>包括上面所有嘢嘅樂趣。</b>'
    },
    taobaoParcel: {
      name: '淘寶包裹', jyut: 'tou4 bou2 baau1 gwo2', en: 'Taobao parcel', owner: null,
      mem: '集運，郵費，等兩星期。<b>拆開嗰下係整個月最開心。</b>'
    },
    lightStick: {
      name: '應援手燈', jyut: 'jing3 wun4 sau2 dang1', en: 'Light stick', owner: null,
      mem: '韓團，紅館，<b>全場同一秒舉起。</b>'
    },
    sharedBike: {
      name: '共享單車', jyut: 'gung6 hoeng2 daan1 ce1', en: 'Shared bike', owner: null,
      mem: '擺滿天橋底，然後冇人理。<b>有人將佢哋疊成一座塔。</b>'
    },
    phoneOctopus: {
      name: '手機八達通', jyut: 'sau2 gei1 baat3 daat6 tung1', en: 'Octopus in phone', owner: null,
      mem: '拍機變拍電話。<b>有一次冇電，全城幫唔到你。</b>'
    },
    returnBox: {
      name: '網購退貨箱', jyut: 'mong5 gau3 teoi3 fo3', en: 'Returns box', owner: null,
      mem: '買咗唔要，退咗再買。<b>物流公司多謝你。</b>'
    },

    // ═══ 2020 ═══
    loengSungCounter: {
      name: '兩餸飯玻璃櫃', jyut: 'loeng5 sung3 faan6', en: 'Two-dish rice counter',
      owner: 'ho', big: true, weight: 2.6, radius: 0.13,
      mem: '三十五蚊，三餸，<b>阿姐問我要唔要飯。</b>我話要，佢加咗一大羹。我冇講多謝，因為趕時間。'
    },
    deliveryBox: {
      name: '外賣保溫箱', jyut: 'ngoi6 maai6 bou2 wan1 soeng1', en: 'Delivery hotbox',
      owner: 'ho', big: true, weight: 2.3, radius: 0.12,
      mem: '九樓，冇電梯，<b>兩個月瘦咗十磅。</b>客人問我點解咁慢。'
    },
    voucherPoster: {
      name: '消費券海報', jyut: 'siu1 fai3 hyun3 hoi2 bou3', en: 'Voucher poster',
      owner: 'chan', big: true, weight: 2.1, radius: 0.11,
      mem: '五千蚊，買咗部電話，<b>剩返三百。</b>阿爺話佢嗰代冇呢啲嘢，但佢都有去排。'
    },
    mask2: {
      name: '口罩（彩色）', jyut: 'gau2 zaau3', en: 'Coloured mask', owner: null,
      mem: '後來有顏色。<b>有人襯衫，有人襯心情。</b>'
    },
    ratTest: {
      name: '快速測試', jyut: 'faai3 cuk1 cak1 si3', en: 'Rapid test', owner: null,
      mem: '兩條線，全屋停擺。<b>一條線，世界照轉。</b>'
    },
    homeReturnCard: {
      name: '回鄉卡', jyut: 'wui4 hoeng1 kaat1', en: 'Home Return Permit', owner: null,
      mem: '北上，按摩，飲茶，買餸。<b>星期六朝早過關，晚上返嚟。</b>'
    },
    rubbishBag: {
      name: '垃圾徵費指定袋', jyut: 'laap6 saap3 zing1 fai3 zi2 ding6 doi2', en: 'Rubbish bag', owner: null,
      mem: '買咗個袋，政策冇咗。<b>袋仲喺櫃桶。</b>'
    },
    bubbleCup: {
      name: '手搖飲品杯', jyut: 'sau2 jiu4 jam2 ban2 bui1', en: 'Bubble tea cup', owner: null,
      mem: '半糖少冰，膠杯，飲管。<b>飲完唔知掉邊。</b>'
    },
    onlineLessonHeadset: {
      name: '網課耳機', jyut: 'mong5 fo3 ji5 gei1', en: 'Online class headset', owner: null,
      mem: '老師對住空氣講書，<b>同學全部熄鏡頭。</b>'
    },

    // ═══ 2026 ═══
    northboundCase: {
      name: '北上行李箱', jyut: 'bak1 soeng5 hang4 lei5 seung1', en: 'Northbound suitcase',
      owner: 'ho', big: true, weight: 2.4, radius: 0.125,
      mem: '星期六朝早過關，晚上返嚟，<b>行李箱滿晒。</b>我而家做物流，送嘅就係呢啲箱。'
    },
    concertBoard: {
      name: '演唱會應援牌', jyut: 'jin2 ceong3 wui2 jing3 wun4 paai4', en: 'Concert banner',
      owner: 'yi', big: true, weight: 2.2, radius: 0.115,
      mem: '搶飛搶咗三個鐘，入到場喊咗。<b>我媽問我喊乜，我話你唔會明。</b>佢話，我明。'
    },
    paymentTerminal: {
      name: '電子支付終端', jyut: 'din6 zi2 zi1 fu6 zung1 dyun1', en: 'Payment terminal',
      owner: 'chan', big: true, weight: 2.0, radius: 0.105,
      mem: '貼咗三年，<b>冇人知個 code 係乜。</b>有人掃完會問：得唔得架？'
    },
    aiBot: {
      name: 'AI 聊天機械人', jyut: 'AI liu4 tin1 gei1 haai6 jan4', en: 'AI chatbot', owner: null,
      mem: '你問佢香港邊度好玩，<b>佢答你以上全部。</b>'
    },
    taobaoBox: {
      name: '淘寶集運箱', jyut: 'tou4 bou2 zaap6 wan6 soeng1', en: 'Taobao consolidation box', owner: null,
      mem: '一箱二十件，<b>十九件唔記得自己買過。</b>'
    },
    loengSungBag: {
      name: '兩餸飯外賣袋', jyut: 'loeng5 sung3 faan6 ngoi6 maai6 doi2', en: 'Two-dish takeaway bag', owner: null,
      mem: '三十五蚊，<b>而家四十。</b>'
    },
    concertStub: {
      name: '演唱會票尾', jyut: 'jin2 ceong3 wui2 piu3 mei5', en: 'Concert ticket stub', owner: null,
      mem: '電子票之後，<b>呢張變咗收藏品。</b>'
    },
    massageVoucher: {
      name: '北上按摩券', jyut: 'bak1 soeng5 on3 mou4 hyun3', en: 'Massage voucher', owner: null,
      mem: '兩個鐘，一百蚊。<b>有人話平過香港，有人話唔敢去。</b>'
    },
    oldOctopus: {
      name: '舊式八達通', jyut: 'gau6 sik1 baat3 daat6 tung1', en: 'Old Octopus card', owner: null,
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

  // Defaults so no prop silently inherits a weight of 1 and behaves like a coin
  // in the physics. Small finds are light and shoveable; big items are set above.
  Object.keys(PROPS).forEach(function (id) {
    var d = PROPS[id];
    if (!d.weight) d.weight = d.big ? 2.3 : 1.35;
    if (!d.radius) d.radius = d.big ? 0.118 : 0.072;
  });

  G.CONTENT = { PEOPLE: PEOPLE, STAGES: STAGES, PROPS: PROPS, MACHINE: MACHINE };
})(window);
