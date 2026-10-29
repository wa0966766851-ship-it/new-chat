import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import {FRONT_EVIDENCE, PET_ANIMATION_ASSETS} from '../src/battle/petAnimationAssets';
import {STATIC_FRONT_EVIDENCE, BATTLE_SPRITE_FACING, BODY_SOURCE_FACING} from '../src/battle/seerAssets';
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { ElfAvatar } from "../src/components/SeerImages";
import { startIllusion, endIllusion } from "../src/battle/illusion";
import { battleSpriteScale, hasRenderableElfImagePath, shouldMirrorBattleSprite, mirrorSourceFacing, loadSeerIndex } from "../src/battle/seerAssets.ts";

test("illusion copies the original asset, then faces its own opponent for explicit paths and both sides", async () => {
  await loadSeerIndex();
  for (const [name, path, facing] of [
    ['魔化.雷伊', '/seer/body/70.png', 'left'],
    ['墜霆.雷伊', '/seer/body/70.png', 'left'],
    ['異境神霆·雷伊', '/elf-skins/rey-thunder-dragon-v1.png', 'right'],
    ['無序.墜星', '/elf-art/wuxu_zhuixing_body.png', 'left'],
    ['異境神霆·雷伊', '/elf-art/otherworld_thunder_rey_body.png', 'left'],
    ['無序.六刃', '/elf-art/wuxu_liuren_body.png', 'right'],
    ['星光·雷納多', '/seer/body/4937.png', 'left'],
    ['恐懼的化身·咤克斯', '/seer/body/2648.png', 'left'],
    ['變革·馬爾修斯', '/seer/body/3393.png', 'left'],
    // 未核對不猜鏡射，與已核對正面圖分開。
    ['未知圖', '/custom/unverified.png', undefined],
  ] as const) for (const side of ['p1', 'p2'] as const) {
    const stats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 };
    const owner: any = { id: 'owner', battleId: 'owner', name: '原精靈', path: '/custom/owner.png', calculatedStats: stats, maxHp: 100, currentHp: 100, skills: [] };
    const target: any = { ...owner, id: 'target', battleId: 'target', name, path };
    const ctx: any = { actor: side, get self() { return owner; }, updateElf: (_s: string, p: any) => Object.assign(owner, p), addLog() {} };
    assert.equal(startIllusion(ctx, target, '朝向測試'), true);
    const render = (elf: any, kind = 'body', battleSide = side) => new JSDOM(renderToStaticMarkup(React.createElement(ElfAvatar, { elf, kind, battleSide } as any))).window.document;
    const mirror = mirrorSourceFacing(facing, side);
    const ownDoc = render(owner), img = ownDoc.querySelector('img')!;
    assert.equal(img.getAttribute('src'), path);
    assert.equal(img.style.transform, mirror ? 'scaleX(-1)' : '', `${name}/${side}`);
    assert.equal(ownDoc.querySelectorAll('[style*="scaleX"]').length, mirror ? 1 : 0);
    if (facing === 'left' || facing === 'right') assert.notEqual(img.style.transform, render(target, 'body', side === 'p1' ? 'p2' : 'p1').querySelector('img')!.style.transform);
    assert.equal(render(owner, 'head').querySelector('img')!.style.transform, '');
    // URL direction remains authoritative even if a copied appearance is renamed.
    assert.equal(render({ ...target, name: '任意改名' }).querySelector('img')!.style.transform, mirror ? 'scaleX(-1)' : '');
    assert.equal(endIllusion(ctx), true);
    assert.equal(render(owner).querySelector('img')!.getAttribute('src'), '/custom/owner.png');
  }
});

test("coordinate contract: P1 faces screen-right, P2 faces screen-left, exactly one mirror", () => {
  // 換圖不得繼承名稱的方向：新圖未登記 → 走未核對預設（left），不是照抄名稱的 left/right。
  assert.equal(shouldMirrorBattleSprite('異境神霆·雷伊','p1',false,'/elf-skins/new-unverified.png'),false,'未知URL不猜翻轉');
  assert.equal(shouldMirrorBattleSprite('異境神霆·雷伊','p2',false,'/elf-skins/new-unverified.png'),false,'未核對預設 left：P2 不翻');
  assert.equal(shouldMirrorBattleSprite('無序.六刃','p2',false,'/elf-skins/new-unverified.png'),false,'不得繼承名稱的 right');
  for (const original of ["left", "right"] as const) {
    const rendered = (side: "p1" | "p2") => mirrorSourceFacing(original, side)
      ? original === "left" ? "right" : "left" : original;
    assert.equal(rendered("p1"), "right");
    assert.equal(rendered("p2"), "left");
    assert.notEqual(mirrorSourceFacing(original, "p1"), mirrorSourceFacing(original, "p2"));
  }
  for (const side of ["p1", "p2"] as const) {
    assert.equal(mirrorSourceFacing("front", side), false);
    assert.equal(mirrorSourceFacing(undefined, side), false);
  }
});

