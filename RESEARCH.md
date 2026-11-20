# RESEARCH.md — 推幣機參考研究

> 目的：為《一蚊雞 Coin Pusher HK》找外部參考，抽出可以直接落手做的 5 樣，同時劃清唔會做的底線。
> 範圍：實體街機／日本メダルゲーム、手機、網頁（Poki／CrazyGames／itch.io）、Steam。
> 方法：逐個抓商店頁／官方說明／第三方評測；只引用機制，唔搬文案。
> **引用慣例**：`sim.js`（636 行）／`render.js`（1607 行）／`content.js`（644 行）冇人改，所以照寫行號。
> `index.html`／`main.js`／`ui.js` 喺研究期間仍然改動中（設定頁就係期間落地的），行號每次睇都唔同，所以**只寫函數名／元素 id，唔寫行號**——`grep` 搵名一定中，行號一定過時。
> **重要**：設定頁同重置進度**已經有人做起咗**（見 §1）。所以第 3 節唔會再叫你去建，而係講「仲差咩、點收尾」。

---

## 0. 一句總結

外面做得好的推幣機，贏在**「每一次落幣都有兩個回報」同「一局有頭有尾」**，唔係贏在抽獎。
我們嘅物理同內容已經齊（2.5D 兩層、63 件收藏、7 個年代、故事線），設定頁亦已經落地；短板純粹係**回饋層**：上層搬運靜音、側溝代價要事後才知道、拍機只有文字、結算頁唔講數。

---

## 1. 我們的現況（寫建議時用來對照）

| 項目 | 現況 | 位置 |
|---|---|---|
| 兩層結構 | 上層只運輸唔付款（`payW: 0.56`），下層付款（`payW: 0.31`） | `sim.js:20-60` |
| 側溝 | `gutterZ: 0.06`，越過＝`lost`；註解講明冇佢會 jam 死 | `sim.js:50-59` |
| 上層搬運 hook | `onShuttle` 已預留、已呼叫，**但 `main.js` 冇掛** | `sim.js:158`、`sim.js:491`、`main.js` `applyStage()` 內掛 hook 嗰幾行 |
| 落幣回饋 | 「叮」一聲 + 數字滾動 | `main.js` `onPayout()`、`ui.js` `clink()`、`ui.js` `UI.tick()` |
| 側溝回饋 | 每兩次先講一句，1.8 秒消失 | `main.js` `onLost()` |
| 拍機 | 3 次 / 4.2 秒回一格；有台詞 + 低音 + 金幣微彈，**畫面唔震** | `main.js` 拍機常數 + `UI.onSlap`、`ui.js` `paintSlap()`／`UI.slapState()`／`UI.slapFired()` |
| 落點預覽 | 3 條 dash + 一個環，**顏色固定** | `main.js` `buildAimRibbon()`、`main.js` `frame()` 內 aim ribbon 更新 |
| 結算頁 | 只有年份 + 一句 beat，**唔講數** | `index.html` `.ov#done`／`#doneInner`、`ui.js` `UI.showStageDone()` |
| 設定頁 | ✅ **已完成**（`.ov#settings`，聲音＋進度兩組，`role="switch"`、焦點陷阱、inert） | `index.html` `.ov#settings`、`ui.js` settings 段 |
| 音效搬離主畫面 | ✅ **已完成**（`.btnRow` 只剩 博物館／設定／拍機，`#soundBtn` 全 repo 0 命中） | `index.html` `.btnRow` |
| 重置進度 | ✅ **已完成**（兩段確認、3 秒自動解除、`armed` 動畫） | `index.html` `#settingsReset`、`ui.js` `armReset()`、`main.js` `resetProgress()` |
| 音效記憶 | ❌ `muted` **冇寫入存檔**，每次重載都變返有聲 | `ui.js` `UI.save()`、`ui.js` `UI.load()` |

---

## 2. 外部參考（13 款遊戲 ＋ 1 份設計書，跨 4 個平台）

### 2.1 實體街機／日本メダルゲーム

**① バベルのメダルタワー（SEGA, 2016）**
平台：實體街機（中型メダルプッシャー）｜URL：<https://www.sega.jp/history/arcade/product/11004/>
做對了什麼：喺推幣台上加一座**高 30cm、最多載 1000 枚的メダルタワー**，賣點寫成「建てるドキドキ、崩す快感」。它把目標由「跌幾多枚」改成「**建立一個結構，然後睇佢崩**」——塔越高，崩的一刻回報越大，而崩塌係玩家一手造成。
對我們：我們冇塔，但「上層儲幣」就係一個天然嘅塔。呢點支撐第 2 條。

**② マーブルフィーバー（KONAMI）**
平台：實體街機｜URL：<https://www.konami.com/arcadegames/products/am_marble_fever/>
做對了什麼：用**球**代替硬幣，靠「筐体に仕掛けられた様々なギミック」逐一觸發。關鍵係：唔同物件有唔同重量／大小，所以同一個推力會產生唔同結果。
對我們：`sim.js` 已經有兩級質量（`MU_COIN` / `MU_PROP`）＋ big／small 兩級收藏——同構。唔需要新機制，只需要**讓玩家看得見**。

