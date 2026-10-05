import assert from "node:assert/strict";
import { normalizeElfStats, calculateElfStats } from "../src/utils/elfStats";
import { applyEquipmentToTeam } from "../src/data/suitsAndEyewears";
import { createExtraElf } from "../src/utils/extraElf";
import { bindMarkToElf, markAppliesToElf } from "../src/battle/marks";
import { switchBattleSide, writeScopedRegistry, readScopedRegistry, addScopedTimer } from "../src/battle/stateScopes";
import { battleReducer } from "../src/components/BattleManager";
import { buildStateAPIs, applyActiveGateTimersToDamage } from "../src/battle/contextBuilders";

let passed = 0;
function test(name: string, fn: () => void) { fn(); passed++; console.log(`✓ ${name}`); }
const base = { hp: 120, atk: 170, def: 125, spatk: 170, spdef: 125, speed: 140 };
function elf(id: string): any {
  return { id: "same-species", battleId: id, name: id, level: 100, baseStats: base,
    calculatedStats: calculateElfStats(base), maxHp: 444, currentHp: 300,
    skills: [{ name: `${id}-skill`, pp: 4 }], marks: [], statStages: {}, battleStatuses: {} };
}
function fixture(): any {
  const a = elf("a"), b = elf("b"), x = elf("x"), y = elf("y");
  return { p1: a, p2: x, p1Team: [a, b], p2Team: [x, y], p1ActiveIndex: 0, p2ActiveIndex: 0,
    p1RegistryState: {}, p2RegistryState: {}, p1Timers: [], p2Timers: [], p1Marks: [], p2Marks: [] };
}
function mark(id: string, extra: any = {}): any {
  return { id, count: 2, displayChar: "印", name: id, source: "test", description: "test", ...extra };
}
function timer(id: string, kind: string = "turn_effect", extra: any = {}): any {
  return { id, name: id, kind, source: "skill", remaining: 2, tickAt: "round_end", ...extra };
}