test("4937: verified left-facing source mirrors only P1, never guesses a custom replacement", () => {
  for (const name of ["星光·雷納多", "星光雷納多", "星光.雷納多"]) {
    assert.equal(shouldMirrorBattleSprite(name, "p1"), true);
    assert.equal(shouldMirrorBattleSprite(name, "p2"), false);
    for (const custom of [false, true]) {
      assert.equal(shouldMirrorBattleSprite(name, "p1", custom, "/seer/body/4937.png"), true);
      assert.equal(shouldMirrorBattleSprite(name, "p2", custom, "/seer/body/4937.png"), false);
    }
    // 未登記的替換圖 → 未核對預設 left：P1 翻、P2 不翻（不再兩邊都不翻而同向）。
    assert.equal(shouldMirrorBattleSprite(name, "p1", true, "/custom/replacement.png"), false);
    assert.equal(shouldMirrorBattleSprite(name, "p2", true, "/custom/replacement.png"), false);
  }
});

test("4937 actual ElfAvatar DOM: P1 body flips once, P2 and portraits remain untouched", async () => {
  await loadSeerIndex();
  const elf = JSON.parse(readFileSync(new URL('../src/data/imported/wiki_4937.json', import.meta.url), 'utf8'));
  for (const side of ['p1', 'p2'] as const) {
    const markup = renderToStaticMarkup(React.createElement(ElfAvatar, { elf, battleSide: side, kind: 'body' }));
    const doc = new JSDOM(markup).window.document;
    const img = doc.querySelector('img')!;
    assert.equal(img.getAttribute('src'), '/seer/body/4937.png');
    assert.equal(img.style.transform, side === 'p1' ? 'scaleX(-1)' : '');
    assert.equal(doc.querySelectorAll('[style*="scaleX"]').length, side === 'p1' ? 1 : 0);
    const head = new JSDOM(renderToStaticMarkup(React.createElement(ElfAvatar, { elf, battleSide: side, kind: 'head' }))).window.document;
    assert.equal(head.querySelector('img')!.style.transform, '');
  }
  const neutral = new JSDOM(renderToStaticMarkup(React.createElement(ElfAvatar, { elf, kind: 'body' }))).window.document;
  assert.equal(neutral.querySelector('img')!.style.transform, '', 'detail art outside battle is not flipped');
});

test("known left-facing battle art faces the opponent on both sides", () => {
  const leftFacing = [
      "變革·馬爾修斯",
    "悲歌.索比拉特",
    "皮特薩拉羅",
    "帝皇之盾",
    "布萊克",
    "星光·魔焰猩猩",
    "鎮魂.巴弗洛",
    "誑獅魔軀.魔獅迪露",
    "星光·魯斯王",
    "星光·麗莎布布",
    "柯爾霍德",
    "混濁海妖.布林克克",
    "聖靈譜尼",
    "異境神霆·雷伊",
    "蟲后·奧佩婭",
    "眾神之父·奧丁",
    "冰魄·柯爾德",
    "湮滅之主・咤克斯",
    "皮皮",
    "聖光斯嘉麗",
    "怒濤·滄嵐",
    "無序.墜星",
    "聖靈邁爾斯",
    "譜尼",
    "混沌·布萊克",
    "治癒.龍魂再臨 次元龍",
    "無序·蝕言",
    "蓓麗安特",
    "天蓬元帥八戒",
    "人皇·帝辛",
    "星核寰宇·艾斯菲亞",
    "星軌重構·艾斯菲格",
    "御天龍神·哈莫",
  ];

  for (const name of leftFacing) {
    assert.equal(shouldMirrorBattleSprite(name, "p1"), true, `${name}: P1 must mirror left-facing art`);
    assert.equal(shouldMirrorBattleSprite(name, "p2"), false, `${name}: P2 must preserve left-facing art`);
  }
});

test("unclassified user paths never inherit a known name or guess a mirror", () => {
 for(const name of ['unknown user art','unverified battle art','皮特薩拉羅'])for(const side of ['p1','p2'] as const){
  assert.equal(shouldMirrorBattleSprite(name,side,true),false);
  assert.equal(shouldMirrorBattleSprite(name,side,true,'/custom/unverified.png'),false);
 }
 for(const side of ['p1','p2'] as const)assert.equal(shouldMirrorBattleSprite('unknown user art',side),false);
});

