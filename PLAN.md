# 一蚊雞 · *Coin Pusher HK* — Build Plan v3

**Status:** draft for approval · **Date:** 2026-11-20 · **Workspace:** `Projects/WebGame/Coin Pusher`
**Target:** playable public build on GitHub Pages, mobile + desktop, one URL.
**Change from v2:** 1972–2026 only (seven stages); **three 大件 per stage, all must be collected**;
the cabinet **modernises** instead of decaying; every 大件 carries a real person's memory.

---

## 0. 一句話

> 一部 1972 年出廠嘅推銀機，捱過七次翻新，今日仍然企喺機舖角落。
> 你推嘅每一蚊，都係某個人喺某一年跌低咗嘅嘢。

You play a coin pusher that has been rewired, re-skinned and re-funded seven times since 1972. Every
coin you push over the lip digs up something that was popular that year — and the person who lost it.

---

## 1. 係邊度嚟 — what this is built on

| Doc | What it gives us |
|---|---|
| `single-file-html-web-apps-and-web-game-portals-p-e1e3a3d4.md` | One-file recipe: inline JS/CSS, CDN libraries, no bundler, GitHub Pages, works double-clicked from `file://` |
| `orb-runner-single-file-three-js-platformer-layou-7e500950.md` | Data-driven geometry, one collision function instead of an engine, `?selftest` assertions, and proof that headless screenshots are not trustworthy evidence |
| `web-game-distribution-monetization-and-portal-de-8a230ab0.md` | Size gates (PixiJS 130 KB / Phaser 290 KB / Godot 10 MB), tap-to-start audio, relative-paths-only |

**Load-bearing lesson from Orb Runner:** a `?selftest` hook asserting physics and content invariants is what
makes a 3D browser game iterable at all. Milestone-one work, not polish.

---

## 2. Goals / Non-goals / Anti-goals

**Goals**
- A 3D coin pusher genuinely fun for 5+ minutes with no tutorial.
- **7 stages, 63 collectibles**, each a thing that was actually popular that year.
- Every stage's **three 大件 must all be collected** before the machine modernises.
- A HK player laughs in the first 90 seconds and feels something in the last 90.
- A non-HK player finishes able to name three things they learned about Hong Kong.

**Non-goals (v1)**
- No accounts, no server, no multiplayer, no ads. `localStorage` only.
- No revenue, no portal submission, no build step.
- No licensed IP, no real brand marks, no 冒險樂園 logo.

**Anti-goals**
- A skin: generic pusher with HK textures pasted on. Culture must be *mechanical*.
- A museum: pretty, inert, no reason to push again.
- A lecture: any popup longer than three lines before the player has laughed.
- **Nostalgia porn.** These years were hard for the people living them. Keep the affection, lose the cosiness.
- **Pity.** The people in this game are not tragic. They are funny, sharp, and still here.

---

## 3. 四個支點

**3.1 部機有性格.** The cabinet talks. Old, tired, passive-aggressive, sentimental, calls you 老細. It
complains when you slap it, gets defensive about coins stuck behind it, and remembers every hand that ever
touched it. Written Cantonese. Comedy engine at near-zero build cost.

**3.2 部機由舊變新.** The arc is **modernisation, not decay**. 1972 it is a wooden box with a mechanical
coin slot and a hand-painted sign. By 2026 it is glass, 4K, contactless, app-linked — and has a "retro mode"
it never asked for. It is not dying. It is being upgraded forever, and that is the joke *and* the wound: the
only thing that never got replaced is what fell down the side.

**3.3 收集品係實物.** A collectible spawns **on the table** and must be pushed over the lip with real
physics. You can lose it down the side. It can bury under 200 coins. Getting one is an event, not a click.

**3.4 每件大件都係一個人.** Every 大件 belongs to a named Hong Kong person — a 工廠妹, a 的士司機, a 護士,
an 外賣仔. Collect it and you get their memory of it, in their voice, in Cantonese. Collect all three in a
stage and you get the rest of their story. **The collection is not objects. It is people.**

---

## 4. 核心循環

