import assert from "node:assert/strict";
import {
  clampGodDescentHp,
  getLostHpRatio,
  getWeightStepPower,
  pickBestReyElement,
  resolveGodDescentHit,
  resolveGodDescentRecovery,
  resolveReyFifthTransformation,
  sumAbsoluteStatStages,
  OTHERWORLD_REY_SKILLS,
} from "../src/effects/otherworldReyRegistry";
import { OTHERWORLD_REY_SEED } from "../src/data/otherworldRey";
import { battleReducer } from "../src/components/BattleManager";
import {
  isAliveBySurvivalRule,
  liurenSurvivalRule,
  reyGodDescentRule,
  resolveDamageTransition,
  resolveRecoveryTransition,
} from "../src/battle/survivalRules";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

test("種族值、身高、體重與五個可選技能符合規格", () => {
  assert.deepEqual(OTHERWORLD_REY_SEED.baseStats, { hp: 120, atk: 170, spatk: 170, def: 125, spdef: 125, speed: 140 });
  assert.equal(Object.values(OTHERWORLD_REY_SEED.baseStats).reduce((a, b) => a + b, 0), 850);
  assert.equal(OTHERWORLD_REY_SEED.height, 185);
  assert.equal(OTHERWORLD_REY_SEED.weight, 70);
  assert.equal(OTHERWORLD_REY_SEED.skills.length, 5);
});

test("二代特質與神明、雷神兩個專屬特質完整分開保存", () => {
  assert.equal(OTHERWORLD_REY_SEED.trait, undefined, "不可再用通用特性欄位保存三項專屬特質摘要");
  assert.equal(OTHERWORLD_REY_SEED.alienTraits?.gen2Trait?.name, "電氣纏繞");
  assert.match(OTHERWORLD_REY_SEED.alienTraits?.gen2Trait?.description || "", /面板原始值的70%/);
  assert.deepEqual(OTHERWORLD_REY_SEED.alienTraits?.exclusiveTraits?.map((trait) => trait.name), ["神明", "雷神"]);
  assert.match(OTHERWORLD_REY_SEED.alienTraits?.exclusiveTraits?.[0].description || "", /體力歸0時進入「神降」/);
  assert.match(OTHERWORLD_REY_SEED.alienTraits?.exclusiveTraits?.[1].description || "", /體力下限不再為0/);
  assert.match(OTHERWORLD_REY_SEED.alienTraits?.exclusiveTraits?.[1].description || "", /神降狀態下場後保留/);
});

test("負血雷伊的延遲技能更新不會覆蓋新上場精靈技能", () => {
  const rey = {
    id: "5029",
    battleId: "rey-1",
    name: "異境神霆·雷伊",
    currentHp: -100,
    skills: [{ name: "空墟赫星", pp: 10 }],
  } as any;
  const nextElf = {
    id: "5003",
    battleId: "next-1",
    name: "天蓬元帥八戒",
    currentHp: 100,
    skills: [{ name: "天河衝擊", pp: 5 }],
  } as any;
  const state = {
    p1: nextElf,
    p1Team: [rey, nextElf],
    p1ActiveIndex: 1,
    p1Marks: [],
  } as any;
  const result = battleReducer(state, {
    type: "UPDATE_ELF",
    side: "p1",
    targetId: "rey-1",
    elf: { skills: [{ name: "空墟赫星", pp: 17 }] as any },
  });
  assert.equal(result.p1.skills[0].name, "天河衝擊");
  assert.equal(result.p1Team[0].skills[0].pp, 17);
  assert.equal(result.p1Team[1].skills[0].name, "天河衝擊");
});

test("同塵祭會把0血與負血直接調整為1點體力", () => {
  for (const hp of [0, -700]) {
    let selfPatch: any = {};
    const ctx = {
      self: { currentHp: hp, statStages: {}, maxHp: 1000 },
      target: { statStages: {}, weight: 0, maxHp: 1000, currentHp: 1000 },
      actor: "p1",
      targetSide: "p2",
      getBody: () => ({ height: 0, weight: 0 }),
      updateElf: (side: string, patch: any) => {
        if (side === "p1") selfPatch = { ...selfPatch, ...patch };
      },
      setOpponentState: () => {},
      getOpponentState: () => 0,
    } as any;
    OTHERWORLD_REY_SKILLS["同塵祭"](ctx);
    assert.equal(selfPatch.currentHp, 1);
  }
});

