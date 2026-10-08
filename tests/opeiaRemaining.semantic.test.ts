import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { countOpeiaTeam } from '../src/effects/elves/opeia/registry';
import { findBlockTimer } from '../src/blocks/runtime';
import { tickTimers } from '../src/battle/timers';
import { applyActiveGateTimersToDamage } from '../src/battle/damageGates';

assert.equal(countOpeiaTeam([{ type: '普通', currentHp: -100, survivalRule: { active: true, mode: 'god_descent' } }]), 1,
  '負血仍存活不能漏掉己方計數');
assert.equal(countOpeiaTeam([{ type: '普通', currentHp: 0, deathImmunity: { deathImmuneTurns: 1 } }], true), 0,
  '零血免死不能誤算敵方陣亡');
assert.equal(findBlockTimer([{ remaining: 2, pendingActivation: true, payload: { block: { prio: 2 } } }], b => b.prio != null), undefined,
  '下回合先制不能在附加當回合提前生效');
for (const side of ['p1', 'p2'] as const) {
  const other = side === 'p1' ? 'p2' : 'p1';
  const state: any = { p1: { id: 'a' }, p2: { id: 'b' }, p1RegistryState: {}, p2RegistryState: {}, p1Timers: [], p2Timers: [] };
  state[`${other}Timers`] = [{ id: 'reduce', remaining: 1, payload: { applyMode: 'gate', wraps: 'damage_multiplier',
    params: { value: 0.5, damageTypes: ['non_true'] } } }];
  const override: any = { id: '99', remaining: 2, tickAt: 'round_end', kind: 'round_counter', payload: { damageReductionOverridePercent: 99 } };
  state[`${side}Timers`] = [override];
  for (const kind of ['skill_attack', 'skill_attribute', 'skill_extra_action', 'fixed', 'percent', 'true']) {
    const comp: any = { base: 1000, damageCategory: kind, multiplier: 1, increasePercent: 0, decreasePercent: 0 };
    applyActiveGateTimersToDamage(other, side, comp, () => {}, { current: state });
    assert.equal(comp.multiplier, kind === 'true' ? 1 : 0.5, `${side}/${kind}對手造成傷害降低不屬於自身受到傷害減傷，不得被99%改寫`);
  }
  state[`${side}Timers`] = tickTimers(tickTimers([override], 'round_end'), 'round_end');
  assert.equal(state[`${side}Timers`].length, 0, '兩回合後99%不永久殘留');
  const comp: any = { damageCategory: 'fixed', multiplier: 1, increasePercent: 0, decreasePercent: 0 };
  applyActiveGateTimersToDamage(other, side, comp, () => {}, { current: state });
  assert.equal(comp.multiplier, 0.5, '到期恢复原50%');
  state[`${side}Timers`] = [{ id: 'taken', remaining: 2, pendingActivation: true,
    payload: { applyMode: 'gate', damageTakenIncreasePercent: 1.5, damageTypes: ['skill', 'fixed', 'percent', 'true'] } }];
  for (const pending of [true, false]) for (const kind of ['skill_attack', 'fixed', 'percent', 'true']) {
    state[`${side}Timers`][0].pendingActivation = pending;
    const comp: any = { damageCategory: kind, multiplier: 1, increasePercent: 0, decreasePercent: 0 };
    applyActiveGateTimersToDamage(other, side, comp, () => {}, { current: state });
    assert.equal(comp.increasePercent, pending ? 0 : 1.5, `${side}/${kind}下一回合開始增傷，不遺漏真傷範圍`);
  }
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
  const { getSoulMarkRegistry, getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { getStatuses } = await server.ssrLoadModule('/src/utils/battleHelpers.ts');
  const souls = getSoulMarkRegistry(), skills = getBattleSkillRegistry();
  const original = souls['蟲后·奧佩婭'];
  let driver: any;
  const wait = { name: '庇護驗收等待', category: '屬性', type: '普通', power: 0, pp: 30, maxPp: 30, description: '' };
  const make = (id: string): any => ({ id, name: id, battleId: id, type: '普通', level: 100,
    maxHp: 100000, currentHp: 100000, calculatedStats: { hp: 100000, atk: 100, def: 10000, spatk: 100, spdef: 10000, speed: 200 },
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }, statStages: {}, effects: [], skills: [{ ...wait }] });
  function opeia(name: string) {
    const template = structuredClone(DEFAULT_ELVES.find((e: any) => e.id === '5018'));
    return { ...template, ...make('5018'), name: template.name, type: '蟲',
      skills: [structuredClone(template.skills.find((s: any) => s.name === name)), { ...wait }] };
  }
  async function mount(key: string, side: string, self: any, enemy: any, bench: any[] = [], enemyBench: any[] = []) {
    await act(async () => root.render(React.createElement(Battle, { key,
      initialP1Team: side === 'p1' ? [self, ...bench] : [enemy, ...enemyBench],
      initialP2Team: side === 'p2' ? [self, ...bench] : [enemy, ...enemyBench],
      p1StarterId: side === 'p1' ? self.id : enemy.id, p2StarterId: side === 'p2' ? self.id : enemy.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
  }
  async function turn(side: string, ownIndex: number, enemyIndex = 0) {
    const before = driver.getSyncState().turnNumber;
    await act(async () => {
      driver.onSkillSelect('p1', driver.getSyncState().p1.skills[side === 'p1' ? ownIndex : enemyIndex]);
      driver.onSkillSelect('p2', driver.getSyncState().p2.skills[side === 'p2' ? ownIndex : enemyIndex]);
    });
    for (let i = 0; i < 250 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.equal(driver.getSyncState().turnNumber, before + 1, '真正結算回合，不以handler呼叫取代');
  }
  for (const side of ['p1', 'p2'] as const) {
    const other = side === 'p1' ? 'p2' : 'p1';
    // 混沌轉移含HP；普通零血/負血存活者仍計數。能力變動不自動回血。
    const self = opeia('蟲群庇護'), donor = make('chaos-donor'), enemyDonor = make('enemy-chaos-donor');
    for (const e of [donor, enemyDonor]) { e.type = '混沌'; e.currentHp = 900; e.maxHp = 1000;
      e.calculatedStats = { hp: 1000, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }; }
    await mount(`chaos-${side}`, side, self, make('neutral'), [donor], [enemyDonor]);
    assert.equal(driver.getSyncState()[side].maxHp, 125280, '六維加成24080＋雙方場下HP600各一次');
    assert.equal(driver.getSyncState()[side].currentHp, 100000, '轉移體力能力值不是恢復體力');
    for (const owner of [side, other]) {
      const e = driver.getSyncState()[`${owner}Team`][1];
      assert.equal(e.maxHp, 400); assert.equal(e.currentHp, 400); assert.equal(e.calculatedStats.atk, 40);
    }
    checks++;

    skills['庇護反彈測試'] = (c: any) => c.applyStatusWithImmunityCheck(c.targetSide, '凍傷', 3);
    const enemy = make('swarm-enemy');
    souls[enemy.name] = (_ctx: any, event: string, data: any) => {
      if (event === 'BEFORE_STATUS_APPLY' && ['中毒', '感染', '害怕'].includes(data.status)) data.prevented = true;
      return false;
    };
    enemy.skills = [{ ...wait, name: '庇護反彈測試' },
      ...Array.from({ length: 5 }, (_, i) => ({ ...wait, name: `庇護等待${i}` }))];
    await mount(`swarm-${side}`, side, opeia('蟲群庇護'), enemy, [make('swarm-bench')], [make('enemy-swarm-bench')]);
    await turn(side, 0);
    let st = driver.getSyncState();
    assert.ok(!getStatuses(st[side])['中毒'], '庇護真正免疫異常');
    assert.ok(!getStatuses(st[side])['凍傷'], '免疫敵方施加的凍傷');
    assert.ok(getStatuses(st[other])['凍傷'] > 0, '反彈必須實際把凍傷施加给對手，不以日誌當證據');
    assert.ok(st.logs.some((l: any) => /反彈/.test(l.message || l.text || '')), JSON.stringify({ logs: st.logs, timers: st[`${side}Timers`], enemy: st[other] }));
    assert.equal(st[`${side}Timers`].find((t: any) => t.id === 'opeia_swarm_priority').remaining, 2, '下2回合不在附加當回合扣除');
    // 鎖切是技能回合效果；若繼續免疫中毒，蟲后魂印會合法把鎖切消除。
    // 此段改為允許中毒，單獨驗證鎖切讀取與側別，不能為測試改成不可清除。
    const denyPoison = souls[enemy.name];
    delete souls[enemy.name];
    await turn(side, 1, 1);
    st = driver.getSyncState();
    assert.equal(Object.values(st[other].statStages).filter((v: any) => v < 0).length, 3, '隨機三個不同能力下降');
    assert.equal(Object.values(st[side].statStages).filter((v: any) => v > 0).length, 3, '實際下降量附加給自身');
    const lock = st[`${other}Timers`].find((t: any) => t.id === 'opeia_swarm_switch_lock');
    assert.ok(lock?.payload?.lockSwitch, '對手未全能力下降，對手受到鎖切限制');
    assert.equal(lock.remaining, 2, '下2回合在本回合結束啟用而不扣期限');
    assert.equal(lock.pendingActivation, false);
    assert.equal(lock.ownerBattleId, st[other].battleId || st[other].id, '鎖定對手個體，不串位');
    assert.ok(!st[`${side}Timers`].some((t: any) => t.payload?.lockSwitch), '蟲后自己不受該句限制');
    await act(async () => driver.onSwitchElf(other, 1));
    assert.equal(driver.getSyncState()[`${other}SwitchIndex`], null, '對手主動切換確實被拒絕');
    souls[enemy.name] = denyPoison;
    await turn(side, 1, 2);
    assert.ok(!driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === 'opeia_swarm_switch_lock'),
      '中毒被免疫後魂印依法消除回合效果，鎖切也一併消除，不改為不可清除');
    for (let i = 3; i <= 5; i++) await turn(side, 1, i);
    assert.ok(!driver.getSyncState()[`${side}Timers`].some((t: any) => t.id === 'opeia_swarm_status'), '免疫反彈5回合後到期，不永久保留');
    checks++;
    delete souls[enemy.name];
    // 繳械會令選中技能PP歸0並阻止該次行動，不能要求同一次還執行反彈測試技能。
    const attacker = make('disarm-enemy');
    souls[attacker.name] = (_ctx: any, event: string, data: any) => {
      if (event === 'BEFORE_STATUS_APPLY' && ['中毒', '感染', '害怕'].includes(data.status)) data.prevented = true;
      return false;
    };
    attacker.skills = [{ ...wait, name: '繳械驗收攻擊', category: '特殊', power: 1, isSureHit: true }];
    await mount(`disarm-${side}`, side, opeia('蟲群庇護'), attacker);
    await turn(side, 0);
    assert.ok(getStatuses(driver.getSyncState()[other])['繳械'] > 0, '敵方攻擊真正觸發繳械');
    assert.equal(driver.getSyncState()[other].skills[0].pp, 0);
    delete souls[attacker.name];
    checks++;

    for (const barrier of [0, 50000]) {
      const self = opeia('蟲后之冠'), enemy = make('crown-enemy'), bench = make('crown-bench');
      enemy.skills = Array.from({ length: 3 }, (_, i) => ({ ...wait, name: `蟲冠等待${i}` }));
      enemy.barrier = barrier; bench.currentHp = 90000;
      const traces: any[] = [];
      souls[enemy.name] = (_ctx: any, event: string, data: any) => {
        if (event === 'BEFORE_STATUS_APPLY') data.prevented = true;
        if (event === 'ON_DAMAGED') traces.push(data.receipt);
        return false;
      };
      await mount(`crown-${side}-${barrier}`, side, self, enemy, [bench]);
      await turn(side, 0);
      const st = driver.getSyncState();
      assert.equal(st[`${side}Timers`].find((t: any) => t.id === 'opeia_crown_drain').remaining, 4,
        '吸取當回合已有收益，先手與後手均扣一次，不額外延長');
      assert.equal(st[`${side}Timers`].find((t: any) => t.id === 'opeia_crown_fixed').remaining, 3);
      assert.equal(st[other].type, '蟲', '执行前真正轉屬性');
      assert.equal(st[side].statStages.atk, 3, '基礎+1及己方蟲與轉化後敵方蟲各+1');
      assert.equal(st[`${side}Team`][1].currentHp, 90200, '高於半血同時恢復場下200');
      assert.equal(st[other].currentHp, barrier ? 99800 : 66367, '護罩阻擋固定傷害時追加真傷200，不能依名目300跳過');
      assert.ok(traces.some(r => r?.damageType === 'percent' && r.requestedAmount === 33333));
      assert.ok(traces.some(r => r?.damageType === 'fixed' && r.requestedAmount === 300));
      assert.equal(traces.some(r => r?.damageType === 'true' && r.requestedAmount === 200), barrier > 0);
      if (!barrier) {
        let invalid = 0;
        const before = souls[enemy.name];
        souls[enemy.name] = (c: any, event: string, data: any) => {
          if (event === 'SKILL_INVALID' && !data.isIncoming) invalid++;
          return before(c, event, data);
        };
        await turn(side, 0, 1);
        assert.equal(invalid, 1, '已為蟲系則下一次技能無效，可在當回合後續節點消耗');
        assert.ok(!driver.getSyncState()[`${other}Timers`].some((t: any) => t.id === 'opeia_crown_next_invalid'));
        const hp = driver.getSyncState()[other].currentHp;
        const round = driver.getSyncState().turnNumber;
        await act(async () => {
          if (side === 'p1') { driver.onSwitchElf(side, 1); driver.onSkillSelect(other, driver.getSyncState()[other].skills[2]); }
          else { driver.onSkillSelect(other, driver.getSyncState()[other].skills[2]); driver.onSwitchElf(side, 1); }
        });
        for (let i = 0; i < 250 && driver.getSyncState().turnNumber === round; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
        assert.equal(driver.getSyncState().turnNumber, round + 1);
        assert.equal(driver.getSyncState()[side].id, bench.id, '正常切換確實完成');
        assert.ok(!driver.getSyncState()[`${side}Timers`].some((t: any) => t.id.startsWith('opeia_crown')), '蟲冠計時不串給下一隻');
        assert.equal(driver.getSyncState()[other].currentHp, hp, '下一隻出手不繼承蟲冠附加傷害');
        checks++;
      }
      delete souls[enemy.name];
      checks++;
    }
    // 低血翻倍採用使用時快照；不能先吸回血後又觸發高血板凳恢復。
    const low = opeia('蟲后之冠'), lowEnemy = make('crown-low-enemy'), lowBench = make('low-bench');
    low.currentHp = 1000; lowBench.currentHp = 90000;
    souls[lowEnemy.name] = (_ctx: any, event: string, data: any) => { if (event === 'BEFORE_STATUS_APPLY') data.prevented = true; return false; };
    await mount(`low-${side}`, side, low, lowEnemy, [lowBench]);
    await turn(side, 0);
    assert.equal(driver.getSyncState()[other].currentHp, 33034, '低血最大體力1/3吸取翻倍，固定300另算');
    assert.equal(driver.getSyncState()[`${side}Team`][1].currentHp, 90000, '不因這次恢復後過半誤觸發另一分枝');
    delete souls[lowEnemy.name]; checks++;

    const combo = opeia('蟲群庇護'), comboEnemy = make('combo-enemy');
    combo.skills = [{ ...wait, name: '蟲后連擊合成驗收', category: '特殊', power: 1, isSureHit: true }];
    const hits: number[] = [], damages: any[] = [];
    skills['蟲后連擊合成驗收'] = (c: any) => c.setPlayerState('attackHitCountThisAction', 5);
    souls['蟲后·奧佩婭'] = (c: any, event: string, data: any) => {
      if (event === 'AFTER_ATTACK_HIT') hits.push(data.hitCount);
      return original(c, event, data);
    };
    souls[comboEnemy.name] = (_ctx: any, event: string, data: any) => {
      if (event === 'BEFORE_STATUS_APPLY') data.prevented = true;
      if (event === 'ON_DAMAGED') damages.push(data);
      return false;
    };
    await mount(`combo-${side}`, side, combo, comboEnemy);
    await turn(side, 0);
    assert.deepEqual(hits, [6, 6, 6, 6, 6, 6], '5連擊＋1，不是直接覆寫成2');
    assert.equal(damages.filter(e => e.damageType === 'skill_attack').length, 1, '6連擊仍然只有一次主傷害結算');
    souls['蟲后·奧佩婭'] = original; delete skills['蟲后連擊合成驗收']; delete souls[comboEnemy.name]; checks++;
  }
  souls['蟲后·奧佩婭'] = original;
  delete skills['庇護反彈測試'];
  console.log(`蟲后剩餘效果：共同分類/期限斷言及${checks}個P1/P2真實引擎情境通過。`);
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