**③ UK penny falls（2p／10p 真硬幣台）**
平台：實體街機（英國）｜URL：<https://en.wikipedia.org/wiki/Medal_game>
做對了什麼（同時係反面）：真硬幣、有 payout ratio、**自 1960 年代起無年齡限制**。有學術個案報告直接題為「I wouldn't have become addicted to fruit machines if it wasn't for coin pushers」。
對我們：呢個係「不要抄」的根，見第 4 節。

### 2.2 手機

**④ Coin Dozer（Game Circus）**
平台：iOS／Android｜URL：<https://apps.apple.com/us/app/coin-dozer/id372836496>｜評測：<https://moneypantry.com/coin-dozer-review/>
做對了什麼（機制）：**推板本身太短，推唔到任何嘢**——玩家必須把幣落在推板正前方，靠新幣去推舊幣。所以每一步都係「用一枚換一堆」嘅計算。側邊掉落唔計，只有另一端算。
做錯了什麼：真錢 sweepstakes（美國限定、要 Level 3）＋ IAP ＋ 廣告 ＋ 賣用戶資料；有一批用戶投訴大獎「贏咗但收唔到獎品」。
對我們：物理上已經同構（`Sim` 只推 face 前面的幣）。**唔好抄**佢嘅商業層。

**⑤ Tipping Point Blast!（Two Way Media, 2020）**
平台：iOS／Android｜URL：<https://apps.apple.com/us/app/tipping-point-blast-coin-game/id1471370760>｜評測：<https://www.bothersbar.co.uk/?p=12777>
做對了什麼：pin board 逐格亮燈 → 推 counters／獎品過 Tipping Point，再加轉輪／答問題等 mini game 做節奏變化。
評測結論值得引：*"It is empty calories, but it's a slick experience."*（半個鐘後「now basically hate myself」）。玩家 tip：**付費 booster 可以靠快速連 tap 取代**——收費設計本身係多餘的。
對我們：mini game 節奏變化成本＝大，會分薄故事線。**唔抄**。

### 2.3 網頁（Poki／CrazyGames／itch.io）

**⑥ Coin Cascade（Weekly Arcade）** ← 最完整的網頁版規格書
平台：HTML5｜URL：<https://weeklyarcade.games/games/coin-cascade/>
做對了什麼（全部明文）：
- **一局 40 枚**、每次落幣 500ms 冷卻、局中冇其他來源 → 一局＝40 個決策，下限約 20 秒。**有頭有尾**。
- 物理參數公開：gravity 0.15、friction 0.985、restitution 0.4、**固定 60Hz 步進**（同螢幕刷新率無關）。
- 幣值 bronze 1／silver 5／gold 25，獎品 star 100／gem 250／crown 500／trophy 1000——**獎品比一整排硬幣值錢**。
- **Combo：1.5 秒內連續收款才連乘** → 鼓勵「養一堆再一次崩」。
- 側邊掉落＝純損失，明文寫「冇比『一局零損失』更難的成就」。
- 頁面直接寫「Is Coin Cascade a gambling game? **No.**」「no coin packs, no premium currency, no ads」。
對我們：**佢就係我們想做的東西的乾淨版**。第 5 條同第 1 條（設定頁寫明唔賭）都係抄佢「把規則講清楚」嘅態度。

**⑦ MEDARUN PUSHER（werizu1208）** ← itch 上最貼近我們結構的樣本
平台：HTML5（免費）｜URL：<https://werizu1208.itch.io/medarun-pusher>
做對了什麼：明文寫「実機の2段構造を再現した、放置型のメダルプッシャー」。
- 上層＝運輸：「Medals drop onto the moving pusher shelf. When the shelf pulls back, the fixed back wall scrapes them onto the lower field.」
- **側溝明文吃掉**：「Medals that slip into the side gutters are lost.」
- **CHANCE pocket 會左右移動**，幣穿過就轉 slot。
- **BAR → JP BALL**：推落前面＝JACKPOT；777 → JACKPOT ＋ MEDAL RUSH（投入 3 倍）＋ 側邊 guard 升起。
- 8 種升級（Auto Dropper／Medal Value／Pusher Speed／Side Guards…）。
- 頁面寫「No real money and no betting: just the joy of medals falling.」
對我們：**兩層＋側溝**同我們 `sim.js` 一模一樣，證明方向係對的；升級系統**唔抄**（數值膨脹），但「側溝要事先講明」要抄（第 3 條）。

**⑧ Coin Drop Factory（CrazyGames）**
平台：HTML5｜URL：<https://www.crazygames.com/game/coin-drop-factory-tvh>
做對了什麼：8.6/10（585 likes）。機制：tap 機器落幣、pusher 推落 grinder、**卡住嘅時候可以搖機器（shake the machine）**；50 關；vault 存剩餘錢；jackpot coin 觸發幣雨。
對我們：**第 4 條（拍機要震機）直接抄佢「搖機」的直覺**——我們已經有「拍機」動作同 5 句台詞（`content.js:597-603`），但畫面完全冇反應。

