import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { ElfAvatar } from "../src/components/SeerImages";
import { startIllusion, endIllusion } from "../src/battle/illusion";
import { battleSpriteScale, hasRenderableElfImagePath, shouldMirrorBattleSprite, mirrorSourceFacing, loadSeerIndex } from "../src/battle/seerAssets.ts";

test("illusion copies the original asset, then faces its own opponent for explicit paths and both sides", async () => {
  await loadSeerIndex();
  for (const [name, path, facing] of [
    ['無序.墜星', '/elf-art/wuxu_zhuixing_body.png', 'left'],
    ['異境神霆·雷伊', '/elf-art/otherworld_thunder_rey_body.png', 'left'],
    ['無序.六刃', '/elf-art/wuxu_liuren_body.png', 'right'],
    ['星光·雷納多', '/seer/body/4937.png', 'left'],
    ['恐懼的化身·咤克斯', '/seer/body/2648.png', 'left'],
    ['變革·馬爾修斯', '/seer/body/3393.png', 'left'],
    ['未知圖', '/custom/unverified.png', 'front'],
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
    if (facing !== 'front') assert.notEqual(img.style.transform, render(target, 'body', side === 'p1' ? 'p2' : 'p1').querySelector('img')!.style.transform);
    assert.equal(render(owner, 'head').querySelector('img')!.style.transform, '');
    // URL direction remains authoritative even if a copied appearance is renamed.
    assert.equal(render({ ...target, name: '任意改名' }).querySelector('img')!.style.transform, mirror ? 'scaleX(-1)' : '');
    assert.equal(endIllusion(ctx), true);
    assert.equal(render(owner).querySelector('img')!.getAttribute('src'), '/custom/owner.png');
  }
});

test("coordinate contract: P1 faces screen-right, P2 faces screen-left, exactly one mirror", () => {
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
    assert.equal(shouldMirrorBattleSprite(name, "p1", true, "/custom/replacement.png"), false);
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

test("front-facing art and unclassified user paths are never mirrored", () => {
  const frontFacing = [
    "六界神王",
  ];

  for (const name of frontFacing) {
    assert.equal(shouldMirrorBattleSprite(name, "p1"), false, `${name}: P1 front art stays unchanged`);
    assert.equal(shouldMirrorBattleSprite(name, "p2"), false, `${name}: P2 front art stays unchanged`);
  }

  assert.equal(shouldMirrorBattleSprite("unknown user art", "p1", true), false);
  assert.equal(shouldMirrorBattleSprite("unknown user art", "p2", true), false);
  assert.equal(shouldMirrorBattleSprite("unverified battle art", "p1"), false, "unverified art is not guessed as left-facing");
  assert.equal(shouldMirrorBattleSprite("unverified battle art", "p2"), false, "unverified art is not guessed as left-facing");
  assert.equal(shouldMirrorBattleSprite("皮特薩拉羅", "p1", true), false, "custom path keeps its original direction");
  assert.equal(shouldMirrorBattleSprite("皮特薩拉羅", "p2", true), false, "custom path keeps its original direction");
});

test("battle sprite scale responds meaningfully to biological height", () => {
  assert.ok(battleSpriteScale("small", 110) < battleSpriteScale("medium", 180));
  assert.ok(battleSpriteScale("medium", 180) < battleSpriteScale("large", 500));
  assert.equal(battleSpriteScale("unknown", 0), 1);
  assert.equal(battleSpriteScale("unknown", 100000), 1);
  assert.equal(battleSpriteScale("恐懼的化身·咤克斯", 180), 1.08);
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
    assert.equal(shouldMirrorBattleSprite(name, "p1", false, "/seer/body/5010.png"), true);
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
  // 幻域競技場暫用圖（使用者確認）：P1 鏡射、P2 原圖
  for (const [n, id] of [["無為龍者", 4661], ["龍錄天鋒", 4903], ["無極聖武", 4800], ["命運龍輪 莫伊萊", 4275]] as const) {
    assert.equal(shouldMirrorBattleSprite(n, "p1", false, `/seer/body/${id}.png`), true);
    assert.equal(shouldMirrorBattleSprite(n, "p2", false, `/seer/body/${id}.png`), false);
  }
});