1. **Aim** — coin on a rail above the front lip; choose a drop column. One input: tap/drag, release.
2. **Drop** — coin lands, plate sweeps, pile breathes.
3. **推** — coins shove each other; the front row teeters.
4. **Payoff** — coins free-fall into the tray in true 3D (the only place real 3D physics runs, §9).
5. **Dig** — every N coins, a period object surfaces from the pile.
6. **Collect** — object and its person's memory go into the museum; the machine says something.
7. **Modernise** — collect all three 大件 → the cabinet upgrades, the stage advances, the street changes.

First collect: 90 seconds. First stage complete: ~5 minutes. Full run: 25–35 minutes.

---

## 5. 七個階段 — 1972 → 2026

| # | 年 | 階段 | 香港發生咩事 | 部機變成點 |
|---|---|---|---|---|
| 1 | **1972** | 清潔．隧道 | 海底隧道通車、清潔香港運動、ICAC（1974） | 木箱、機械投幣、手寫招牌、玻璃罩 |
| 2 | **1980** | 地鐵．霓虹 | 地鐵通車、前途談判、匯豐總行、股災（1987） | chrome 邊、霓虹燈、電子音效 |
| 3 | **1997** | 回歸．啟德 | 回歸、八達通、啟德關閉（1998）、金融風暴 | 花紋膠板、數碼計數、出票 |
| 4 | **2003** | 沙士．自由行 | 沙士、自由行、迪士尼（2005）、天星鐘樓（2006） | 金屬殼、LCD、紙幣找換、消毒液 |
| 5 | **2010** | 智能電話．排隊 | 智能手機普及、社交媒體、淘寶、團購 | 觸控螢幕、LED 燈帶、會員卡、QR |
| 6 | **2020** | 疫情．兩餸飯 | 疫情、消費券（2021）、通關（2023）、垃圾徵費擱置 | 無接觸支付、膠板、噴霧 |
| 7 | **2026** | 現在 | 現在 | 玻璃殼、4K、App、復古模式 |

**每階段三件大件，全部要收集齊先可以翻新。** 六件小物係額外嘅 —— 收齊九件就完成嗰間舖。

---

### 第一階段 · 1972 「清潔．隧道」

**大件（必須全收）**
| 物件 | 邊個嘅 | 佢嘅記憶 |
|---|---|---|
| 汽水櫃 | 工廠妹 阿珍，18 歲，觀塘塑膠花廠 | 「阿爸放工帶我落樓下，一樽綠寶，兩支飲管。」 |
| 大牛龜電視機 | 阿珍個阿爸，夜班看更 | 「全家食飯望住部機，阿媽話食完先准睇。」 |
| 麻雀枱 | 樓下士多老闆 陳伯 | 「開枱要搬枱，搬完先發現少咗隻東。」 |

**小物**：垃圾蟲 · 紅色小巴牌 · 康樂棋 · 綠寶橙汁 · 報紙檔 · 跳飛機粉筆

---

### 第二階段 · 1980 「地鐵．霓虹」

**大件（必須全收）**
| 物件 | 邊個嘅 | 佢嘅記憶 |
|---|---|---|
| 霓虹招牌 | 的士司機 強哥，35 歲，夜更 | 「我住嗰條街，夜晚唔使開燈。」 |
| 街機（太空侵略者） | 強哥個仔，10 歲 | 「放學唔返屋企，企喺機舖睇人打，俾人趕就換間。」 |
| 卡式錄音機 | 工廠妹 阿珍，26 歲，轉咗做電子廠 | 「錄歌要等收音機播，一有廣告就嬲。」 |

**小物**：大哥大 · 紅白藍袋 · 地鐵儲值票 · 魚翅撈飯碗 · 玉郎漫畫 · 電子錶

---

### 第三階段 · 1997 「回歸．啟德」

**大件（必須全收）**
| 物件 | 邊個嘅 | 佢嘅記憶 |
|---|---|---|
| 啟德飛機（747） | 強哥，52 歲，喺九龍城長大 | 「飛機飛過，電視會雪花，全屋一齊嗌。」 |
| 移民行李箱 | 阿文，12 歲，1997 年走 | 「表哥走嗰日，機場合照，之後三十年冇見。」 |
| 卡拉OK 電視櫃 | 阿珍，43 歲，第一次入 K 房 | 「唱到走音，全場拍手，我以為自己好紅。」 |