**⑨ Poki「Coin Machine」（Kuyi Mobile, 2025）** ← 反面教材
平台：Poki｜URL：<https://poki.com/en/g/coin-machine>（Poki 頁係 JS 渲染，`web_fetch` 只回空白；描述取自 <https://zologames.com/coin-machine/>）
做對了什麼：其實**唔係推幣機**，係高玻璃櫃＋peg board。硬幣由頂部落入、撞 peg 反彈，**每枚幣的面值會因為撞到邊個 peg 而改變**——「路徑本身會改變價值」，所以落點有意義。底部有常駐**目標進度環**。
做錯了什麼：**未解鎖的 slot 有鎖頭搖動，要看廣告解鎖**；chip 要買。典型 FOMO＋廣告閘。
對我們：抄「落點有意義」（我們已經有 `#bigCount`「N / 9」，`ui.js` `UI.setBigCount()`）。**唔抄**廣告閘。

**⑩ Super Coin Pusher 2000 3D Arcade Edition（Samuel_Carton / Loowood, 2021）**
平台：HTML5＋Windows｜URL：<https://samuel-carton.itch.io/super-coin-pusher-2000-3d-arcade-edition>
做對了什麼：**單鍵操作**（spacebar 落幣），文案自己講「Try to push a maximum of coins out of the level by dropping strategically your coins **or just spam space and watch the chaos unfold**」。即係：物理本身已經係獎賞，連亂按都好玩。
對我們：呢個係最應該守住嘅嘢。**任何新 UI 都唔應該令「亂丟」變難玩或者變慢**。

### 2.4 Steam

**⑪ Coin Pusher Casino（TreeNutsGames, 2024）** ← 三模式分層
平台：Steam（Win／macOS／Linux）｜URL：<https://store.steampowered.com/app/2178590/Coin_Pusher_Casino/>
數據：976 篇評測 84% 好評，近 30 天 90%。
做對了什麼：**同一個推幣台，三種節奏**——**Classic Mode**（限時清機）、**Zen Mode**（低壓、自己pace）、**Arcade Mode**（小遊戲＋power-up＋動態事件）。再加 100+ 關，每關 layout 唔同；文案用「Master **timing and placement**」。
對我們：**「一局有邊界」＋「有放鬆模式」**係低成本高回報。我們冇體力、冇收費，天生就係 Zen Mode；但 `#done`（`index.html` `.ov#done`／`#doneInner`）應該做到「呢一版結束咗、你玩成點」——第 5 條。

**⑫ Old Coin Pusher Friends 3（STP WORKS, 2024）** ← 收藏換報酬
平台：Steam｜URL：<https://store.steampowered.com/app/3040390/Old_Coin_Pusher_Friends_3/>
數據：211 篇評測 92% 好評（特別好評）。
做對了什麼：江戶時代背景，用**東海道五十三次雙陸棋**包住推幣——擲骰行進，行到事件格觸發隨機事件；有消滅怪物／制裁惡人代官／火山爆發等協作 mini game。最關鍵一句（官方描述）：「**獲得的獎品越多，完成雙陸棋時取得的報酬也會更加豐富**」。
對我們：**「收藏度 → 回報」的循環**正是 63 件收藏＋7 年代＋博物館缺嘅一環。已經有 `UI.bigComplete()`（`ui.js`）做閘門，但收藏度本身冇兌換。最低成本版本＝喺結算頁把收藏度講大聲（第 5 條），**唔加商店**。

**⑬ Coin Pusher（RewindApp, 2019）** ← 反面教材
平台：Steam｜URL：<https://store.steampowered.com/app/827420/Coin_Pusher/>
數據：46 篇評測只有 58% 好評（褒貶不一）。**它做對了什麼**：機制上齊（收集獎品去賣、5 種不同速度托盤主題、等級系統、**硬幣產生器**），內容唔算少。**但呢啲全部係數值膨脹**，冇新結構；結果 46 篇評測只有 58% 好評（同 ⑪ 84%、⑫ 92% 對比明顯）。
對我們：只靠「更多幣／更快托盤」的數值膨脹，玩家唔會覺得好玩。**明確唔抄**任何 upgrade／generator。

### 2.5 設計書／研究