test("缺失面板與上限時重算正式能力，不製造100體力", () => {
  const raw = { name: "舊自訂精靈", level: 100, baseStats: base };
  const result = applyEquipmentToTeam([raw])[0];
  assert.equal(result.maxHp, calculateElfStats(base).hp);
  assert.notEqual(result.maxHp, 100);
  assert.equal((raw as any).calculatedStats, undefined);
});
test("預覽100與死亡0上限不能污染下一場，重複套用不累加面板", () => {
  for (const hp of [0, 100]) {
    const raw = { ...elf("a"), maxHp: hp, calculatedStats: { ...base, hp } };
    const once = applyEquipmentToTeam([raw])[0];
    const twice = applyEquipmentToTeam([once])[0];
    assert.deepEqual(once.calculatedStats, calculateElfStats(base));
    assert.deepEqual(twice.calculatedStats, once.calculatedStats);
  }
});
test("合法僅面板格式仍可100；無正式資料則明確拒絕，不能假造面板", () => {
  assert.equal(normalizeElfStats({ calculatedStats: { ...base, hp: 100 } }).maxHp, 100);
  assert.throws(() => normalizeElfStats({ name: "損壞資料", maxHp: 0 }), /缺少完整/);
});
for (const side of ["p1", "p2"] as const) {
  test(`${side}正常換人隔離個體計數、清短期旗標；回場保留原持有者資料`, () => {
    const state = fixture(), original = state[side];
    state[`${side}RegistryState`] = { scarlettOriginalMaxHp: 1234, puniBoostUses: 3, immuneStatusTurns: 2,
      skillDamageBoost: 0.7, nextElfBlessing: true, chanStacks: 2 };
    const next = switchBattleSide(state, side, 1);
    assert.equal(next[side].maxHp, state[`${side}Team`][1].maxHp);
    assert.equal(next[`${side}RegistryState`].scarlettOriginalMaxHp, undefined);
    assert.equal(next[`${side}RegistryState`].skillDamageBoost, undefined);
    assert.equal(next[`${side}RegistryState`].nextElfBlessing, true);
    assert.equal(next[`${side}RegistryState`].chanStacks, 2);
    assert.equal(readScopedRegistry(next, side, original, "scarlettOriginalMaxHp"), 1234);
    const back = switchBattleSide(next, side, 0);
    assert.equal(back[`${side}RegistryState`].puniBoostUses, 3);
    assert.equal(back[`${side}RegistryState`].immuneStatusTurns, undefined);
    assert.deepEqual(state[`${side}ElfState`], undefined, "不原地污染輸入狀態");
  });
  test(`${side}正常與死亡強制換人使用相同隔離規則`, () => {
    const state = fixture();
    state[side].currentHp = 0;
    state[`${side}RegistryState`] = { wuxuLiurenOriginalMaxHp: 444 };
    const normal = battleReducer(state, { type: "SET_ACTIVE_INDEX", side, index: 1 });
    const forced = battleReducer(state, { type: "FORCED_SWITCH", side, index: 1, newElf: state[`${side}Team`][1] });
    assert.deepEqual(forced, normal);
    assert.equal(forced[`${side}RegistryState`].wuxuLiurenOriginalMaxHp, undefined);
  });
}
test("個體回合/次數計時器不傳下一隻，陣營鎖切仍保留", () => {
  let state = fixture();
  state = addScopedTimer(state, "p1", state.p1, timer("temporary"));
  state = addScopedTimer(state, "p1", state.p1, timer("charges", "use_counter"));
  state = addScopedTimer(state, "p1", state.p1, timer("lock", "turn_effect", { payload: { lockSwitch: true } }));
  const next = switchBattleSide(state, "p1", 1);
  assert.deepEqual(next.p1Timers.map((t: any) => t.id), ["lock"]);
  const back = switchBattleSide(next, "p1", 0);
  assert.deepEqual(back.p1Timers.map((t: any) => t.id).sort(), ["charges", "lock"]);
});
for (const side of ['p1', 'p2'] as const) test(`${side}明確個體鎖切優先於舊陣營預設，強制换人後不串位`, () => {
  let state = fixture();
  state = addScopedTimer(state, side, state[side], timer('personal-lock', 'turn_effect',
    { scope: 'elf', persistsOffField: false, payload: { lockSwitch: true } }));
  assert.equal(state[`${side}Timers`][0].ownerBattleId, state[side].battleId);
  assert.equal(state[`${side}Timers`][0].scope, 'elf');
  const next = battleReducer(state, { type: 'FORCED_SWITCH', side, index: 1, newElf: state[`${side}Team`][1] });
  assert.equal(next[`${side}Timers`].length, 0);
  assert.equal(switchBattleSide(next, side, 0)[`${side}Timers`].length, 0, '回場不復活已清的鎖切');
});
test("板凳新增計時器只能寫進自己的銀行，不覆蓋在場者", () => {
  const state = fixture();
  const next = addScopedTimer(state, "p1", state.p1Team[1], timer("bench"));
  assert.equal(next.p1Timers.length, 0);
  assert.equal(next.p1ElfState.b.timers[0].id, "bench");
});
test("真實傷害閘門忽略其他持有者，即使側清單殘留亦不吃減傷", () => {
  const state = fixture();
  state.p2Timers = [timer("foreign", "round_counter", { ownerBattleId: "y", payload: { applyMode: "gate", wraps: "damage_reduce", percent: 50 } })];
  const comp: any = { base: 100, multiplier: 1, decreasePercent: 0 };
  applyActiveGateTimersToDamage("p1", "p2", comp, () => {}, { current: state });
  assert.equal(comp.decreasePercent, 0);
  state.p2Timers[0].ownerBattleId = "x";
  applyActiveGateTimersToDamage("p1", "p2", comp, () => {}, { current: state });
  assert.equal(comp.decreasePercent, 0.5);
});
// 真實傷害 API 會讀取 Vite 的 import.meta.glob 註冊表，需由 Vite 載入而非偽造註冊表。
const { createServer } = await import("vite");
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const { buildDamageAPIs } = await vite.ssrLoadModule("/src/battle/contextBuilders.ts");
  test("實際附加傷害不套用板凳增傷／易傷，原持有者上場才生效", () => {
  const ref = { current: fixture() };
  ref.current.p1Marks = [bindMarkToElf(mark("boost", { effects: { nonTrueDamageDealtMultiplier: 2 } }), ref.current.p1Team[1])];
  ref.current.p2Marks = [bindMarkToElf(mark("vulnerable", { effects: { nonTrueDamageTakenMultiplier: 3 } }), ref.current.p2Team[1])];
  const api = buildDamageAPIs({ side: "p1", self: ref.current.p1, syncStateRef: ref, pushEffect: () => {},
    getBattleEventContext: () => ({ self: ref.current.p2, target: ref.current.p1, getPlayerState: () => undefined, getMarks: () => [] }) } as any);
  assert.equal(api.applyPinkDamage("p2", 100, "test"), 100);
  ref.current = switchBattleSide(ref.current, "p1", 1);
  ref.current = switchBattleSide(ref.current, "p2", 1);
  assert.equal(api.applyPinkDamage("p2", 100, "test"), 600);
  });
} finally { await vite.close(); }
test("合法下一隻追蹤與已傳遞技能保留；離開指定持有者才停止追蹤", () => {
  const state = fixture();
  state.p1RegistryState = { wuxuBladeReviveTrackingElf: "b", wuxuBladeReviveTrackingActive: true,
    wuxuBladeReviveTrackingTurns: 0, clearOnSwitch: ["wuxuBladeReviveTrackingActive"] };
  state.p1Team[1].skills = [{ name: "明文傳遞技能", pp: 20 }];
  const next = battleReducer(state, { type: "FORCED_SWITCH", side: "p1", index: 1, newElf: state.p1Team[1] });
  assert.equal(next.p1.skills[0].name, "明文傳遞技能");
  assert.equal(next.p1RegistryState.wuxuBladeReviveTrackingActive, true);
  assert.equal(switchBattleSide(next, "p1", 0).p1RegistryState.wuxuBladeReviveTrackingActive, false);
});
test("下場保留是同隻保留，不是狄盧/凱爾德/詩章傳給下一隻", () => {
  for (const id of ["delu_shackles", "keld_soul", "poem_chapter"]) {
    const state = fixture();
    state.p1Marks = [bindMarkToElf(mark(id), state.p1)];
    const next = switchBattleSide(state, "p1", 1);
    assert.equal(next.p1.marks.length, 0);
    assert.equal(next.p1Marks.length, 1);
    assert.equal(markAppliesToElf(next.p1Marks[0], next.p1), false);
    assert.equal(switchBattleSide(next, "p1", 0).p1.marks[0].id, id);
  }
});
test("恐懼種子/花、陣營怨念、燦界聖芒合法繼承不受破壞", () => {
  for (const id of ["fear_seed", "fear_flower", "demon_grudge", "scarlett_holy_light"]) {
    const state = fixture();
    const m = bindMarkToElf(mark(id), state.p1);
    assert.equal(m.ownerBattleId, undefined);
    state.p1Marks = [m];
    assert.equal(switchBattleSide(state, "p1", 1).p1.marks[0].id, id);
  }
});
test("未明示下場保留的印記離場移除；同名不同持有者不互相覆蓋", () => {
  const state = fixture();
  state.p1Marks = [bindMarkToElf(mark("temporary"), state.p1),
    bindMarkToElf(mark("keld_soul"), state.p1), bindMarkToElf(mark("keld_soul", { count: 1 }), state.p1Team[1])];
  const next = switchBattleSide(state, "p1", 1);
  assert.equal(next.p1Marks.some((m: any) => m.id === "temporary"), false);
  assert.equal(next.p1.marks[0].count, 1);
  assert.equal(switchBattleSide(next, "p1", 0).p1.marks[0].count, 2);
});
test("神降負體力與個體存活規則下場保留，但不傳給下一隻", () => {
  const state = fixture();
  state.p1.currentHp = -700;
  state.p1.survivalRule = { kind: "rey_god_descent" };
  const next = switchBattleSide(state, "p1", 1);
  assert.equal(next.p1.survivalRule, undefined);
  assert.equal(next.p1Team[0].currentHp, -700);
  assert.deepEqual(switchBattleSide(next, "p1", 0).p1.survivalRule, state.p1.survivalRule);
});
test("板凳 Registry 寫入不串在場；同種族不同戰鬥身分分開保存", () => {
  const state = fixture();
  const next = writeScopedRegistry(state, "p1", state.p1Team[1], { count: 7, teamHeal: 2 });
  assert.equal(readScopedRegistry(next, "p1", next.p1, "count"), undefined);
  assert.equal(readScopedRegistry(next, "p1", next.p1Team[1], "count"), 7);
  assert.equal(next.p1RegistryState.teamHeal, 2);
});
test("真實 Context 板凳更新及印記預設綁定不誤寫在場者", () => {
  const ref = { current: fixture() };
  const self = ref.current.p1Team[1];
  const api = buildStateAPIs({ side: "p1", self, opp: ref.current.p2, isP1: true,
    targetSide: "p2", syncStateRef: ref, dispatch: () => {}, pushEffect: () => {} } as any);
  api.setPlayerState("count", 9);
  api.updateElf("p1", { currentHp: 77 });
  api.setMark(mark("keld_soul"));
  assert.equal(ref.current.p1.currentHp, 300);
  assert.equal(ref.current.p1Team[1].currentHp, 77);
  assert.equal(api.getPlayerState("count"), 9);
  assert.equal(api.getMarks("p1")[0].ownerBattleId, "b");
  assert.equal(markAppliesToElf(ref.current.p1Marks[0], ref.current.p1), false);
  assert.equal(ref.current.p1.marks.length, 0);
  assert.equal(ref.current.p1Team[1].marks[0].ownerBattleId, "b");
  api.updateElf("p1", { battleId: "missing", currentHp: 1 });
  assert.equal(ref.current.p1.currentHp, 300);
});
test("移除場下印記不能由精靈舊快照於回場時復活", () => {
  const state = fixture();
  const m = bindMarkToElf(mark("keld_soul"), state.p1Team[1]);
  state.p1Marks = [m];
  state.p1Team[1].marks = [m];
  const removed = battleReducer(state, { type: "SET_MARKS", side: "p1", marks: [] });
  assert.equal(switchBattleSide(removed, "p1", 1).p1.marks.length, 0);
});
test("重開戰鬥會清空上一場個體銀行", () => {
  const state = fixture();
  state.p1ElfState = { old: { registry: { count: 99 }, timers: [] } };
  assert.deepEqual(battleReducer(state, { type: "RESET_BATTLE", initialState: {} }).p1ElfState, {});
});
test("找不到延遲更新的身分時忽略，不能退回覆蓋當前技能", () => {
  for (const side of ["p1", "p2"] as const) {
    const state = fixture();
    assert.equal(battleReducer(state, { type: "UPDATE_ELF", side, targetId: "missing", elf: { skills: [] } }), state);
  }
});
test("額外精靈不能複製召喚者戰鬥私有狀態，明確覆寫仍有效", () => {
  const parent = { ...elf("a"), marks: [mark("keld_soul")], statStages: { atk: 6 }, shield: 700,
    deathImmunity: true, survivalRule: { kind: "rey_god_descent" }, globalPpUnlimited: true };
  const child = createExtraElf(parent, { name: "怨靈", maxHp: 100, skills: [] }) as any;
  assert.deepEqual(child.marks, []);
  assert.equal(child.statStages.atk, 0);
  assert.equal(child.shield, 0);
  assert.equal(child.survivalRule, undefined);
  assert.equal(child.deathImmunity, undefined);
  assert.equal(child.globalPpUnlimited, undefined);
  assert.equal(child.currentHp, 100);
  assert.notEqual(child.battleId, parent.battleId);
  assert.equal(createExtraElf(parent, { name: "指定", shield: 80 }).shield, 80);
});
console.log(`作用域語意測試：${passed}項通過`);