**小物**：冒險樂園代幣 · Yes! Card · 他媽哥池 · 傳呼機 · 八達通 · 四大天王卡式帶

---

### 第四階段 · 2003 「沙士．自由行」

**大件（必須全收）**
| 物件 | 邊個嘅 | 佢嘅記憶 |
|---|---|---|
| 天星鐘樓 | 護士 阿儀，28 歲，屯門醫院 | 「拆嗰晚，好多人企喺度睇，冇人出聲。」 |
| 迪士尼城堡（模型） | 阿儀個妹，14 歲 | 「開幕嗰日排咗四個鐘，入到去落雨。」 |
| 網吧電腦（CRT） | 阿文，18 歲，返咗嚟 | 「通宵十二蚊，打到天光，返學照去。」 |

**小物**：口罩 · 翻蓋手機 · MP3 機 · 囍帖 · 奶粉罐 · 電子辭典

---

### 第五階段 · 2010 「智能電話．排隊」

**大件（必須全收）**
| 物件 | 邊個嘅 | 佢嘅記憶 |
|---|---|---|
| 夾公仔機 | 大學生 阿康，20 歲 | 「夾咗三百蚊，隻公仔淘寶二十九蚊。」 |
| 珍珠奶茶招牌 | 阿康個女朋友，19 歲，排隊黨 | 「排四十分鐘，飲三口，影相，掉。」 |
| 韓團應援燈牌 | 阿儀個女，12 歲 | 「全場一片粉紅色，我嗌到冇聲。」 |

**小物**：智能電話 · 淘寶包裹 · 應援手燈 · 共享單車 · 手機八達通 · 網購退貨箱

---

### 第六階段 · 2020 「疫情．兩餸飯」

**大件（必須全收）**
| 物件 | 邊個嘅 | 佢嘅記憶 |
|---|---|---|
| 兩餸飯玻璃櫃 | 外賣仔 阿豪，24 歲 | 「三十五蚊，三餸，阿姐問我要唔要飯。」 |
| 外賣保溫箱 | 阿豪 | 「九樓，冇電梯，兩個月瘦咗十磅。」 |
| 消費券海報 | 陳伯個孫，22 歲 | 「五千蚊，買咗部電話，剩返三百。」 |

**小物**：口罩 · 快速測試 · 回鄉卡 · 垃圾袋 · 手搖飲品杯 · 網課耳機

---

### 第七階段 · 2026 「現在」

**大件（必須全收）**
| 物件 | 邊個嘅 | 佢嘅記憶 |
|---|---|---|
| 北上行李箱 | 阿豪，30 歲，轉咗做物流 | 「星期六朝早過關，晚上返嚟，行李箱滿晒。」 |
| 演唱會應援牌 | 阿儀個女，28 歲 | 「搶飛搶咗三個鐘，入到場喊咗。」 |
| 電子支付終端 | 陳伯個孫，28 歲，開咗間舖 | 「貼咗三年，冇人知個 code 係乜。」 |

**小物**：AI 聊天機械人 · 淘寶集運箱 · 兩餸飯外賣袋 · 演唱會票尾 · 北上按摩券 · 舊式八達通

---

## 6. 七個人 — 條線

The same seven people recur across all seven stages. You watch them age.

| 人物 | 1972 | 1980 | 1997 | 2003 | 2010 | 2020 | 2026 |
|---|---|---|---|---|---|---|---|
| 阿珍 | 工廠妹 18 | 電子廠 26 | K 房 43 | — | — | — | — |
| 強哥 | — | 的士司機 35 | 九龍城 52 | — | — | — | — |
| 陳伯 | 士多老闆 40 | — | — | — | — | 80，退休 | — |
| 阿文 | — | — | 移民 12 | 回流 18 | — | — | — |
| 阿儀 | — | — | — | 護士 28 | 阿媽 35 | — | — |
| 阿康 | — | — | — | — | 大學生 20 | — | — |
| 阿豪 | — | — | — | — | — | 外賣仔 24 | 物流 30 |

**Collecting all three 大件 in a stage unlocks that stage's person chapter** — three lines, their voice,
what happened next. This is the emotional spine and it is 21 short paragraphs of authored text. Cheap to
build, impossible to fake.