**⑭ gigadeli / medal_web — DESIGN.md** ← 最硬的機制證據
平台：開源網頁メダルゲーム設計書｜URL：<https://github.com/gigadeli/medal_web/blob/main/DESIGN.md>
做對了什麼（實測數據，可直接引用）：
- **上段ラチェット**：上層幣靠摩擦跟推板前後移動；若冇固定壁堰き止め，只會往復唔前進。必要條件：推板前進端仍潛入背壁內側、幣山由壁到前緣連續、**上層做淺**。實測（150 秒、共 360 枚）：0.80/2.2 → 17 枚；0.90/2.0 → 239 枚；**0.95/1.9 → 249 枚（採用）**；1.20/1.4 → 出過多。結論：**推板行程對回收量的影響壓倒性大於摩擦**。
- **場內枚數 vs 效能**：200 枚 → 5.1ms/step；300 → 10.2ms；400 → 16.2ms（60fps 極限）；500 → 24.4ms（唔得）。自然平衡 160–200 枚。
- **上段手前加壁＝機械停擺**（回收 36% vs 無壁 88%，AntiJam 17 次）。
- 抽選球回歸需要 **settling 2.2 秒**，否則 1–3 秒連開。
- 效果音全部 WebAudio 合成，用碰撞力門檻（1600 → 16.6 事件/step 太密；**3200 → 0.5 事件/step 採用**）。
- **UI 教訓**：透明度 `transition`／keyframes 在重負載下會卡在半透明；改用 **transform** 做主進場動畫。動畫重播唔好用「移除 class → 讀 offsetWidth → 加返」（= 我們 `ui.js` `flash()` 現時做法）。
- 存檔：**只存「場內枚數」一個數字**（319 bytes）；`pagehide` + 2 秒 debounce；`SaveStore.clear()` 連 userId 一齊清。**「記録を消す」要一層確認**（我們已做兩段確認，`ui.js` `armReset()`）。
- 0 枚時延遲 8 秒才 game over（最後一枚可能贏回）。
對我們：第 1、2、4 條全部有佢做證；`flash()` 同 `pagehide` 兩個技術債直接對應我們 `ui.js` `flash()` 同 `ui.js` `UI.save()`。

---

## 3. 我們應該抄這 5 樣

> 排序＝落手次序。設定頁同重置進度**已經起好**，所以第 1 條係「收尾現有嘢」而唔係「新建」。
> 每條都寫得出檔案位置；寫唔出嘅已經刪（見 3.6）。

### 3.1【優先 1】設定頁收尾：音效要記得（成本：小）

**1. 這是什麼行為**
玩家喺設定頁熄咗音效 → 關 tab → 下次開返，**仍然係熄**。另外設定頁底部（`.setNote`，`index.html` `.setNote`）補一句「呢部機唔收錢，唔換獎品，唔會要你等。」

**2. 為什麼有效**
- 現時 `muted` 只活喺記憶體（`ui.js` `muted`）。`UI.save()`（`ui.js`）寫嘅係 `{v, stageIdx, coins, collected, seen}`——**冇 `muted`**；`UI.load()`（`ui.js`）亦冇讀。即係：一個為無障礙而設嘅設定，**每次重載都靜靜雞變返有聲**。呢個係 bug，唔係缺 feature。
- 設定頁已經有 `#soundToggle`（`index.html`）同 `UI.toggleMuted()`（`ui.js`），只差持久化呢一步。
- §4 講明「唔賭」係硬底線；Coin Cascade 直接喺頁面寫「no coin packs, no premium currency, no ads」。**同一個頁面寫明自己唔賭，係建立信任最快的方法**，而設定頁就係放呢句嘅地方。`.setNote`（`index.html`）已經存在，加一行字成本＝0。

**3. 落在哪個檔案、大概怎麼做**
- `ui.js` `UI.save()`：payload 加 `muted: muted`。
- `ui.js` `UI.load()`：加 `if (typeof s.muted === 'boolean') { muted = s.muted; }`，並喺 `UI.init()`（`ui.js`）收集完 els 之後呼叫一次 `paintSound()`（`ui.js`）令個 switch 一開始就顯示正確狀態（而 `paintSound()` 目前係 `function`，要喺 `UI.init` 之前 hoist 到 module 作用域——佢已經係 `ui.js` 內嘅 function declaration，OK）。
- `ui.js` `UI.toggleMuted()`：尾段加 `UI.save();`。
- `main.js` `resetProgress()`：**唔使改**，只要唔好喺重置路徑叫 `UI.toggleMuted()`。`muted` 係 `ui.js` module 變數，`resetProgress()` 清 `UI.state` 同 `app.state` 都唔會掂到佢——**重置進度唔應該順手幫人開返聲**，而現行寫法已經無此問題。
- `index.html` `.setNote`：加 `<br>唔收錢，唔換獎品，唔會要你等。`
- 注意：`UI.setMuted()`（`ui.js`）而家**已經冇人叫**（`grep setMuted` 只剩定義同 `isMuted`）。可以刪，或者留返俾外部工具；建議刪，避免兩條路徑。

**4. 成本：小**
`ui.js` 約 8 行、`index.html` 1 行、`main.js` 0-3 行。

---

### 3.2【優先 2】上層搬運要出聲：掛 `Sim.onShuttle`（成本：小）

**1. 這是什麼行為**
每當有幣由上層滑過 lip 跌落下層，出一聲**好輕的「嗒」**（明顯細過付款的「叮」），連環崩塌時變一段密麻麻的細响而唔係靜音。同時 `#top` 角落一個小字「上層 N 枚」跳一格。

