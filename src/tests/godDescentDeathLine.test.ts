// Regression: god-descent floor is a DEATH line (<=), not a clamp.
// All values are derived from the rule formula; no literal 70 in the assertions.
import assert from "node:assert/strict";
import { checkElfDead } from "../battle/elfAlive";
import {
  godDescentFloor,
  reyGodDescentRule,
  resolveDamageTransition,
  liurenSurvivalRule,
  standardSurvivalRule,
  isAliveBySurvivalRule,
} from "../battle/survivalRules";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };

const mkElf = (over: Record<string, unknown> = {}) => ({
  id: "5029",
  battleId: "rey",
  name: "異境神霆·雷伊",
  currentHp: 0,
  maxHp: 1000,
  survivalRule: reyGodDescentRule(1000),
  deathImmunity: undefined,
  ...over,
}) as any;

t("Floor is derived from rule.floorMult and scales with current maxHp", () => {
  const rule = reyGodDescentRule(1000);
  const floor = godDescentFloor(rule, 1000);
  assert.equal(floor, -70 * 1000);
  // maxHp change is picked up immediately (formula-driven, no snapshot).
  assert.equal(godDescentFloor(rule, 1), -70 * 1);
  // Legacy rule with only minHp still works.
  const legacy = { mode: "god_descent", active: true, preserveOffField: true, minHp: -70000 } as any;
  assert.equal(godDescentFloor(legacy, 1000), -70000);
  // Non-god rules report 0 floor (used by the positive death-line gate).
  assert.equal(godDescentFloor(liurenSurvivalRule(), 1000), 0);
});

t("hp > floor survives; hp == floor dies (<=, equality included)", () => {
  const rule = reyGodDescentRule(1000);
  const floor = godDescentFloor(rule, 1000);
  assert.equal(checkElfDead(mkElf({ currentHp: floor + 1 })), false);
  assert.equal(checkElfDead(mkElf({ currentHp: floor })), true);
  assert.equal(checkElfDead(mkElf({ currentHp: floor - 1 })), true);
});

t("General death immunity still blocks the god-descent death line", () => {
  const rule = reyGodDescentRule(1000);
  const floor = godDescentFloor(rule, 1000);
  assert.equal(checkElfDead(mkElf({ currentHp: floor, deathImmunity: { guardTurns: 0, deathImmuneTurns: 3 } })), false);
  assert.equal(checkElfDead(mkElf({ currentHp: floor, deathImmunity: { guardTurns: 0, deathImmuneTurns: 0 } })), true);
});

t("Negative currentHp is preserved (display is not normalized to zero)", () => {
  const elf = mkElf({ currentHp: -70 });
  assert.equal(elf.currentHp, -70, "the raw value must stay negative for the HUD");
  assert.equal(checkElfDead(elf), false, "maxHp=1000 -> floor=-70000, so -70 is still alive");
  assert.equal(checkElfDead(mkElf({ currentHp: -70, maxHp: 1 })), true, "maxHp=1 -> floor=-70 -> death");
});

t("Screenshot case: maxHp compressed to 1, hp pinned at -70", () => {
  const rule = reyGodDescentRule(1);
  const elf = mkElf({ currentHp: -70, maxHp: 1, survivalRule: rule });
  assert.equal(godDescentFloor(rule, 1), -70);
  assert.equal(checkElfDead(elf), true, "-70/1 must now be dead");
  // The negative number itself is still available for rendering.
  assert.equal(elf.currentHp, -70);
});

t("Crossing zero: the entering hit uses god-descent settlement", () => {
  const rule = reyGodDescentRule(1000);
  const outcome = resolveDamageTransition(100, 1000, 5000, "non_true", rule);
  assert.equal(outcome.ignoredDamage, true, "non-true damage is nullified");
  assert.equal(outcome.enteredNonPositive, true, "crossing zero enters god descent");
  assert.equal(outcome.hp, -700, "settled as -70% maxHp adjustment, not the raw damage");
  assert.equal(outcome.alive, true, "not yet at the death line");
});

t("Reaching the floor during a hit reports not alive (fatal-resist pipeline can run)", () => {
  const rule = reyGodDescentRule(1000);
  const floor = godDescentFloor(rule, 1000);
  const trueHit = resolveDamageTransition(floor + 10, 1000, 50, "true", rule);
  assert.equal(trueHit.hp, floor);
  assert.equal(trueHit.alive, false);
  const nonTrueHit = resolveDamageTransition(floor + 10, 1000, 50, "non_true", rule);
  assert.equal(nonTrueHit.hp, floor);
  assert.equal(nonTrueHit.alive, false);
});

t("True damage is NOT converted to the -70% adjustment", () => {
  const rule = reyGodDescentRule(1000);
  const out = resolveDamageTransition(-100, 1000, 350, "true", rule);
  assert.equal(out.hp, -450, "normal true-damage subtraction");
  assert.equal(out.ignoredDamage, false);
});

t("Other survival modes are untouched", () => {
  assert.equal(checkElfDead(mkElf({ survivalRule: liurenSurvivalRule(), currentHp: 0 })), false);
  assert.equal(checkElfDead(mkElf({ survivalRule: standardSurvivalRule(), currentHp: 0 })), true);
  assert.equal(isAliveBySurvivalRule(0, liurenSurvivalRule()), true);
});

t("Positive death-line gate still takes precedence over negative survival rules", () => {
  // naifenForms contract: held positive death line does not override a negative rule,
  // but a zero-floor rule still applies it. Both are exercised here.
  const god = mkElf({ currentHp: 300, maxHp: 1000, survivalRule: reyGodDescentRule(1000), heldDeathFloorRatio: 0.3 });
  assert.equal(checkElfDead(god), false, "negative rule keeps the holder alive");
  const freeze = mkElf({ currentHp: 300, maxHp: 1000, survivalRule: liurenSurvivalRule(), heldDeathFloorRatio: 0.3 });
  assert.equal(checkElfDead(freeze), true, "zero-floor rule still applies 30% death line");
});

console.log(`\nGod-descent death-line regression: ${passed}/${passed} passed`);