**The ending.** By 2026 the arcade is being renovated. The machine is scheduled for replacement. You play
one last round. The 樓梯底 pile opens: it contains one lost object from each of the seven people — the
thing they each dropped and never got back — plus one coin from 1972, still there. The machine says one
line. It is not sentimental. It is worse than sentimental: it is polite.

---

## 7. 博物館 — 一條街，七間舖

Not a grid. **The street outside the arcade, as the machine remembers it through the door.**

| 階段 | 間舖 | 收齊之後 |
|---|---|---|
| 1972 | 士多 | 鐵閘拉開，光管閃兩下先著 |
| 1980 | 電器舖 | 霓虹招牌亮，隔籬街都見到 |
| 1997 | 機舖 | 捲閘升起，入面有街機聲 |
| 2003 | 網吧 | 藍色燈，煙霧，屏幕一排排 |
| 2010 | 手機舖 | 白光，玻璃門，職員企喺門口 |
| 2020 | 兩餸飯舖 | 發熱燈著，八個盤 |
| 2026 | 便利店 | 自動門開，叮噹 |

- Each shop window physically holds its 9 objects on shelves. Completing all 9 lights the shop.
- **Seven lit shops in one frame is the marketing asset** — the shareable screenshot.
- The shops visibly modernise as you go: hand-painted → neon → plastic → LCD → LED → glass.
- **第七間舖後面係樓梯底** — the space under the machine, one pile, the ending.

---

## 8. 驚喜引擎 — 事件

Fired by coins pushed, not by clock, so nothing interrupts a good avalanche. One mechanic, one joke,
≤6 seconds, fully interruptible.

| 事件 | 發生咩事 | 點解好笑 |
|---|---|---|
| 阿姐抹機 | 清潔阿姐抹枱，掃走你啲銀，仲要話「唔好意思」 | 全香港人都聽過 |
| 拍機 | 你可以摑部機（有限體力），銀會跳，部機話要叫管理處 | 真人真事 |
| 八號風球 | 部機斜，全部滑，免費銀，貼紙剝落 | 唔使解釋 |
| 停電 | 黑畫面，假 CRT 開機，你啲銀冇事 | 嚇你一跳再放鬆 |
| 大牛龜維修 | 維修師傅開機頭，拎走一個銀「檢查」 | 小事，但真 |
| 阿叔教路 | 阿伯教錯晒，然後幫你打一個銀 —— 贏咗 | 耆英賭場，有感情 |
| 死機 | 假系統錯誤，其實係小遊戲：按啱序列 | 反轉「死機」反應 |
| 金幣去咗邊 | 一個銀跌咗落機後面，要搖部機 | 人人都試過 |

Two rules: **no event costs progress the player can't recover**, and **every event is skippable with the
same input** (tap). Comedy that blocks play is not comedy.

**Per-stage events** (one each, cheap, era-flavoured): 1980 隔籬街機聲搶你生意；1997 倒數計時；2003
部機要消毒先可以玩；2010 QR code 出現但乜都唔做；2020 限聚，一次只可以一個人玩；2026 「復古模式」
啟動，部機變返 1972 樣，但只維持八秒。

---

## 9. 兩種觀眾

- **Default:** Cantonese name, Jyutping, the person's memory, one line from the machine. Funny first.
- **遊客 Mode (toggle, remembered):** English gloss, two sentences on why it mattered, "say it out loud"
  with Jyutping highlighted, and one line on *what it replaced* — objects teach better as a chain.
- **廣東話 Mode:** all chrome in written Cantonese, no English. What HK players screenshot.

**Non-negotiable:** no popup longer than three lines before the player has laughed at least once.

---

## 10. 3D 與物理

**Decision: 2.5D simulation + real 3D only for the payoff.**

- **Table plane:** coins are 2D discs in `(x, z)`, radius `r`. No out-of-plane rotation.
- **Layers:** integer `layer`. Supported if a coin one layer below overlaps ≥85% of its footprint.
  Support vanishes → drops one layer with a 0.12 s tween.
