import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { reductionPolicy, addDamageReduction, multiplyDamageReduction, applyStatusDamageModifiers, applyMarkDamageReductions, applyThresholdDamageReductions, finalizeDamageReductions } from '../src/battle/damageReduction';
import { ATOMS } from '../src/effects/effectRunner';
import { applyOutgoingSkillRestriction, applyAdvancedDamageModifiers } from '../src/battle/advancedDamageModifiers';
import { recordDamageHpCeilings, capCurrentHp } from '../src/battle/hpCeiling';
import { applyActiveGateTimersToDamage } from '../src/battle/damageGates';
import { handleCanglanSoulMark } from '../src/effects/elves/canglan/registry';
import { handleMarsSoulMark } from '../src/effects/elves/mars/registry';
import { handleDimensionalSoulMark } from '../src/effects/elves/dimensional-dragon/registry';
import { createHarness } from './helpers/migrationHarness';
import { runDixinFormation } from '../src/effects/elves/dixin/formation';
import { runSideTimers } from '../src/blocks/runtime';
import { settlementReceipt } from '../src/battle/settlementReceipt';
import { createSkillStone, toSSStone } from '../src/data/skillStones';

let checks = 0;
const check = (label: string, fn: () => void) => { fn(); checks++; };
const kinds = ['skill_attack', 'skill_attribute', 'skill_extra_action', 'skill', 'fixed', 'percent', 'true'];
const elf = (id: string): any => ({ id, battleId: id, name: id, type: '普通', currentHp: 900, maxHp: 1000,
  skills: [], calculatedStats: { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, statStages: {}, effects: [], battleStatuses: {} });
const state = (): any => ({ p1: elf('a'), p2: elf('b'), p1Marks: [], p2Marks: [], p1Timers: [], p2Timers: [], p1RegistryState: {}, p2RegistryState: {} });
const comp = (kind: string): any => ({ base: 1000, increasePercent: 0, decreasePercent: 0, multiplier: 1, damageCategory: kind, isIncoming: true });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function fixture(side: 'p1' | 'p2', reg: Record<string, any> = {}) {
  let st = state();
  let round = 1;
  const other = side === 'p1' ? 'p2' : 'p1';
  const calls: any[] = [];
  const c: any = { actor: side, targetSide: other, get self() { return st[side]; }, get target() { return st[other]; },
    get activeP1() { return st.p1; }, get activeP2() { return st.p2; }, get p1Timers() { return st.p1Timers; }, get p2Timers() { return st.p2Timers; },
    get roundNumber() { return round; }, getPlayerState: (k: string) => reg[k], setPlayerState: (k: string, v: any) => reg[k] = v,
    getOpponentState: () => 0, setOpponentState: () => {}, getStatuses: (e: any) => e.battleStatuses,
    getMarks: (s: string) => st[`${s}Marks`], setMark: (m: any, s = side) => { st[`${s}Marks`] = [m]; },
    addTimerTo: (s: string, t: any) => { st[`${s}Timers`] = [...st[`${s}Timers`].filter((x: any) => x.id !== t.id), { ...t, ownerBattleId: t.ownerBattleId || st[s].id }]; },
    consumeTimer: (s: string, id: string) => { st[`${s}Timers`] = st[`${s}Timers`].flatMap((t: any) => t.id !== id ? [t] : t.remaining > 1 ? [{ ...t, remaining: t.remaining - 1 }] : []); },
    addLog: () => {}, updateElf: (s: string, patch: any) => Object.assign(st[s], patch), adjustHp: (s: string, n: number) => st[s].currentHp += n,
    applyHeal: (s: string, n: number) => calls.push(['heal', s, n]), applyPinkDamage: () => 0,
    applyTrueDamage: (s: string, n: number, _l: string, _a: any, _b: any, opts: any) => { calls.push(['true', s, n]); opts?.onSettled(settlementReceipt({ operation: 'damage', targetBattleId: st[s].id, requestedAmount: n, settledAmount: n, hpBefore: 10, hpAfter: 0 })); },
  };
  return { c, reg, calls, get st() { return st; }, set st(v) { st = v; }, set round(v: number) { round = v; }, other };
}

for (const side of ['p1', 'p2'] as const) for (const kind of kinds) {
  const st = state(), e = st[side];
  st[`${side}Timers`] = [{ id: '99', remaining: 2, ownerBattleId: e.id, payload: { damageReductionOverridePercent: 99 } }];
  check(`${side}/${kind}/99只改受到減傷`, () => {
    const d = comp(kind); d.reductionPolicy = reductionPolicy(st, side, e, kind);
    addDamageReduction(d, 0); near(d.decreasePercent, 0);
    addDamageReduction(d, .2); near(d.decreasePercent, kind === 'true' ? 0 : .99);
    multiplyDamageReduction(d, .5, false); near(d.multiplier, kind === 'true' ? 1 : .5);
    multiplyDamageReduction(d, .5); near(d.multiplier, kind === 'true' ? 1 : .005);
    d.pure = true; const before = d.multiplier; multiplyDamageReduction(d, .5); near(d.multiplier, before);
  });
  check(`${side}/${kind}/千秋比例按持有者與技能分支`, () => {
    for (const count of [0, 1, 2, 4]) {
      st[`${side}Marks`] = [{ id: 'blk_千秋一淚', ownerBattleId: e.id, count }];
      const d = comp(kind); d.reductionPolicy = reductionPolicy(st, side, e, kind); multiplyDamageReduction(d, .5);
      const skill = kind.startsWith('skill');
      near(d.multiplier, kind === 'true' ? 1 : 1 - .99 * (skill ? .5 ** Math.floor(count / 2) : 1));
      st[`${side}Marks`][0].ownerBattleId = 'same-name-other-instance';
      near(reductionPolicy(st, side, e, kind).attenuation, 1);
    }
  });
  check(`${side}/${kind}/腐朽不抹攻擊者自己的降傷`, () => {
    e.battleStatuses = { 腐朽: 2 };
    const d = comp(kind); d.reductionPolicy = reductionPolicy(st, side, e, kind);
    multiplyDamageReduction(d, .5); near(d.multiplier, kind === 'true' || kind === 'skill_attack' ? 1 : .01);
    multiplyDamageReduction(d, .5, false); near(d.multiplier, kind === 'true' ? 1 : kind === 'skill_attack' ? .5 : .005);
  });
  check(`${side}/${kind}/魂印減傷分類`, () => {
    const f = fixture(side, { dimensionalDragonStacks: 5, dimensionalDmgReduction: .4 });
    const d = comp(kind);
    f.st[`${side}Marks`] = [{ id: 'poem_chapter', count: 5, ownerBattleId: f.c.self.id, effects: { poemHpSnapshots: [1000, 1000, 1000, 1000, 1000] } }];
    handleDimensionalSoulMark(f.c, 'BEFORE_DAMAGE', d);
    const skill = kind.startsWith('skill');
    near(d.multiplier, skill ? .3 : 1);
    assert.equal(f.reg.dimensionalDmgReduction, skill ? 0 : .4);
    const water = fixture(side);
    const wd = comp(kind); handleCanglanSoulMark(water.c, 'BEFORE_DAMAGE', wd);
    near(wd.multiplier, skill ? .5 : 1);
  });
}
for (const side of ['p1', 'p2'] as const) {
  check(`${side}/gate真減傷99而不是對手造成半傷99`, () => {
    const st = state(); const other = side === 'p1' ? 'p2' : 'p1';
    st[`${side}Timers`] = [{ remaining: 2, payload: { damageReductionOverridePercent: 99 } },
      { id: 'incoming', remaining: 2, payload: { applyMode: 'gate', wraps: 'damage_reduce', params: { percent: 50, damageTypes: ['non_true'] } } }];
    const d = comp('fixed'); applyActiveGateTimersToDamage(other, side, d, () => {}, { current: st }); near(d.decreasePercent, .99);
    st[`${side}Timers`][0].ownerBattleId = 'other'; const otherComp = comp('fixed');
    applyActiveGateTimersToDamage(other, side, otherComp, () => {}, { current: st }); near(otherComp.decreasePercent, .5);
  });
  check(`${side}/技能傷害附屬類狀態範圍`, () => {
    const a = elf('a'), b = elf('b'); b.battleStatuses = { 星佑: 2 };
    for (const kind of kinds) {
      const d = comp(kind); applyStatusDamageModifiers(d, a, b); near(d.multiplier, kind.startsWith('skill') ? .7 : 1);
    }
  });
  check(`${side}/咒怨僅攻擊；霜光不串位`, () => {
    const st = state(); st[`${side}Marks`] = [{ id: 'demon_grudge', count: 3, scope: 'team' },
      { id: 'frost_glow', count: 1000, ownerBattleId: st[side].id, effects: { thresholdDamageReduction: { thresholdRatio: .1, multiplier: .5, damageTypes: ['fixed', 'percent'] } } }];
    for (const kind of kinds) {
      const d = comp(kind); applyMarkDamageReductions(d, st, side, st[side]); applyThresholdDamageReductions(d, st, side, st[side]);
      near(d.decreasePercent, kind === 'skill_attack' ? .15 : 0);
      near(d.multiplier, ['fixed', 'percent'].includes(kind) ? .5 : 1);
    }
    const d = comp('fixed'); d.base = 100; applyThresholdDamageReductions(d, st, side, st[side]); near(d.multiplier, 1);
    d.base = 150; d.flatReduction = 50; applyThresholdDamageReductions(d, st, side, st[side]); near(d.multiplier, 1);
    st[side] = elf('another'); const next = comp('fixed'); applyThresholdDamageReductions(next, st, side, st[side]); near(next.multiplier, 1);
  });
  check(`${side}/馬爾修斯盾罩都需存在、只一次非真傷`, () => {
    for (const [shield, barrier, expected] of [[1, 0, 1], [0, 1, 1], [1, 1, .5]]) {
      const f = fixture(side); Object.assign(f.c.self, { shield, barrier });
      const d = comp('fixed'); handleMarsSoulMark(f.c, 'BEFORE_DAMAGE', d); near(d.multiplier, expected);
      const second = comp('fixed'); handleMarsSoulMark(f.c, 'BEFORE_DAMAGE', second); near(second.multiplier, 1);
    }
    const f = fixture(side); Object.assign(f.c.self, { shield: 1, barrier: 1 });
    const d = comp('true'); handleMarsSoulMark(f.c, 'BEFORE_DAMAGE', d); near(d.multiplier, 1); assert.ok(!f.reg.marsShieldDamageHalvedUsed);
  });
  check(`${side}/帝辛天陣9回合、源綁體力限制及關閉代價`, () => {
    const f = fixture(side);
    f.c.setMark({id:'bahuang_mark',count:9,scope:'elf',ownerBattleId:f.c.self.battleId||f.c.self.id},side);
    runDixinFormation(f.c, 'CHECK_FORMATION'); assert.equal(f.reg.dixinFormationRounds, 9);
    f.c.self.skills = [{ name: 'a', pp: 5, currentPp: 5 }];
    f.c.target.currentHp = 600;
    const d = comp('fixed'); runDixinFormation(f.c, 'BEFORE_DAMAGE', d); assert.equal(d.flatReduction, 400);
    f.st = recordDamageHpCeilings(f.st, f.other, f.c.target, 600);
    near(capCurrentHp(f.st, f.other, f.c.target, 1000), 600); assert.equal(f.c.target.maxHp, 1000);
    f.st = recordDamageHpCeilings(f.st, f.other, f.c.target, 500);
    near(capCurrentHp(f.st, f.other, f.c.target, 900), 500);
    near(capCurrentHp(f.st, f.other, elf('next'), 900), 900);
    const old = f.st[side]; f.st[side] = elf('other-source'); near(capCurrentHp(f.st, f.other, f.c.target, 900), 900); f.st[side] = old;
    for (let r = 2; r <= 10; r++) { f.round = r; runDixinFormation(f.c, 'ROUND_END'); runDixinFormation(f.c, 'ROUND_END'); }
    assert.equal(f.reg.dixinFormationRounds, 0); assert.equal(f.c.self.currentHp, 1); assert.equal(f.c.self.skills[0].currentPp, 0);
    assert.ok(!f.st[`${side}Timers`].some((t: any) => t.id === 'dixin_formation'));
    near(capCurrentHp(f.st, f.other, f.c.target, 900), 900);
    assert.ok(f.st[`${side}Timers`].some((t: any) => t.pendingActivation && t.payload.lockSwitch));
  });
  check(`${side}/次數減傷僅觸發消耗且不跨種類`, () => {
    const f = fixture(side); f.c.addTimerTo(side, { id: 'once', remaining: 1, kind: 'use_counter', payload: { block: { dmgIn: -.5, kind: '技能' } } });
    runSideTimers(f.c, ['incoming'], { damageComp: comp('fixed') }); assert.equal(f.st[`${side}Timers`].length, 1);
    const d = comp('skill_extra_action'); runSideTimers(f.c, ['incoming'], { damageComp: d }); near(d.decreasePercent, .5);
    assert.equal(f.st[`${side}Timers`].length, 0);
  });
}
check('投石者四技能石攻擊增減傷讀取實際特質，含SS名稱', () => {
  const a = elf('a'), b = elf('b');
  for (const e of [a, b]) { e.alienTraits = { gen2Trait: { name: '投石者' } }; e.skills = ['火', '水', '草', '電'].map(t => ({ name: `${t}石之力-SS`, type: t })); }
  for (const kind of kinds) {
    const d = comp(kind); d.reductionPolicy = { override: .99, attenuation: 1 }; applyAdvancedDamageModifiers(d, a, b);
    near(d.increasePercent, kind === 'skill_attack' ? .5 : 0); near(d.multiplier, kind === 'skill_attack' ? .01 : 1);
  }
  a.skills[3] = { name: '火石之力-SS', type: '火' };
  const repeated = comp('skill_attack'); applyAdvancedDamageModifiers(repeated, a, b);
  near(repeated.increasePercent, 0);
});
check('原子以實際造成／受到方向區分99%，不是以self/opponent字面猜', () => {
  const f = fixture('p1');
  const received = comp('fixed'); received.isIncoming = false; received.reductionPolicy = { override: .99, attenuation: 1 };
  ATOMS.damage_reduce({ percent: 50 }, 'opponent', { ...f.c, damageComp: received }); near(received.decreasePercent, .99);
  const outgoing = comp('fixed'); outgoing.reductionPolicy = { override: .99, attenuation: 0 };
  ATOMS.damage_multiplier({ multiplier: .5 }, 'opponent', { ...f.c, damageComp: outgoing }); near(outgoing.multiplier, .5);
});
check('不同來源相乘、同來源加算且最高100%，多個99%不假免疫', () => {
  const d = comp('fixed'); addDamageReduction(d, .2); addDamageReduction(d, .3); near(d.decreasePercent, .44);
  const grouped = comp('fixed'); addDamageReduction(grouped, .2, true, 'same'); addDamageReduction(grouped, .3, true, 'same'); near(grouped.decreasePercent, .5);
  addDamageReduction(grouped, .2, true, 'other'); near(grouped.decreasePercent, .6);
  const override = comp('fixed'); override.reductionPolicy = { override: .99, attenuation: 1 };
  addDamageReduction(override, .2); addDamageReduction(override, .3); near(override.decreasePercent, .9999);
  const group99 = comp('fixed'); group99.reductionPolicy = { override: .99, attenuation: 1 };
  addDamageReduction(group99, .2, true, 'same'); addDamageReduction(group99, .3, true, 'same'); near(group99.decreasePercent, .99);
});
check('黯痕限制涵蓋X系/額外行動；無視限制改輸出減半，不吃受擊99%', () => {
  for (const kind of kinds) for (const ignore of [false, true]) {
    const d = comp(kind); d.reductionPolicy = { override: .99, attenuation: 0 };
    applyOutgoingSkillRestriction(d, { DarkScarTurns: 3, ignoreDamageLimitThisAction: ignore });
    near(d.multiplier, ignore && kind.startsWith('skill') ? .5 : 1);
    assert.equal(d.outgoingLimit, !ignore && kind.startsWith('skill') ? 1 : undefined);
  }
});
const vite = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const { buildDamageAPIs } = await vite.ssrLoadModule('/src/battle/contextBuilders.ts');
  const { getBattleSkillAfterHitRegistry } = await vite.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    check(`${side}/真正API狀態減傷99包含X系、額外行動`, () => {
      const st = state(), effects: any[] = []; st[other].battleStatuses = { 星佑: 2 };
      st[`${other}Timers`] = [{ id: '99', remaining: 2, payload: { damageReductionOverridePercent: 99 } }];
      const api = buildDamageAPIs({ side, self: st[side], syncStateRef: { current: st }, pushEffect: (e: any) => effects.push(e), getBattleEventContext: (owner:any) => {const f=fixture(owner);f.st=st;return {...f.c,getFullTeam:(s:string)=>[st[s]]};} });
      for (const kind of ['skill_attribute', 'skill_extra_action']) {
        effects.length = 0; api.applySkillTypeDamage(other, 1000, 'API驗收', { elem: '普通', category: kind });
        const e = effects.find(e => e.type === 'damage'); assert.equal(e.data.damageType, kind); assert.equal(e.data.amount, 10);
        assert.equal(e.data.reductionPolicy.override, .99);
      }
      effects.length = 0; api.applyFixedDamage(other, 1000); assert.equal(effects.find(e => e.type === 'damage').data.amount, 1000);
    });
    check(`${side}/技能石100%減半有真正runner而非special日誌`, () => {
      const f = fixture(side);
      f.c.self.alienTraits = { gen2Trait: { name: '投石者' } };
      f.c.skill = toSSStone(createSkillStone('聖靈', 'S', '物理', true, 'attr_holy_half'));
      getBattleSkillAfterHitRegistry()[f.c.skill.name](f.c, { hit: true });
      assert.ok(f.st[`${side}Timers`].some((t: any) => t.payload?.wraps === 'damage_reduce'));
      for (const kind of kinds) {
        const d = comp(kind); applyActiveGateTimersToDamage(f.other, side, d, () => {}, { current: f.st });
        near(d.decreasePercent, kind === 'true' ? 0 : .5);
      }
    });
  }
} finally { await vite.close(); }

