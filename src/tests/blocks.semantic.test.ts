import assert from "node:assert";
import { DEFAULT_ELVES } from "../data/defaultElves";
import { getSkillProgram, getSoulProgram } from "../blocks/registry";
import { SKILL_MODE, SOUL_MODE } from "../blocks/specs";
import { runSkillProgram, runSoulProgram } from "../blocks/runtime";

let pass = 0;
let fail = 0;

function t(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (error: any) {
    fail++;
    console.log(`  ❌ ${name}\n     ${error.message}`);
  }
}

const baseStages = () => ({ atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0 });

function makeElf(overrides: Record<string, any> = {}) {
  return {
    id: "test",
    name: "測試精靈",
    type: "普通",
    currentHp: 600,
    maxHp: 1000,
    shield: 0,
    barrier: 0,
    statStages: baseStages(),
    battleStatuses: {},
    battleStatus: "normal",
    effects: [],
    skills: [{ name: "測試技能", category: "物理", pp: 5, maxPp: 5 }],
    calculatedStats: { atk: 200, def: 200, spatk: 200, spdef: 200, speed: 200 },
    ...overrides,
  };
}

function makeBlockContext(selfOverrides: Record<string, any> = {}, targetOverrides: Record<string, any> = {}) {
  const self = makeElf({ name: "我方", ...selfOverrides });
  const target = makeElf({ name: "對手", ...targetOverrides });
  const playerState: Record<string, any> = {};
  const opponentState: Record<string, any> = {};
  const statuses: Record<string, string[]> = { p1: [], p2: [] };
  const marks: Record<string, any[]> = { p1: [], p2: [] };
  const timers: Record<string, any[]> = { p1: [], p2: [] };
  const damage = { pink: 0, fixed: 0, true: 0, skill: 0, absorbed: 0 };

  const elfAt = (side: "p1" | "p2") => side === "p1" ? self : target;
  const ctx: any = {
    actor: "p1",
    targetSide: "p2",
    self,
    target,
    activeP1: self,
    activeP2: target,
    p1FullTeam: [self],
    p2FullTeam: [target],
    p1Timers: timers.p1,
    p2Timers: timers.p2,
    skill: { name: "測試技能", category: "物理", description: "" },
    rng: () => 0,
    addLog: () => {},
    trackCodeExec: () => {},
    showPopup: () => {},
    getStatuses: (elf: any) => elf.battleStatuses || {},
    applyStatusWithImmunityCheck: (side: "p1" | "p2", status: string, duration: number) => {
      const elf = elfAt(side);
      elf.battleStatuses = { ...(elf.battleStatuses || {}), [status]: duration };
      statuses[side].push(status);
      return { success: true, immune: false };
    },
    applyHeal: (side: "p1" | "p2", amount: number) => {
      const elf = elfAt(side);
      elf.currentHp = Math.min(elf.maxHp, elf.currentHp + Math.floor(amount));
    },
    applyShield: (side: "p1" | "p2", amount: number) => {
      const elf = elfAt(side);
      elf.shield = (elf.shield || 0) + Math.floor(amount);
    },
    applyStatChange: (side: "p1" | "p2", changes: Record<string, number>) => {
      const elf = elfAt(side);
      for (const [key, value] of Object.entries(changes)) {
        elf.statStages[key] = Math.max(-6, Math.min(6, (elf.statStages[key] || 0) + value));
      }
    },
    updateElf: (side: "p1" | "p2", patch: Record<string, any>) => Object.assign(elfAt(side), patch),
    updateAnyElf: () => {},
    applyPinkDamage: (_side: string, amount: number) => (damage.pink += Math.floor(amount), Math.floor(amount)),
    applyFixedDamage: (_side: string, amount: number) => (damage.fixed += Math.floor(amount), Math.floor(amount)),
    applyTrueDamage: (_side: string, amount: number) => (damage.true += Math.floor(amount), Math.floor(amount)),
    applySkillTypeDamage: (_side: string, amount: number) => (damage.skill += Math.floor(amount), Math.floor(amount)),
    applyPercentDamage: (_side: string, ratio: number) => (damage.pink += Math.floor(target.maxHp * ratio)),
    applyAbsorb: (_side: string, amount: number) => { damage.absorbed += Math.floor(amount); },
    adjustHp: () => {},
    applyDeathImmunity: () => {},
    getPlayerState: (key: string) => playerState[key],
    setPlayerState: (key: string, value: any) => { playerState[key] = value; },
    getOpponentState: (key: string) => opponentState[key],
    setOpponentState: (key: string, value: any) => { opponentState[key] = value; },
    clearTurnEffectsOf: () => true,
    hasTurnEffectOn: () => true,
    addTimerTo: (side: "p1" | "p2", timer: any) => {
      timers[side].push(timer);
      ctx[`${side}Timers`] = timers[side];
    },
    consumeTimer: () => {},
    queueExtraAction: () => {},
    setMark: (mark: any, side: "p1" | "p2" = "p2") => {
      const entry = { ...mark, source: mark.source || self.name };
      const index = marks[side].findIndex(existing => existing.id === entry.id);
      if (index >= 0) marks[side][index] = entry;
      else marks[side].push(entry);
    },
    clearMark: (id: string, side: "p1" | "p2" = "p2") => {
      marks[side] = marks[side].filter(mark => mark.id !== id);
    },
    getMarks: (side: "p1" | "p2") => marks[side],
    shuffleArray: (items: any[]) => items,
    getEligibleTeam: (side: "p1" | "p2") => [elfAt(side)],
    getFullTeam: (side: "p1" | "p2") => [elfAt(side)],
    getFirstStarter: (side: "p1" | "p2") => elfAt(side),
    getNthElf: (side: "p1" | "p2") => elfAt(side),
    getAdjacentElves: () => [],
    getSeparatedElves: () => [],
    vanishElf: () => {},
    addExtraElf: () => {},
  };

  return { ctx, self, target, playerState, opponentState, statuses, marks, timers, damage };
}