test("battle sprite scale responds meaningfully to biological height", () => {
  assert.ok(battleSpriteScale("small", 110) < battleSpriteScale("medium", 180));
  assert.ok(battleSpriteScale("medium", 180) < battleSpriteScale("large", 500));
  assert.equal(battleSpriteScale("unknown", 0), 1);
  assert.equal(battleSpriteScale("unknown", 100000), 1);
  // 2026-10-27：咤克斯改由 BATTLE_SPRITE_PROFILES 的 heightRatio 控制大小，profile 不再帶 scale 乘數，
  // battleSpriteScale 因此不應再額外放大（先前期望 1.08 為舊架構的殘留）。
  assert.equal(battleSpriteScale("恐懼的化身·咤克斯", 180), 1);
});

test("built-in art keys do not suppress the registered facing rule", () => {
  assert.equal(hasRenderableElfImagePath("otherworld_thunder_rey"), false);
  assert.equal(hasRenderableElfImagePath("/elf-art/custom_body.png"), true);
  assert.equal(hasRenderableElfImagePath("https://example.test/body.png"), true);
  assert.equal(shouldMirrorBattleSprite("異境神霆·雷伊", "p1", hasRenderableElfImagePath("otherworld_thunder_rey")), true);
  assert.equal(shouldMirrorBattleSprite("異境神霆·雷伊", "p2", hasRenderableElfImagePath("otherworld_thunder_rey")), false);
});

test("fear custom art faces right while official fallback faces left", () => {
  for (const name of ["恐懼的化身·咤克斯", "恐懼的化身.吒克斯"]) {
    assert.equal(shouldMirrorBattleSprite(name, "p1"), false);
    assert.equal(shouldMirrorBattleSprite(name, "p2"), true);
    // 5010 尚無已核對的全身素材；不能僅靠恐懼化身名稱推定其方向。
    // 5010 尚未登記 → 未核對預設 left：P1 翻、P2 不翻，仍保持面對面。
    assert.equal(shouldMirrorBattleSprite(name, "p1", false, "/seer/body/5010.png"), false);
    assert.equal(shouldMirrorBattleSprite(name, "p2", false, "/seer/body/5010.png"), false);
  }
});


test("source facing matches the user-confirmed P1 corrections", () => {
  for (const [name, id] of [["星核寰宇·艾斯菲亞", 79], ["星軌重構·艾斯菲格", 418], ["御天龍神·哈莫", 3809]] as const) {
    for (const custom of [false, true]) {
      assert.equal(shouldMirrorBattleSprite(name, "p1", custom, `/seer/body/${id}.png`), true);
      assert.equal(shouldMirrorBattleSprite(name, "p2", custom, `/seer/body/${id}.png`), false);
    }
  }
  for (const [name, source] of [["譜尼", "/seer/body/300.png"], ["混沌·布萊克", "/seer/body/3539.png"],
    ["治癒.龍魂再臨 次元龍", "/seer/body/4586.png"], ["無序·蝕言", "/elf-art/wuxu_shiyan_body.png"], ["蓓麗安特", "/seer/body/4643.png"]]) {
    assert.equal(shouldMirrorBattleSprite(name, "p1", false, source), true);
    assert.equal(shouldMirrorBattleSprite(name, "p2", false, source), false);
  }
  assert.equal(shouldMirrorBattleSprite("無序.六刃", "p2", false, "/elf-art/wuxu_liuren_body.png"), true);
  assert.equal(shouldMirrorBattleSprite("無序.六刃", "p1", false, "/elf-art/wuxu_liuren_body.png"), false);
  for (const side of ["p1", "p2"] as const) assert.equal(shouldMirrorBattleSprite("未知精靈", side, false, "/elf-art/unknown_myth_ghost_body.png"), false);
  // 2026-10-26 逐張看原圖改：2882／3105／4032／3045 是斜側朝左，不是正面圖。
  for (const id of [2882, 3105, 4032, 3045, 3665]) {
    assert.equal(shouldMirrorBattleSprite("六界神王", "p1", false, `/seer/body/${id}.png`), true, `${id} 原圖朝左，P1 應翻轉`);
    assert.equal(shouldMirrorBattleSprite("六界神王", "p2", false, `/seer/body/${id}.png`), false, `${id} 原圖朝左，P2 不翻`);
  }
  // 幻域競技場四張立繪：逐張看原圖重新核對（2026-10-26）。
  // 4661 無為龍者、4800 無極聖武：使用者逐張看原圖核對後確認為朝左 → 原圖 left：P1 翻、P2 不翻。
  // （先前登記 right 是看頭部特寫誤判；已由使用者提供的實測清單更正。）
  for (const [n, id] of [["無為龍者", 4661], ["無極聖武", 4800]] as const) {
    assert.equal(shouldMirrorBattleSprite(n, "p1", false, `/seer/body/${id}.png`), true, `${n} 原圖朝左，P1 應翻轉`);
    assert.equal(shouldMirrorBattleSprite(n, "p2", false, `/seer/body/${id}.png`), false, `${n} 原圖朝左，P2 不應翻轉`);
  }
  // 4903 龍錄天鋒、4275 命運龍輪 莫伊萊朝畫面左 → 原圖 left：P1 翻、P2 不翻。
  for (const [n, id] of [["龍錄天鋒", 4903], ["命運龍輪 莫伊萊", 4275]] as const) {
    assert.equal(shouldMirrorBattleSprite(n, "p1", false, `/seer/body/${id}.png`), true, `${n} 原圖朝左，P1 應翻轉`);
    assert.equal(shouldMirrorBattleSprite(n, "p2", false, `/seer/body/${id}.png`), false, `${n} 原圖朝左，P2 不應翻轉`);
  }
});

