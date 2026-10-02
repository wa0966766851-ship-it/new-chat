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
  ];

  for (const name of leftFacing) {
    assert.equal(shouldMirrorBattleSprite(name, "p1"), true, `${name}: P1 must mirror left-facing art`);
    assert.equal(shouldMirrorBattleSprite(name, "p2"), false, `${name}: P2 must preserve left-facing art`);
  }
});

test("front-facing art and unclassified user paths are never mirrored", () => {
  const frontFacing = [
    "天蓬元帥八戒",
    "譜尼",
    "混沌·布萊克",
    "變革·馬爾修斯",
    "人皇·帝辛",
    "治癒.龍魂再臨 次元龍",
    "蓓麗安特",
    "無序.六刃",
    "無序·蝕言",
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