- **Pusher:** open box sweeping sinusoidally; contacts every coin in layers `0..N` intersecting its front
  face. Resolution = iterative position correction, 3 iterations, velocity clamp. This is what makes piles
  feel *heavy* rather than bouncy.
- **Payoff is the only true 3D:** centre crosses the lip → leaves the 2D sim for a tiny ballistic integrator
  (position, velocity, angular velocity, gravity) → tumbles into the tray. 100% of the payoff, 0% of the
  stability cost.
- **大件 are just coins with bigger radii and heavier mass.** Same sim, no special case. A 大件 needs the
  pile behind it to be moving; a lucky drop bounces off. That is the entire difficulty design.
- **Feel constants (derived, not eyeballed):** `r = 0.035`, thickness `0.012`, layer height `0.012`, table
  `1.2 × 0.8`, pusher amplitude `0.18`, period `2.4 s`, fixed step `1/120 s` with accumulator. 大件 radii
  0.08–0.14. 480-coin cap before oldest layer-0 coins auto-clear.
- **Camera locked 38–42° above horizontal, fixed FOV.** Too high and layering reads fake; too low and you
  can't see the pile. Hard constraint, asserted in a probe.

Why: deterministic (seeded RNG, fixed step) → the §14 assertion suite is possible at all. Cheap: 480 discs.

---

## 11. 美術．音效 — 全部程序生成

**No model files. No texture files. No audio files.**

- Every object built from primitives + `ExtrudeGeometry` in a `PROPS` table:
  `{ id, stage, build(), hitbox, weight, owner }`. 維他奶 is a cylinder + canvas label; 大牛龜 is a box +
  inset screen + knobs; 垃圾蟲 is two spheres and five cones. Chunky low-poly is the art direction, not a
  compromise — it is funnier than realism, and it lets the same seven materials re-tint per stage so the
  cabinet's modernisation reads instantly.
- **The cabinet itself is one parametric builder** with seven profiles: wood → chrome → plastic → metal →
  touch → contactless → glass. Same geometry, different materials, bevels, trim and display panel.
- Logos drawn at runtime into `CanvasTexture`, genericised (§17).
- Audio fully synthesised in WebAudio: coin clink = noise burst through bandpass + short resonant decay;
  payout rumble = filtered noise; machine voice = pitched square-wave chirp, not TTS. Audio payload: 0 KB.
- Est. total: 63 props + 7 cabinet profiles of authored JS + three.js from CDN (~170 KB gzip). Under 5 MB.

---

## 12. 技術形狀

```
index.html          shell, canvas, inline <style>, boot
content.js          STAGES + PEOPLE + PROPS + all l10n data (plain JS global)
sim.js              2.5D sim + freefall integrator (no DOM, no three.js)
render.js           three.js scene, prop builders, cabinet profiles, camera
ui.js               HUD, popups, memory cards, museum street, events
main.js             wiring, input, save/load
README.md           what it is, how to run, screenshot
sources.md          every factual claim in content.js → its source
docs/plan.md        this file
```

**Classic `<script>` tags, no ES modules, no bundler.** ES modules are blocked on `file://`, which would
kill the double-click-to-play guarantee the prior-art survey calls the whole point. Classic scripts also
mean `content.js` can be a global instead of a `fetch()`ed JSON — also blocked on `file://`. This single
constraint decides the file layout. Cost: globals, load order matters. Accept it.

Save: `localStorage['yatmangai.save.v1']` → `{ v:1, stage, coins, collected:[], street, chapters:[],
settings:{lang, tourist, reducedMotion} }`. Versioned, migrated, never silently dropped.

---

## 13. 部署 — GitHub first

**Phase 1 (day 1, ~15 min):**
1. `git init` in `Coin Pusher/`, first commit = plan + shell `index.html` rendering an empty table.
2. `gh repo create osman3n/hk-coin-pusher --public --source=. --push` (account `osman3n`, active).
3. Settings → Pages → Deploy from branch → `main` / root. No Actions needed for static.
4. Verify the **live URL** on a phone: `https://osman3n.github.io/hk-coin-pusher/`.

**Why day 1:** deploy is never the risky part, but a stale URL is.

**Phase 2:** a `verify` workflow failing on (a) absolute paths, (b) payload >3 MB, (c) `?selftest` not
returning 0 failures in headless Chrome.