// ── 5012 冰／5013 凕 已遷真 Kit（舊 handler 空殼）：原兩組單元斷言改以真引擎＋真實精靈魂印 Kit 驅動，斷言數值與原測試一致 ──
{
  const h = await createHarness();
  try {
    const { DEFAULT_ELVES } = await h.server.ssrLoadModule('/src/data/defaultElvesLoaded.ts');
    const real = (id: string) => DEFAULT_ELVES.find((e: any) => String(e.id) === id);
    const holder = (id: string, o: { cur?: number; skills?: any[]; extraSoulKit?: any[]; statuses?: any } = {}) => {
      const u = structuredClone(real(id));
      Object.assign(u, { id: 'S', battleId: 'S', name: '減傷驗收持有者', maxHp: 1000, currentHp: o.cur ?? 900, shield: 0, statStages: {}, battleStatuses: o.statuses || {},
        baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, calculatedStats: { hp: 1000, atk: 300, def: 300, spatk: 300, spdef: 300, speed: 100 }, skills: o.skills || [h.wait(), h.wait()] });
      u.soulMark = structuredClone(real(id).soulMark);
      if (o.extraSoulKit) u.soulMark.kit = [...u.soulMark.kit, ...o.extraSoulKit];
      return u;
    };
    const fixedHit = (n: number, type = '固定') => h.kitSkill('驗收傷害' + n, [{ op: 'dmg', p: { flat: n, type } }]);
    const attacker = (skills: any[]) => h.unit('E', 100000, [...skills, h.wait()], { speed: 300 });
    // 防守方追加的測試用條款：受到固定傷害 +100%（模擬原測試 increasePercent=1，於減免之後才加入的後續增傷）
    const boostEntry = (boost: number) => ({ codeId: 'effect_sequence', source: 'soulmark', role: 'innate', node: 'before_damage', order: 90, customText: '測試用後續增傷',
      params: { clause: { raw: '測試用後續增傷', trig: 'incoming', parsed: true, body: [{ acts: [{ label: 'dmg_mod', op: 'dmg_mod', p: { dir: 'in_boost', kind: '固定', boost } }] }] } } });
    const marks = (st: any, side: string) => Object.fromEntries((st[side + 'Marks'] || []).map((m: any) => [m.id, m.count]));
    for (const side of ['p1', 'p2'] as const) {
      const other = side === 'p1' ? 'p2' : 'p1';
      const run = async (self: any, opp: any, picks: (t: number) => [number, number] = () => [0, 0], turns = 1) => (await h.play(side, { self, opp, turns: (_e, t) => picks(t) }, turns));
      // 柯爾霍德：≥當前體力⅓ → 減60%＋對手得等同減少量的霜寒幽光；不汲取
      {
        const r = (await run(holder('5013'), attacker([fixedHit(300)])))[0];
        assert.equal(r.self.currentHp, 900 - 120, side + ' 高傷：受到 300×0.4=120'); assert.equal(marks(r.state, other).frost_glow, 180, side + ' 對手獲得霜寒幽光＝減少量180');
        assert.equal(r.opp.currentHp, 100000, '高傷分支不汲取');
      }
      // 後續增傷超過門檻才選高傷分支（原 boosted：base200＋增傷100%＝400≥300）
      {
        const r = (await run(holder('5013', { extraSoulKit: [boostEntry(1)] }), attacker([fixedHit(200)])))[0];
        assert.equal(r.self.currentHp, 900 - 160, side + ' 增傷後高傷：400×0.4'); assert.equal(r.opp.currentHp, 100000, '後續增傷超過門檻選高傷分支（不汲取）');
        assert.equal(marks(r.state, other).frost_glow, 240);
      }
      // 低傷分支：<⅓ → 不減傷、汲取傷害值60%（原：299→乘數1、對手真傷179、自身回復179）
      {
        const r = (await run(holder('5013'), attacker([fixedHit(299)])))[0];
        assert.equal(r.self.currentHp, 900 - 299 + 179, side + ' 低傷不減傷、回復60%'); assert.equal(r.opp.currentHp, 100000 - 179, side + ' 汲取對手179');
        assert.equal(marks(r.state, other).frost_glow, undefined, '低傷不產生霜寒幽光');
      }
      // 固定點數減免後不足門檻採低傷汲取（原 flat：400-150=250<300）
      {
        const guard = h.kitSkill('固減', [{ op: 'flat_reduction_uses', p: { flat: 150, uses: 1, kind: '固定' } }]);
        const r = (await run(holder('5013', { skills: [guard, h.wait()] }), attacker([fixedHit(400)]), t => t === 1 ? [0, 1] : [1, 0], 2))[1];
        assert.equal(r.self.currentHp, 900 - 250 + 150, side + ' 固減後250<300：低傷分支汲取60%×250'); assert.equal(r.opp.currentHp, 100000 - 150);
      }
      // 真實傷害不進分流
      {
        const r = (await run(holder('5013'), attacker([fixedHit(299, '真實')])))[0];
        assert.equal(r.self.currentHp, 900 - 299, side + ' 真傷不減免不汲取'); assert.equal(r.opp.currentHp, 100000);
      }
      checks += 5;
      // 柯爾德：受非真實傷害減60%；減免量≥200且有寂殺之魄→凍傷對手；<200→戰鬥階段結束受25%真傷（反噬）；無視減傷不觸發
      {
        const gain = fixedHit(10, '真實'), big = fixedHit(1000);
        const r = await run(holder('5012', { cur: 1000 }), attacker([gain, big]), t => [0, t === 1 ? 0 : 1], 2);
        assert.equal(r[1].self.currentHp, 1000 - 400, side + ' 柯爾德減60%：1000→400'); assert.ok(r[1].opp.battleStatuses?.['凍傷'] > 0 || Object.keys(r[1].opp.battleStatuses || {}).includes('凍傷'), side + ' 擁有寂殺之魄：減免值600≥200→凍傷對手');
        assert.equal(marks(r[1].state, side).keld_soul, 1, '高傷分支不反噬、不額外加魄');
      }
      {
        // 凍傷未觸發（對手免疫異常）→ 消除對手回合類效果＋下2回合對手無法主動切換（原：frostbite 失敗後 clear／next2）
        const gain = fixedHit(10, '真實'), big = fixedHit(1000), immune = h.kitSkill('免疫異常', [{ op: 'immune_status_turns', p: { turns: 4, cls: '', reflect: false } }]);
        const picks: [number, number][] = [[0, 2], [0, 0], [0, 1]];
        const r = await run(holder('5012', { cur: 1000 }), attacker([gain, big, immune]), t => picks[t - 1], 3);
        const oppTimers = (r[2].state[other + 'Timers'] || []).map((t: any) => t.name);
        assert.ok(!oppTimers.includes('免疫異常'), side + ' 凍傷未觸發：消除對手回合類效果（' + oppTimers + '）');
        assert.ok(oppTimers.includes('無法主動切換'), side + ' 凍傷未觸發：下2回合對手無法主動切換（' + oppTimers + '）');
      }
      {
        const boosted = holder('5012', { cur: 1000, extraSoulKit: [boostEntry(9)] });
        const r = (await run(boosted, attacker([fixedHit(100)])))[0];
        assert.equal(r.self.currentHp, 1000 - 400, side + ' 柯爾德減免值含後續增傷：(100×10)×0.4'); assert.equal(marks(r.state, side).keld_soul, undefined, '減免600≥200不反噬');
      }
      {
        const r = (await run(holder('5012', { cur: 1000 }), attacker([fixedHit(100)])))[0];
        assert.equal(marks(r.state, side).keld_soul, 1, side + ' 減免60<200：戰鬥階段結束受25%×1000=250真傷（獲得1道寂殺之魄）'); assert.equal(r.opp.currentHp, 100000 - 500, '反噬真傷觸發汲取對手2倍(500)');
      }
      {
        const r = (await run(holder('5012', { cur: 1000, statuses: { 腐朽: 3 } }), attacker([{ ...h.wait(), name: '驗收物攻', category: '物理', power: 100, isSureHit: true }])))[0];
        assert.equal(marks(r.state, side).keld_soul, undefined, side + ' 無視減傷（腐朽衰減0）：不觸發減免副作用／反噬'); assert.equal(r.opp.currentHp, 100000);
      }
      checks += 5;
    }
  } finally { await h.close(); }
}
console.log(`減傷语意 ${checks} 組通過。`);