**2. 為什麼有效**
- gigadeli 實測：上層係**純運輸層**（ラチェット），作用係「延遲中獎」唔係付款；coinpusher.com 都講多層台「只有底層會付，上層主要延遲中獎」。
- 問題係：上層搬運**冇聲冇畫**，玩家會覺得「我落咗幣，但枱面冇反應」——而實際上上層正喺做嘢。
- MEDARUN PUSHER 明文描述同一件事（back wall scrapes medals onto the lower field），即係呢個動作係實機最核心的「機件感」。
- **掛鉤已經白等**：`sim.js:158` 定義、`sim.js:491` 呼叫、`sim.js:619` reset 會清；`main.js` `applyStage()` 內掛 hook 嗰幾行只掛咗三個（`onPayout`／`onBigPayout`／`onLost`）。
- 呢個亦係 ①バベルのメダルタワー「養一座塔」同構：上層幣量就係我們嘅塔。

**3. 落在哪個檔案、大概怎麼做**
- `main.js` `applyStage()` 內掛 hook 嗰幾行加 `Sim.onShuttle = onShuttle;`。
- `main.js` 新增 `function onShuttle(coin)`，形狀照 `onLost`（`main.js`）：**要節流**，例如 `if (now - lastShuttle < 55) return;`（用 `performance.now()`），否則瀑布時一秒幾十聲會爆音。
- `ui.js`：新增 `function ping()`，照 `clink()`（`ui.js`）嘅白噪＋bandpass，但 `frequency.value = 1200 + Math.random() * 600`、`len = 0.045 * sampleRate`、`g.gain.value = 0.055`；再出 `UI.shuttlePing = ping`。
- 上層存量：`Sim.countTier('top')`（`sim.js:587-591`）已經有。`index.html` `#stageBox` 後面加 `<div id="topPile"></div>`；`ui.js` 加 `UI.setTopPile(n)`，照 `paintSlap()`（`ui.js`）「只喺變更時寫 DOM」做法記住上一個值。`main.js` `frame()` 每 N frame 呼叫一次就夠（例如 `if ((frameNo++ & 15) === 0)`）。

**4. 成本：小**
`main.js` 約 15 行、`ui.js` 約 25 行、`index.html` 1 個 div + 2 行 CSS。零新依賴。

---

### 3.3【優先 3】放手之前就睇到側溝代價（成本：小）

**1. 這是什麼行為**
拖瞄準時，枱面左右各多一條**暗紅色帶**（＝側溝）；落點環同中心圓如果落喺付款區外面，即時轉紅，入返付款區就轉金。

**2. 為什麼有效**
- `sim.js:50-59` 自己嘅註解講得最白：冇側溝，幣堆會「jams solid against the plate, and the payout rate collapses to nothing」。即係側溝係**必要之惡**，唔係 bug。
- coinpusher.com 的部件表：側溝吃掉落幣的 **20–50%**；真機 payout ratio 只有 30–50%。
- 但我們而家要等 `onLost` 之後才知道（`main.js` `onLost()`，而且每兩次先講一次，1.8 秒收）。玩家見到幣唔見咗，只會覺得遊戲壞。
- Coin Cascade 明文把「側邊掉落＝純損失」寫成規則；MEDARUN 明文寫「Medals that slip into the side gutters are lost」。**兩款都係事先講，唔係事後講。**
- 呢個係「illusion of control」的**正面用法**：唔係假裝有技術，而係**真嘅技術**（`payW: 0.31` 對 `table` 1.12 寬＝只有 55% 落點會付款）。

**3. 落在哪個檔案、大概怎麼做**
- `main.js` `buildAimRibbon()`：加兩塊 `PlaneGeometry(w, 0.42)` 喺 `y = 0.052`、`z = G.Sim.DECKS.bottom.table.z0 + 0.21`，`x = ±(G.Sim.DECKS.bottom.payW + w/2)`，`MeshBasicMaterial({color: 0x8c2f24, transparent: true, opacity: 0.15, depthWrite: false})`。
  **記住** `head`（環）用 `solid`、`core`（中心）用 `mat`（`main.js` `buildAimRibbon()` 的 `mat`／`solid` 兩個唔同 material），唔可以共用同一個再改色。
- 喺回傳嘅 group 上掛 `g.userData.head = head; g.userData.core = core;`（慣例；`main.js` `buildAimRibbon()` 個 group 目前冇 `userData`，加係安全嘅）。
- `main.js` `frame()` 內 aim ribbon 更新處已經有 `app.aimRibbon.position.x = aim.x;`，喺同一處加：
  ```js
  var bot = G.Sim.DECKS.bottom;
  var inSlot = Math.abs(aim.x) <= bot.payW;
  var hex = inSlot ? 0xffd28a : 0xc8342b;
  var ud = app.aimRibbon.userData;
  if (ud.head && ud.head.material.color.getHex() !== hex) {
    ud.head.material.color.setHex(hex);
    ud.core.material.color.setHex(hex);
  }
  ```
  （`Sim.DECKS` 已 export，`sim.js:625`；`payW` 喺 `sim.js:52`。）
- 唔需要改 `wireInput`／`updateAim`（`main.js` `wireInput()`／`updateAim()`）——平滑已經有（`aim.x += (nx-aim.x)*0.55`）。

**4. 成本：小**
兩塊 mesh + 一個顏色判斷，約 30 行，全部喺 `main.js` 一個檔案。

---