function elfById(id: string) {
  const elf = DEFAULT_ELVES.find(item => String(item.id) === id);
  assert.ok(elf, `找不到精靈 ${id}`);
  return elf!;
}

function skillByName(name: string) {
  for (const elf of DEFAULT_ELVES) {
    const skill = elf.skills?.find(item => item.name === name);
    if (skill) return skill;
  }
  assert.fail(`找不到技能 ${name}`);
}

console.log("\n=== 積木登記完整性 ===");

t("8 個積木技能的所有子句皆可解析", () => {
  assert.strictEqual(Object.keys(SKILL_MODE).length, 8);
  for (const name of Object.keys(SKILL_MODE)) {
    const program = getSkillProgram(skillByName(name));
    const unparsed = program.clauses.filter(clause => !clause.parsed);
    assert.deepStrictEqual(unparsed.map(clause => clause.raw), [], `${name} 仍有未解析子句`);
  }
});

t("6 個積木魂印的所有子句皆可解析", () => {
  assert.strictEqual(Object.keys(SOUL_MODE).length, 6);
  for (const id of Object.keys(SOUL_MODE)) {
    const elf = elfById(id);
    const program = getSoulProgram(elf);
    const unparsed = program.clauses.filter(clause => clause.marker !== "§" && !clause.parsed);
    assert.deepStrictEqual(unparsed.map(clause => clause.raw), [], `${elf.name} 魂印仍有未解析子句`);
  }
});

console.log("\n=== 積木技能語意 ===");

t("天河衝擊：消強後全屬性-1，消回合後禁療2回合", () => {
  const h = makeBlockContext({}, { statStages: { ...baseStages(), atk: 2, speed: 1 } });
  h.ctx.skill = skillByName("天河衝擊");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.deepStrictEqual(h.target.statStages, { atk: -1, def: -1, spatk: -1, spdef: -1, speed: -1, accuracy: -1 });
  assert.strictEqual(h.opponentState.p2_noHealTurns, 2);
});

t("翎萬羽歸宗：異常目標使攻擊翻倍並啟用等量回血", () => {
  const h = makeBlockContext({}, { battleStatuses: { 麻痺: 2 } });
  h.ctx.skill = skillByName("翎萬羽歸宗");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use", [3]);
  assert.strictEqual(h.playerState.skillDamageBoost, 2);
  assert.strictEqual(h.playerState.vampireRatio, 1);
});

t("雙重暗影：實際降低防禦並施加害怕", () => {
  const h = makeBlockContext();
  h.ctx.skill = skillByName("雙重暗影");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use");
  assert.strictEqual(h.target.statStages.def, -1);
  assert.ok(h.statuses.p2.includes("害怕"));
});

t("深潛者盛宴：異常存在時3回合技能增傷由50%翻倍為100%", () => {
  const h = makeBlockContext({ battleStatuses: { 混亂: 2 } });
  h.ctx.skill = skillByName("深潛者盛宴");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use", [5]);
  assert.strictEqual(h.timers.p1.length, 1);
  assert.strictEqual(h.timers.p1[0].payload.block.dmgOut, 1);
});

t("贖魂讚詩：消回合成功後施加流血", () => {
  const h = makeBlockContext();
  h.ctx.skill = skillByName("贖魂讚詩");
  runSkillProgram(h.ctx, getSkillProgram(h.ctx.skill), "use", [1]);
  assert.ok(h.statuses.p2.includes("流血"));
});

console.log("\n=== 積木魂印語意 ===");

t("星光·魔焰猩猩登場：為對手附加星火之灼", () => {
  const elf = elfById("5006");
  const h = makeBlockContext({ id: elf.id, name: elf.name });
  runSoulProgram(h.ctx, getSoulProgram(elf), ["entrance"], {});
  assert.ok(h.marks.p2.some(mark => mark.name === "星火之灼" && mark.effects.blkTurns === 3));
});

t("鎮魂.巴弗洛登場：對手窒息且自身混亂", () => {
  const elf = elfById("5008");
  const h = makeBlockContext({ id: elf.id, name: elf.name });
  runSoulProgram(h.ctx, getSoulProgram(elf), ["entrance"], {});
  assert.ok(h.statuses.p2.includes("窒息"));
  assert.ok(h.statuses.p1.includes("混亂"));
});

t("星光·麗莎布布登場：為對手附加星芳之纏", () => {
  const elf = elfById("5011");
  const h = makeBlockContext({ id: elf.id, name: elf.name });
  runSoulProgram(h.ctx, getSoulProgram(elf), ["entrance"], {});
  assert.ok(h.marks.p2.some(mark => mark.name === "星芳之纏" && mark.effects.blkTurns === 3));
});

console.log(`\n${"=".repeat(40)}\n積木語意通過: ${pass}  失敗: ${fail}\n${"=".repeat(40)}`);
if (fail > 0) process.exit(1);
