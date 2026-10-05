import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { attackDefenseBypass, bypassesAttackDefense, applyAttackDefenseLimit } from '../src/battle/attackDefense';
import { resolveDamageTransition, reyGodDescentRule, liurenSurvivalRule } from '../src/battle/survivalRules';
import { runSideTimers } from '../src/blocks/runtime';

const rule = { ownerBattleId: 'owner', block: true, conversion: true, limit: true, shield: true };
const owner = { id: 'same', battleId: 'owner' };
for (const kind of ['skill_attack', 'skill_attribute', 'skill_extra_action', 'fixed', 'percent', 'true']) {
  const policy = attackDefenseBypass(owner, { attackDefenseBypassUntilSwitch: rule }, kind);
  assert.equal(!!policy.block, kind === 'skill_attack');
  const comp: any = { base: 100, damageCategory: kind, attackDefenseBypass: policy,
    increasePercent: 0, decreasePercent: .5, multiplier: 0, limit: 10 };
  applyAttackDefenseLimit(comp);
  assert.equal(comp.limit, kind === 'skill_attack' ? undefined : 10);
  assert.equal(comp.multiplier, 0, '無視不把攻擊者自己被封的乘區恢復');
  assert.equal(comp.decreasePercent, .5, '一般減傷保持');
}
assert.deepEqual(attackDefenseBypass({ id: 'same', battleId: 'another' }, { attackDefenseBypassUntilSwitch: rule }, 'skill_attack'), {}, '同名不同個體不得借用旗標');
assert.equal(bypassesAttackDefense(undefined, 'block'), false);
assert.equal(resolveDamageTransition(-100, 1000, 200, 'non_true', reyGodDescentRule(1000), { ignoreNonTrueImmunity: true }).hp, -300);
assert.equal(resolveDamageTransition(-100, 1000, 200, 'non_true', reyGodDescentRule(1000)).hp, -800);
assert.equal(resolveDamageTransition(0, 1000, 200, 'non_true', liurenSurvivalRule(), { ignoreNonTrueImmunity: true }).hp, 0,
  '無視攻擊防護不是消除六刃的死亡條件');

// 實際積木runtime：被無視的防護不能回血／積存抵擋量／扣次數；其他傷害仍依原分類。
for (const type of ['skill_attack', 'skill_attribute', 'skill_extra_action', 'fixed', 'percent', 'true']) {
  for (const block of [{ blockAttack: true }, { blockSkillDmg: true }, { absorbToHeal: true, kind: '攻擊' }]) {
    let healed = 0, consumed = 0, stored = 0;
    const comp: any = { base: 100, increasePercent: 0, decreasePercent: 0, multiplier: 1,
      damageCategory: type, isIncoming: true, attackDefenseBypass: attackDefenseBypass(owner, { attackDefenseBypassUntilSwitch: rule }, type) };
    const ctx: any = { actor: 'p1', self: owner, p1Timers: [{ id: 'guard', remaining: 1, kind: 'use_counter', payload: { block } }],
      consumeTimer: () => consumed++, applyHeal: (_s: string, n: number) => healed += n,
      getPlayerState: () => stored, setPlayerState: (_k: string, n: number) => stored = n, addLog: () => {} };
    runSideTimers(ctx, ['incoming'], { damageComp: comp });
    if (type === 'skill_attack') assert.deepEqual([comp.multiplier, healed, consumed, stored], [1, 0, 0, 0]);
    if ('blockSkillDmg' in block && ['skill_attribute', 'skill_extra_action'].includes(type)) assert.equal(comp.multiplier, 0);
    if (!['skill_attack', 'skill_attribute', 'skill_extra_action'].includes(type)) assert.equal(comp.multiplier, 1);
  }
}

