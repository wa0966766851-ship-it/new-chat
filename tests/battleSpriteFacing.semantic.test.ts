import assert from "node:assert/strict";
import test from "node:test";
import { battleSpriteScale, hasRenderableElfImagePath, shouldMirrorBattleSprite } from "../src/battle/seerAssets.ts";

test("known left-facing battle art faces the opponent on both sides", () => {
  const leftFacing = [
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
    "變革·馬爾修斯",
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