### 3.4【優先 4】拍機要震機，唔止講嘢（成本：中）

**1. 這是什麼行為**
拍落去的一刻：畫面震 180ms（快速衰減），低沉 rumble 響起（已有），金幣微微向上跳（已有），機器講一句（已有）。**缺嘅只係畫面震。**

**2. 為什麼有效**
- Coin Drop Factory 明文有「**shake the machine** when coins get stuck」——玩家已經被訓練到「卡住＝搖佢」。
- 我們而家 `UI.onSlap`（`main.js`）只有：`UI.say()` ＋ `UI.rumble()`（`ui.js` `rumble()`：0.5 秒低通 700Hz）＋ 每枚幣 `vz += .10`。**畫面完全唔動**，所以「拍機」讀落去似一個文字按鈕，唔似一個動作。
- 呢個係唯一一條要改 render 嘅建議，所以排第 4——前面三條都唔使掂 3D。

**3. 落在哪個檔案、大概怎麼做**
- `render.js:1550` 而家係一行：`R.render = function () { renderer.render(scene, camera); };`
  - 加 `var camBase = null, shakeT = 0, shakeMag = 0;`
  - `R.shake = function (mag, ms) { shakeMag = mag; shakeT = Math.max(shakeT, (ms || 180) / 1000); };`
  - `R.render` 改成：`if (!camBase) camBase = camera.position.clone();` → 如果有 `shakeT`：`shakeT = Math.max(0, shakeT - 1/60); var k = shakeT * shakeMag * (Math.random() - 0.5) * 2; camera.position.set(camBase.x + k, camBase.y + k * 0.8, camBase.z);` → `renderer.render(...)` → `shakeT <= 0 && camera.position.copy(camBase);`
  - **關鍵陷阱**：`placeCamera()`（`render.js:1234` → `fitCamera()` `render.js:1184`）同 `R.resize()`（`render.js:1540-1546`）會重寫 `camera.position`，所以 `camBase` 要喺 `R.resize` 結尾重新快照（`camBase = null;`），否則轉螢幕之後震機位會漂。
- `main.js` `UI.onSlap` 成功扣力之後加 `if (R.shake) R.shake(0.014, 180);`。
- `prefers-reduced-motion` 判斷放喺 `R.shake` 內部（`matchMedia('(prefers-reduced-motion: reduce)').matches` 就 return），唔好散落 `main.js`。
- 驗證：`probe()`（`main.js`）加一個 `shake` 欄位方便 headless 驗（`tools/` 已經有 CDP 工具鏈：`tools/cdp.mjs` 直接 spawn Chromium headless shell 再講 DevTools protocol，零 npm 依賴）。

**4. 成本：中**
`render.js` 約 25 行（要小心 base 快照同 resize），`main.js` 1 行。

---

### 3.5【優先 5】年代結算頁要講數（成本：小）

**1. 這是什麼行為**
`#done` overlay（`index.html` `.ov#done`／`#doneInner`）喺年份同 beat 之後，多一行小字：
「今個年代：落咗 42 蚊 · 側溝食咗 9 蚊 · 搵到 6 / 9 件」

**2. 為什麼有效**
- Coin Pusher Casino 三模式（Classic 限時／Zen 低壓／Arcade 混亂）嘅共通點唔係玩法，係**一局有邊界**：你會知道「呢局完咗」。
- Coin Cascade 一局 40 枚、「側邊掉落＝純損失」明文寫住，所以玩家知道自己在追咩。
- 我們 `#done` 而家只有年份 + 一句 beat（`ui.js` `UI.showStageDone()`），玩家唔知自己玩得好唔好，`#doneNext`（翻新部機）同 `#doneStay`（再推多陣）之間冇決策依據。
- 數據**已經有**：`app.state.drops` / `app.state.lost`（`main.js` `app.state`）、`Sim.stats`（`sim.js:141-143` 有 `{dropped, paid, bigPaid, lost, shuttled, maxLayer}`）、`UI.setBigCount()` 已經計到 `got / all.length`（`ui.js`）。**唔需要新邏輯，只需要傳同顯示。**
- ⑫ 嘅「收藏越多，報酬越豐富」如果唔想加數值膨脹，最低成本版本就係：**喺結算頁把收藏度講到好大聲**（`UI.bigComplete()`（`ui.js`）已經係 `#done` 的觸發條件）。

**3. 落在哪個檔案、大概怎麼做**
- `index.html` `#doneInner`（`.ov#done` 內）加 `<div id="doneStats" class="doneStats"></div>`；CSS 可以照 `#doneBeat` 嘅樣式但 `color: var(--dim)`、`letter-spacing: .1em`。
- `ui.js` `UI.showStageDone(stage, isLast)` 加第三個參數 `stats`，兩個分支（最後一 stage／普通 stage）都填 `#doneStats`；`isLast` 時寫 7 個年代嘅總數。
- `main.js` `onBigPayout()` 呼叫 `UI.showStageDone(stage(), isLast)` 時傳 `{ drops: app.state.drops, lost: app.state.lost, got: ..., total: ... }`。
- 排版：寧願「落 42 · 蝕 9 · 6/9」咁密，都唔好搶走 `#doneYear`（64px）嘅主角地位。