test("雙方能力等級總和採絕對值", () => {
  const a = { statStages: { atk: 2, def: -3, spatk: 0, spdef: 1, speed: -1, accuracy: 2 } };
  const b = { statStages: { atk: -2, def: 0, spatk: 4, spdef: -1, speed: 0, accuracy: -2 } };
  assert.equal(sumAbsoluteStatStages(a, b), 18);
});

test("重量每滿70才增加70威力且小數捨去", () => {
  assert.equal(getWeightStepPower(69.99), 210);
  assert.equal(getWeightStepPower(70.99), 280);
  assert.equal(getWeightStepPower(140), 350);
});

test("第五技能只在麻痺、固有效果有效且雙攻不相等時轉化", () => {
  assert.equal(resolveReyFifthTransformation({ effectiveAtk: 500, effectiveSpAtk: 400, paralyzed: false }), undefined);
  assert.equal(resolveReyFifthTransformation({ effectiveAtk: 500, effectiveSpAtk: 400, paralyzed: true, inherentInvalid: true }), undefined);
  assert.equal(resolveReyFifthTransformation({ effectiveAtk: 500, effectiveSpAtk: 500, paralyzed: true }), undefined);
  assert.equal(resolveReyFifthTransformation({ effectiveAtk: 500, effectiveSpAtk: 400, paralyzed: true })?.category, "物理");
  assert.equal(resolveReyFifthTransformation({ effectiveAtk: 400, effectiveSpAtk: 500, paralyzed: true })?.category, "特殊");
});

test("第五技能轉化後依對手重量增威力並選最佳克制屬性", () => {
  const transformed = resolveReyFifthTransformation({
    effectiveAtk: 900,
    effectiveSpAtk: 800,
    paralyzed: true,
    defenderType: "水",
    defenderWeight: 209.9,
  });
  assert.ok(transformed);
  assert.equal(transformed.power, 350);
  assert.equal(transformed.type, pickBestReyElement("水"));
});

test("雷神已損體力加成最高70%且不把負體力算成超過上限", () => {
  assert.equal(getLostHpRatio({ currentHp: 1000, maxHp: 1000 }), 0);
  assert.equal(getLostHpRatio({ currentHp: 500, maxHp: 1000 }), 0.5);
  assert.equal(getLostHpRatio({ currentHp: -1000, maxHp: 1000 }), 0.7);
});

test("神降非真傷免疫原傷害並改作-70%最大體力調整", () => {
  assert.equal(resolveGodDescentHit(-100, 1000, 9999, false), -800);
});

test("神降真傷正常扣除且體力下限為-70倍最大體力", () => {
  assert.equal(resolveGodDescentHit(-100, 1000, 350, true), -450);
  assert.equal(resolveGodDescentHit(-69900, 1000, 500, true), -70000);
  assert.equal(clampGodDescentHp({ maxHp: 1000 }, -80000), -70000);
});

test("神降恢復事件取消原恢復，改為+70%最大體力調整", () => {
  assert.equal(resolveGodDescentRecovery(-1000, 1000), -300);
  assert.equal(resolveGodDescentRecovery(-500, 1000), 200);
});

test("六刃與雷伊共用非正體力存活判定", () => {
  assert.equal(isAliveBySurvivalRule(0, liurenSurvivalRule()), true);
  assert.equal(isAliveBySurvivalRule(-700, reyGodDescentRule(1000)), true);
});

test("六刃降至0後，後續任何傷害不再改變體力", () => {
  const entered = resolveDamageTransition(100, 1000, 300, "non_true", liurenSurvivalRule());
  assert.deepEqual({ hp: entered.hp, alive: entered.alive, entered: entered.enteredNonPositive }, { hp: 0, alive: true, entered: true });
  assert.equal(resolveDamageTransition(0, 1000, 99999, "true", liurenSurvivalRule()).hp, 0);
  assert.equal(resolveDamageTransition(0, 1000, 99999, "non_true", liurenSurvivalRule()).hp, 0);
});

test("六刃可從0正常恢復；雷伊神降忽略原恢復量改為70%調整", () => {
  assert.equal(resolveRecoveryTransition(0, 1000, 123, liurenSurvivalRule()).hp, 123);
  const rey = resolveRecoveryTransition(-500, 1000, 99999, reyGodDescentRule(1000));
  assert.equal(rey.hp, 200);
  assert.equal(rey.ignoredRecovery, true);
  assert.equal(rey.exitedGodDescent, true);
});

console.log(`\n異境神霆·雷伊語意測試：${passed}/${passed} 通過`);