const wait = { name: '防護驗收等待', category: '屬性', type: '普通', power: 0, pp: 30, maxPp: 30, priority: -5, description: '' };
const attack = { ...wait, name: '防護驗收攻擊', category: '特殊', type: '蟲', power: 160, priority: 4, isSureHit: true };
const make = (id: string): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
  maxHp: 100000, currentHp: 80000, calculatedStats: { hp: 100000, atk: 1000, spatk: 1000, def: 1000, spdef: 1000, speed: 200 },
  baseStats: { hp: 100, atk: 100, spatk: 100, def: 100, spdef: 100, speed: 100 },
  statStages: {}, effects: [], skills: [{ ...wait }] });
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
  const { getSoulMarkRegistry, getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { handleShenglingPuniSoulMark } = await server.ssrLoadModule('/src/effects/puniRegistry.ts');
  const souls = getSoulMarkRegistry(), skills = getBattleSkillRegistry();
  let driver: any;
  async function finish(before: number) {
    for (let i = 0; i < 300 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.equal(driver.getSyncState().turnNumber, before + 1);
  }
  async function turn(side: string) {
    const before = driver.getSyncState().turnNumber;
    await act(async () => {
      driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]);
      driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]);
    });
    await finish(before);
  }
  const modes = ['plain', 'immune', 'block', 'skillBlock', 'conversion', 'shield', 'cap', 'guard', 'puni', 'reduce', 'actorStop', 'invalid'];
  for (const side of ['p1', 'p2'] as const) for (const chaos of [false, true]) {
    const other = side === 'p1' ? 'p2' : 'p1';
    let baseline = 0;
    for (const mode of modes) {
      const self = { ...make('opeia-instance'), name: '蟲后·奧佩婭', type: '蟲', skills: [{ ...attack }, { ...wait }] };
      const enemy = make(`defense-${mode}-${side}`), bench = { ...make('chaos-bench'), type: chaos ? '混沌' : '普通' };
      enemy.skills.push({ ...wait, name: '防護驗收備用等待' });
      const receipts: any[] = [];
      souls[enemy.name] = (c: any, ev: string, data: any) => {
        if (ev === 'BEFORE_STATUS_APPLY') data.prevented = true;
        if (ev === 'ON_ENTRANCE') {
          if (mode === 'immune') c.setPlayerState('blockAttackCount', 1);
          if (mode === 'cap') { c.setPlayerState('incomingSkillDmgCapTurns', 3); c.setPlayerState('incomingSkillDmgCap', 1); }
          if (mode === 'puni') c.setPlayerState('puniNextAttackImmune', true);
          if (mode === 'shield') c.updateElf(c.actor, { shield: 99999, barrier: 99999 });
          if (mode === 'guard') c.applyDeathImmunity(c.actor, { guardTurns: 3, deathImmuneTurns: 3, fixedPercentCap: 60 });
          if (mode === 'invalid') c.setOpponentState('allSkillInvalidTurns', 3);
          if (mode === 'actorStop') c.addTimerTo(c.targetSide, { id: 'stop-actor', name: '自身攻擊傷害失效', kind: 'round_counter',
            source: 'soulmark', remaining: 3, tickAt: 'never', payload: { preventAttackDamage: true } }, false);
          const block = mode === 'block' ? { blockAttack: true } : mode === 'skillBlock' ? { blockSkillDmg: true } : mode === 'conversion' ? { absorbToHeal: true, kind: '攻擊' } : null;
          if (block) c.addTimerTo(c.actor, { id: 'defense', name: '驗收防護', kind: 'use_counter', source: 'soulmark',
            remaining: 1, tickAt: 'never', payload: { block } }, false);
        }
        if (ev === 'BEFORE_DAMAGE' && data.isIncoming) {
          if (mode === 'puni') handleShenglingPuniSoulMark(c, ev, data);
          if (mode === 'reduce') data.decreasePercent += .5;
        }
        if (ev === 'ON_DAMAGED') receipts.push(data.receipt);
        return false;
      };
      await act(async () => root.render(React.createElement(Battle, { key: `${side}-${chaos}-${mode}`,
        initialP1Team: side === 'p1' ? [self, bench] : [enemy], initialP2Team: side === 'p2' ? [self, bench] : [enemy],
        p1StarterId: side === 'p1' ? self.id : enemy.id, p2StarterId: side === 'p2' ? self.id : enemy.id,
        battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
      const originalHp = driver.getSyncState()[other].currentHp;
      await turn(side);
      const state = driver.getSyncState(), r = receipts.find(r => r?.damageType === 'skill_attack');
      const settled = r?.settledAmount ?? 0;
      if (mode === 'plain') { assert.ok(settled > 1); baseline = settled; }
      if (chaos && !['plain', 'reduce', 'actorStop', 'invalid'].includes(mode)) {
        assert.equal(settled, baseline, `${side}/${mode}無視只移除防護，不重算/放大傷害`);
        assert.equal(state[other].currentHp, originalHp - settled);
      }
      if (mode === 'immune') assert.equal(state[`${other}RegistryState`].blockAttackCount, chaos ? 1 : 0);
      if (mode === 'block' || mode === 'conversion') assert.equal(state[`${other}Timers`].some((t: any) => t.id === 'defense'), chaos);
      if (mode === 'conversion' && !chaos) assert.equal(state[other].currentHp, originalHp + baseline);
      if (mode === 'shield') {
        assert.equal(state[other].shield, chaos ? 99999 : 99999 - baseline);
        assert.equal(state[other].barrier, 99999);
      }
      if (mode === 'puni') assert.equal(state[`${other}RegistryState`].puniNextAttackImmune, chaos);
      if (mode === 'reduce') assert.equal(settled, Math.floor(baseline * .5), '一般50%減傷不能被無視抵擋抹掉');
      if (['actorStop', 'invalid'].includes(mode)) assert.equal(settled, 0, '不是无視自身傷害失效或技能無效');
      if (!chaos && ['immune', 'block', 'skillBlock', 'conversion', 'guard', 'puni'].includes(mode)) assert.equal(settled, 0);
      if (!chaos && mode === 'cap') assert.equal(settled, 1);
      if (chaos && mode === 'plain') {
        const before = state.turnNumber;
        await act(async () => {
          if (side === 'p1') { driver.onSwitchElf(side, 1); driver.onSkillSelect(other, driver.getSyncState()[other].skills[1]); }
          else { driver.onSkillSelect(other, driver.getSyncState()[other].skills[1]); driver.onSwitchElf(side, 1); }
        });
        await finish(before);
        assert.equal(driver.getSyncState()[`${side}RegistryState`].attackDefenseBypassUntilSwitch, undefined, '下場清除，不傳給下一隻');
      }
      delete souls[enemy.name]; checks++;
    }
  }
  // 正式「星垂穹儀」使用正式一次轉化timer，不再僅寫死鍵。
  const conversionCalls: any[] = [], conversionContext: any = { actor: 'p1', self: make('beliente'), target: make('target'),
    addLog: () => {}, setPlayerState: () => {}, addTimerTo: (...args: any[]) => conversionCalls.push(args) };
  skills['星垂穹儀'](conversionContext);
  assert.equal(conversionCalls[0][1].payload.block.absorbToHeal, true);
  assert.equal(conversionCalls[0][1].payload.block.kind, '攻擊');
  console.log(`攻擊防護：分類/持有者/生存規則/積木斷言及${checks}個P1/P2真實引擎情境通過。`);
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