**4. 成本：小**
`index.html` 1 個 div + 2 行 CSS、`ui.js` 約 15 行、`main.js` 約 5 行。

---

### 3.6 自己讀一遍之後**刪掉**的候選（寫唔出位置／成本超標）

| 候選 | 出自 | 為何刪 |
|---|---|---|
| DOM 層落點標記（`camera.project` 畫 DOM 標籤） | Coin Cascade 落點提示 | `render.js` **冇** `project`／`worldToScreen`（grep 0 命中），要新寫投影 + 每 frame 同步；`Sim.DROP_Z` 只係上層落點，真正付款點在下層 → 成本中至大，效果同第 3 條重疊 |
| 用 mp3 素材做落幣聲 | gigadeli（抽選球用 14 種 mp3／453KB） | 要外部音檔 → 違反「file:// 直開、唔加 CDN、唔加 npm」；WebAudio 合成已經夠（`ui.js` 音效區 零 bytes） |
| 多台連動 mega jackpot | 英文 Wikipedia（可達 100,000+ medals） | 要 server／同步層 → 同「純前端單檔」矛盾 |
| 雙陸棋／棋盤模式包住推幣 | Old Coin Pusher Friends 3 | 要新 game mode（棋盤、骰、事件表）＝成本大，會分薄 7 個年代故事線。**取代方案**＝第 5 條 |
| 商店／升級（Auto Dropper、Pusher Speed、Side Guards…） | MEDARUN、Coin Drop Factory、Coin Pusher Casino | 同「免費、唔賭、唔通脹」底線衝突；Coin Pusher（RewindApp）就係靠 generator 膨脹，58% 好評 |
| 設定頁加「減少動畫」in-app switch | 設定頁直覺 | **OS 已經有**（`prefers-reduced-motion`），`index.html` 三個 `@media (prefers-reduced-motion:reduce)` 區塊已經尊重。再加一個 in-app 開關＝兩套真相、要 sync、要存。**唔加。** |
| 設定頁放喺遊戲結束畫面（唔做設定頁） | gigadeli 的結論 | **冇刪但改寫**：gigadeli 反對的是「一按就冇」，不是設定頁本身。現行實作（兩段確認，`ui.js` `armReset()`）已經滿足佢嘅顧慮 |

---

## 4. 不要抄（硬底線）

> 我們係免費網頁遊戲，冇課金、冇廣告、冇抽獎。以下任何一條都唔做，亦唔做「先做少少」。

### 4.1 真錢賭博機制
- **真硬幣＋真獎品＋sweepstakes**：Coin Dozer 在美國做 sweepstakes（要 Level 3、16 歲以上）、IAP 買 power-up、廣告，評測更指出它賣用戶資料；有一批 Reddit 用戶投訴大獎「贏咗但收唔到獎品」（<https://moneypantry.com/coin-dozer-review/>）。**我哋連「獎品」都唔應該有實物等價。**
- **Payout ratio 設計**：真機 payout ratio 30–50%（<https://coinpusher.com/how-do-coin-pushers-work/>），即係設計上係蝕錢嘅。日文 Wikipedia 講得最白：「ゲームをやり続けると最終的にはプレーヤーは負ける」（<https://ja.wikipedia.org/wiki/プッシャーゲーム>）。
- **UK penny falls 由 1960 年代起無年齡限制**，已經有學術個案研究把它同 fruit machine 成癮連埋（<https://www.sciencedirect.com/science/article/pii/S2773021225000033>）。
- **成癮證據不只在真錢台**：Tipping Point Blast 係完全免費的手機遊戲，評測者半個鐘之後寫「now basically hate myself」（<https://www.bothersbar.co.uk/?p=12777>）。**免費唔等於安全**，所以下面幾條同樣重要。

### 4.2 暗黑模式（一律唔做）
| 模式 | 實例 | 我們的替代做法 |
|---|---|---|
| **付費牆／廣告閘** | Poki Coin Machine：未解鎖 slot 有鎖頭搖動，要看廣告解鎖 | 所有內容一次過解鎖；進度靠玩家推，唔靠等或者睇廣告 |
| **假隨機／near-miss 造假** | 真機的 near-miss effect（coinpusher.com 明列）；「あと1枚」類（<https://gorufo-games.itch.io/just-one-more-coin>） | RNG 係 `mulberry32` 決定性（`sim.js`），物理係真的；`Sim.reset(seed)` 可重現。**唔好加假嘅「差少少」** |
| **FOMO 倒數／限時獎勵** | 手機遊戲通用 | 冇限時、冇每日簽到、冇季節通行證 |
| **Sunk-cost 陷阱** | gigadeli 的「0 枚延遲 8 秒才 game over（最後一枚可能贏回）」**係為咗留住你** | 我們有 `topUp()`（`main.js`）——但佢係**明示**的（「陳伯擺低幾蚊」＋ chime），有 2.5 秒冷卻、一次 8 蚊。呢個係「你冇晒錢」的保底，唔係「再一局就中」。**保持明示，唔好加動畫誘導。** |
| **賣資料／追蹤** | Coin Dozer | 只有 `localStorage['yatmangai.save.v1']`（`ui.js` `UI.save()`／`UI.load()`），冇網絡請求（除了 three.js CDN，見第 5 節） |
| **假裝有技術（illusion of control）用來留人** | coinpusher.com 把 illusion of control 列為真機心理機制 | 落點**真係**決定付款（`payW: 0.31`），所以可以有操控感——但要**講真話**（第 3 條嘅側溝帶），唔好誇大 |