**Phase 3 (later):** itch.io mirror (same files, zip, `index.html` at root); Cloudflare Pages mirror for
mainland players (GitHub Pages is slow there — known, accepted).

---

## 14. 驗證

1. **`?selftest`** — console assertions, target ~34:
   - pushed coin moves; coin behind plate doesn't
   - coin past the lip pays out exactly once
   - unsupported coin drops exactly one layer, never two
   - stacking never exceeds layer 12
   - 300 coins at `1/120 s` holds 60 fps (measured)
   - **every stage has exactly 3 大件 and 6 小物; every item has `{name, jyutping, en, blurb, replaced,
     owner, stage, build}`**
   - **every 大件 has an `owner` that exists in `PEOPLE`, and that person has a chapter with 3 lines**
   - every prop builds without throwing and has a non-zero bounding box
   - every item footprint fits inside the table (reachable by the pusher)
   - every 大件 is heavier than every 小物 in its stage
   - **stage advances only when all 3 大件 are collected** (attempt to advance with 2 → rejected)
   - save → reload → state identical; unknown version migrates or fails loudly
   - no absolute paths anywhere
2. **`?probe`** — camera, coin count, layer histogram, payout tally, collected flags.
3. **Content linter** (`node tools/lint-content.mjs`): every blurb sourced in `sources.md`; no duplicate
   ids; **no stage-5/6/7 entry matching the banned-terms list (§17)**; every Cantonese line under 40
   characters (so it fits the popup).
4. **Screenshots, with the documented caveat.** Headless Chrome returned all-black frames for the same URL
   that rendered fine seconds earlier in this workspace. Prove framing numerically first, shoot
   real-browser screenshots second, never chase a black frame as a code bug.
5. **香港人會笑測試** — ten beats only a local gets: 拍機, 阿姐抹機, 斗零, 大牛龜, 八號風球, 兩餸飯,
   啟德飛機, 移民行李箱, 天星鐘樓, 樓梯底. Not shippable until 7 exist and land.
6. **香港人會痛測試** — the ending lands: the seven lost objects, and the machine being polite about it.
7. **遊客測試** — zero-context player, 5 minutes, can name three things they learned.

---

## 15. 里程碑

| # | Milestone | Done when | Est. |
|---|---|---|---|
| **M0** | Skeleton live | Repo public, Pages on, empty 3D table at the real URL on a phone | 0.5 d |
| **M1** | Physics core | Plate sweeps, layered stacking, lip payout, 大件 weight behaves, `?selftest` physics subset green, 60 fps @ 300 coins | 1.5 d |
| **M2** | 1972 vertical slice | 9 props, memory cards, person chapter, 士多, save/load, cabinet profile #1 | 2 d |
| **M3** | Pipeline proven | stage→collect→memory→chapter→shop chain works once; then batch | 0.5 d |
| **M4** | Stages 2–3 | 1980 + 1997, cabinet profiles #2–3, street shops #2–3 | 2 d |
| **M5** | Stages 4–5 | 2003 + 2010, profiles #4–5, shops #4–5 | 2.5 d |
| **M6** | Stages 6–7 + ending | 2020 + 2026, profiles #6–7, 樓梯底, the polite line | 2.5 d |
| **M7** | 驚喜引擎 | 8 global events + 7 stage events, machine voice lines | 2 d |
| **M8** | Polish | Touch + mobile, synth audio, reduced-motion, colourblind-safe, share card | 1.5 d |
| **M9** | Launch | README + GIF, itch.io mirror, sources complete | 1 d |

~16 working days. **M2 is the gate:** if 1972 isn't fun, the plan changes before 54 more objects and 21
memory cards get built.

**If scope must be cut:** ship 1972 / 1980 / 1997 / 2020 / 2026 (five stages, 45 items). Keep the person
line intact across those five. Drop 2003 and 2010 to v2 — they are the two most similar to their neighbours.

---

## 16. 風險與敏感

**Technical**
- *Layering looks fake at the wrong angle.* Lock 38–42°, assert in probe.
- *Jitter / tunneling at high counts.* Fixed step, layered support, coin cap, frame-time assertion.
- *大件 never move.* The 大件 must be heavy but not immovable; selftest asserts each is payout-reachable
  within a simulated 200-coin avalanche. Tune radius before mass.
