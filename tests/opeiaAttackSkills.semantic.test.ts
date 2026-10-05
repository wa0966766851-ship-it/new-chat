import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { calculateDamage } from '../src/utils/damageCalculator';
import { timedRecoveryMultiplier, reactToTimedAttack } from '../src/battle/timedReactions';
import { skillTypeMultiplier } from '../src/battle/skillTypeOverride';

const wait = { name: '蟲后攻擊驗收等待', type: '普通', category: '屬性', power: 0, pp: 30, maxPp: 30, priority: -5, description: '' };
const make = (id: string): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
  maxHp: 100000, currentHp: 100000, calculatedStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 200 },
  baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 },
  statStages: {}, effects: [], skills: [{ ...wait }] });

for (const side of ['p1', 'p2'] as const) {
  const a = make('formula'), t = make('defender');
  a.type = '蟲'; t.type = '火';
  const skill: any = { ...wait, category: '特殊', power: 160, type: '蟲' };
  const weak = skillTypeMultiplier({}, skill.type, t.type);
  assert.ok(weak > 0 && weak < 1);
  const calc = (reg: any, defender = t) => calculateDamage(a, defender, skill, side, undefined, undefined, 1, false,
    [], [], undefined, undefined, undefined, side === 'p1' ? reg : {}, side === 'p2' ? reg : {});
  const normal = calc({ noResistedThisAction: true });
  assert.equal(normal.typeMultiplier, 1);
  assert.equal(normal.damage, calc({ noResistedThisAction: true }, { ...t, type: '普通' }).damage,
    '不微弱在公式取整前處理，不能把已取整的微弱傷害除回去');
  const lowered = { ...t, calculatedStats: { ...t.calculatedStats, spdef: 7500 } };
  assert.equal(calc({ ignoreSpDefPercentUntilSwitch: 0.25 }).damage, calc({}, lowered).damage);
  assert.ok(Number.isFinite(calc({ ignoreSpDefPercentUntilSwitch: 1 }).damage), '忽略100%特防仍至少1');
  const timers: any[] = [{ id: 'bound', remaining: 1, ownerBattleId: t.id, scope: 'elf',
    payload: { recoveryReductionPercent: 1, onAttackReceivedTruePercent: 0.3 } }];
  assert.equal(timedRecoveryMultiplier(timers, t), 0);
  assert.equal(timedRecoveryMultiplier(timers, make('next')), 1);
  assert.equal(timedRecoveryMultiplier([{ ...timers[0], pendingActivation: true }], t), 1);
  const calls: any[] = [];
  const ctx: any = { actor: side, targetSide: side === 'p1' ? 'p2' : 'p1', target: t,
    p1Timers: side === 'p2' ? timers : [], p2Timers: side === 'p1' ? timers : [],
    applyTrueDamage: (...args: any[]) => calls.push(args) };
  for (const kind of ['fixed', 'percent', 'true', 'skill_attribute', 'skill_extra_action']) reactToTimedAttack(ctx, kind);
  assert.equal(calls.length, 0, '受攻擊限定，不能因其他技能/粉傷/白傷遞迴');
  reactToTimedAttack(ctx, 'skill_attack');
  assert.equal(calls.length, 1); assert.equal(calls[0][1], 30000);
}

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, SVGElement: dom.window.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: (f: any) => setTimeout(f, 0), cancelAnimationFrame: clearTimeout });
(window as any).__BATTLE_FAST__ = true;
(globalThis as any).__BATTLE_SEED__ = 751;
const { createRoot } = await import('react-dom/client');
const root = createRoot(document.getElementById('root')!);
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
let checks = 0;
try {
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { DEFAULT_ELVES } = await server.ssrLoadModule('/src/data/defaultElves.ts');
  const { getStatuses } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const { getSoulMarkRegistry, getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const souls = getSoulMarkRegistry(), skills = getBattleSkillRegistry();
  const original = souls['蟲后·奧佩婭'];
  let driver: any;
  const opeia = (name: string) => {
    const template = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === '5018'));
    const skill = template.skills.find((s: any) => s.name === name);
    assert.ok(skill, name);
    return { ...template, ...make('5018'), name: template.name, type: '蟲', skills: [skill, { ...wait }] };
  };
  async function mount(key: string, side: string, self: any, enemy: any, bench: any[] = []) {
    await act(async () => root.render(React.createElement(Battle, { key,
      initialP1Team: side === 'p1' ? [self, ...bench] : [enemy], initialP2Team: side === 'p2' ? [self, ...bench] : [enemy],
      p1StarterId: side === 'p1' ? self.id : enemy.id, p2StarterId: side === 'p2' ? self.id : enemy.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
  }
  async function turn(side: string, index = 0, enemyIndex = 0) {
    const before = driver.getSyncState().turnNumber;
    await act(async () => {
      driver.onSkillSelect('p1', driver.getSyncState().p1.skills[side === 'p1' ? index : enemyIndex]);
      driver.onSkillSelect('p2', driver.getSyncState().p2.skills[side === 'p2' ? index : enemyIndex]);
    });
    for (let i = 0; i < 250 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.equal(driver.getSyncState().turnNumber, before + 1);
  }
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    let baseline = 0;
    for (const [hp, factor] of [[100000, 1], [40000, 2], [20000, 3]]) {
      const self = opeia('王.噬心毒蝕'), enemy = make(`toxic-${side}`), receipts: any[] = [];
      self.currentHp = hp; enemy.currentHp = 80000;
      souls[enemy.name] = (_c: any, event: string, data: any) => {
        if (event === 'BEFORE_STATUS_APPLY') data.prevented = true;
        if (event === 'ON_DAMAGED') receipts.push(data.receipt);
        return false;
      };
      await mount(`toxic-${side}-${hp}`, side, self, enemy);
      const start = driver.getSyncState()[side];
      const selfLost = Math.floor((start.maxHp - start.currentHp) / 2);
      await turn(side);
      const attack = receipts.filter(r => r?.damageType === 'skill_attack');
      const pink = receipts.filter(r => r?.damageType === 'percent');
      assert.equal(attack.length, 1);
      if (factor === 1) baseline = attack[0].settledAmount;
      assert.equal(attack[0].settledAmount, baseline * factor, `${side}只選2/3倍而非相乘，分類只限技能`);
      assert.deepEqual(pink.map(r => r.requestedAmount), [10000, selfLost], '两段百分比，均打對手且按使用時失血快照');
      assert.equal(pink[0].settledAmount, 10000, '低血技能增傷不污染百分比附加');
      assert.ok(!receipts.some(r => r?.damageType === 'true'));
      delete souls[enemy.name]; checks++;
    }
    // 附加效果無效：主傷害及固有效果仍正常，不能照常附加百分比或低血倍率。
    const invalid = opeia('王.噬心毒蝕'), invalidEnemy = make(`invalid-${side}`), invalidReceipts: any[] = [];
    invalid.currentHp = 20000;
    souls[invalidEnemy.name] = (c: any, event: string, data: any) => {
      if (event === 'ON_ENTRANCE') c.addTimerTo(c.targetSide, { id: 'invalid-attack', name: '驗收附加失效',
        kind: 'use_counter', source: 'mechanic', remaining: 1, tickAt: 'never', payload: { block: { addInvalid: '攻擊' } } }, false);
      if (event === 'BEFORE_STATUS_APPLY') data.prevented = true;
      if (event === 'ON_DAMAGED') invalidReceipts.push(data.receipt);
      return false;
    };
    await mount(`invalid-${side}`, side, invalid, invalidEnemy); await turn(side);
    assert.equal(invalidReceipts.filter(r => r?.damageType === 'skill_attack').length, 1);
    assert.equal(invalidReceipts.filter(r => r?.damageType === 'percent').length, 0);
    delete souls[invalidEnemy.name]; checks++;

    const ppSelf = opeia('王.噬心毒蝕'), ppEnemy = make(`pp-${side}`);
    ppSelf.skills[0].maxPp = 5;
    ppSelf.skills[0].pp = 3; ppSelf.skills[0].currentPp = 3;
    ppSelf.skills[1].pp = 1; ppSelf.skills[1].currentPp = 1;
    ppSelf.skills.push({ ...wait, name: '已滿技能', pp: 30, currentPp: 30 });
    ppEnemy.skills.push({ ...wait, name: '敵方不足2PP', pp: 1, currentPp: 1 });
    souls[ppEnemy.name] = (_c: any, event: string, data: any) => { if (event === 'BEFORE_STATUS_APPLY') data.prevented = true; return false; };
    await mount(`pp-${side}`, side, ppSelf, ppEnemy); await turn(side);
    assert.deepEqual(driver.getSyncState()[side].skills.map((s: any) => s.pp), [5, 3, 30], '每招恢復2且不能超過PP上限');
    assert.deepEqual(driver.getSyncState()[side].skills.map((s: any) => s.currentPp), [5, 3, 30], 'PP雙欄一致');
    assert.equal(driver.getSyncState()[other].skills[1].pp, 0, '敵方不足2點扣至0，不負PP');
    delete souls[ppEnemy.name]; checks++;

    for (const clearable of [false, true]) {
      const self = opeia('王·鏽腑喰心'), enemy = make(`rust-${side}-${clearable}`), receipts: any[] = [];
      self.statStages = { spatk: -2, accuracy: -1, def: 2 }; enemy.type = '火'; enemy.currentHp = 80000;
      // 敵方的可消除效果在主伤害命中時附加，避免被蟲后中毒失敗分支提前消掉。
      souls[enemy.name] = (c: any, event: string, data: any) => {
        if (event === 'BEFORE_STATUS_APPLY') data.prevented = true;
        if (event === 'ON_DAMAGED') {
          receipts.push(data.receipt);
          if (clearable && data.damageType === 'skill_attack') c.addTimerTo(c.actor, { id: 'clear-me', name: '待消除效果',
            kind: 'turn_effect', source: 'skill', remaining: 3, tickAt: 'round_end' }, false);
        }
        return false;
      };
      skills['蟲后束縛驗收'] = (c: any) => {
        c.applyHeal(c.actor, 1000);
        c.applyPinkDamage(c.actor, 100, '驗收固定', undefined, undefined, 'fixed');
        c.applyPinkDamage(c.actor, 100, '驗收百分比', undefined, undefined, 'percent');
        c.applyTrueDamage(c.actor, 100, '驗收真傷');
        c.applyPinkDamage(c.actor, 100, '驗收反射攻擊', undefined, undefined, 'skill_attack');
        c.applyStatusWithImmunityCheck(c.targetSide, '燒傷', 3);
        c.applyStatusWithImmunityCheck(c.targetSide, '凍傷', 3);
      };
      enemy.skills = [{ ...wait, name: '蟲后束縛驗收' }, { ...wait }];
      await mount(`rust-${side}-${clearable}`, side, self, enemy, [make('rust-bench')]);
      assert.equal(driver.getSyncState()[`${side}RegistryState`].teamEntranceHistory['5018'], 1);
      await turn(side);
      const state = driver.getSyncState();
      assert.equal(state[side].statStages.spatk, 0); assert.equal(state[side].statStages.accuracy, 0);
      assert.equal(state[side].statStages.def, 2, '解除能力下降不消除提升');
      assert.ok(receipts.some(r => r?.damageType === 'fixed' && r.requestedAmount === 400));
      assert.equal(receipts.filter(r => r?.damageType === 'true' && r.requestedAmount === 30000).length, 1,
        '使用後的綁定計時只因後續攻擊附加一次30%真傷，不被施放本招/粉傷/白傷遞迴');
      assert.equal(receipts.find(r => r?.damageType === 'skill_attack')?.damageType, 'skill_attack');
      assert.ok(!state[`${other}Timers`].some((t: any) => t.id === 'opeia_rust_bound'), '先手1回合於本回合結束到期');
      assert.ok(!state[`${side}Timers`].some((t: any) => t.id === 'opeia_rust_next_status'), '一次型免疫觸發後消耗，不延續為永久免疫');
      assert.equal((getStatuses(state[side])['燒傷'] || 0) > 0, !clearable, '消除成功才免疫下一次燒傷');
      assert.ok(getStatuses(state[side])['凍傷'] > 0, '第二次異常不再被一次型免疫攔下');
      // 敵方1000恢復被減至0；把所有傷害receipt合計可直接查出是否偷偷回血。
      assert.equal(state[other].currentHp, 80000 - receipts.reduce((sum, r) => sum + (r?.hpLost || 0), 0));
      const before = state.turnNumber;
      await act(async () => {
        if (side === 'p1') { driver.onSwitchElf(side, 1); driver.onSkillSelect(other, driver.getSyncState()[other].skills[1]); }
        else { driver.onSkillSelect(other, driver.getSyncState()[other].skills[1]); driver.onSwitchElf(side, 1); }
      });
      for (let i = 0; i < 250 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
      assert.equal(driver.getSyncState().turnNumber, before + 1);
      assert.equal(driver.getSyncState()[side].id, 'rust-bench');
      assert.ok(!driver.getSyncState()[`${side}RegistryState`].ignoreSpDefPercentUntilSwitch, '忽略特防不串给下一隻');
      assert.deepEqual(driver.getSyncState()[`${other}RegistryState`].teamEntranceHistory, {}, '未擊敗時下場重置對方登場紀錄');
      assert.equal(driver.getSyncState()[`${side}RegistryState`].teamEntranceHistory['5018'], undefined, '未擊敗時重置自身登場紀錄');
      const backRound = driver.getSyncState().turnNumber;
      await act(async () => {
        if (side === 'p1') { driver.onSwitchElf(side, 0); driver.onSkillSelect(other, driver.getSyncState()[other].skills[1]); }
        else { driver.onSkillSelect(other, driver.getSyncState()[other].skills[1]); driver.onSwitchElf(side, 0); }
      });
      for (let i = 0; i < 250 && driver.getSyncState().turnNumber === backRound; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
      assert.equal(driver.getSyncState().turnNumber, backRound + 1);
      assert.equal(driver.getSyncState()[`${side}RegistryState`].opeiaRustEntranceBonus, 1, '重新登場僅1次，不能復用舊累加');
      assert.equal(driver.getSyncState()[`${side}RegistryState`].ignoreSpDefPercentUntilSwitch, 0.25);
      delete souls[enemy.name]; delete skills['蟲后束縛驗收']; checks++;
    }
  }
  souls['蟲后·奧佩婭'] = original;
  console.log(`蟲后兩招攻擊：公式/分類/個體計時斷言及${checks}個P1/P2真實引擎情境通過。`);
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