### 4.3 一句可以放喺設定頁的話（抄態度，唔抄文案）
Coin Cascade 喺頁面寫：「Is Coin Cascade a gambling game? **No.**」「no coin packs, no premium currency, no ads」。
我們版本（提議，放 `index.html` `.setNote`）：「**唔收錢，唔換獎品，唔會要你等。**推落嘅嘢，落唔到就係落唔到。」

---

## 5. 研究期間順手發現的技術債

1. **`index.html` 仲載住 three.js CDN**（`index.html` `<script src=…three.min.js>`：`https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js`）→ 同「file:// 直開、離線可用」目標衝突。要本地化（`vendor/three.min.js` + 相對路徑）或者至少喺 `#err`（`index.html`）講清楚。
2. **`flash()` 用 `offsetWidth` 強制重排**（`ui.js` `flash()`：`classList.remove → void el.offsetWidth → add`）→ gigadeli 實測喺重負載下會卡動畫。建議改成「換 key／重建元素」或者用 `animation` 的 `startTime` 重設。`#machine`（`index.html` CSS）已經係 transform-based，方向係對的。
3. **存檔冇 `pagehide`**：`UI.save()` 只在事件（付款／收集／`topUp`／`showStageDone`）呼叫（`main.js` `UI.save()` 嘅呼叫點、`ui.js` `UI.showStageDone()` 尾段）。手機切走 tab 有機會掉最後一次進度。gigadeli 用 2 秒 debounce + `pagehide`（唔用 `beforeunload`）。**同 3.1 一齊做最省事。**
4. **`#bigRow` 喺景觀手機被 `display:none`**（`index.html` 景觀 media query 嘅 `#bigRow`）→ 手機橫向玩嘅時候，收藏進度完全消失。第 5 條嘅結算頁可以補返呢個洞。
5. **`UI.setMuted()`（`ui.js`）已經冇人叫**（`grep setMuted` 只剩定義；`isMuted` 亦只剩定義）。可以刪，避免同 `UI.toggleMuted()`（`ui.js`）兩條路徑。

---

## 6. 參考連結（全部已抓取／已核）

實體街機
- バベルのメダルタワー（SEGA）<https://www.sega.jp/history/arcade/product/11004/>
- マーブルフィーバー（KONAMI）<https://www.konami.com/arcadegames/products/am_marble_fever/>
- プッシャーゲーム（ja.wikipedia）<https://ja.wikipedia.org/wiki/プッシャーゲーム>
- Medal game（en.wikipedia，含 UK penny falls）<https://en.wikipedia.org/wiki/Medal_game>
- How do coin pushers work <https://coinpusher.com/how-do-coin-pushers-work/>

手機
- Coin Dozer（App Store）<https://apps.apple.com/us/app/coin-dozer/id372836496>
- Coin Dozer 評測 <https://moneypantry.com/coin-dozer-review/>
- 澳洲兒童媒體警示 <https://childrenandmedia.org.au/app-reviews/apps/coin-dozer>
- Tipping Point Blast!（App Store）<https://apps.apple.com/us/app/tipping-point-blast-coin-game/id1471370760>
- Tipping Point Blast! 評測 <https://www.bothersbar.co.uk/?p=12777>

網頁
- Coin Cascade <https://weeklyarcade.games/games/coin-cascade/>
- MEDARUN PUSHER（itch.io）<https://werizu1208.itch.io/medarun-pusher>
- Coin Drop Factory（CrazyGames）<https://www.crazygames.com/game/coin-drop-factory-tvh>
- Coin Machine（Poki）<https://poki.com/en/g/coin-machine>（第三方描述 <https://zologames.com/coin-machine/>）
- Super Coin Pusher 2000 3D Arcade Edition（itch.io）<https://samuel-carton.itch.io/super-coin-pusher-2000-3d-arcade-edition>
- itch.io coin-pusher tag <https://itch.io/games/tag-coin-pusher>

Steam
- Coin Pusher Casino <https://store.steampowered.com/app/2178590/Coin_Pusher_Casino/>
- Old Coin Pusher Friends 3 <https://store.steampowered.com/app/3040390/Old_Coin_Pusher_Friends_3/>
- Coin Pusher（RewindApp）<https://store.steampowered.com/app/827420/Coin_Pusher/>

設計書／研究
- gigadeli/medal_web DESIGN.md <https://github.com/gigadeli/medal_web/blob/main/DESIGN.md>
- 成癮個案報告 <https://www.sciencedirect.com/science/article/pii/S2773021225000033>