- *Content growth.* `content.js` is the one file designed to grow; `sim.js` must stay small and testable.
- *Cantonese font rendering* on Windows/Android/iOS. System stack + fallback; rare hanzi stay in content,
  never in chrome.

**Content**
- *Facts.* Every claim gets a line in `sources.md` before shipping. When unsure, the general truth beats the
  specific one.
- *Hard sensitivity rules:*
  - **No politics, no slogans, no flags, no commentary on current events.** Era is defined by *objects,
    consumer habits and daily inconvenience*, never by political moments. 2010s/2020s especially:
    consumer objects only.
  - 1997 is a **year label**, not a subject. The stage contains 八達通, 啟德, 移民行李箱, 冒險樂園 — no
    commentary, no flags, no editorialising. If an object needs a political explanation to be funny, cut it.
  - 2003 covers 沙士 as *public experience* — masks, queues, school closures, a nurse's shift — never blame.
  - 2020 covers 疫情、兩餸飯、消費券、垃圾徵費 — cost-of-living comedy, not commentary.
  - **The seven people are not victims.** 阿珍 retires well. 強哥 still drives. 陳伯's shop closes but he is
    fine. 阿文 comes back. 阿儀 is competent, not saintly. 阿康 is a hustler. 阿豪 is funny, not pitiable.
  - 冒險樂園 is the *setting*, affectionately, with no logo and no implied endorsement.
  - 長者 who play 推銀機 are the punchline's friends, never the punchline. 阿叔教路 ends with him winning.
  - **No nostalgia for hardship.** 板間房, 山寨廠 and 通宵網吧 are presented as what they were — hard —
    with dignity intact. The joke is never at the expense of people who lived it.
- *Brand marks.* Real products appear as objects (a 維他奶 bottle is history), but logos are redrawn
  generically; the repo states clearly it is an unaffiliated fan work.
- *Cantonese quality.* Every line of written Cantonese gets read by a native speaker before ship. Not
  translated from English. This is the single highest-risk content item — bad Cantonese reads as fake
  instantly, and the whole emotional payload rides on it.

---

## 17. 開放問題 — 需要你決定

1. **三個大件夠唔夠？** I chose 3 per stage (21 total) so the mandatory goal stays ~5 minutes per stage.
   If you want the collection to feel bigger, 4 per stage is 28 — but the run grows to ~45 minutes.
2. **七個人嘅結局。** I wrote all seven as still-standing — nobody dies, nobody is pitied. That is a
   deliberate anti-nostalgia choice. Push back if you want it heavier.
3. **個名.** 一蚊雞 is my pick — slang for one dollar, and it is the sound the machine makes. You'll say it
   most, so you should own it.
4. **語言.** Cantonese-first + English toggle (my pick — HK players are the ones who must be surprised), or
   English-first?
5. **Spike first?** Two hours, 1972 only, three props, real physics, ugly. Answers "is this funny" earlier
   than a 16-day plan can. Cheap, and it doesn't commit you.

---

## 18. 附錄 — 待核實清單

Every historical claim above is from general knowledge, **not verified this session**. Must be sourced in
`sources.md` before shipping:

- 海底隧道通車（1972）· 清潔香港運動／垃圾蟲（1972）· 廉政公署（1974）
- 地鐵通車（1980）· 中英聯合聲明（1984）· 匯豐總行（1985）· 股災（1987）
- 冒險樂園（1994，上水名都首間）· 八達通（1997）· 啟德關閉（1998）
- 沙士（2003）· 自由行（2003）· 香港迪士尼（2005）· 天星鐘樓拆卸（2006）
- 智能手機普及年份（2010–2012）· 淘寶／團購在香港普及年份
- 疫情（2020）· 消費券（2021）· 通關（2023）· 垃圾徵費擱置（2024）
- 維他奶（1940）· 白花油（1927）· 紅A（1949）
- 太空侵略者（1978）在香港機舖普及年份
- **All 63 Jyutping strings — one dictionary pass by a person, not by memory.**
- **All 21 memory lines + 7 chapters — read aloud by a native speaker before ship.**