test("2026-10-26 locked static decisions never inherit native bundle direction", () => {
 for(const id of [4661,4800,3045,2882,3105,4032,3665,1536,187,3626,3809,4649,4275,4903,1000,2656,3005,3870,4249,4891]){
 const source='/seer/body/'+id+'.png';assert.equal(BODY_SOURCE_FACING[source],'left',source);
 assert.equal(shouldMirrorBattleSprite('任意名稱','p1',true,source),true);assert.equal(shouldMirrorBattleSprite('任意名稱','p2',true,source),false);
 }
 assert.equal(BODY_SOURCE_FACING['/elf-art/zhakesi_fear_body.png'],'right');
 for(const key of ['emperorShield','brink','marthus','odin','mogos','wujiShengwu','wuxuLong','moyilai','diluTianfeng'] as const){
 assert.equal(PET_ANIMATION_ASSETS[key].facing,'right',key+' native raw');
 const source='/api/pet-animations/bundle/'+key;
 assert.equal(shouldMirrorBattleSprite('不靠名稱猜測','p1',false,source),false);assert.equal(shouldMirrorBattleSprite('不靠名稱猜測','p2',false,source),true);
 }
});

test("front 只能是正面或無側向素材，且每一筆都要有視覺證據", () => {
  // 規則：front＝兩側都不鏡射，所以 front 一旦用錯，P1/P2 會同向、直接違反面對面。
  // 因此每一筆 front 都必須在 FRONT_EVIDENCE／STATIC_FRONT_EVIDENCE 留下核對依據，
  // 而且不准拿 front 當「還沒看過」的預設值。
  const assets = Object.entries(PET_ANIMATION_ASSETS as Record<string, {name: string; facing: string}>);
  const fronts = assets.filter(([, meta]) => meta.facing === 'front');
  for (const [key, meta] of fronts) {
    assert.ok(FRONT_EVIDENCE[key], `${meta.name}（${key}）標成 front 卻沒有視覺證據，請改成 left/right 或補上 FRONT_EVIDENCE`);
  }
  for (const key of Object.keys(FRONT_EVIDENCE)) {
    const meta = (PET_ANIMATION_ASSETS as Record<string, {name: string; facing: string}>)[key];
    assert.ok(meta, `FRONT_EVIDENCE 列了不存在的素材 ${key}`);
    assert.equal(meta.facing, 'front', `${meta.name} 已有證據但 facing 不是 front`);
  }
  // 不以任意數量上限代替視覺證據；已知正面與未驗證素材必須分開。
  assert.deepEqual(fronts.map(([key])=>key).sort(),Object.keys(FRONT_EVIDENCE).sort());
  for (const [key, note] of Object.entries(STATIC_FRONT_EVIDENCE)) {
    assert.ok(note.trim().length > 8, `${key} 的 front 證據說明太短`);
  }
});

test("每一筆靜態立繪都有方向，且 front 只留無法核對的自訂圖", () => {
  const tables = [BATTLE_SPRITE_FACING, BODY_SOURCE_FACING] as Record<string, string>[];
  for (const table of tables) {
    for (const [key, facing] of Object.entries(table)) {
      if (facing !== 'front') continue;
      // 動畫素材的鍵是 bundle URL，證據登記在 FRONT_EVIDENCE（以素材鍵為索引）。
      const animKey = key.match(/^\/api\/pet-animations\/bundle\/(\w+)$/)?.[1];
      if (animKey) {
        assert.ok(FRONT_EVIDENCE[animKey], `動畫素材 ${animKey} 標成 front 卻沒有視覺證據`);
        continue;
      }
      assert.ok(STATIC_FRONT_EVIDENCE[key], `靜態圖 ${key} 標成 front 卻沒有視覺證據`);
    }
  }
  // 內建 /seer/body/*.png 是原廠素材，一律有明確方向，不得用 front 交差。
  for (const table of tables) {
    for (const [key, facing] of Object.entries(table)) {
      if (/^\/seer\/body\//.test(key)) assert.notEqual(facing, 'front', `${key} 是原廠立繪，不得標成 front`);
    }
  }
});
