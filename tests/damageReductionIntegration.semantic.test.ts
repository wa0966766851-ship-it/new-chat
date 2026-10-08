import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

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
const wait: any = { name: '減傷驗收等待', category: '屬性', type: '普通', power: 0, pp: 30, maxPp: 30, priority: -5, description: '' };
const attack = { ...wait, name: '減傷驗收攻擊', category: '特殊', power: 160, priority: 0, isSureHit: true };
const make = (id: string): any => ({ id, battleId: id, name: id, type: '普通', level: 100,
  maxHp: 100000, currentHp: 80000, calculatedStats: { hp: 100000, atk: 10000, spatk: 10000, def: 1000, spdef: 1000, speed: 200 },
  baseStats: { hp: 100, atk: 100, spatk: 100, def: 100, spdef: 100, speed: 100 }, statStages: {}, effects: [], skills: [{ ...wait }] });
let checks = 0;
try {
  const { default: Battle } = await server.ssrLoadModule('/src/components/BattleScreen.tsx');
  const { getSoulMarkRegistry, getBattleSkillRegistry } = await server.ssrLoadModule('/src/effects/battleEventRegistry.ts');
  const { handleDixinSoulMark } = await server.ssrLoadModule('/src/effects/elves/dixin/registry.ts');
  const { handleKeldSoulMark } = await server.ssrLoadModule('/src/effects/elves/keld/registry.ts');
  const { handleKeerhodeSoulMark } = await server.ssrLoadModule('/src/effects/elves/keerhode/registry.ts');
  const souls = getSoulMarkRegistry(), skills = getBattleSkillRegistry();
  let driver: any;
  for (const side of ['p1', 'p2'] as const) for (const mode of ['status', 'gate', 'mark', 'trait', 'resistance', 'dixin_ignore', 'hp_ceiling', 'keld_reduce', 'keerhode_reduce']) {
    const other = side === 'p1' ? 'p2' : 'p1';
    const self = make(`attacker-${side}-${mode}`), enemy = make(`defender-${side}-${mode}`);
    let base = 0; const receipts: any[] = [];
    if (mode === 'dixin_ignore') {
      self.name = '天陣驗收者'; self.skills = [{ ...attack, name: '帝怒傾天', category: '物理' }];
      souls[self.name] = (c: any, ev: string, data: any) => {
        if (ev === 'ON_ENTRANCE') c.setPlayerState('dixinBahuangStacks', 3);
        return handleDixinSoulMark(c, ev, data);
      };
    } else self.skills = [{ ...attack }];
    if (mode === 'trait') enemy.alienTraits = { generalTrait: { name: '堅硬' } };
    if (mode === 'keerhode_reduce') enemy.currentHp = 2000;
    souls[enemy.name] = (c: any, ev: string, data: any) => {
      if (ev === 'ON_ENTRANCE') {
        c.addTimerTo(c.actor, { id: '99', name: '99%驗收', kind: 'round_counter', source: 'soulmark', remaining: 3, tickAt: 'never', payload: { damageReductionOverridePercent: 99 } }, false);
        if (['status', 'dixin_ignore'].includes(mode)) c.updateElf(c.actor, { battleStatuses: { 星佑: 3 } });
        if (mode === 'mark') c.setMark({ id: 'guardian_shield_mark', name: '守護', count: 1, effects: { nonTrueDamageTakenMultiplier: .75, damageTakenTypes: ['attack'] } });
        if (mode === 'gate') c.addTimerTo(c.actor, { id: 'half', name: '減半', kind: 'turn_effect', source: 'skill', remaining: 3, tickAt: 'never', payload: { applyMode: 'gate', wraps: 'damage_reduce', params: { percent: 50, damageTypes: ['attack'] } } }, false);
        if (mode === 'resistance') c.updateElf(c.actor, { resistances: { damageResist: { fixed: 50 } } });
        if (mode === 'hp_ceiling') c.addTimerTo(c.targetSide, { id: 'test_formation', name: '源綁天陣', kind: 'round_counter', source: 'soulmark', remaining: 1, tickAt: 'never', payload: { opponentDamageHpCeiling: true } }, false);
      }
      if (ev === 'BEFORE_DAMAGE' && data.damageCategory === 'skill_attack') base = data.base;
      if (ev === 'ON_DAMAGED') receipts.push(data.receipt);
      if (mode === 'keld_reduce') return handleKeldSoulMark(c, ev, data);
      if (mode === 'keerhode_reduce') return handleKeerhodeSoulMark(c, ev, data);
      return false;
    };
    if (mode === 'resistance') {
      self.skills = [{ ...wait, name: '減傷驗收固傷' }]; skills[self.skills[0].name] = (c: any) => c.applyFixedDamage(c.targetSide, 1000);
    }
    if (mode === 'hp_ceiling') {
      self.skills = [{ ...wait, name: '天陣快照驗收' }];
      skills[self.skills[0].name] = (c: any) => {
        c.applyTrueDamage(c.targetSide, 10000);
        c.applyHeal(c.targetSide, 50000);
        c.adjustHp(c.targetSide, 50000);
      };
    }
    await act(async () => root.render(React.createElement(Battle, { key: `${side}-${mode}`,
      initialP1Team: side === 'p1' ? [self] : [enemy], initialP2Team: side === 'p2' ? [self] : [enemy],
      p1StarterId: side === 'p1' ? self.id : enemy.id, p2StarterId: side === 'p2' ? self.id : enemy.id,
      battleMode: 'PVP', preparedTeams: true, onBackToMenu: () => {}, onDriverInit: (d: any) => driver = d })));
    const before = driver.getSyncState().turnNumber;
    await act(async () => { driver.onSkillSelect('p1', driver.getSyncState().p1.skills[0]); driver.onSkillSelect('p2', driver.getSyncState().p2.skills[0]); });
    for (let i = 0; i < 300 && driver.getSyncState().turnNumber === before; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)); });
    assert.equal(driver.getSyncState().turnNumber, before + 1, `${side}/${mode}確實結算完`);
    const r = receipts.find(r => r?.damageType === (mode === 'resistance' ? 'fixed' : mode === 'hp_ceiling' ? 'true' : 'skill_attack'));
    assert.ok(r, `${side}/${mode}有傷害回饋`);
    if (mode === 'resistance') assert.equal(r.settledAmount, 10, '99%讀取到抗性舊入口');
    else if (mode === 'hp_ceiling') assert.equal(driver.getSyncState()[other].currentHp, 80000, '真傷快照同時限制回血及體力調整，不改maxHp');
    else assert.equal(r.settledAmount, Math.floor(base * (mode === 'dixin_ignore' ? 1 : 1 - .99)), `${side}/${mode}主傷害管線讀取減傷政策`);
    delete souls[self.name]; delete souls[enemy.name]; delete skills['減傷驗收固傷']; delete skills['天陣快照驗收']; checks++;
  }
} finally { await act(async () => root.unmount()); await server.close(); dom.window.close(); }
console.log(`實際對戰減傷 ${checks} 場通過。`);
